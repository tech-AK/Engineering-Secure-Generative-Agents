import { reactive } from "vue";
import { useGame } from "../game";
import type GameState from "../../common/state/gamestate";
import { type ObjectView, useObjectView } from "./objectView";

export type ObjectListView = Record<string, ObjectView>;

export function useObjectListView(): ObjectListView {
    // get the game singleton
    const game = useGame();

    // create a reactive object list
    const target = reactive({} as ObjectListView);

    // setup reactive listeners for add and remove events
    game.on("login", (state: GameState) => {
        state.objects.onAdd((object) => target[object.id] = useObjectView(object.id));
        state.objects.onRemove((object) => delete target[object.id]);
    });

    return target;
}
