<template>
    <div class="w-full h-12 flex bg-bg-mute shadow-lg overflow-hidden">
        <div class="flex-none flex justify-start items-center w-48 px-4">
            <button @click="displayMenu = !displayMenu">
                <h2>Key Map</h2>
            </button>
        </div>
        <div class="grow flex justify-center items-center">
            <h1>Engineering Secure Generative Agents</h1>
        </div>
        <div class="flex-none flex justify-end items-center w-48 px-4">
            <h2>{{ time }}</h2>
        </div>
    </div>
</template>

<script setup>
import { ref } from "vue";
import { useGame } from "../game";

const displayMenu = defineModel("displayMenu", { type: Boolean, default: false });
const time = ref("");

// update time in a fixed interval
const game = useGame();
setInterval(() => {
    if (game.state?.time) {
        time.value = new Date(game.state.time).toLocaleString("de-DE", {
            timezone: "UTC",
            dateStyle: "short",
            timeStyle: "short"
        });
    }
}, 100);
</script>

<style scoped>
</style>
