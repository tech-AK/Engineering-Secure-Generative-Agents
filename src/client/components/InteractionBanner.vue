<template>
    <div
        v-if="ownAgent"
        class="px-4 py-2 max-w-128 bg-bg text-center rounded-lg shadow-lg transition-all duration-200"
        :class="visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'"
    >
        <h1 class="mb-4">{{ name }}</h1>

        <div
            v-if="isKeypadDoor"
            class="w-32 h-48 mx-auto grid grid-cols-3 grid-rows-4 gap-0.5"
        >
            <button
                v-for="k, i in [7, 8, 9, 4, 5, 6, 1, 2, 3, -1, 0, -1]"
                :key="i"
                class="text-white font-bold text-2xl rounded-lg"
                :class="{
                    'opacity-0': k === -1,
                    'bg-red': pressedDigit === k,
                    'bg-bg-mute': pressedDigit !== k
                }"
            >
                {{ k === -1 ? "" : k }}
            </button>
        </div>

        <p
            v-else-if="isObject"
            v-for="s, i in availableStates"
            :key="s"
            :class="{
                'text-green font-bold': objectInteractionRunning
                    ? i === selectedStateIndex
                    : s.trim() === currentState.trim(),
                'text-2xl': objectInteractionRunning && i === selectedStateIndex
            }"
            class="transition-all duration-200 ease-linear"
        >
            <span v-if="objectInteractionRunning && !processingStateChange && i === selectedStateIndex">&gt;</span>
            {{ s }}
            <span v-if="objectInteractionRunning && !processingStateChange && i === selectedStateIndex">&lt;</span>
        </p>

        <div v-if="isKeypadDoor" class="text-4xl font-bold mt-4">Code: {{ code || '&nbsp;' }}_</div>

        <div v-if="isKeypadDoor" class="text-2xl mt-2">{{ codeStatus }}</div>

        <h2 class="mt-4">
            <template v-if="!isObject">Press <kbd>SPACE</kbd> to chat</template>
            <template v-else-if="isKeypadDoor">Press <kbd>0</kbd>..<kbd>9</kbd> to enter the code<br>Confirm with <kbd>ENTER</kbd></template>
            <template v-else-if="!objectInteractionRunning">Press <kbd>SPACE</kbd> to change</template>
            <template v-else-if="!processingStateChange">Select (<kbd>W</kbd>/<kbd>S</kbd>) a new state and confirm with <kbd>SPACE</kbd></template>
            <template v-else>Setting new state ...</template>
        </h2>
    </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, ref } from "vue";
import { useOwnAgentRef } from "@/views/agentView";
import { ActionType } from "@common/state/action";
import { useGame } from "@/game";
import { ObjectStateRequest, ObjectStateResponse, PinCodeRequest, PinCodeResponse } from "@common/messages/interaction";

const emit = defineEmits(["startInteraction"]);

const game = useGame();
const ownAgent = useOwnAgentRef();

const objectInteractionRunning = computed(() => ownAgent.value?.action.kind === ActionType.INTERACTING_WITH_OBJECT);
const processingStateChange = ref(false);

onMounted(() => {
    // register key listener
    window.addEventListener("keydown", async (event) => {
        if (!objectInteractionRunning.value && nearestInteractable.value && !isKeypadDoor.value) {
            // interaction initialization is handled by the parent component
            if (event.key === " ") {
                emit("startInteraction", nearestInteractable.value.id);
            }
        }
        
        if (objectInteractionRunning.value && !processingStateChange.value) {
            if (event.key === "w" || event.key === "ArrowUp") {
                selectedStateIndex.value = Math.max(0, selectedStateIndex.value - 1);
            }

            if (event.key === "s" || event.key === "ArrowDown") {
                selectedStateIndex.value = Math.min(availableStates.value.length - 1, selectedStateIndex.value + 1);
            }

            if (event.key === " " || event.key === "Enter") {
                game.room?.send(ObjectStateResponse.NAME, new ObjectStateResponse(id.value, availableStates.value[selectedStateIndex.value]));
                processingStateChange.value = true;
            }

            if (event.key === "Escape") {
                // send the same state that the object already had (currentState)
                game.room?.send(ObjectStateResponse.NAME, new ObjectStateResponse(id.value, currentState.value));
                processingStateChange.value = true;
            }
        }

        if (isKeypadDoor.value) {
            if (event.key === "Escape") {
                code.value = "";
            }

            if (event.key === "Backspace") {
                code.value = code.value.slice(0, -1);
            }

            if (event.key === " " || event.key === "Enter") {
                // try to enter the pin code
                const request = new PinCodeRequest(id.value, code.value);
                const response = await game.sendServerRequest(request, PinCodeResponse.NAME) as PinCodeResponse;
                if (response.success) {
                    codeStatus.value = "Correct!";
                } else {
                    codeStatus.value = "Incorrect!";
                    code.value = "";
                }
            }

            if (event.key.match(/^[0-9]$/)) {
                // limit code to 5 digits
                if (code.value.length < 5) {
                    code.value += event.key;
                }

                pressedDigit.value = parseInt(event.key);
            }
        }
    });

    window.addEventListener("keyup", (event) => {
        if (pressedDigit.value === parseInt(event.key)) {
            pressedDigit.value = -1;
        }
    });
});

const interactables = computed(() => {
    // make sure we have an agent who is doing nothing
    if (!ownAgent.value) return [];
    if (ownAgent.value.action.kind !== ActionType.NONE) return [];

    // merge agents and object within sight
    return [
        ...ownAgent.value.agentsWithinSight,
        ...ownAgent.value.objectsWithinSight
            .filter((entity) => !(entity.name.startsWith("door to secret room") && entity.state === "open")) // filter out already opened doors
    ];
});

// filter and sort by nearest interactables
const nearestInteractable = computed(() => interactables.value
    .filter((entity) => entity.distance < 2)
    .sort((a, b) => a.distance - b.distance)[0] ?? null);

const visible = computed(() => !!nearestInteractable.value || objectInteractionRunning.value);

const id = ref("");
const name = ref("");
const isObject = ref(false);
const isKeypadDoor = ref(false);
const currentState = ref("");
const availableStates = ref([] as string[]);
const selectedStateIndex = ref(0);

const code = ref("");
const codeStatus = ref("");
const pressedDigit = ref(-1);

watch(nearestInteractable, (entity) => {
    if (entity) {
        // update the model
        id.value = entity.id;
        name.value = entity.name;
        isObject.value = entity.hasOwnProperty("availableStates");
        isKeypadDoor.value = entity.hasOwnProperty("availableStates") && entity.name.startsWith("door to secret room");

        // set object specific values
        if (isObject.value) {
            currentState.value = entity.state ?? "";
            availableStates.value = entity.availableStates ?? [];
            selectedStateIndex.value = entity.state ? availableStates.value.indexOf(entity.state) : 0;
        }
    } else {
        code.value = "";
    }

    processingStateChange.value = false;
});

// reset code and status when the door is no longer in sight
watch(visible, (value) => {
    if (!value) {
        code.value = "";
        codeStatus.value = "";
    }
});
</script>
