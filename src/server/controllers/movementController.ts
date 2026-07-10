import Agent, { AgentState } from "../../common/state/agent";
import GameEngine from "../gameengine";
import GameState from "../../common/state/gamestate";
import Vector2 from "../../common/utils/vector";
import Pathfinder from "../utils/pathfinder";
import Controller from "../gameengine/controller";
import Message from "../../common/messages/message";
import { Client } from "colyseus";
import { ActionType } from "../../common/state/action";

export default class MovementController extends Controller<GameState> {
    pathfinder: Pathfinder;

    constructor(game: GameEngine<GameState>) {
        super(game);

        this.pathfinder = new Pathfinder(this.state.tilemap);
    }

    update(delta: number) {
        this.state.agents.forEach(agent => {
            switch (agent.state) {
                case AgentState.IDLE:
                    // stop moving if not player controlled
                    if (agent.controllingPlayerId === "") {
                        agent.velocity.value = Vector2.ZERO;
                    }

                    // stop moving if not doing nothing
                    if (agent.action.kind !== ActionType.NONE) {
                        agent.velocity.value = Vector2.ZERO;
                    }

                    break;
                case AgentState.TRAVERSING_PATH:
                    // update the agent's position along the path
                    this.stepAlongPath(agent, delta);
                    break;
                default:
                    break;
            }

            // apply velocity
            agent.position.value = agent.position.value.add(agent.velocity.value.multiply(delta));

            return;

            // for testing: if in idle state, choose a random point to move to
            // use points along the center of the map
            if (agent.state === AgentState.IDLE && agent.controllingPlayerId === "" && Math.random() < 0.004) {
                const center = agent.position.value;
                const x = Math.floor(center.x - 20 + Math.random() * 40);
                const y = Math.floor(center.y - 20 + Math.random() * 40);
                const target = new Vector2(x, y);

                // silently fail if the target is outside the map. We will retry on the next update
                this.traverseTo(agent, target).catch(() => {});
            }
        });
    }

    async onMessage(message: Message, client: Client): Promise<Message | void> {
    }

    async traverseTo(agent: Agent, position: Vector2, near: boolean = false): Promise<Vector2> {
        // find a path to the target position
        let path: Vector2[];
        try {
            path = await this.pathfinder.findPath(agent.position.value, position, near);
        } catch (e) {
            throw `No path found for route ${agent.position.value} -> ${position}: ${e}`;
        }

        agent.currentTraversal = path;
        agent.updateCurrentTraversalStr();
        agent.state = AgentState.TRAVERSING_PATH;

        // wait for the agent to finish moving
        await new Promise<void>((resolve) => {
            agent.currentTraversalOnComplete = resolve;
        });

        // return the final position
        return agent.position.value.floor();
    }

    private stepAlongPath(agent: Agent, delta: number) {
        if (agent.state !== AgentState.TRAVERSING_PATH) {
            throw `Cannot traverse path: agent state is ${agent.state}`;
        }

        // path may be empty if we are already close enough to the target
        if (agent.currentTraversal.length === 0) {
            agent.velocity.value = Vector2.ZERO;
            agent.state = AgentState.IDLE;

            // invoke and the reset the callback
            agent.currentTraversalOnComplete?.();
            agent.currentTraversalOnComplete = undefined;
            return;
        }

        // step towards the next point in the path
        const nextPosition = agent.currentTraversal[0];
        if (this.stepTowards(agent, nextPosition, delta)) {
            // remove the point from the path
            agent.currentTraversal.shift();
            agent.updateCurrentTraversalStr();

            // if the path is empty, we've reached the goal so stop moving
            if (agent.currentTraversal.length === 0) {
                agent.velocity.value = Vector2.ZERO;
                agent.state = AgentState.IDLE;

                // invoke and the reset the callback
                agent.currentTraversalOnComplete?.();
                agent.currentTraversalOnComplete = undefined;
            }
        }
    }

    private stepTowards(agent: Agent, position: Vector2, delta: number): boolean {
        if (agent.state !== AgentState.TRAVERSING_PATH) {
            throw `Cannot step towards position: agent state is ${agent.state}`;
        }

        const offset = position.subtract(agent.position.value);
        const direction = offset.normalize();

        // get the remaingin distance and the distance that we can travel this step
        const remainingDistance = offset.magnitude;
        const stepDistance = delta * Agent.MOVEMENT_SPEED;

        // if we can travel the full distance, set the position immediately
        if (stepDistance >= remainingDistance) {
            agent.position.value = position;
            agent.velocity.value = Vector2.ZERO;
            return true;
        } else {
            // set the velocity to the direction we want to move
            agent.velocity.value = direction.multiply(Agent.MOVEMENT_SPEED);

            // direction is used for visual purposes on the client
            agent.direction = direction.asDirection();
            return false;
        }
    }

    public rebuildPathfinder() {
        this.pathfinder = new Pathfinder(this.state.tilemap);
    }
}
