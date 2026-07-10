import { Client } from "colyseus.js";
import { ResourceLoader, Renderer } from "./renderer";
import Tilemap from "../../../../common/state/tilemap";
import Vector2 from "../../../../common/utils/vector";

export const TILESET_PATH = "static/images/tilesets";
export const TILESETS = Object.freeze([
    "modernExteriors",
    "InteriorsRooms",
    "ModernInteriors_Rearranged",
    "OfficeUtilitiesWithShadow",
    "OfficeRooms"
]);

export class TilemapResourceLoader extends ResourceLoader {
    preload() {
        // load all tileset images
        TILESETS.forEach((name) => {
            const url = `${TILESET_PATH}/${name}.png`
            this.scene.load.image(name, url);
        })
    }

    create() {}
}

export default class TilemapRenderer extends Renderer<Tilemap, TilemapResourceLoader> {
    static readonly TILE_SIZE = 16;
    static readonly LAYERS = [
        "Background",
        "Background2",
        "Obstacles",
        "Obstacles2",
        "Foreground",
        "Foreground2"
    ];

    readonly tilemapKey: string = "currentTilemap";
    tilemap!: Phaser.Tilemaps.Tilemap;
    layers!: { [key: string]: Phaser.Tilemaps.TilemapLayer };

    async create() {
        // read the json tilemap from the server
        const data = await this.getProperty("jsonData") as string;
        const json = JSON.parse(data);

        // load the tilemap into Phaser
        await this.loadTilemap(this.tilemapKey, json);
        this.tilemap = this.scene.make.tilemap({
            key: this.tilemapKey,
            tileWidth: TilemapRenderer.TILE_SIZE,
            tileHeight: TilemapRenderer.TILE_SIZE
        });

        // link all tilesets
        const tilesets = TILESETS.map((name) => {
            const tileset = this.tilemap.addTilesetImage(name);
            if (!tileset) {
                throw new Error(`Failed to load tileset ${name}`);
            }

            return tileset;
        });

        // create all layers
        this.layers = {};
        TilemapRenderer.LAYERS.forEach((name) => {
            const layer = this.tilemap.createLayer(name, tilesets);
            if (!layer) {
                throw new Error(`Failed to create layer ${name}`);
            }

            this.layers[name] = layer;
        });
    }

    destroy() {
        this.tilemap.destroy();
    }

    update(delta: number) {}

    async markObstacles(targetLayer: Phaser.GameObjects.Layer | Phaser.GameObjects.Container) {
        const ts = TilemapRenderer.TILE_SIZE;

        const tiles = await this.getProperty("tiles");
        tiles.onAdd((tile, index) => {
            if (tile.collides) {
                const x = index % this.state.size.x;
                const y = Math.floor(index / this.state.size.x);
                const rect = this.scene.add.rectangle(x * ts, y * ts, ts, ts, 0xff0000, 0.5)
                    .setOrigin(0, 0);
                targetLayer.add(rect);

                tile.onRemove(() => {
                    rect.destroy();
                });
            }
        });
    }

    private async loadTilemap(key: string, json: object) {
        return new Promise<void>(resolve => {
            this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
            this.scene.load.tilemapTiledJSON(key, json);
            this.scene.load.start();
        });
    }

    get spritePosition(): Vector2 {
        return Vector2.ZERO;
    }

    set spritePosition(position: Vector2) {}
}
