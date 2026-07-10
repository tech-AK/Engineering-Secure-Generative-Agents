import { reactive } from "vue";
import { useGame } from "../game";
import type GameState from "../../common/state/gamestate";
import { type AgentView, useAgentView } from "./agentView";

export type AgentListView = Record<string, AgentView>;

export function useAgentListView(): AgentListView {
    // get the game singleton
    const game = useGame();

    // create a reactive agent list
    const target = reactive({} as AgentListView);

    // setup reactive listeners for add and remove events
    game.on("login", (state: GameState) => {
        state.agents.onAdd((agent) => target[agent.id] = useAgentView(agent.id));
        state.agents.onRemove((agent) => delete target[agent.id]);
    });

    return target;
}
