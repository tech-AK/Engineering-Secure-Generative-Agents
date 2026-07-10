import Controller from "../gameengine/controller";
import GameEngine from "../gameengine";
import GameState from "../../common/state/gamestate";
import Message from "../../common/messages/message";
import {Client} from "colyseus";
import Agent, {AgentEvent, AgentState} from "../../common/state/agent";
import {
    ActionType,
    InteractingWithAgentAction,
    InteractingWithObjectAction,
    MovingAction,
    NoneAction,
    RespondingToAgentAction,
    UndecidedAction
} from "../../common/state/action";
import Vector2 from "../../common/utils/vector";
import MovementController from "./movementController";
import IObject from "../../common/state/iobject";
import {Dialog} from "../../common/types/dialog";
import PlayerController from "./playerController";
import MemoryController from "./memoryController";
import { ForceInteraction } from "../../common/messages/interaction";

export default class ActionController extends Controller<GameState> {
    INITIAL_ACTION_CHECK_INTERVAL = 2 * 60 * 60 * 1000;
    ACTION_CHECK_INTERVAL = 1 * 60 * 60 * 1000;
    DIALOG_PREFERRED_LENGTH = 7;
    DIALOG_MAX_LENGTH = 15;

    constructor(game: GameEngine<GameState>) {
        super(game);

        // set an initial timestamp for all agents to check at least 1 minute in the future
        for (const agent of this.state.agents.values()) {
            agent.lastActionCheckTimestamp = Math.floor(this.state.time - this.ACTION_CHECK_INTERVAL + 1*60*1000 + Math.random() * this.INITIAL_ACTION_CHECK_INTERVAL);
        }

        // Debug: Start an agent interaction with the active player
        /* setTimeout(async () => {
            const initiator = Array(...this.state.agents.values()).find(agent => agent.controllingPlayerId !== "")!;
            const interlocutor = Array(...this.state.agents.values()).find(agent => agent.name.includes("Klaus Mueller"))!;
            await this.startAgentInteractionAction(initiator, interlocutor);
        }, 2000); */
    }

    public resetLastActionInterval(agent: Agent) {
        agent.lastActionCheckTimestamp = this.state.time;
    }

    update(delta: number) {
        for (let agent of this.state.agents.values()) {
            // check if the agent is ready (idle, no action, not controlled by a player)
            if (!this.agentIsReady(agent)) continue;

            // check if the agent should start a new action
            if (this.state.time - agent.lastActionCheckTimestamp < this.ACTION_CHECK_INTERVAL) continue;

            // start the action in the background
            this.startNewAction(agent).catch(e => {
                agent.events.push(AgentEvent.error(String(e), "action"));
                console.error(`Error generating next action for agent ${agent.name} ${e}. Waiting for the next interval.`);
            });
        }
    }

    private agentIsReady(agent: Agent) {
        if (agent.state !== AgentState.IDLE) return false;
        if (agent.action.kind !== ActionType.NONE) return false;
        if (agent.controllingPlayerId !== "") return false;
        return true;
    }

    private async startNewAction(agent: Agent) {
        agent.lastActionCheckTimestamp = this.state.time;

        try {
            // ask the LLM for the next action
            agent.events.push(AgentEvent.process("Choosing action type", "action"));
            agent.action = new UndecidedAction();
            const nextActionType = await this.game.chainGenerator.generateNextActionType(agent, this.state);
            if (nextActionType === null) {
                throw new Error("Could not generate next action.");
            }

            // run the action
            await this.executeAction(agent, nextActionType);
        } catch (e) {
            agent.events.push(AgentEvent.error(String(e), "action"));
            console.error(`Error executing action for agent ${agent.name} ${e}. Waiting for the next interval.`);
        } finally {
            // store the previous action. If the previous action was undecided, use None.
            agent.previousAction = agent.action.kind === ActionType.UNDECIDED ? new NoneAction() : agent.action;
            agent.action = new NoneAction();
            agent.lastActionCheckTimestamp = this.state.time;
        }
    }

