import fs from "fs";
import path from "path";
import { Room, Client } from "colyseus";
import GameState from "../../common/state/gamestate";
import Agent, { AgentState } from "../../common/state/agent";
import Tilemap from "../../common/state/tilemap";
import Player from "../../common/state/player";
import GameEngine from "../gameengine";
import CollisionController from "../controllers/collisionController";
import MovementController from "../controllers/movementController";
import Vector2 from "../../common/utils/vector";
import { v4 as uuidv4 } from "uuid";
import PlayerController from "../controllers/playerController";
import TimeController from "../controllers/timeController";
import ActionController from "../controllers/actionController";
import NearEnvironmentController from "../controllers/nearEnvironmentController";
import MemoryController from "../controllers/memoryController";
import SecretRoomController from "../controllers/secretRoomController";
import Action, { ActionType, NoneAction } from "../../common/state/action";

export class GameRoom extends Room<GameState> {
    engine!: GameEngine<GameState>;

    async onCreate({ worldDescription, llm, chainGenerator, globalAgentMemoryVectorStore }: any) {
        // load the default tilemap
        const filename = path.resolve(worldDescription.tilemap);
        console.log(`Loading map data from ${filename} ...`);
        const mapData = JSON.parse(await fs.promises.readFile(filename, "utf-8"));
        const [tilemap, objects] = Tilemap.parseJson("default", mapData);

        // create all agents
        const agents = new Map<string, Agent>();
        worldDescription.agents.forEach(({ name, characterImage, position, seed, role }: any) => {
            const positionVector = new Vector2(position[0], position[1]);
            if (!tilemap.isInside(positionVector)) {
                throw new Error(`Agent position ${positionVector} is outside the map!`);
            }
            if (tilemap.getTile(positionVector)?.collides) {
                throw new Error(`Agent position ${positionVector} is inside a wall!`);
            }

            const id = uuidv4().slice(0, 8);
            const agent = new Agent(id, positionVector, name, characterImage, seed, role);
            agents.set(id, agent);
        });

        // setup a game state and the engine
        this.setState(new GameState(tilemap, agents, objects));
        this.engine = new GameEngine(this, llm, chainGenerator, globalAgentMemoryVectorStore);

        /* for (let i = 0; i < AgentFilenames.length; i++) {
            // choose a random position that is not colliding
            let center = this.state.tilemap.size.value.divide(3);
            let position = Vector2.ZERO;
            for (let j = 0; j < 1000; j++) {
                const x = Math.floor(Math.random() * 10 - 5 + center.x);
                const y = Math.floor(Math.random() * 10 - 5 + center.y);
                position = new Vector2(x, y);

                if (!tilemap.getTile(position)?.collides) {
                    break;
                }
            }

            // create the agent
            const agent = new Agent(String(i), position, `Agent ${i}`);
            this.state.agents.set(String(i), agent);
        } */

        // add all controllers (note: order matters!)
        this.engine.addController("time", TimeController);
        this.engine.addController("movement", MovementController);
        this.engine.addController("collision", CollisionController);
        this.engine.addController("nearEnvironment", NearEnvironmentController);
        this.engine.addController("player", PlayerController);
        this.engine.addController("action", ActionController);
        this.engine.addController("memory", MemoryController);
        this.engine.addController("secretRoom", SecretRoomController);

        // mark the state as ready
        this.state.ready = true;
    }

    onJoin(client: Client, options: any) {
        // add the player
        const player = new Player(client.sessionId, options.name ?? "Anonymous");
        this.state.players.set(client.sessionId, player);

        // for debugging, let the player control one of the agents
        // -> choose the first agent that is not already controlled
        // -> use a timeout to make sure the client has loaded the agent data
        setTimeout(() => {
            const agent = Array.from(this.state.agents.values()).find(agent => agent.action.kind == ActionType.NONE && agent.controllingPlayerId === "");
            if (agent) {
                this.engine.getController<PlayerController>("player").startControlAgent(player, agent);
            }
        }, 100);
    }

    onLeave(client: Client) {
        // release any controlled agents
        const player = this.state.players.get(client.sessionId)!;
        if (player.controlledAgent) {
            this.engine.getController<PlayerController>("player").stopControlAgent(player);
        }

        this.state.players.delete(client.sessionId);
    }
}
