import Controller from "../gameengine/controller";
import GameEngine from "../gameengine";
import GameState from "../../common/state/gamestate";
import { TilemapCollisionDetector } from "../utils/physics";
import Message from "../../common/messages/message";
import { Client } from "colyseus";

export default class CollisionController extends Controller<GameState> {
    collisionDetector: TilemapCollisionDetector;

    constructor(game: GameEngine<GameState>) {
        super(game);

        this.collisionDetector = new TilemapCollisionDetector(this.state.tilemap);
    }

    update(delta: number) {
        // apply collision detection and resolution to all agents
        this.state.agents.forEach(agent => {
            const collisions = this.collisionDetector.getCollisions(agent.position.value);
            if (collisions.length > 0) {
                const resolution = this.collisionDetector.resolveCollisions(collisions);
                agent.position.value = agent.position.value.add(resolution);
            }
        });
    }

    async onMessage(message: Message, client: Client): Promise<Message | void> {
    }

    public rebuildCollisionMap() {
        this.collisionDetector = new TilemapCollisionDetector(this.state.tilemap);
    }
}
