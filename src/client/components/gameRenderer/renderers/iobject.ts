import Phaser from "phaser";
import IObject from "../../../../common/state/iobject";
import Vector2 from "../../../../common/utils/vector";
import { Renderer, ResourceLoader } from "./renderer";
import TilemapRenderer, { TILESETS } from "./tilemap";

export class IObjectResourceLoader extends ResourceLoader {
    preload() {
    }

    create() {
    }
}

export default class IObjectRenderer extends Renderer<IObject, IObjectResourceLoader> {
    static readonly TILE_SIZE = 16;

    objectPosition!: Vector2;

    visualOffset: Vector2 = Vector2.ZERO;
    visualSize: Vector2 = Vector2.ZERO;
    visualTiles: Phaser.GameObjects.RenderTexture[][] = [];

    create() {
        // set the initial position
        this.objectPosition = new Vector2(this.serverPosition);

        // use the object's tile data ids to create all visual sprites
        const tilemap = (this.scene.renderers.get("tilemap") as TilemapRenderer).tilemap;
        const { offset, size, data } = JSON.parse(this.state.tileData);
        this.visualOffset = new Vector2(offset);
        this.visualSize = new Vector2(size);

        // create a sprite for each tile id in the data
        const currentStateIndex = this.state.availableStates.indexOf(this.state.state) ?? 0;
        this.visualTiles = data
            .map((stateData: number[], stateIndex: number) => stateData
                .map((tileId: number, i: number) => {
                    // skip empty tiles
                    if (tileId <= 0) {
                        return null;
                    }

                    // tiles are ordered left to right, top to bottom
                    const x = this.visualOffset.x + i % this.visualSize.x;
                    const y = this.visualOffset.y + Math.floor(i / this.visualSize.x);
                    const worldX = this.serverPosition.x + x * IObjectRenderer.TILE_SIZE;
                    const worldY = this.serverPosition.y + y * IObjectRenderer.TILE_SIZE;

                    // get the tileset
                    const tiledef = tilemap.tiles[tileId];
                    if (!tiledef) {
                        console.warn(`Object ${this.state.name} at (${this.state.position.x}, ${this.state.position.y}): State layer ${stateIndex} at position (${this.state.position.x + x}, ${this.state.position.y + y}): Tile id ${tileId} not found in tilemap.`);
                        return null;
                    }
                    const [tileX, tileY, tilesetIndex] = tiledef;
                    const tileset = tilemap.tilesets[tilesetIndex];

                    // use a render texture to "cut out" the specific tile from the tileset
                    const rt = this.scene.add.renderTexture(
                        worldX,
                        worldY,
                        IObjectRenderer.TILE_SIZE,
                        IObjectRenderer.TILE_SIZE
                    )
                        .setOrigin(0, 0)
                        .drawFrame(tileset.name, 0, -tileX, -tileY) // shift the tileset so that the correct tile is drawn
                        .setVisible(stateIndex === currentStateIndex);

                    return rt;
                })
            );

        // update sprite visibility on state change
        this.state.listen("state", () => {
            const currentStateIndex = this.state.availableStates.indexOf(this.state.state) ?? 0;
            this.visualTiles.forEach((stateData, stateIndex) => {
                stateData.forEach((sprite) => {
                    if (sprite) {
                        sprite.setVisible(stateIndex === currentStateIndex);
                    }
                });
            });
        });

        // HACK: handle secret doors to cover up their corresponding room
        if (this.state.name === "door to secret room 1") {
            // add a black cover rectangle
            const cover1 = this.scene.add.rectangle(
                this.serverPosition.x + 3 * IObjectRenderer.TILE_SIZE,
                this.serverPosition.y - 5.7 * IObjectRenderer.TILE_SIZE,
                9 * IObjectRenderer.TILE_SIZE,
                8.1 * IObjectRenderer.TILE_SIZE,
                0x000000)
                .setOrigin(0, 0)
                .setDepth(1);
            const cover2 = this.scene.add.rectangle(
                this.serverPosition.x + 0 * IObjectRenderer.TILE_SIZE,
                this.serverPosition.y - 1.7 * IObjectRenderer.TILE_SIZE,
                3 * IObjectRenderer.TILE_SIZE,
                3.7 * IObjectRenderer.TILE_SIZE,
                0x000000)
                .setOrigin(0, 0)
                .setDepth(1);
            this.state.listen("state", () => {
                cover1.setVisible(this.state.state === "closed");
                cover2.setVisible(this.state.state === "closed");
            });
        }

        if (this.state.name === "door to secret room 2") {
            // add a black cover rectangle
            const cover1 = this.scene.add.rectangle(
                this.serverPosition.x - 5 * IObjectRenderer.TILE_SIZE,
                this.serverPosition.y - 0.7 * IObjectRenderer.TILE_SIZE,
                9 * IObjectRenderer.TILE_SIZE,
                5.7 * IObjectRenderer.TILE_SIZE,
                0x000000)
                .setOrigin(0, 0)
                .setDepth(1);
            this.state.listen("state", () => {
                cover1.setVisible(this.state.state === "closed");
            });
        }
    }

    destroy() {
    }

    update(delta: number) {
    }

    get spritePosition(): Vector2 {
        return Vector2.ZERO;
    }

    set spritePosition(position: Vector2) {
    }
}
