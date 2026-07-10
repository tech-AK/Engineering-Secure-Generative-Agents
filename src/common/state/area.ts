import { Schema, MapSchema, type } from "@colyseus/schema";
import Subarea from "./subarea";

export default class Area extends Schema {
    @type("string") name: string;
    @type({ map: Subarea }) subareas = new MapSchema<Subarea>();

    constructor(name: string) {
        super();
        this.name = name;
    }
}
