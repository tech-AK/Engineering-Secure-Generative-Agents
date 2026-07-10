import Vector2 from "../../common/utils/vector"
import Tilemap from "../../common/state/tilemap";

export type TilemapCollisionResult = {
    offsetId: number;
    distance: number;
};

export class TilemapCollisionDetector {
    static readonly RELEVANT_OFFSETS = [
        Vector2.RIGHT,
        Vector2.UP_RIGHT,
        Vector2.UP,
        Vector2.UP_LEFT,
        Vector2.LEFT,
        Vector2.DOWN_LEFT,
        Vector2.DOWN,
        Vector2.DOWN_RIGHT
    ];

    constructor(private tilemap: Tilemap) {}

    collidesAt(position: Vector2): boolean {
        return this.tilemap.getTile(position)?.collides ?? true;
    }

    getCollisions(position: Vector2): TilemapCollisionResult[] {
        const tilePosition = position.round();

        const collisions = TilemapCollisionDetector.RELEVANT_OFFSETS
            .map((offset, index) => {
                const neighborPosition = tilePosition.add(offset);

                // no collision with the neighbor tile
                if (!this.collidesAt(neighborPosition)) {
                    return Infinity
                }

                // return the distance to the neighbor tile
                return position.chebyshevDistanceTo(neighborPosition) - 1;
            })
            .map((distance, offsetId) => ({
                offsetId,
                distance
            }))
            .filter(({ distance }) => distance < 0);

        return collisions;
    }

    resolveCollisions(collisions: TilemapCollisionResult[]): Vector2 {
        // nothing to resolve
        if (collisions.length === 0) {
            return Vector2.ZERO;
        }

        // sort collisions by distance
        collisions.sort((a, b) => a.distance - b.distance);

        // resolve the first collision
        const collision = collisions[0];
        return TilemapCollisionDetector.RELEVANT_OFFSETS[collision.offsetId].multiply(collision.distance);
    }
}
