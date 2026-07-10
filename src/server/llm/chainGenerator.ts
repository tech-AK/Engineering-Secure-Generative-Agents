import Agent from "../../common/state/agent";
import Action, { ActionType } from "../../common/state/action";
import {Dialog, DialogLine} from "../../common/types/dialog";
import {
    addMemoryContextInfoToPrompt,
    addResearchContextInfoToPrompt,
    documentChainNeededCheckPrompt,
    chooseNextAction,
    chooseAgentToInteractWith,
    chooseObjectToInteractWith,
    chooseObjectState,
    endingDialogLine,
    nextDialogLine,
    openingDialogLine,
    unpackDialogHistory, checkforMaliciousPrompt
} from "./prompts";
import {LLM} from "@langchain/core/language_models/llms";
import {ChatOpenAI} from "@langchain/openai";
import {Ollama} from "@langchain/community/llms/ollama";
import RetrievalAugmentedGeneration from "./retrievalAugmentedGeneration";
import {Document} from "langchain/document";
import {FilterData} from "../../common/types/filterData";
import IObject from "../../common/state/iobject";
import { all } from "axios";
import GameState from "../../common/state/gamestate";
import {ContextAwareAgentMemory} from "../../common/types/AgentMemory";
import MemoryController from "../controllers/memoryController";

export class ChainGenerator {

    RAG_model = new RetrievalAugmentedGeneration(this.llm);

    constructor(private llm: LLM) {
        this.RAG_model.init();
    }

    public async generateNextActionType(agent: Agent, state: GameState): Promise<ActionType | null> {
        const prompt = chooseNextAction(agent, state);

        const response = (await this.invokeLLM(prompt)).toLowerCase();

        // try to match the response to one of the four action types
        if (this.isWithinResponse(response, "do nothing")) {
            return ActionType.NONE;
        } else if (this.isWithinResponse(response, "walk to a new location")) {
            return ActionType.MOVING;
        } else if (this.isWithinResponse(response, "interact with an object")) {
            return ActionType.INTERACTING_WITH_OBJECT;
        } else if (this.isWithinResponse(response, "start a conversation")) {
            return ActionType.INTERACTING_WITH_AGENT;
        }

        // it seems that the LLM likes to give specific answers, even if we explicitly told it to only choose between the four options.
        // This is why we also check for specific object and agent names
        for (const object of agent.objectsWithinSight.map(id => state.objects.get(id) as IObject)) {
            if (this.isWithinResponse(response, object.name)) {
                return ActionType.INTERACTING_WITH_OBJECT;
            }
        }

        for (const otherAgent of agent.agentsWithinSight.map(id => state.agents.get(id) as Agent)) {
            if (this.isWithinResponse(response, otherAgent.name)) {
                return ActionType.INTERACTING_WITH_AGENT;
            }
        }

        console.warn("Could not parse response from LLM as an ActionType:", response);
        return null;
    }

    public async generateAgentToInteractWith(agent: Agent, state: GameState): Promise<Agent | null> {
        const prompt = chooseAgentToInteractWith(agent, state);

        const response = (await this.invokeLLM(prompt)).toLowerCase();

        const agents = agent.agentsWithinSight.map(id => state.agents.get(id) as Agent);
        for (const otherAgent of agents) {
            if (this.isWithinResponse(response, otherAgent.name)) {
                return otherAgent;
            }
        }

        console.warn("Could not parse response from LLM as an agent:", response);
        return null;
    }

    public async generateObjectToInteractWith(agent: Agent, state: GameState): Promise<IObject | null> {
        const prompt = chooseObjectToInteractWith(agent, state);

        const response = (await this.invokeLLM(prompt)).toLowerCase();

        const objects = agent.objectsWithinSight.map(id => state.objects.get(id) as IObject);
        for (const object of objects) {
            if (this.isWithinResponse(response, object.name)) {
                return object;
            }
        }

        console.warn("Could not parse response from LLM as an object:", response);
        return null;
    }

