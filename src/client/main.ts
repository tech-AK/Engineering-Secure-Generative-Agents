import { importTest } from "../common/importtest";
import { useGame } from "./game";
import { createApp } from "vue";
import App from "./App.vue";
import "./index.css";

if (!importTest()) {
    throw "Import Test failed";
}

createApp(App).mount("#app");

const game = useGame();
try {
    game.login();
} catch (e) {
    console.error("Failed to login:", e);
}