    async startAgentInteractionAction(agent: Agent, interlocutor: Agent) {
        try {
            await this.executeAgentInteractionAction(agent, interlocutor);
        } catch (e) {
            agent.events.push(AgentEvent.error(String(e), "action"));
            console.error(`Error executing agent interaction for agent ${agent.name} ${e}.`);
        } finally {
            // store the previous action. If the previous action was undecided, use None.
            agent.previousAction = agent.action.kind === ActionType.UNDECIDED ? new NoneAction() : agent.action;
            agent.action = new NoneAction();
            agent.lastActionCheckTimestamp = this.state.time;
        }
    }

    async startObjectInteractionAction(agent: Agent, object: IObject) {
        try {
            await this.executeObjectInteractionAction(agent, object);
        } catch (e) {
            agent.events.push(AgentEvent.error(String(e), "action"));
            console.error(`Error executing object interaction for agent ${agent.name} ${e}.`);
        } finally {
            // store the previous action. If the previous action was undecided, use None.
            agent.previousAction = agent.action.kind === ActionType.UNDECIDED ? new NoneAction() : agent.action;
            agent.action = new NoneAction();
            agent.lastActionCheckTimestamp = this.state.time;
        }
    }

    private async executeAction(agent: Agent, actionType: ActionType) {
        try {
            console.log(`${agent.name} is starting a new action: ${ActionType[actionType]}.`);
            agent.events.push(AgentEvent.info(`Action started: ${ActionType[actionType]}.`, "action"));

            switch (actionType) {
                case ActionType.NONE:
                    // nothing to do here
                    break;
                case ActionType.MOVING:
                    await this.executeMovingAction(agent);
                    break;
                case ActionType.INTERACTING_WITH_AGENT:
                    await this.executeAgentInteractionAction(agent);
                    break;
                case ActionType.INTERACTING_WITH_OBJECT:
                    await this.executeObjectInteractionAction(agent);
                    break;
                default:
                    break;
            }

            console.log(`${agent.name} has finished their action: ${ActionType[actionType]}.`);
            agent.events.push(AgentEvent.info(`Action finished.`, "action"));
        } catch (e) {
            // startNewAction will handle this error and log it
            throw e;
        }
    }

    private async executeMovingAction(agent: Agent) {
        try {
            const action = new MovingAction();
            agent.action = action;
            action.setOrigin(agent.position.value, this.state.tilemap);

            // TODO: use LLM to choose a target
            agent.events.push(AgentEvent.process("Choosing target", "action:moving"));
            const target = this.findRandomTarget();
            action.setTarget(target, this.state.tilemap);

            // start traversing to the target
            agent.events.push(AgentEvent.process(`Traversing to ${target.x}, ${target.y}`, "action:moving"));
            await this.game.getController<MovementController>("movement").traverseTo(agent, target);

            // store a memory
            this.game.getController<MemoryController>("memory").saveCurrentLocationMemory(agent);
        } catch (e) {
            throw e;
        }
    }

    private async executeObjectInteractionAction(agent: Agent, chosenObject?: IObject) {
        let object: IObject | null = null;

        try {
            const action = new InteractingWithObjectAction();
            agent.action = action;

            const objects = agent.objectsWithinSight.map(id => this.state.objects.get(id) as IObject);
            if (objects.length === 0) {
                throw new Error("No objects in sight.");
            }

            if (chosenObject) {
                // use the already provided object
                object = chosenObject;
            } else {
                // ask LLM which object to interact with
                agent.events.push(AgentEvent.process("Choosing object to interact with", "action"));
                if (objects.length === 1) {
                    object = objects[0];
                } else {
                    object = await this.game.chainGenerator.generateObjectToInteractWith(agent, this.state);
                    if (object === null) {
                        throw new Error("Could not determine which object to interact with.");
                    }
                }
            }

            // make sure we don't directly interact with secret room doors
            if (object.name.includes("door to secret room")) {
                throw new Error(`Object ${object.name} cannot be interacted with directly.`);
            }

            // make sure the object is still in range
            if (!agent.objectsWithinSight.includes(object.id)) {
                throw new Error(`Object ${object.name} is not within sight.`);
            }

            // set the interaction target
            action.setObject(object);

            // move near the object
            agent.events.push(AgentEvent.process(`Moving towards ${object.name}`, "action"));
            await this.game.getController<MovementController>("movement").traverseTo(agent, object.position.value, true);

            // make sure the object is close enough
            if (agent.position.value.distanceTo(object.position.value) > 2) {
                throw new Error(`Object ${object.name} is still too far away after traversal.`);
            }

            // make the agent face the object
            agent.direction = object.position.value.subtract(agent.position.value).asDirection();

            let newState: string | null = null;
            if (agent.controllingPlayerId !== "") {
                // ask the player for a new object state
                newState = await this.game.getController<PlayerController>("player").requestObjectState(agent, object);
            } else {
                // ask the LLM to set a new state for the object
                agent.events.push(AgentEvent.process(`Choosing new state for ${object.name}`, "action:object"));
                newState = await this.game.chainGenerator.generateObjectState(agent, object, this.state, this.game.getController<MemoryController>("memory"));
            }

            if (newState === null) {
                throw new Error("Could not determine a new state for the object.");
            }

            object.state = newState;
            action.setNewState(newState);
            agent.events.push(AgentEvent.process(`Object state changed to ${newState}`, "action:object"));

            // store a memory for this agent
            this.game.getController<MemoryController>("memory").saveObjectInteractionToMemory(agent, agent, true, object);

            // store a memory for all surrounding agents
            Array(...this.state.agents.values())
                .filter((observer) => object?.currentArea === observer.currentArea && object?.currentSubarea === observer.currentSubarea && observer.id !== agent.id)
                .forEach((observer) => this.game.getController<MemoryController>("memory").saveObjectInteractionToMemory(observer!, agent, false, object!));

            // wait for an additional fixed time period
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
            throw e;
        }
    }