    public async generateObjectState(agent: Agent, object: IObject, state: GameState, memoryController: MemoryController,): Promise<string | null> {
        const contextAwareMemories = await memoryController.retrieveContextAwareMemories(agent, `You are currently looking at ${object.name}, which is ${object.state}`)

        const contextAwareMemoriesString = contextAwareMemories.map(agentMemory => `* ${agentMemory.memoryDesc}`).join("\n")

        const prompt = chooseObjectState(agent, object, state, contextAwareMemoriesString);
        console.log(`[Object Interaction Prompt]: ${prompt}`)

        const response = (await this.invokeLLM(prompt)).toLowerCase();

        if (this.isWithinResponse(response, "no change")) {
            return object.state;
        }

        for (const possibleState of object.availableStates) {
            if (this.isWithinResponse(response, possibleState)) {
                return possibleState;
            }
        }

        console.warn("Could not parse response from LLM as a state:", response);
        return null;
    }

    public async generateDialogLine(agent: Agent, dialog: Dialog, memoryController: MemoryController, limit: number = 7): Promise<DialogLine | null> {
        try {

            /* const demo_dialog: Dialog = {
                 initiator: {
                     id: "1",
                     name: "Arthur",
                     position: new Vector2(12,12),
                 },
                 interlocutor: {
                     id: "2",
                     name: "Prof. Dr. Konrad Rieck",
                     position: new Vector2(12,12),
                 },
                 lines: [{            speakerId: "1",
                     line: "What were the most exciting insights you gained during reading the research paper from Konrad Rieck about the Dancer in the Dark?",
                     endConversation: false}, {            speakerId: "1",
                     line: "What were the most exciting insights you gained during reading the research paper from Konrad Rieck about the Dancer in the Dark?",
                     endConversation: false}]
             };*/

            //For debug: Disable LLM integration for every agent expect for one player.
            /*if (dialog.lines.length > 0 && !(unpackDialogHistory(dialog).listener.name.includes("Stefan") || unpackDialogHistory(dialog).speaker.name.includes("Stefan"))) {
                return "blubb";
            }*/

            const unpackedDialog = unpackDialogHistory(dialog);
            let prompt = this.generatePromptForDialogConversation(dialog, agent, limit);

            //For the third level, we deploy an additional LLM checking for malicious inputs.
            if (agent.isSecretKeeperLevel3) {
                const checkPromptForMaliciousIntent = checkforMaliciousPrompt(unpackedDialog.lastMessage);
                const evaluationResponse = await this.invokeLLM(checkPromptForMaliciousIntent);
                const isMaliciousprompt = this.getBoolean(evaluationResponse);
                if (isMaliciousprompt) {
                    return {
                        speakerId: agent.id,
                        line: "L3-Defense LLM triggered. Your request was blocked. Shame on you for trying to hack me!",
                        endConversation: false
                    }
                }
            }

            // Test if the current dialog line refers to a research-orientated question.
            if (dialog.lines.length > 0) {
                if (await this.testForResearchOrientatedQuestion(dialog)) {
                    // it is a research-orientated question, using the PDF-VectorStore

                    const [filtered_json, retrievedDocs] = await this.RAG_model.getRelevantContext(this.llm, unpackedDialog.lastMessage, unpackedDialog.history);

                    //use the retrievedDocs now as context for creating the next line in the dialog
                    prompt = addResearchContextInfoToPrompt(prompt, this.transformDocumentsToLLMPrompt(filtered_json, retrievedDocs, agent))

                    console.log(`[Tester-LLM] classified that "${unpackDialogHistory(dialog).lastMessage}" is a research-orientated question. Using VectorStore with PDF files.`)

                } else {
                    // it is a casual question, using the Memory-VectorStore
                    const contextAwareMemories = await memoryController.retrieveContextAwareMemories(agent, unpackedDialog.lastMessage);
                    prompt = addMemoryContextInfoToPrompt(prompt, this.transformMemoriesToLLMPrompt(contextAwareMemories));
                    console.log(`[Tester-LLM] classified that "${unpackDialogHistory(dialog).lastMessage}" is a casual question. Using VectorStore with saved memories.`)
                }
            }


            const response = await this.invokeLLM(prompt)

            // check for "END" in the response
            const line = response.replace("\"END\"", "").replace("END", "").replace("\"", "").trim();
            const endConversation = this.isWithinResponse(response.slice(-7), "END");

            return {
                speakerId: agent.id,
                line,
                endConversation
            }
        } catch (error) {
            console.error(`Error while generating dialog line: ${error}`);
            return null;
        }
    }

