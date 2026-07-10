import {Schema, ArraySchema, type} from "@colyseus/schema";
import VectorSchema from "./vectorSchema";
import Vector2 from "../utils/vector";
import { type ObjectTileData as IObjectTileData } from "../types/objectTileData";
import {type SeenObject} from "../types/SeenObject";

export default class IObject extends Schema {
    @type("string") readonly id: string;
    @type("string") readonly name: string;
    @type(["string"]) readonly availableStates: ArraySchema<string>;
    @type("string") state: string;
    @type(VectorSchema) readonly position: VectorSchema;

    @type("string") readonly currentArea: string = "";
    @type("string") readonly currentSubarea: string = "";

    @type("string") readonly tileData: string = "{}";

    constructor(id: string, name: string, states: string[], initState: string, position: Vector2, area: string, subarea: string, tileData: IObjectTileData) {
        super();
        this.id = id;
        this.name = name;
        this.availableStates = new ArraySchema(...states);
        this.state = initState;
        this.position = new VectorSchema(position);

        // objects are static (for now), so the area and subarea are set at creation
        this.currentArea = area;
        this.currentSubarea = subarea;

        // tile data is also static and will be provided as a string
        this.tileData = JSON.stringify(tileData);
    }

    getSeenObjectCopy(): SeenObject {
       return {
            id: this.id,
            state: this.state
        }
    }

}
