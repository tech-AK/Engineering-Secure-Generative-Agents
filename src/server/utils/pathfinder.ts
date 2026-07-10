import Tilemap from "../../common/state/tilemap";
import Vector2 from "../../common/utils/vector";

class Node {
    h: number = 0;
    g: number = 0;
    f: number = 0;

    parent: Node | null = null;
    onOpenList: boolean = false;
    onClosedList: boolean = false;
    walkable: boolean = false;

    constructor(public readonly position: Vector2) {}

    updateF() {
        this.f = this.g + this.h;
    }

    reset() {
        this.f = 0;
        this.g = 0;
        this.h = 0;
        this.parent = null;
        this.onOpenList = false;
        this.onClosedList = false;
    }
}

class Grid {
    static readonly NEIGHBOR_OFFSETS = [
        Vector2.RIGHT,
        Vector2.UP,
        Vector2.LEFT,
        Vector2.DOWN
    ];

    private nodes: Node[];

    constructor(public readonly width: number, public readonly height: number) {
        this.nodes = new Array(width * height).fill(null).map((_, i) => {
            return new Node(new Vector2(this.indexToPosition(i)));
        });
    }

    indexToPosition(index: number): Vector2 {
        index = Math.floor(index);
        return new Vector2(index % this.width, Math.floor(index / this.width));
    }

    positionToIndex(position: Vector2): number {
        position = position.floor();
        return position.y * this.width + position.x;
    }

    getNode(position: Vector2): Node {
        return this.nodes[this.positionToIndex(position)];
    }

    isInside(position: Vector2): boolean {
        return position.x >= 0 && position.x < this.width && position.y >= 0 && position.y < this.height;
    }

    getNeighbors(position: Vector2): Node[] {
        return Grid.NEIGHBOR_OFFSETS
            .map(offset => position.add(offset))
            .filter(neighbor => this.isInside(neighbor))
            .map(neighbor => this.getNode(neighbor));
    }

    reset() {
        this.nodes.forEach(node => {
            node.reset();
        });
    }

    static fromTilemap(tilemap: Tilemap) {
        const grid = new Grid(tilemap.size.x, tilemap.size.y);

        // set the walkable flag for each node
        for (let x = 0; x < tilemap.size.x; x++) {
            for (let y = 0; y < tilemap.size.y; y++) {
                const node = grid.getNode(new Vector2(x, y));
                node.walkable = !tilemap.getTile(node.position)!.collides;
            }
        }

        return grid;
    }
}

export default class Pathfinder {
    private grid: Grid;

    constructor(tilemap: Tilemap) {
        this.grid = Grid.fromTilemap(tilemap);
    }

    async findPath(start: Vector2, end: Vector2, near: boolean = false): Promise<Vector2[]> {
        const openList = new Set<Node>();
        const closedList = new Set<Node>();

        const startNode = this.grid.getNode(start);
        const endNode = this.grid.getNode(end);

        // if neither start nor end are walkable, there is no path
        if (!startNode || !startNode.walkable) {
            throw "Start node is not walkable";
        }
        if (!endNode || !(endNode.walkable || near)) {
            throw "End node is not walkable";
        }

        // reset the grid
        this.grid.reset();

        // add start node to open list
        startNode.onOpenList = true;
        openList.add(startNode);

        // calculate initial heuristics
        for (let y = 0; y < this.grid.height; y++) {
            for (let x = 0; x < this.grid.width; x++) {
                const node = this.grid.getNode(new Vector2(x, y));
                if (node.walkable || (near && node.position === endNode.position)) {
                    // node is walkable, calculate heuristic. If near is true, the end node is also considered walkable
                    node.h = node.position.manhattanDistanceTo(endNode.position);
                    node.updateF();
                } else {
                    // node is not walkable, set heuristic to zero and put on closed list
                    node.h = 0;
                    node.g = 0;
                    node.f = 0;

                    node.onClosedList = true;
                    closedList.add(node);
                }
            }
        }

        let iterationCounter = 0;

        // search for a path while there are nodes on the open list
        while (openList.size > 0) {
            // get node with the lowest f value
            const currentNode = Array.from(openList).reduce((a, b) => a.f < b.f ? a : b);

            // move node from open to closed list
            currentNode.onOpenList = false;
            currentNode.onClosedList = true;
            openList.delete(currentNode);
            closedList.add(currentNode);

            // if we reached the end node, reconstruct the path
            if (currentNode === endNode) {
                const path: Vector2[] = [];

                // in near mode, omit the end node from the path
                let current = near ? currentNode.parent : currentNode;
                while (current) {
                    path.push(current.position);
                    current = current.parent!;
                }

                // console.log(`Path found in ${iterationCounter} iterations`);

                return path.reverse();
            }

            // get neighbors of the current node
            const neighbors = this.grid.getNeighbors(currentNode.position);
            for (const neighbor of neighbors) {
                // skip nodes that are already on the closed list
                if (neighbor.onClosedList) {
                    continue;
                }

                // calculate heuristic as the manhattan distance to the end node
                let h = currentNode.position.manhattanDistanceTo(neighbor.position);

                // add a small penalty for changing direction
                if (currentNode.parent && neighbor.position.distanceTo(currentNode.parent!.position) < 2) {
                    h += 0.01;
                }

                // calculate tentative g score
                const tentativeG = currentNode.g + h;

                // if the neighbor is not on the open list, add it
                if (!neighbor.onOpenList) {
                    neighbor.parent = currentNode;
                    neighbor.g = tentativeG;
                    neighbor.updateF();

                    neighbor.onOpenList = true;
                    openList.add(neighbor);
                } else if (tentativeG < neighbor.g) {
                    // if the tentative g score is lower than the current g score, update the node
                    neighbor.parent = currentNode;
                    neighbor.g = tentativeG;
                    neighbor.updateF();
                }
            }

            iterationCounter++;
        }

        // no path found
        throw "No path found";
    }
}