    private async executeAgentInteractionAction(agent: Agent, chosenInterlocutor?: Agent) {
        let interlocutor: Agent | null = null;

        try {
            const action = new InteractingWithAgentAction();
            agent.action = action;

            const agents = agent.agentsWithinSight.map(id => this.state.agents.get(id) as Agent);
            if (agents.length === 0) {
                throw new Error("No agents within sight.");
            }

            if (chosenInterlocutor) {
                // use the already provided interlocutor
                interlocutor = chosenInterlocutor;
            } else {
                // ask LLM which agent to interact with
                agent.events.push(AgentEvent.process("Choosing agent to interact with", "action"));
                if (agents.length === 1) {
                    interlocutor = agents[0];
                } else {
                    interlocutor = await this.game.chainGenerator.generateAgentToInteractWith(agent, this.state);
                    if (interlocutor === null) {
                        throw new Error("Could not determine which agent to interact with.");
                    }
                }
            }

            // make sure the interlocutor is still in range
            if (!agent.agentsWithinSight.includes(interlocutor.id)) {
                throw new Error(`Agent ${interlocutor.name} is not within sight.`);
            }

            // note: this block must (!) happen synchronously, otherwise the interlocutor might end up in an invalid state
            {
                // make sure the interlocutor is also ready for interaction
                if (!this.agentIsReady(interlocutor)) {
                    throw new Error(`Agent ${interlocutor.name} is not ready for interaction.`);
                }

                // update the action of both agents
                const interlocutorAction = new RespondingToAgentAction();
                interlocutor.action = interlocutorAction;
                interlocutorAction.setInitiator(agent);

                action.setInterlocutor(interlocutor);
            }

            // move near the interlocutor
            agent.events.push(AgentEvent.process(`Moving towards ${interlocutor.name}`, "action"));
            await this.game.getController<MovementController>("movement").traverseTo(agent, interlocutor.position.value, true);

            // make sure the interlocutor is close enough
            if (agent.position.value.distanceTo(interlocutor.position.value) > 2) {
                throw new Error(`Agent ${interlocutor.name} is still too far away after traversal.`);
            }

            // make the agents face each other
            agent.direction = interlocutor.position.value.subtract(agent.position.value).asDirection();
            interlocutor.direction = agent.position.value.subtract(interlocutor.position.value).asDirection();

            // start the dialog (limit to 20 lines absolute max). The LLM will be prompted to finish the dialog after about 7 lines.
            let speaker = agent;
            let listener = interlocutor;
            let dialog: Dialog = {
                initiator: {
                    id: agent.id,
                    name: agent.name,
                    position: agent.position.value
                },
                interlocutor: {
                    id: interlocutor.id,
                    name: interlocutor.name,
                    position: interlocutor.position.value
                },
                lines: []
            };

            agent.events.push(AgentEvent.process(`Generating dialog`, "action:agent"));
            for (let i = 0; i < this.DIALOG_MAX_LENGTH; i++) {
                let dialogLine;

                if (speaker.controllingPlayerId !== "") {
                    // ask the human player to generate a dialog line
                    dialogLine = await this.game.getController<PlayerController>("player").requestDialogLine(speaker, listener, dialog.lines);
                } else {
                    // ask the LLM to generate a dialog line
                    dialogLine = await this.game.chainGenerator.generateDialogLine(speaker, dialog, this.game.getController<MemoryController>("memory"), this.DIALOG_PREFERRED_LENGTH);
                }
                if (dialogLine === null) {
                    throw new Error("Failed to generate next dialog line.");
                }

                // add the line to the dialog and the action context
                agent.events.push(AgentEvent.info(`${speaker.name}: ${dialogLine.line}`, "action:agent"));
                dialog.lines.push(dialogLine);
                action.addDialogLine({
                    speakerId: speaker.id,
                    line: dialogLine.line,
                    endConversation: dialogLine.endConversation
                });

                // check if the dialog is over
                if (dialogLine.endConversation) {
                    // wait for an additional fixed time period
                    agent.events.push(AgentEvent.process(`Dialog ended.`, "action:agent"));
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    break;
                }

                // swap speaker and listener
                const temp = speaker;
                speaker = listener;
                listener = temp;
            }

            // store the dialog in a memory (for both agents)
            this.game.getController<MemoryController>("memory").saveDialogMemory(agent, dialog);
            this.game.getController<MemoryController>("memory").saveDialogMemory(interlocutor, dialog);

            // store a memory for all surrounding agents
            Array(...this.state.agents.values())
                .filter((observer) => agent.currentArea === observer.currentArea && agent.currentSubarea === observer.currentSubarea && observer.id !== agent.id && observer.id !== interlocutor!.id)
                .forEach((observer) => this.game.getController<MemoryController>("memory").saveToMemory(observer!, `I saw ${agent.name} and ${interlocutor!.name} having a conversation.`));

        } catch (e) {
            throw e;
        } finally {
            // release the interlocutor if it was involved in the interaction
            if (interlocutor && interlocutor.action.kind === ActionType.RESPONDING_TO_AGENT) {
                interlocutor.previousAction = interlocutor.action;
                interlocutor.action = new NoneAction();
                interlocutor.lastActionCheckTimestamp = this.state.time;
            }
        }
    }

