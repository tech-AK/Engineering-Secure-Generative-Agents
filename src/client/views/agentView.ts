import { reactive, ref } from "vue";
import { Game, useGame } from "../game";
import Agent, { AgentEventLevel, AgentState } from "../../common/state/agent";
import { ActionType, type InteractingWithAgentActionContext, type InteractingWithObjectActionContext, type MovingActionContext, type RespondingToAgentActionContext } from "../../common/state/action";
import type Action from "../../common/state/action";
import Vector2 from "../../common/utils/vector";
import type IObject from "../../common/state/iobject";
import { delayPromise, timeoutPromise } from "@common/utils/promises";

export type ActionView = {
    kind: ActionType;
    context: any;
    description: string;
}

export type EntityWithinSightView = {
    id: string;
    name: string;
    distance: number;
    state?: string;
    availableStates?: string[];
}

export type AgentEventView = {
    level: AgentEventLevel;
    text: string;
    category: string;
}

export type AgentView = {
    id: string;
    name: string;
    state: number;
    action: ActionView;
    previousAction: ActionView;
    events: AgentEventView[];

    controllingPlayerId: string;
    controllingPlayerName: string | null;
    isOwnAgent: boolean;

    currentArea: string;
    currentSubarea: string;
    locationDescription: string;

    agentsWithinSight: EntityWithinSightView[];
    objectsWithinSight: EntityWithinSightView[];
}

export const useAgentView = (agentId: string): AgentView => {
    // get the game singleton
    const game = useGame();

    // create a reactive agent object
    const target = reactive({} as AgentView);

    const createControllingPlayerName = (agent: Agent) => {
        if (agent.controllingPlayerId === "") {
            return null;
        } else if (agent.controllingPlayerId === game.room!.sessionId) {
            return "you";
        } else {
            return game.state!.players.get(agent.controllingPlayerId)?.name || null;
        }
    };

    const createActionDescription = (action: Action, agent: Agent) => {
        const context = JSON.parse(action.contextStr);

        switch (action.kind) {
            case ActionType.NONE:
                return "doing nothing";
            case ActionType.UNDECIDED:
                return "deciding what to do next";
            case ActionType.MOVING: {
                const { target } = context as MovingActionContext;
                if (!target) {
                    return "deciding where to walk to"
                } else {
                    return `walking to ${target.area}: ${target.subarea} (at ${target.position.x}, ${target.position.y})`;
                }
            }
            case ActionType.INTERACTING_WITH_AGENT: {
                const { interlocutor } = context as InteractingWithAgentActionContext;
                if (!interlocutor) {
                    return "deciding who to talk to";
                } else {
                    return `talking to ${interlocutor.name}`;
                }
            }
            case ActionType.INTERACTING_WITH_OBJECT: {
                const { object } = context as InteractingWithObjectActionContext;
                if (!object) {
                    return "deciding what to interact with";
                } else {
                    return `interacting with ${object.name}`;
                }
            }
            case ActionType.RESPONDING_TO_AGENT: {
                const { initiator } = context as RespondingToAgentActionContext;
                if (!initiator) {
                    return "going to respond to someone";
                } else {
                    return `responding to ${initiator.name}`;
                }
            } default:
                return `unknown action ${action.kind}`;
        }
    };

    const createLocationDescription = (agent: Agent) => {
        return `${agent.currentArea}: ${agent.currentSubarea}`;
    };

    function update(state: Agent) {
        target.id = state.id;
        target.name = state.name;
        target.state = state.state;

        target.action = {
            kind: state.action.kind,
            context: JSON.parse(state.action.contextStr),
            description: createActionDescription(state.action, state)
        }

        target.previousAction = {
            kind: state.previousAction.kind,
            context: JSON.parse(state.previousAction.contextStr),
            description: createActionDescription(state.previousAction, state)
        }

        target.events = state.events.map(event => ({
            level: event.level,
            text: event.text,
            category: event.category
        }));

        target.controllingPlayerId = state.controllingPlayerId;
        target.controllingPlayerName = createControllingPlayerName(state);
        target.isOwnAgent = state.controllingPlayerId === game.room?.sessionId;

        target.currentArea = state.currentArea;
        target.currentSubarea = state.currentSubarea;
        target.locationDescription = createLocationDescription(state);

        target.agentsWithinSight = state.agentsWithinSight
            .map(id => game.state?.agents.get(id) as Agent)
            .filter(agent => agent)
            .map(agent => ({
                id: agent.id,
                name: agent.name,
                distance: new Vector2(agent.position).distanceTo(new Vector2(state.position))
            }));
        target.objectsWithinSight = state.objectsWithinSight
            .map(id => game.state?.objects.get(id) as IObject)
            .filter(object => object)
            .map(object => ({
                id: object.id,
                name: object.name,
                state: String(object.state),
                availableStates: object.availableStates.map(state => String(state)),
                distance: new Vector2(object.position).distanceTo(new Vector2(state.position))
            }));
    }

    // make sure the agent exists
    const agentState = game.state?.agents.get(agentId);
    if (!agentState) {
        throw new Error(`Agent with id ${agentId} not found`);
    }

    // setup reactive listeners
    agentState.listen("state", () => update(agentState));
    agentState.listen("action", () => update(agentState));
    agentState.events.onAdd(() => update(agentState));
    agentState.listen("controllingPlayerId", () => update(agentState));
    agentState.listen("currentArea", () => update(agentState));
    agentState.listen("currentSubarea", () => update(agentState));
    agentState.listen("agentsWithinSight", () => update(agentState));
    agentState.listen("objectsWithinSight", () => update(agentState));
    agentState.action.onChange(() => {
        agentState.action.listen("contextStr", () => update(agentState));
        update(agentState);
    });
    agentState.previousAction.onChange(() => {
        agentState.previousAction.listen("contextStr", () => update(agentState));
        update(agentState);
    });
    game.state?.agents.onChange((agent) => agent.id === agentId && update(agent));

    // initial update
    update(agentState);

    return target;
}

const tryUseOwnAgentView = (game: Game): AgentView | null => {
    const playerId = game.room?.sessionId;
    if (!playerId) {
        return null;
    }

    const agentId = game.state?.players.get(playerId)?.controlledAgent;
    if (!agentId) {
        return null;
    }

    return useAgentView(agentId);
}

let ownAgentSingleton: { value: AgentView | null } = null as any;

export const useOwnAgentRef = () => {
    if (ownAgentSingleton) {
        return ownAgentSingleton;
    }

    const game = useGame();

    // wrap the agent view in a "pseudo-ref" (e. g. a reactive object that contains a value property)
    ownAgentSingleton = reactive({ value: tryUseOwnAgentView(game) });

    game.on("login", async () => {
        // wait until the player agent is available
        while (!ownAgentSingleton.value && game.isLoggedIn()) {
            ownAgentSingleton.value = tryUseOwnAgentView(game);

            if (!ownAgentSingleton.value) {
                console.warn("Own agent not available after login. Retrying...");
            } else {
                console.log(`Own agent found: ${ownAgentSingleton.value.name}`);
            }
            
            await delayPromise(500);
        }
    })

    game.on("logout", () => ownAgentSingleton.value = null);

    return ownAgentSingleton;
}
