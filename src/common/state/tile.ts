import { Schema, ArraySchema, type } from "@colyseus/schema";

export default class Tile extends Schema {
    @type("boolean") collides: boolean;
    @type("string") area: string;
    @type("string") subarea: string;
    @type([ "string" ]) objects = new ArraySchema<string>();

    constructor(collides: boolean = false, area: string = "", subarea: string = "") {
        super();
        this.collides = collides;
        this.area = area;
        this.subarea = subarea;
    }
}