    private findRandomTarget() {
        for (let i = 0; i < 100; i++) {
            const x = Math.floor(this.state.tilemap.size.x * Math.random());
            const y = Math.floor(this.state.tilemap.size.y * Math.random());

            const target = new Vector2(x, y);
            const tile = this.state.tilemap.getTile(target);

            if (tile && !tile.collides) {
                return target;
            }
        }

        throw new Error("Could not find a valid target after 100 attempts.");
    }

    async onMessage(message: Message, client: Client): Promise<Message | void> {
        switch (message.messageName) {
            case ForceInteraction.NAME: {
                const forceInteraction = message as ForceInteraction;
                const agent = this.state.agents.get(forceInteraction.agentId);
                if (!agent) {
                    throw new Error(`Agent ${forceInteraction.agentId} not found.`);
                }
                if (!this.agentIsReady(agent)) {
                    throw new Error(`Agent ${forceInteraction.agentId} is not ready for interaction.`);
                }

                switch (forceInteraction.interactionType) {
                    case "agent": {
                        const interlocutor = this.state.agents.get(forceInteraction.otherId);
                        if (!interlocutor) {
                            throw new Error(`Agent ${forceInteraction.otherId} not found.`);
                        }

                        await this.startAgentInteractionAction(agent, interlocutor);
                        break;
                    }

                    case "object": {
                        const object = this.state.objects.get(forceInteraction.otherId);
                        if (!object) {
                            throw new Error(`Object ${forceInteraction.otherId} not found.`);
                        }

                        await this.startObjectInteractionAction(agent, object);
                        break;
                    }

                    default: {
                        throw new Error(`Invalid interaction type: ${forceInteraction.interactionType}.`);
                    }
                }

                break;
            }
            default: {
                break;
            }
        }
    }
}
