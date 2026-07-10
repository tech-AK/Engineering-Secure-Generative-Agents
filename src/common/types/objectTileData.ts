import Vector2 from "../utils/vector"

export type ObjectTileData = {
    readonly offset: Vector2;
    readonly size: Vector2;
    readonly data: number[][];
};
