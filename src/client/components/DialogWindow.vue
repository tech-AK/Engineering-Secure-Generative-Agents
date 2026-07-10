<template>
    <Window
        :title="currentListenerName ? `Chat with ${currentListenerName}` : 'Chat'"
        :collapsed="!agentInteractionRunning"
    >
        <template
            class="flex flex-col h-full w-full"
        >
            <div class="grow overflow-y-scroll px-4 py-2">
                <div
                    v-for="line, index in currentDialog"
                    :key="index"
                >
                    <b>{{ ownAgent.value?.id === line.speakerId ? "You" : currentListenerName }}:</b> {{ line.line }}
                </div>
                <div
                    v-if="currentDialog.length === 0"
                    class="text-center"
                >
                </div>
            </div>

            <div class="h-2 bg-bg-mute"></div>

            <div class="flex">
                <input
                    ref="input"
                    type="text"
                    class="grow w-full px-4 py-2 bg-bg text-fg focus:ring-0 focus:outline-none disabled:bg-bg-mute disabled:opacity-50"
                    :placeholder="inputEnabled ? 'Type your message ...' : (`${currentListenerName} is responding ...` ?? '...')"
                    :disabled="!inputEnabled"
                    @click="eventFocus = true"
                    @mousedown="eventFocus = true"
                    @submit="submitDialogLine()"
                    @keypress.enter="submitDialogLine()"
                    @keypress.escape="submitDialogLine(true)"
                />

                <button
                    class="px-4 py-2 bg-bg-mute text-fg"
                    @click="submitDialogLine(true)"
                >
                    End&nbsp;Conversation
                </button>
            </div>
        </template>
    </Window>
</template>

<script setup lang="ts">
import { watchEffect, ref, watch, computed, onMounted } from "vue";
import { useGame } from "@/game";
import Window from "./window/Window.vue";
import { DialogLineRequest, DialogLineResponse } from "@common/messages/interaction";
import { useOwnAgentRef } from "@/views/agentView";
import { ActionType } from "@common/state/action";
import type { DialogLine } from "@common/types/dialog";

const game = useGame();
const ownAgent = useOwnAgentRef();

const eventFocus = defineModel("eventFocus", { type: Boolean, default: false });

const input = ref<HTMLInputElement | null>(null);

const currentListenerName = ref<string>("");
const currentDialog = ref<DialogLine[]>([]);

const agentInteractionRunning = computed(() => ownAgent.value?.action.kind === ActionType.INTERACTING_WITH_AGENT);

const inputEnabled = ref(false);

game.on("login", () => {
    game.room?.onMessage(DialogLineRequest.NAME, (message: DialogLineRequest) => {
        currentListenerName.value = message.listenerName;
        currentDialog.value = message.history;

        startDialogLine();
    });
})

// focus when a dialog starts
watch(ownAgent, () => {
    eventFocus.value = ownAgent.value?.action.kind === ActionType.INTERACTING_WITH_AGENT;
});

// focus the input when a new dialog starts
watch(agentInteractionRunning, () => {
    if (agentInteractionRunning.value) {
        eventFocus.value = true;
    }
});

// update the input focus depending on the event focus model
watch(eventFocus, (value) => {
    if (value) {
        input.value?.focus();
    } else {
        input.value?.blur();
    }
});
watch(inputEnabled, (value) => {
    if (value && eventFocus.value) {
        setTimeout(() => input.value?.focus(), 1);
    }
})

function startDialogLine() {
    if (input.value) input.value.value = "";
    inputEnabled.value = true;
}

function submitDialogLine(endConversation: boolean = false) {
    const line = input.value?.value ?? "";
    if (!line && !endConversation) return;

    if (input.value) input.value.value = "";
    inputEnabled.value = false;

    // send a dialog response
    game.room?.send(DialogLineResponse.NAME, new DialogLineResponse(line, endConversation));

    // add the line to the dialog history
    currentDialog.value = [
        ...currentDialog.value,
        {
            speakerId: ownAgent.value?.id ?? "",
            line,
            endConversation
        }
    ];
}
</script>
