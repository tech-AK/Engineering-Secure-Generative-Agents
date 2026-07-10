<template>
    <div class="fixed left-0 top-0 w-screen h-screen flex flex-col">
        <TitleBar
            class="flex-none z-10"
            v-model:displayMenu="displayMenu"
        />

        <div class="grow relative">
            <!-- Main Renderer -->
            <GameRenderer
                ref="renderer"
                class="absolute inset-0"
                @ready="rendererReady = true"
                @destroy="rendererReady = false"
                v-model:eventFocus="rendererFocus"
            />

            <!-- UI Windows -->
            <div class="absolute inset-4 flex space-x-4 pointer-events-none">
                <div class="grow flex flex-col justify-between h-full space-y-4 pointer-events-none">
                    <EntityListWindow
                        class="shrink w-72 pointer-events-auto"
                        :expandedClasses="['h-auto']"
                        v-model:selectedAgentId="selectedAgentId"
                        v-model:selectedObjectId="selectedObjectId"
                    />

                    <DialogWindow
                        ref="dialog"
                        class="flex-none w-full pointer-events-auto"
                        :expandedClasses="['h-64']"
                        v-model:eventFocus="dialogFocus"
                    />
                </div>

                <div class="flex-none flex flex-col justify-between h-full space-y-4 pointer-events-none">
                    <AgentInfoWindow
                        v-if="selectedAgentId"
                        class="shrink w-72 pointer-events-auto"
                        :expandedClasses="['h-full']"
                        :agentId="selectedAgentId"
                    />

                    <ObjectInfoWindow
                        v-else-if="selectedObjectId"
                        class="shrink w-72 pointer-events-auto"
                        :expandedClasses="['h-auto']"
                        :objectId="selectedObjectId"
                    />
                </div>
            </div>

            <!-- Mount Interaction Banner only when the game has finished loading -->
            <InteractionBanner
                v-if="rendererReady"
                class="absolute left-1/2 top-4 -translate-x-1/2 z-10 pointer-events-none"
                @startInteraction="startInteraction($event)"
            />

            <!-- Loading Overlay -->
            <div
                class="absolute inset-0 flex justify-center items-center bg-bg-mute z-50 transition-all duration-500"
                :class="rendererReady ? 'opacity-0' : 'opacity-100'"
                v-if="!rendererReadyDelayed"
            >
                <h1 class="text-fg text-4xl text-center">{{ loadingText }}</h1>
            </div>

            <!-- Key Bindings Overlay -->
            <div
                class="absolute inset-0 flex justify-center items-center bg-bg-mute bg-opacity-95 z-50 transition-all duration-200"
                v-if="displayMenu"
                @click="displayMenu = false"
            >
                <div class="flex flex-col p-4 text-2xl">
                    <div
                        v-for="{ keys, action } in [
                            {
                                keys: ['W', 'A', 'S', 'D'],
                                action: 'Walk'
                            },
                            {
                                keys: ['Shift'],
                                action: 'Sprint'
                            },
                            {
                                keys: ['Space'],
                                action: 'Interact'
                            },
                            {
                                keys: ['Mouse Drag'],
                                action: 'Move the Map'
                            },
                            {
                                keys: ['Mouse Wheel'],
                                action: 'Zoom the Map'
                            }
                        ]"
                        :key="action"
                        class="flex my-2"
                    >
                        <div class="w-64 text-right -mx-1">
                            <kbd
                                v-for="key in keys"
                                :key="key"
                                class="mx-1"
                            >
                                {{ key }}
                            </kbd>
                        </div>
                        <div class="mx-2">&mdash;</div>
                        <div class="w-64">{{ action }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, watchEffect, computed } from "vue";
import { useGame } from "./game";
import GameRenderer from "./components/gameRenderer/GameRenderer.vue";
import TitleBar from "./components/TitleBar.vue";
import EntityListWindow from "./components/EntityListWindow.vue";
import AgentInfoWindow from "./components/AgentInfoWindow.vue";
import ObjectInfoWindow from "./components/ObjectInfoWindow.vue";
import InteractionBanner from "./components/InteractionBanner.vue";
import DialogWindow from "./components/DialogWindow.vue";
import { useOwnAgentRef } from "./views/agentView";
import { AgentInteractionFailureResponse, AgentInteractionRequest, AgentInteractionSuccessResponse, ObjectInteractionFailureResponse, ObjectInteractionRequest, ObjectInteractionSuccessResponse } from "@common/messages/interaction";

const game = useGame();
const ownAgent = useOwnAgentRef();

const renderer = ref<(typeof GameRenderer & HTMLElement) | null>(null);
const dialog = ref<typeof DialogWindow | null>(null);

const displayMenu = defineModel("displayMenu", { type: Boolean, default: false });
const rendererFocus = defineModel("rendererFocus", { type: Boolean, default: true });
const dialogFocus = defineModel("dialogFocus", { type: Boolean, default: false });

const selectedAgentId = defineModel("selectedAgentId", { type: String, default: "" });
const selectedObjectId = defineModel("selectedObjectId", { type: String, default: "" });

const loadingText = ref("Connecting...");
const rendererReady = ref(false);
const rendererReadyDelayed = ref(false);

game.on("connected", () => loadingText.value = "Logging in...");
game.on("login", () => loadingText.value = "Loading World...");
game.on("logout", () => {
    loadingText.value = "Server disconnected. Trying to reconnect...";

    // reload the page as soon as the server is back online
    const reloadIfServerAlive = async () => {
        try {
            const res = await fetch("/", { method: "HEAD" });
            if (res.ok) {
                window.location.reload();
            } else {
                throw new Error("Server not reachable");
            }
        } catch (e) {
            // try again in 1 second
            setTimeout(reloadIfServerAlive, 1000);
        }
    }
    reloadIfServerAlive();
});

// create a delayed value for renderer ready
watch(rendererReady, (value) => {
    if (value) {
        setTimeout(() => rendererReadyDelayed.value = true, 500);
    } else {
        rendererReadyDelayed.value = false;
    }
});

// select the agent or object to follow
watch(selectedAgentId, (agentId) => agentId && rendererReady && renderer.value && renderer.value.followAgent(agentId));
watch(selectedObjectId, (objectId) => objectId && rendererReady && renderer.value && renderer.value.followObject(objectId));

async function startInteraction(id: string) {
    try {
        if (game.state?.agents.has(id)) {
            const req = new AgentInteractionRequest(id);
            const res = await game.sendServerRequest(req, AgentInteractionSuccessResponse.NAME, AgentInteractionFailureResponse.NAME, 20 * 60_000);
        } else if (game.state?.objects.has(id)) {
            const req = new ObjectInteractionRequest(id);
            const res = await game.sendServerRequest(req, ObjectInteractionSuccessResponse.NAME, ObjectInteractionFailureResponse.NAME, 20 * 60_000);
        } else {
            console.error("Invalid interaction target:", id);
        }
    } catch (e) {
        console.error("Interaction failed:", e);
    }
}

// make sure renderer and dialog are never focused at the same time
watchEffect(() => {
    if (dialogFocus.value) {
        rendererFocus.value = false;
    }
})
watchEffect(() => {
    if (rendererFocus.value) {
        dialogFocus.value = false;
    }
})
</script>

<style scoped>
</style>
