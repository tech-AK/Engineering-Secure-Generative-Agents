import { Client } from "colyseus";
import { Schema } from "@colyseus/schema";
import Message from "../../common/messages/message";
import GameEngine from ".";

export default abstract class Controller<State extends Schema> {
    constructor(protected game: GameEngine<State>) {}

    abstract update(delta: number): void;
    abstract onMessage(message: Message, client: Client): Promise<Message | void>;

    get state() {
        return this.game.room.state;
    }

    set state(state: State) {
        this.game.room.state;
    }
}
