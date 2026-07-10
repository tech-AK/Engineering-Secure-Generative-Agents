export type AgentMemory = { //Holds all metadata for one specific memory
    memoryId: string;
    agentId: string;
    agentName: string;
    last_accessed: number;
    importance_score: number
};


export type ContextAwareAgentMemory = {
    memoryDesc: string;
    recency: number;
    normalized_recency?: number;
    importance: number;
    normalized_importance?: number;
    relevance: number;
    normalized_relevance?: number;
    total_score?: number;
    docID: string;
};