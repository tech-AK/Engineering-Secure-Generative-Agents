import EventEmitter from "events";
import { Client, Room } from "colyseus.js";
import GameState from "../common/state/gamestate";
import type Message from "@common/messages/message";

export class Game extends EventEmitter {
    public client?: Client;
    public room?: Room<GameState>;
    public state?: GameState;

    private loggedIn: boolean = false;

    constructor() {
        super();
    }

    async login() {
        try {
            const serverUrl = process.env.SERVER_URL ?? "ws://localhost:8080";
            this.client = new Client(serverUrl);
            this.emit("connected");

            this.room = await this.client.joinOrCreate<GameState>("GameRoom");
            this.state = this.room.state;

            this.room.onLeave(() => {
                this.loggedIn = false;
                this.emit("logout");
            });

            console.log(`Connected to ${serverUrl}`);

            this.loggedIn = true;
            this.emit("login", this.state);
        } catch (e) {
            console.error("Failed to connect to server:", e);
        }
    }

    async logout() {
        if (this.client) {
            await this.room?.leave();
        }
        this.loggedIn = false;
    }

    isLoggedIn() {
        return this.loggedIn;
    }

    async sendServerRequest(request: Message, successResponseType: string, failureResponseType?: string, timeout: number = 5000): Promise<Message> {
        const requestPromise = new Promise((resolve, reject) => {
            if (!this.room) {
                reject(new Error("Not connected to server"));
                return;
            }

            // register response message handlers
            this.room.onMessage(successResponseType, (message) => {
                resolve(message);
            });

            if (failureResponseType) {
                this.room.onMessage(failureResponseType, (message) => {
                    reject(message);
                });
            }

            // send the request
            this.room.send(request.messageName, request);
        });

        const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout));

        return Promise.race([requestPromise, timeoutPromise]);
    }
}

const globalInstance = new Game();
export const useGame = () => globalInstance;
