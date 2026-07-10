<template>
    <div
        class="flex flex-col overflow-hidden bg-bg opacity-95 hover:opacity-100 shadow-lg transition-all"
        :class="collapsed ? ['h-8'] : expandedClasses"
    >
        <Title
            class="h-8"
            @click="collapsed = !collapsed"
        >{{ title }}</Title>
        <div class="grow flex flex-col overflow-x-hidden overflow-y-auto">
            <slot />
        </div>
    </div>
</template>

<script setup lang="ts">
import { mergeModels } from "vue";
import Title from "./Title.vue";

const collapsed = defineModel("collapsed", { type: Boolean, default: false });

const props = defineProps({
    title: String,
    expandedClasses: { type: Array, default: () => ["w-64", "h-full"] },
});
</script>
