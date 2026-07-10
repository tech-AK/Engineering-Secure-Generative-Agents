<template>
    <Window
        title="Entities"
    >
        <div class="px-4 py-2">
            <h3>Agents</h3>
            <div
                v-for="agent, i in agents"
                :key="agent.id"
                class="-mx-4 px-4 flex items-baseline hover:bg-bg-mute"
                :class="{ 'bg-bg-mute': selectedAgentId === agent.id }"
                @click="selectedAgentId = agent.id; selectedObjectId = null"
            >
                <div>{{ agent.name }} <span v-if="agent.controllingPlayerName">({{ agent.controllingPlayerName }})</span></div>

                <div class="grow"></div>

                <div
                    v-if="agent.action.kind !== ActionType.NONE"
                    class="text-xs font-bold"
                    :class="actionColors[agent.action.kind]"
                >
                    {{ actionShortInfo(agent.action) }}
                </div>
            </div>
        </div>

        <div class="h-2 bg-bg-mute"></div>

        <div class="px-4 py-2">
            <h3>Objects</h3>
            <div
                v-for="object in objects"
                :key="object.id"
                class="-mx-4 px-4 flex items-baseline hover:bg-bg-mute"
                :class="{ 'bg-bg-mute': selectedObjectId === object.id }"
                @click="selectedObjectId = object.id; selectedAgentId = null"
            >
                <div>{{ object.name }}</div>
                <div class="grow"></div>
                <div class="text-xs text-fg-mute">{{ object.state }}</div>
            </div>
        </div>
    </Window>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Window from "./window/Window.vue";
import { useGame } from "../game";
import { useAgentListView } from "../views/agentListView";
import { useObjectListView } from "../views/objectListView";
import Action, { ActionType, type InteractingWithAgentActionContext, type InteractingWithObjectActionContext, type MovingActionContext, type RespondingToAgentActionContext } from "../../common/state/action";
import type { ActionView } from "../views/agentView";

const selectedAgentId = defineModel("selectedAgentId");
const selectedObjectId = defineModel("selectedObjectId");

const agents = useAgentListView();
const objects = useObjectListView();

const game = useGame();

// When the player logs in, select the agent they are controlling
game.on("login", () => {
    game.state!.agents.onAdd((agent) => {
        agent.listen("controllingPlayerId", (value) => {
            if (value === game.room!.sessionId) {
                selectedAgentId.value = agent.id;
            }
        });
    });
});

const actionColors = {
    [ActionType.NONE]: "text-fg-mute",
    [ActionType.MOVING]: "text-green",
    [ActionType.UNDECIDED]: "text-fg-mute",
    [ActionType.INTERACTING_WITH_OBJECT]: "text-red",
    [ActionType.INTERACTING_WITH_AGENT]: "text-yellow",
    [ActionType.RESPONDING_TO_AGENT]: "text-orange"
};

const actionShortInfo = (action: ActionView) => {
    switch (action.kind) {
        case ActionType.NONE:
            return "";
        case ActionType.UNDECIDED:
            return "deciding...";
        case ActionType.MOVING: {
            const context = action.context as MovingActionContext;
            if (context.target) {
                const { x, y } = context.target.position;
                return `move ${x}, ${y}`;
            } else {
                return "move...";
            }
        }
        case ActionType.INTERACTING_WITH_OBJECT: {
            const context = action.context as InteractingWithObjectActionContext;
            if (context.object) {
                return `obj ${context.object.name}`;
            } else {
                return "obj...";
            }
        }
        case ActionType.INTERACTING_WITH_AGENT: {
            const context = action.context as InteractingWithAgentActionContext;
            if (context.interlocutor) {
                return `talk ${context.interlocutor.name}`;
            } else {
                return "talk...";
            }
        }
        case ActionType.RESPONDING_TO_AGENT: {
            const context = action.context as RespondingToAgentActionContext;
            if (context.initiator) {
                return `resp ${context.initiator.name}`;
            } else {
                return "resp...";
            }
        }
    }
};

</script>
