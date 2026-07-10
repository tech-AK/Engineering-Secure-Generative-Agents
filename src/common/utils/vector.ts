import Direction from './direction';

export default class Vector2 {
    static readonly ZERO = new Vector2(0, 0);
    static readonly ONE = new Vector2(1, 1);

    static readonly RIGHT = new Vector2(1, 0);
    static readonly UP_RIGHT = new Vector2(1, -1);
    static readonly UP = new Vector2(0, -1);
    static readonly UP_LEFT = new Vector2(-1, -1);
    static readonly LEFT = new Vector2(-1, 0);
    static readonly DOWN_LEFT = new Vector2(-1, 1);
    static readonly DOWN = new Vector2(0, 1);
    static readonly DOWN_RIGHT = new Vector2(1, 1);

    x: number;
    y: number;

    constructor(x: number | { x: number, y: number }, y?: number) {
        if (y === undefined) {
            const other = x as Vector2;
            this.x = other.x;
            this.y = other.y;
        } else {
            this.x = x as number;
            this.y = y;
        }
    }

    add(other: Vector2): Vector2 {
        return new Vector2(this.x + other.x, this.y + other.y);
    }

    subtract(other: Vector2): Vector2 {
        return new Vector2(this.x - other.x, this.y - other.y);
    }

    multiply(scalar: number): Vector2 {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    divide(scalar: number): Vector2 {
        return new Vector2(this.x / scalar, this.y / scalar);
    }

    get magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    get argument(): number {
        return Math.atan2(this.y, this.x);
    }

    equals(other: Vector2): boolean {
        return this.x === other.x && this.y === other.y;
    }

    normalize(): Vector2 {
        if (this.magnitude === 0) {
            return Vector2.ZERO;
        } else {
            return this.divide(this.magnitude);
        }
    }

    distanceTo(other: Vector2): number {
        return other.subtract(this).magnitude;
    }

    manhattanDistanceTo(other: Vector2): number {
        return Math.abs(other.x - this.x) + Math.abs(other.y - this.y);
    }

    chebyshevDistanceTo(other: Vector2): number {
        return Math.max(Math.abs(other.x - this.x), Math.abs(other.y - this.y));
    }

    floor(): Vector2 {
        return new Vector2(Math.floor(this.x), Math.floor(this.y));
    }

    ceil(): Vector2 {
        return new Vector2(Math.ceil(this.x), Math.ceil(this.y));
    }

    round(): Vector2 {
        return new Vector2(Math.round(this.x), Math.round(this.y));
    }

    lerp(other: Vector2, alpha: number): Vector2 {
        const x = this.x + (other.x - this.x) * alpha;
        const y = this.y + (other.y - this.y) * alpha;
        return new Vector2(x, y);
    }

    toString(): string {
        return `Vector2(${this.x}, ${this.y})`;
    }

    asDirection(): Direction {
        if (Math.abs(this.x) >= Math.abs(this.y)) {
            if (this.x > 0) {
                return Direction.RIGHT;
            } else {
                return Direction.LEFT;
            }
        } else {
            if (this.y > 0) {
                return Direction.DOWN;
            } else {
                return Direction.UP;
            }
        }
    }

    static fromDirection(direction: Direction): Vector2 {
        switch (direction) {
            case Direction.UP:
                return Vector2.UP;
            case Direction.DOWN:
                return Vector2.DOWN;
            case Direction.LEFT:
                return Vector2.LEFT;
            case Direction.RIGHT:
                return Vector2.RIGHT;
        }
    }
}
