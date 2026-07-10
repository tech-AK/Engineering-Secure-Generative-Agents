import {Document} from 'langchain/document';
import {RecursiveCharacterTextSplitter} from "langchain/text_splitter";
import fs from "fs";
import path from "path";
import pdf from 'pdf-parse';
import {LLM} from "@langchain/core/language_models/llms";
import {getContextInformationForPDFRetrieval} from "./prompts";
import {FilterData} from "../../common/types/filterData";
import {CacheBackedEmbeddings} from "langchain/embeddings/cache_backed";
import {LocalFileStore} from "langchain/storage/file_system";
import {OpenAIEmbeddings} from "@langchain/openai";
import {MemoryVectorStore} from "langchain/vectorstores/memory";
import {OllamaEmbeddings} from "@langchain/community/embeddings/ollama";
import {HuggingFaceTransformersEmbeddings} from "@langchain/community/embeddings/hf_transformers";

/**
 * This class is responsible for reading the PDF files (research papers) and embedding it (i. e., take the separate research papers and
 * map them into a high-dimensional space where semantic relationships between them can be captured and measured).
 * After that, we can use the method {@link getRelevantContext} to retrieve the most relevant information for the question at hand.
 */
export default class RetrievalAugmentedGeneration {

    PDF_DIRECTORY_PATH = "./server-files/pdfs";
    CACHE_STORAGE_PATH = "./cache-files";

    vectorStore!: MemoryVectorStore;
    titleVectorStore!: MemoryVectorStore;

    constructor(private llm: LLM) {
    }


    /**
     * Reads all PDF documents found in {@link PDF_DIRECTORY_PATH}.
     *
     * @returns A {@link Document} containing the raw text as well as some meta data if available
     */
    private async readDocs(): Promise<Document[][]> {
        const pdfFiles = fs.readdirSync(this.PDF_DIRECTORY_PATH).filter(file => file.endsWith('.pdf'));
        const documents: Document[] = [];
        const title_documents: Document[] = [];

        for (const file of pdfFiles) {
            const filePath = path.join(this.PDF_DIRECTORY_PATH, file);
            const fileBuffer = fs.readFileSync(filePath);
            const data = await pdf(fileBuffer);
            const text = data.text;

            if (data.info.Title === undefined || data.info.Author === undefined) {
                // Having PDF files with correct metadata is a acceptable decision as it increases the accuracy of RAGs.
                // So for now, we do not accept any PDFs without this metadata
                throw new Error(`Missing metadata for file ${file} with Title=${data.info.Title} and Authors=${data.info.Author}`)
            }

            const doc = new Document({
                pageContent: text,
                metadata: { /*fileName: file,*/ Title: data.info.Title, Authors: data.info.Author}
            });
            documents.push(doc);

            const title_doc = new Document( {
                pageContent: data.info.Title
            })
            title_documents.push(title_doc)
        }


        //NOTE: If getting a warning "Warning: TT: undefined function: 32" this is okay, see https://github.com/mozilla/pdf.js/issues/3768#issuecomment-36468349
        console.log(`RAG: ${documents.length} PDF files were found`);
        return [documents, title_documents];
    }

    /**
     * Create Vector Database by reading all PDF documents and embed them into the VectorStore. You need to call this method before using this class.
     */
    async init() {
        try {
            const pdf_content = await this.readDocs();
            const docs = pdf_content[0];
            const titleDocs = pdf_content[1];

            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 3000, //Setting higher chunk size as research paper PDFs often contain lots of other characters
                chunkOverlap: 300, //10 - 20%
            });

            const allSplits = await textSplitter.splitDocuments(docs);
            console.log(`RAG: In total, we have ${allSplits.length} splits`);

            // We use HuggingFaceTransformersEmbeddings as an alternative for Ollama to avoid Ollama having to switch context.
            // Note that HuggingFaceTransformersEmbeddings takes very much memory and CPU for the first initial calculation. , but be aware that consumes lots of CPU
            const embeddings = new HuggingFaceTransformersEmbeddings({
                model: "Xenova/all-MiniLM-L6-v2", //model was trained using cosine similarity, so better use also cosine similarity for the vector store index.
            });


            /*const embeddings = new OllamaEmbeddings({
                baseUrl: process.env.LLM_BASE_URL,
                model: "nomic-embed-text",  //mxbai-embed-large
            });*/

            /*const embeddings = new OpenAIEmbeddings({
                model: "text-embedding-3-large",
            });*/

            const localFileCacheStore = await LocalFileStore.fromPath(this.CACHE_STORAGE_PATH);

