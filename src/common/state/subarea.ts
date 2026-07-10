import { Schema, ArraySchema, type } from "@colyseus/schema";

export default class Subarea extends Schema {
    @type("string") name: string;
    @type([ "string" ]) objectIds = new ArraySchema<string>();
    @type([ "string" ]) agentIds = new ArraySchema<string>();

    constructor(name: string) {
        super();
        this.name = name;
    }
}
