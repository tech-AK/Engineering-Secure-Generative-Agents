import Agent, { AgentState } from "../../common/state/agent";
import GameEngine from "../gameengine";
import GameState from "../../common/state/gamestate";
import Player from "../../common/state/player";
import Vector2 from "../../common/utils/vector";
import Controller from "../gameengine/controller";
import Message from "../../common/messages/message";
import { PlayerMoveMessage, PlayerStopMessage } from "../../common/messages/player";
import { LegacyInteractionFailureResponse, LegacyInteractionRequest, LegacyInteractionSuccessResponse, DialogLineRequest, DialogLineResponse, ObjectStateRequest, ObjectStateResponse, AgentInteractionRequest, AgentInteractionSuccessResponse, AgentInteractionFailureResponse, ObjectInteractionRequest, ObjectInteractionSuccessResponse, ObjectInteractionFailureResponse } from "../../common/messages/interaction";
import { Client } from "colyseus";
import { DialogLine } from "../../common/types/dialog";
import IObject from "../../common/state/iobject";
import ActionController from "./actionController";
import { ActionType } from "../../common/state/action";

export default class PlayerController extends Controller<GameState> {
    static readonly INTERACTION_REQUEST_TIMEOUT = 5 * 60 * 1000;

    constructor(game: GameEngine<GameState>) {
        super(game);
    }

    update(delta: number) {
    }

    async onMessage(message: Message, client: Client): Promise<Message | void> {
        // get the agent that the player is controlling (possibly none)
        const agent = this.getControlledAgent(client.sessionId);
        if (!agent) {
            return;
        }

        switch (message.messageName) {
            case PlayerMoveMessage.NAME: {
                // cannot move if not doing nothing
                if (agent.action.kind !== ActionType.NONE) {
                    return;
                }

                const moveMessage = message as PlayerMoveMessage;

                // move the player along that direction. If sprinting, use the faster speed
                const direction = moveMessage.direction;
                const speed = moveMessage.sprint ? Agent.SPRINT_SPEED : Agent.MOVEMENT_SPEED;
                agent.direction = direction;
                agent.velocity.value = Vector2.fromDirection(direction).multiply(speed);
                break;
            }
            case PlayerStopMessage.NAME:
                // stop the player's movement
                agent.velocity.value = Vector2.ZERO;
                break;
            case AgentInteractionRequest.NAME:
                // start an interaction with a specific agent
                try {
                    const interactionRequest = message as AgentInteractionRequest;
                    const interlocutor = this.state.agents.get(interactionRequest.agentId);
                    if (!interlocutor) throw `Agent not found: ${interactionRequest.agentId}`;

                    await this.game.getController<ActionController>("action").startAgentInteractionAction(agent, interlocutor);
                    return new AgentInteractionSuccessResponse();
                } catch (e) {
                    return new AgentInteractionFailureResponse(String(e));
                }
            case ObjectInteractionRequest.NAME:
                // start an dinteraction with a specific object
                try {
                    const interactionRequest = message as ObjectInteractionRequest;
                    const object = this.state.objects.get(interactionRequest.objectId);
                    if (!object) throw `Object not found: ${interactionRequest.objectId}`;

                    await this.game.getController<ActionController>("action").startObjectInteractionAction(agent, object);
                    return new ObjectInteractionSuccessResponse();
                } catch (e) {
                    return new ObjectInteractionFailureResponse(String(e));
                }
            default:
                break;
        }
    }

    async requestDialogLine(speaker: Agent, listener: Agent, history: DialogLine[]): Promise<DialogLine> {
        if (speaker.controllingPlayerId === "") {
            throw `Cannot request dialog line: speaker is not player controlled`;
        }

        // find out the speaker's session id
        const player = new Array(...this.state.players.values()).find((player) => player.controlledAgent === speaker.id);
        if (!player) {
            throw `Cannot request dialog line: player not found`;
        }

        // send a request to the client
        try {
            const dialogLine = await this.game.sendClientRequest(player.id, new DialogLineRequest(listener.name, history), DialogLineResponse.NAME, undefined, PlayerController.INTERACTION_REQUEST_TIMEOUT) as DialogLineResponse;
            return { ...dialogLine, speakerId: speaker.id };
        } catch (e) {
            throw `Failed to get dialog line: ${e}`;
        }
    }

    async requestObjectState(agent: Agent, object: IObject): Promise<string> {
        if (agent.controllingPlayerId === "") {
            throw `Cannot request object state: agent is not player controlled`;
        }

        // find out the agent's session id
        const player = new Array(...this.state.players.values()).find((player) => player.controlledAgent === agent.id);
        if (!player) {
            throw `Cannot request object state: player not found`;
        }

        // send a request to the client
        let response;
        try {
            response = await this.game.sendClientRequest(player.id, new ObjectStateRequest(object.id, object.name, object.state, Array(...object.availableStates)), ObjectStateResponse.NAME, undefined, PlayerController.INTERACTION_REQUEST_TIMEOUT) as ObjectStateResponse;
        } catch (e) {
            throw `Failed to get object state: ${e}`;
        }

        // make sure the response id matches
        if (response.id !== object.id) {
            throw `Object state response id mismatch: expected ${object.id}, got ${response.id}`;
        }

        return response.newState;
    }

    startControlAgent(player: Player, agent: Agent) {
        if (player.controlledAgent) {
            throw `Cannot control agent: player is already controlling an agent`;
        }
        if (agent.controllingPlayerId !== "") {
            throw `Cannot control agent: agent is already controlled`;
        }

        // link player and agent
        player.controlledAgent = agent.id;
        agent.controllingPlayerId = player.id;
    }

    stopControlAgent(player: Player) {
        if (!player.controlledAgent) {
            throw `Cannot stop controlling agent: player is not controlling an agent`;
        }

        const agent = this.state.agents.get(player.controlledAgent);
        if (!agent) {
            throw `Cannot stop controlling agent: agent not found`;
        }
        if (agent.controllingPlayerId !== player.id) {
            throw `Cannot stop controlling agent: agent is not controlled by this player`;
        }

        // unlink the player from the agent
        player.controlledAgent = undefined;
        agent.controllingPlayerId = "";
        agent.state = AgentState.IDLE;

        // reset the last action interval of the agent. Otherwise, the agent will start doing something immediately and this will make our demo more difficult.
        this.game.getController<ActionController>("action").resetLastActionInterval(agent);
    }

    getControlledAgent(sessionId: string): Agent | undefined {
        const player = this.state.players.get(sessionId);
        return this.state.agents.get(player?.controlledAgent ?? "");
    }
}
