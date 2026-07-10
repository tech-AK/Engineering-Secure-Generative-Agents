import Controller from "../gameengine/controller";
import GameEngine from "../gameengine";
import GameState from "../../common/state/gamestate";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { AgentMemory, ContextAwareAgentMemory } from "../../common/types/AgentMemory";
import Agent, { AgentEvent } from "../../common/state/agent";
import Message from "../../common/messages/message";
import { Client } from "colyseus";
import { Document } from "langchain/document";
import {importanceScorePrompt, naturalObjectInteractionDescription, summarizeDialogPrompt} from "../llm/prompts";
import { Dialog } from "../../common/types/dialog";
import IObject from "../../common/state/iobject";

export default class MemoryController extends Controller<GameState> {
    // We use the decency memory factor to calculate how aware an agent is of one particular memory after time has passed.
    // A factor of 0.99 means that after one hour, the memory is still almost as relevant as when then memory was created (as 0.99^1 = 0.99)
    // After one day, the memory has a bit more than 3/4 of the awareness it had when the memory was created: (0.99)^24 = 0.7857
    // After three days, the agent is only half so aware of it as when the memory was created: (0.99)^72 = 0.485
    // Thus, using 0.99 seems to be a valid choice. Also (Park et al, 2023) are using it.
    static readonly RECENCY_MEMORY_FACTOR_IN_HOURS = 0.99;


    static readonly WEIGHT_FACTOR_RECENCY = 1;
    static readonly WEIGHT_FACTOR_IMPORTANCE = 1;
    static readonly WEIGHT_FACTOR_RELEVANCE = 1;

    vectorStore: FaissStore;

    constructor(game: GameEngine<GameState>) {
        super(game);
        this.vectorStore = this.game.globalAgentMemoryVectorStore.getVectorStore();
    }

    update(delta: number) {}

    async onMessage(message: Message, client: Client): Promise<Message | void> {}

    /**
     * We use three scores to retrieve the memories fitting the most for the current context (inspired by Park et. al, 2023)
     * (1) Relevance: calculated as the cosine similarity (between each memory embedding vector and the query embedding vector)
     * (2) Recency: calculated as exponential decay function
     * (3) Importance: "calculated" by using the assessment of a LLM
     * @param agent The agent.
     * @param query The query/current context that should be used for getting context-aware memories
     * @param k The number of memories to return. Default is 5.
     * @return A {@link ContextAwareAgentMemory} that contains the top k memories fitting to the context provided by the parameter query.
     */
    async retrieveContextAwareMemories(agent: Agent, query: string, k: number = 5): Promise<ContextAwareAgentMemory[]> {
        try {
            let allAgentMemoriesWithScores: ContextAwareAgentMemory[] = [];

            const totalMemoryEntriesSize = this.vectorStore._index!.ntotal();
            // Unfortunately, the current version of FAISS vector store does not support filtering. But this function will be included soon. For now, just filtering manually after retrieval of all memories. Alternatively, we can think about using multiple vector stores for each agent.

            if (totalMemoryEntriesSize === 0) return [];

            const allAgentMemories = await this.vectorStore.similaritySearchWithScore(query, totalMemoryEntriesSize);

            //Now go through all retrieved memories and calculate the recency, importance and relevance for each memory.
            allAgentMemories.forEach(agentMemory => {
                const doc: Document = agentMemory[0];
                const docMetadata: AgentMemory = doc.metadata as AgentMemory;

                if (docMetadata.agentId == agent.id) {
                    const memory = doc.pageContent;
                    const cos_similarity: number = agentMemory[1];

                    const importance = docMetadata.importance_score;

                    const recency = this.calculateRecency(docMetadata.last_accessed);

                    allAgentMemoriesWithScores.push({
                        memoryDesc: memory,
                        recency: recency,
                        importance: importance,
                        relevance: cos_similarity,
                        docID: docMetadata.memoryId
                    });
                }
            });

            //First normalize all three values and then calculate the total score
            this.calculateNormalizedScore(allAgentMemoriesWithScores);
            this.calculateTotalScore(allAgentMemoriesWithScores);

            //Return the top k values with the highest total score.
            allAgentMemoriesWithScores.sort((a, b) => b.total_score! - a.total_score!);
            const topKMemories = allAgentMemoriesWithScores.slice(0, k); // Slice the top k elements

            //update the last_accessed timestamps for the retrieved memories
            this.updateLastAccessedTimestamp(topKMemories, agent)

            console.log(`[Memory] Following ${k} top memories were retrieved for the query "${query}": ${JSON.stringify(topKMemories)}`);
            return topKMemories;
        } catch (e) {
            console.error(`[Memory] Error while retrieving context-aware memories: ${e}`);
            return [];
        }
    }

    private updateLastAccessedTimestamp(accessed_memories: ContextAwareAgentMemory[], agent: Agent) {
        accessed_memories.forEach(memory => {
            this.saveToVectorStore(agent, memory.memoryDesc, this.state.time, memory.importance, false);
            this.vectorStore.delete({ ids: [memory.docID]} );
        });
    }

    /**
     * We use the function f(x) = (DECENCY_FACTOR)^(time passed) for calculating the recency.
     * @param last_accessed
     */
    private calculateRecency(last_accessed: number) {
        const timePassedInHours = (this.state.time - last_accessed) / (1000 * 60 * 60);
        return Math.pow(MemoryController.RECENCY_MEMORY_FACTOR_IN_HOURS, timePassedInHours);
    }