    private generatePromptForDialogConversation(dialog: Dialog, agent: Agent, limit: number) {
        // use either the opening or the next line prompt
        if (dialog.lines.length === 0) {
            return openingDialogLine(agent, dialog);
        } else if (dialog.lines.length < limit) {
            return nextDialogLine(agent, dialog);
        } else {
            return endingDialogLine(agent, dialog);
        }
    }

    private transformDocumentsToLLMPrompt(filtered_json: FilterData, docs: Document[], agent: Agent) {
        let LLM_prompt = ""

        if (docs.length > 0 ) {
            LLM_prompt = "In order to continue the dialog, you can make use of your inner knowledge from several research papers. Your chat partner does not know about the extracts. If you refer to them, you need to explain them. If someone asks about a source, say that this is your own knowledge you obtained some time ago. You know the following things related to this conversational topic:"
        }

        for (const doc of docs) {
            const title = doc.metadata.Title || 'No Title';
            const authors = doc.metadata.Authors || 'No Authors';

            const cleanedAgentName = agent.name.replace("Prof.", "").replace("Dr.", "")
            const adaptedAuthors = authors.replace(cleanedAgentName.trim(), "yourself")

            const explanation_text = authors.includes(cleanedAgentName.trim()) ? "This is part of a research paper you have written some time ago. This is why you remember everything exactly and can provide in-depth explanations to your interlocutors." : "This is one part of a research paper you have read some time ago."

            const formattedContent = `
${explanation_text}
Title: ${title}
Authors: ${adaptedAuthors}
Your knowledge:
${doc.pageContent}
----------------------------------------

`;
            LLM_prompt += formattedContent;
        }

        return LLM_prompt;
    }

    private transformMemoriesToLLMPrompt(memories: ContextAwareAgentMemory[]) {
        let LLM_prompt = ""
        for (const memoryEntry of memories) {

            const formattedContent = `* ${memoryEntry.memoryDesc}
`;
            LLM_prompt += formattedContent;
        }

        return LLM_prompt;
    }

    private async testForResearchOrientatedQuestion(dialog: Dialog): Promise<boolean> {
        // test for a question asking to provide some information from the PDF paper files
        const checkPrompt = documentChainNeededCheckPrompt(dialog);
        const answer_LLM = await this.invokeLLM(checkPrompt);
        return this.getBoolean(answer_LLM)
    }

    private getBoolean(string: string): boolean {
        switch (string.toLowerCase()) {
            case "true":
            case "yes":
                return true;
            default:
                return false;
        }
    }

    private isWithinResponse(response: string, expected: string): boolean {
        // TODO: this can be improved by comparing embeddings
        response = response.toLowerCase();
        expected = expected.toLowerCase();
        return expected
            .split(/[\s-_]/) // split by whitespace, dash, underscore
            .every(term => response.includes(term));
    }

    public async invokeLLM(prompt: string): Promise<string> {
        let response = "";

        if (this.llm instanceof ChatOpenAI) {
            // TODO: implement it
            throw new Error("Not implemented yet!");
        } else if (this.llm instanceof Ollama) {
            // generate the next line
            response = await this.llm.invoke(prompt);
        } else {
            throw new Error("Unsupported LLM!");
        }

        console.log(`---------------------------------------------------------------------------------------------------------------------------\nPROMPT: "${prompt}"\n-----------------------------------------------------------------------------------------------------`);
        console.log(`---------------------------------------------------------------------------------------------------------------------------\nRESPONSE: "${response}"\n---------------------------------------------------------------------------------------------------`);
        return response;
    }
}