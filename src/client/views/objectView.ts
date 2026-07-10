import { reactive } from "vue";
import { useGame } from "../game";
import type IObject from "../../common/state/iobject";

export type ObjectView = {
    id: string;
    name: string;
    capitalName: string;
    state: string;
    availableStates: string[];

    currentArea: string;
    currentSubarea: string;
    locationDescription: string;
}

export const useObjectView = (objectId: string): ObjectView => {
    // get the game singleton
    const game = useGame();

    // create a reactive agent object
    const target = reactive({} as ObjectView);

    const createLocationDescription = (object: IObject) => {
        return `${object.currentArea}: ${object.currentSubarea}`;
    };

    function update(state: IObject) {
        target.id = state.id;
        target.name = state.name;
        target.capitalName = state.name.replace(/\b\w/g, l => l.toUpperCase());
        target.state = state.state;
        target.availableStates = (state.availableStates as any as string[]).map(s => String(s));

        target.currentArea = state.currentArea;
        target.currentSubarea = state.currentSubarea;
        target.locationDescription = createLocationDescription(state);
    }

    // make sure the object exists
    const objectState = game.state?.objects.get(objectId);
    if (!objectState) {
        throw new Error(`Object with id ${objectState} not found`);
    }

    // setup reactive listeners
    objectState.listen("state", () => update(objectState));
    game.state?.objects.onChange((object) => object.id === objectId && update(object));

    // initial update
    update(objectState);

    return target;
}
