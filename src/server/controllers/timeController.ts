import Agent, { AgentState } from "../../common/state/agent";
import GameEngine from "../gameengine";
import GameState from "../../common/state/gamestate";
import Vector2 from "../../common/utils/vector";
import Pathfinder from "../utils/pathfinder";
import Controller from "../gameengine/controller";
import Message from "../../common/messages/message";
import { Client } from "colyseus";

export default class TimeController extends Controller<GameState> {
    TIME_SCALE = 60 * 24 / 10; // 1 day in game == 10 minutes in real life

    constructor(game: GameEngine<GameState>) {
        super(game);

        // set time to the current day at 12:00
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        this.state.time = date.getTime();
    }

    update(delta: number) {
        this.state.time += delta * this.TIME_SCALE;
    }

    async onMessage(message: Message, client: Client): Promise<Message | void> {
    }
}
