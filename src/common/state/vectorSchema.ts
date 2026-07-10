import { Schema, type } from "@colyseus/schema";
import Vector2 from "../utils/vector";

export default class VectorSchema extends Schema {
    @type("number") x: number;
    @type("number") y: number;

    constructor(x: number | { x: number, y: number }, y?: number) {
        super();

        if (y === undefined) {
            const other = x as any as Vector2;
            this.x = other.x;
            this.y = other.y;
        } else {
            this.x = x as number;
            this.y = y;
        }
    }

    get value(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    set value(v: Vector2) {
        this.x = v.x;
        this.y = v.y;
    }
}
