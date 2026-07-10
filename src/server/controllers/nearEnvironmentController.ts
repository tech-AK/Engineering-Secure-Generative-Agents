import Controller from "../gameengine/controller";
import GameEngine from "../gameengine";
import GameState from "../../common/state/gamestate";
import Message from "../../common/messages/message";
import { Client } from "colyseus";
import Agent from "../../common/state/agent";
import Action, { ActionType } from "../../common/state/action";

export default class NearEnvironmentController extends Controller<GameState> {
    static readonly ENVIRONMENT_CHECK_INTERVAL = 1 * 60 * 1000; // every in-game minute

    lastCheckTimestamp = 0;

    constructor(game: GameEngine<GameState>) {
        super(game);
    }

    update(delta: number) {
        // restrict the update rate of this controller
        if (this.state.time - this.lastCheckTimestamp < NearEnvironmentController.ENVIRONMENT_CHECK_INTERVAL) {
            return;
        }
        this.lastCheckTimestamp = this.state.time;

        // update the current area of all agents
        this.state.tilemap.areas.forEach((area) => {
            area.subareas.forEach((subarea) => {
                // clear the agents array in each subarea
                subarea.agentIds.clear();
            });
        });
        this.state.agents.forEach(agent => {
            const position = agent.position.value;
            const tile = this.state.tilemap.getTile(position);
            if (!tile) throw new Error(`Agent ${agent.name} is outside the map!`);

            // add the agent id to the subarea
            this.state.tilemap.areas.get(tile.area)?.subareas.get(tile.subarea)?.agentIds.push(agent.id);

            // add the area and subarea info to the agent
            agent.currentArea = tile.area;
            agent.currentSubarea = tile.subarea;
        });

        // update the nearby agents and objects of all agents
        this.state.agents.forEach(agent => {
            agent.agentsWithinSight = this.getAgentsWithinSight(agent);
            agent.objectsWithinSight = this.getObjectsWithinSight(agent);
        });
    }

    async onMessage(message: Message, client: Client): Promise<Message | void> {
    }

    private getAgentsWithinSight(agent: Agent): string[] {
        // for an agent to be within sight, it must:
        // - be not this agent
        // - be in the same area/subarea
        // - be within a certain distance
        // - do nothing
        // - not be controlled by a player
        // the agents are then sorted by shortest distance

        return Array(...this.state.agents.values())
            .filter((other) => other.id !== agent.id) // not this agent
            .filter((other) => other.currentArea === agent.currentArea && other.currentSubarea === agent.currentSubarea) // same area
            .filter((other) => other.position.value.distanceTo(agent.position.value) < Agent.INTERACTION_RADIUS) // within radius
            .filter((other) => other.action.kind === ActionType.NONE) // do nothing
            .filter((other) => other.controllingPlayerId === "") // not player controlled
            .sort((a, b) => a.position.value.distanceTo(agent.position.value) - b.position.value.distanceTo(agent.position.value)) // sort by distance
            .map((other) => other.id);
    }

    private getObjectsWithinSight(agent: Agent): string[] {
        // for an object to be within sight, it must:
        // - be in the same area/subarea
        // - be within a certain distance
        // the objects are then sorted by shortest distance

        return Array(...this.state.objects.values())
            .filter((object) => object.currentArea === agent.currentArea && object.currentSubarea === agent.currentSubarea) // same area
            .filter((object) => object.position.value.distanceTo(agent.position.value) < Agent.INTERACTION_RADIUS) // within radius
            .sort((a, b) => a.position.value.distanceTo(agent.position.value) - b.position.value.distanceTo(agent.position.value)) // sort by distance
            .map((object) => object.id);
    }
}
