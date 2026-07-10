import {FaissStore} from "@langchain/community/vectorstores/faiss";
import {HuggingFaceTransformersEmbeddings} from "@langchain/community/embeddings/hf_transformers";
import {IndexFlatIP} from "faiss-node";


export default class AgentMemoryVectorStore {

    private vectorStore!: FaissStore;

    constructor() {
    }

    async init() {
        //We use HuggingFace Transformers as they run locally and even work directly in the browser. Thus, we can avoid the issue that Ollama can only load one model at once.
        const model = new HuggingFaceTransformersEmbeddings({
            model: "Xenova/all-MiniLM-L6-v2", //model was trained using cosine similarity, so better use also cosine similarity for the vector store index.
        });

        this.vectorStore = await FaissStore.fromDocuments([], model);


        this.vectorStore._index = new IndexFlatIP(384);  //dimension is 384 for MiniLM-L6-v2, 4096 for llama 3, etc.
    }

    getVectorStore(): FaissStore {
        if (!this.vectorStore) {
            throw new Error("AgentMemoryVectorStore not ready! Did you call init()?")
        }
        return this.vectorStore;
    }

}