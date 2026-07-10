<template>
    <Window
        :title="object ? object.capitalName : 'Object Info'"
    >
        <template v-if="object">
            <div class="px-4 py-2">
                <h3>Info</h3>
                <p>ID: #{{ object.id }}</p>
            </div>
            <div class="px-4 py-2">
                <h3>States</h3>

                <div
                    v-for="state in object.availableStates"
                    :key="state"
                    :class="{
                        'text-green font-bold': object.state === state
                    }"
                >
                    {{ state }}
                </div>
            </div>
        </template>
        <p v-else class="text-center italic p-2">No object selected</p>
    </Window>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Window from "./window/Window.vue";
import { useObjectView } from "../views/objectView";

const props = defineProps({
    objectId: String,
});
const object = computed(() => props.objectId ? useObjectView(props.objectId) : null);

</script>