            const cacheBackedEmbeddings = CacheBackedEmbeddings.fromBytesStore(
                embeddings,
                localFileCacheStore,
                {
                    namespace: "documentEmbeddings",
                }
            );

            const cacheBackedEmbeddingsForTitleDocs = CacheBackedEmbeddings.fromBytesStore(
                embeddings,
                localFileCacheStore,
                {
                    namespace: "titleDocumentEmbeddings",
                }
            );

            // Unfortunately, for the the Xenova/all-MiniLM-L6-v2 model, the already processed embeddings all remain in memory until all texts have been processed.
            // This can lead to high memory usage. Thus, we add the documents one by one.
            // This is an known issue, see: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/discussions/41
            this.vectorStore = await MemoryVectorStore.fromDocuments(
                [],
                cacheBackedEmbeddings
            );

            //loading each chunk one by one...
            for (let i = 0; i < allSplits.length; i++) {
                console.log(`Adding PDF text chunk no. ${i+1} out of ${allSplits.length}..... This can take a while if the cache is empty, please be patient....`)
                await this.vectorStore.addDocuments([allSplits[i]])
            }


            //we use an additional vector store for all titles in order to calculate the cosine similarity between the original title of the paper and the title that is used e. g. in the current dialog.
            this.titleVectorStore = await MemoryVectorStore.fromDocuments( //memoryVectorStore uses cosine similarity as default similarity metric
                titleDocs, //for the titles, we can load every title at once, as they are quite small
                cacheBackedEmbeddingsForTitleDocs
            );

            console.log(`RAG: DocumentVectorStore was loaded.`);
        } catch (e) {
            console.error(`RAG: Failed to initialize the VectorStore: ${e}`);
        }
    }

    async getFilterConditions(user_input: string, llm: LLM): Promise<FilterData> {
        const prompt = getContextInformationForPDFRetrieval(user_input)
        const result = await llm.invoke(prompt)

        try {
            const json = JSON.parse(result);
            console.log(`[LLM 2: Context Extractor] For the input ${user_input}, we extracted the following JSON: ${JSON.stringify(json)}`);

            return json;
        } catch (e) {
            console.error(`[LLM 2: Context Extractor] Could not parse JSON response from LLM: ${result}`);

            //return dummy filter dict that returns true for every possible paper (as .include("") is always true)
            return {
                title: "",
                authors: ""
            }
        }
    }

    /**
     * This function uses our {@link vectorStore} created to retrieve relevant text snippets from the PDF documents that fit our user_input (the input parameter).
     */
    async getRelevantContext(llm: LLM, last_message: string, full_history: string): Promise<[FilterData, Document[]]> {
        if (!this.vectorStore) {
            throw new Error("DocumentVectorStore not ready! Did you call init()?")
        }

        const filter_json: FilterData = await this.getFilterConditions(last_message, llm);

        if (filter_json.title == "" && filter_json.authors == "") {
            //in this case we do not have any further info. In the most cases, only relying on cosine similarity for finding the research papers does not work
            // and, even worse, does confuse the LLM model. Thus in that case, do not return anything.
            return [filter_json, []];
        }

        /*
        // In case we want to set a minimum threshold (not needed for now):
        const retriever = ScoreThresholdRetriever.fromVectorStore(this.vectorStore, {
            minSimilarityScore: 0.6, // Finds results with at least this similarity score
            maxK: 20, // We have in total 926 splits. Let's use at maximum 20 of them.
            kIncrement: 2, // How much to increase K by each time. It'll fetch N results, then N + kIncrement, then N + kIncrement * 2, etc.
        });*/

        let bestFittingTitle;
        if (filter_json.title != "") {
            const contextFittingTitles = await this.titleVectorStore.similaritySearch(filter_json.title, 1);
            bestFittingTitle = contextFittingTitles[0].pageContent;
        } else {
            bestFittingTitle = ""; //setting string to empty so that every title is true for .includes("")
        }

        const retriever = this.vectorStore.asRetriever({
            k: 3, searchType: "similarity",
            filter: (doc: Document) => {
                return doc.metadata.Title.toString().includes(bestFittingTitle) && doc.metadata.Authors.toString().includes(filter_json.authors)
            }
        });
        //const docs = await this.vectorStore.similaritySearch(user_input);

        const retrievedDocs = await retriever.invoke(last_message); //using only last_message for cost saving purposes
        //console.log(`[RAG] Recieved ${retrievedDocs.length} text extractions fitting to "${full_history}" with the following content:`);
        //console.log(retrievedDocs);

        return [filter_json, retrievedDocs];
    }

}