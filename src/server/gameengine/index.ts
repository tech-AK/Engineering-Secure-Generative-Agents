import Controller from "./controller";
import { Client, Room } from "colyseus";
import { Schema } from "@colyseus/schema";
import Message from "../../common/messages/message";
import { LLM } from "@langchain/core/language_models/llms";
import {ChainGenerator} from "../llm/chainGenerator";
import AgentMemoryVectorStore from "../llm/AgentMemoryVectorStore";

export default class GameEngine<State extends Schema> {
    controllers: Map<string, Controller<State>> = new Map();

    constructor(public room: Room<State>, public llm: LLM, public chainGenerator: ChainGenerator, public globalAgentMemoryVectorStore: AgentMemoryVectorStore) {
        // pass incoming messages to all controllers
        room.onMessage("*", (client, type, message) => {
            this.controllers.forEach(async (controller, name) => {
                try {
                    // handle the message
                    const result = await controller.onMessage(message, client);

                    // send a response
                    if (result) {
                        client.send(result.messageName, result);
                    }
                } catch (e) {
                    console.error(`Error during message handling in controller "${name}":`, e);
                    if (e instanceof Message) {
                        // send an error response
                        client.send(e.messageName, e);
                    }
                }
            });
        });

        // register update method
        room.setSimulationInterval((delta) => this.update(delta));
    }

    addController<C extends Controller<State>>(name: string, controllerClass: { new(game: GameEngine<State>): C }) {
        this.controllers.set(name, new controllerClass(this));
    }

    getController<C extends Controller<State>>(name: string): C {
        return this.controllers.get(name) as C;
    }

    getState(): State {
        return this.room.state;
    }

    async sendClientRequest(clientSessionId: string, request: Message, successResponseType: string, failureResponseType?: string, timeout: number = 5000): Promise<Message> {
        const requestPromise = new Promise((resolve, reject) => {
            // register response message handlers
            this.room.onMessage(successResponseType, (client, message) => {
                if (client.sessionId === clientSessionId) {
                    resolve(message);
                }
            });

            if (failureResponseType) {
                this.room.onMessage(failureResponseType, (client, message) => {
                    if (client.sessionId === clientSessionId) {
                        reject(message);
                    }
                });
            }

            // send the request
            this.room.clients.find(client => client.sessionId === clientSessionId)?.send(request.messageName, request);
        });

        const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout));

        return Promise.race([requestPromise, timeoutPromise]);
    }

    update(delta: number) {
        // update all controllers
        this.controllers.forEach((controller, name) => {
            try {
                controller.update(delta)
            } catch (e) {
                console.error(`Error during update in controller "${name}":`, e);
            }
        });
    }
}
