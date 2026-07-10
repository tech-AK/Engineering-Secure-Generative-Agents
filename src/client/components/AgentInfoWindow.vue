<template>
    <Window
        :title="agent ? agent.name : 'Agent Info'"
    >
        <template v-if="agent">
            <div class="px-4 py-2">
                <h3>Info</h3>
                <p>ID: #{{ agent.id }}</p>
                <p>Action: {{ agent.action.description }}</p>
                <p>Location: {{ agent.locationDescription }}</p>
            </div>

            <div class="h-2 bg-bg-mute"></div>

            <div class="px-4 py-2">
                <h3>Agents within sight</h3>

                <div
                    v-for="other in agent.agentsWithinSight"
                    :key="other.id"
                    class="flex group"
                >
                    <div class="w-16">{{ other.distance.toFixed(1) }}m</div>
                    <div class="grow">{{ other.name }}</div>
                    <div class="w-0 relative hidden group-hover:inline"><button class="absolute px-2 py-0.25 right-0 top-0 bg-yellow text-bg-mute text-sm" @click="forceInteraction('agent', other.id)">interact</button></div>
                </div>

                <p v-if="agent.agentsWithinSight.length === 0" class="text-center italic p-2">No agents within sight</p>
            </div>

            <div class="h-2 bg-bg-mute"></div>

            <div class="px-4 py-2">
                <h3>Objects within sight</h3>

                <div
                    v-for="object in agent.objectsWithinSight"
                    :key="object.id"
                    class="flex group"
                >
                    <div class="w-16">{{ object.distance.toFixed(1) }}m</div>
                    <div class="grow">{{ object.name }}</div>
                    <div class="w-0 relative hidden group-hover:inline"><button class="absolute px-2 py-0.25 right-0 top-0 bg-red text-bg-mute text-sm" @click="forceInteraction('object', object.id)">interact</button></div>
                </div>

                <p v-if="agent.objectsWithinSight.length === 0" class="text-center italic p-2">No objects within sight</p>
            </div>

            <div class="h-2 bg-bg-mute"></div>

            <div class="px-4 py-2 min-h-48 grow overflow-y-scroll">
                <h3>Events</h3>

                <p v-if="events.length === 0" class="text-center italic p-2">No events yet</p>

                <div
                    v-for="event, index in events"
                    :key="event.text + index"
                    :class="{
                        'text-yellow font-bold': event.level === AgentEventLevel.WARNING,
                        'text-red-300 font-bold': event.level === AgentEventLevel.ERROR
                    }"
                >
                    <span v-if="event.category === 'action:moving'" class="text-green">[Moving] </span>
                    <span v-if="event.category === 'action:agent'" class="text-yellow">[Dialog] </span>
                    <span v-if="event.category === 'action:object'" class="text-red">[Object] </span>
                    <span v-if="event.category === 'memory'" class="text-blue">[Memory] </span>
                    <span v-html="formatEventText(event.text)"></span>
                </div>
            </div>

            <div class="h-2 bg-bg-mute"></div>
        </template>
        <p v-else class="text-center italic p-2">No agent selected</p>
    </Window>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Window from "./window/Window.vue";
import { useAgentView } from "../views/agentView";
import { AgentEventLevel } from "../../common/state/agent";
import { useGame } from "@/game";
import { ForceInteraction } from "@common/messages/interaction";

const props = defineProps({
    agentId: String,
});
const agent = computed(() => props.agentId ? useAgentView(props.agentId) : null);
const events = computed(() => agent.value ? agent.value.events.slice() : []);

const game = useGame();

// Method to format event text: Use real line break instead of \n and use " instead of escaped \"
const formatEventText = (text: string) => {
    return text.replace(/\\n/g, "<br>").replace(/\\"/g, "\"");
};

const forceInteraction = (type: "agent" | "object", otherId: string) => {
    if (!agent.value) {
        console.error("Cannot force interaction. No agent selected.");
    }
    const req = new ForceInteraction(agent.value!.id, type, otherId);
    game.room?.send(req.messageName, req);
};

</script>