    private calculateNormalizedScore(memoriesWithScores: ContextAwareAgentMemory[]) {
        const maxRecencyValue = Math.max(...memoriesWithScores.map(obj => obj.recency));
        const maxImportanceValue = Math.max(...memoriesWithScores.map(obj => obj.importance));
        const maxRelevanceValue = Math.max(...memoriesWithScores.map(obj => obj.relevance));

        const minRecencyValue = Math.min(...memoriesWithScores.map(obj => obj.recency));
        const minImportanceValue = Math.min(...memoriesWithScores.map(obj => obj.importance));
        const minRelevanceValue = Math.min(...memoriesWithScores.map(obj => obj.relevance));

        memoriesWithScores.forEach((value: ContextAwareAgentMemory) => {
            value.normalized_recency = this.normalize(value.recency, minRecencyValue, maxRecencyValue);
            value.normalized_importance = this.normalize(value.importance, minImportanceValue, maxImportanceValue);
            value.normalized_relevance = this.normalize(value.relevance, minRelevanceValue, maxRelevanceValue);
        });
    }

    private calculateTotalScore(memoriesWithScores: ContextAwareAgentMemory[]) {
        memoriesWithScores.forEach((value: ContextAwareAgentMemory) => {
            if (value.hasOwnProperty("normalized_recency") && value.hasOwnProperty("normalized_importance") && value.hasOwnProperty("normalized_relevance")) {
                value.total_score = (MemoryController.WEIGHT_FACTOR_RECENCY * value.normalized_recency!) +
                    (MemoryController.WEIGHT_FACTOR_IMPORTANCE * value.normalized_importance!) +
                    (MemoryController.WEIGHT_FACTOR_RELEVANCE * value.normalized_relevance!);
            } else {
                throw new Error("Missing normalized score values! Did you call calculateNormalizedScore() before?")
            }
        });
    }

    private normalize(value: number, min: number, max: number): number {
        return (max - min) != 0 ? (value - min) / (max - min) : 0;
    }

    private async getImportanceScore(memory: string): Promise<number> {
        try {
            const importancePrompt = importanceScorePrompt(memory);
            const importanceScoreLLMResult = await this.game.llm.invoke(importancePrompt);
            //console.log(`IMPORTANCE PROMPT: ${importancePrompt}. Result: ${importanceScoreLLMResult}`)
    
            let importanceScore = parseInt(importanceScoreLLMResult);
            if (isNaN(importanceScore)) {
                let importanceScore = 5; //setting value between 1 and 10, maybe better to use average in future or in case of error retry generation with another LLM/prompt
                console.log(`[Memory] [Importance Score Generator] Error determining importance of ${importancePrompt}!!`)
            }
    
            return importanceScore;
        } catch (e) {
            console.error(`[Memory] [Importance Score Generator] Error determining importance of ${memory}!!`)
            throw e;
        }
    }

    async saveToMemory(agent: Agent, memory: string) {
        await this.saveToVectorStore(agent, memory, this.state.time, await this.getImportanceScore(memory), true)
    }

    async saveToVectorStore(agent: Agent, memory: string, last_accessed: number, importance_score: number, is_new_memory: boolean = false) {
        try {
            const id = Date.now() + agent.id + memory.length + memory.slice(0,3) + Math.floor(Math.random() * 10000) //generating unique ID

            const agentMemoryMetaData: AgentMemory = {
                memoryId: id, //using current timestamp to get unique ID that does not repeat
                agentId: agent.id,
                agentName: agent.name, //we add this entry only for easier debugging (see agent name in the console), might remove later
                last_accessed: last_accessed,
                importance_score: importance_score
            };

            const memoryDocument = new Document({
                pageContent: memory,
                metadata: agentMemoryMetaData,
            })

           await this.vectorStore.addDocuments(
                [memoryDocument],
                {ids: [id]}
           );

            if (is_new_memory) {
                console.log(`[Memory] ${agent.name} has created the following memory: ${JSON.stringify(memoryDocument)}`);
                agent.events.push(AgentEvent.info(`New memory: ${JSON.stringify(memoryDocument.pageContent)}`, "memory"));
            }
        } catch (e) {
            console.error(`[Memory] Error while saving memory: ${e}`);
        }
    }

    async saveObjectInteractionToMemory(observer: Agent, observed_Agent: Agent, first_person_perspective: boolean, object: IObject) {
        try {
        const personAwareDescriptionBeginning =  first_person_perspective ? "I " : `${observed_Agent.name} `;
        const generateNaturalMemoryObjectDescription = naturalObjectInteractionDescription(object);
        const LLMDescription = await this.game.llm.invoke(generateNaturalMemoryObjectDescription);

        await this.saveToMemory(observer, personAwareDescriptionBeginning + LLMDescription.toLowerCase());

        } catch (e) {
            console.error(`[Memory] [Object Interaction Description Genereator] Error generating description for ${object.name}`)
            throw e;
        }
    }

    async saveDialogMemory(agent: Agent, dialog: Dialog) {
        const summaryPrompt = summarizeDialogPrompt(dialog, agent);
        const LLMSummary = await this.game.llm.invoke(summaryPrompt);

        await this.saveToMemory(agent, LLMSummary);
    }

    async saveCurrentLocationMemory(agent: Agent) {
        this.saveToMemory(agent, `I walked to ${agent.currentSubarea} at ${agent.currentArea}.`);
    }
}
