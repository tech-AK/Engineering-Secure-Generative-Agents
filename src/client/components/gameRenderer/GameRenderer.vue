<template>
    <div
        ref="container"
        @click="eventFocus = true"
        @mousedown="eventFocus = true"
    ></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useGame } from "../../game";
import Phaser from "phaser";
import GameScene from "./gamescene";

const eventFocus = defineModel("eventFocus", { type: Boolean, default: true });

const emit = defineEmits(["create", "ready", "destroy"]);

const container = ref<HTMLElement | null>(null);

// no-reactive private variables
const game = useGame();
let phaser: Phaser.Game | null = null;

onMounted(() => {
    if (!container.value) {
        throw new Error("Container element not found");
    }

    // create the game either immediately or after login
    if (game.isLoggedIn()) {
        createPhaser(container.value);
    } else {
        game.on("login", () => {
            createPhaser(container.value!);
        });
    }

    // destroy the game after logout
    game.on("logout", () => destroyPhaser());
});

onUnmounted(() => {
    if (phaser) {
        phaser.destroy(true);
    }
});

watch(eventFocus, (enabled) => {
    if (phaser) {
        phaser.scene.getScene("GameScene").input.enabled = enabled;
        phaser.scene.getScene("GameScene").input.keyboard!.enabled = enabled;
    }
    console.log("renderer focus", enabled);
});

function createPhaser (parent: HTMLElement) {
    console.log("Creating Phaser instance");

    const gameScene = new GameScene(game);
    gameScene.rendererEvents.on("ready", () => emit("ready"));

    phaser = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        scale: {
            mode: Phaser.Scale.ENVELOP,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        width: 1920,
        height: 1080,
        autoRound: true,
        banner: false,
        backgroundColor: "#b0c59e",
        pixelArt: true, // disable smooth scaling
        scene: gameScene,
        audio: {
            noAudio: true // disable audio for now
        }
    });

    emit("create");
};

function destroyPhaser () {
    console.log("Destroying Phaser instance");
    emit("destroy");
    phaser?.destroy(true);
};

function followAgent(agentId: string) {
    if (phaser) {
        const scene = phaser.scene.getScene("GameScene") as GameScene;
        try {
            scene.followAgent(agentId);
        } catch (e) {
            console.error("Failed to follow agent", e);
        }
    }
}

function followObject(objectId: string) {
    if (phaser) {
        const scene = phaser.scene.getScene("GameScene") as GameScene;
        try {
            scene.followObject(objectId);
        } catch (e) {
            console.error("Failed to follow object", e);
        }
    }
}

defineExpose({ followAgent, followObject });
</script>

<style scoped>
</style>
