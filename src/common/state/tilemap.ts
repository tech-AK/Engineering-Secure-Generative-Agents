import { Schema, ArraySchema, MapSchema, type } from "@colyseus/schema";
import VectorSchema from "./vectorSchema";
import Vector2 from "../utils/vector";
import Tile from "./tile";
import Area from "./area";
import Subarea from "./subarea";
import IObject from "./iobject";
import { type ObjectTileData } from "../types/objectTileData";

export default class Tilemap extends Schema {
    @type("string") name: string;
    @type("string") jsonData: string | undefined;
    @type(VectorSchema) position: VectorSchema = new VectorSchema(Vector2.ZERO);
    @type(VectorSchema) size: VectorSchema = new VectorSchema(Vector2.ZERO);

    @type([ Tile ]) tiles = new ArraySchema<Tile>();
    @type({ map: Area }) areas = new MapSchema<Area>();

    constructor(name: string, size: Vector2, jsonData?: string) {
        super();
        this.name = name;
        this.size = new VectorSchema(size);
        this.jsonData = jsonData;

        // generate default tilemap data
        for (let i = 0; i < size.x * size.y; i++) {
            this.tiles.push(new Tile());
        }
    }

    isInside(position: Vector2): boolean {
        return position.x >= 0 && position.x < this.size.x &&
               position.y >= 0 && position.y < this.size.y;
    }

    getTile(position: Vector2): Tile | null {
        position = position.floor();

        if (!this.isInside(position)) {
            return null;
        }

        // get tile in right-down order
        return this.tiles[position.y * this.size.x + position.x];
    }

    static parseJson(name: string, mapData: any): [Tilemap, Map<string, IObject>] {
        if (mapData.renderorder !== "right-down") {
            throw "Only right-down render order is supported.";
        }

        // create the tilemap
        const size = new Vector2(mapData.width, mapData.height);
        const tilemap = new Tilemap(name, size, JSON.stringify(mapData));

        // enable collision for each non-empty tile on any obstacle layers
        const EMPTY_TILE_ID = 0;

        for (let layer of mapData.layers.filter((layer: any) => layer.name.startsWith("Obstacles"))) {
            if (!layer) {
                throw "no \"Obstacles\" layer found in the tilemap.";
            }

            // set the collides property for each non-empty tile
            for (let i = 0; i < layer.data.length; i++) {
                if (layer.data[i] !== EMPTY_TILE_ID) {
                    tilemap.tiles[i].collides = true;
                }
            }
        }

        // setup the area data
        const areaTileset = mapData.tilesets.find((tileset: any) => tileset.name === "Areas");
        if (!areaTileset) {
            throw "no \"Areas\" tileset found in the tilemap.";
        }
        const getAreaData = (tileId: number) => {
            // check for empty tiles (used to mark obstacles)
            if (tileId === 0) {
                return null;
            }

            // check for out of bounds tiles
            const arrayIndex = tileId - areaTileset.firstgid;
            if (arrayIndex < 0 || arrayIndex >= areaTileset.tilecount) {
                throw `Areas layer contains a non-area tile with id ${tileId}.`;
            }

            // get all required properties
            const propArray = areaTileset.tiles[arrayIndex].properties;

            const area = propArray.find((prop: any) => prop.name === "area")?.value.trim();
            if (!area) {
                throw `No area property found for tile with id ${tileId}.`;
            }

            const subarea = propArray.find((prop: any) => prop.name === "subarea")?.value.trim();
            if (!subarea) {
                throw `No subarea property found for tile with id ${tileId}.`;
            }

            return { area, subarea };
        }

        const areaLayer = mapData.layers.find((layer: any) => layer.name === "Areas");
        if (!areaLayer) {
            throw "no \"Areas\" layer found in the tilemap.";
        }

        for (let i = 0; i < areaLayer.data.length; i++) {
            try {
                if (areaLayer.data[i] === EMPTY_TILE_ID) {
                    // set collision to true on empty tiles
                    tilemap.tiles[i].collides = true;
                } else {
                    // get the area info for non-empty tiles
                    const { area, subarea } = getAreaData(areaLayer.data[i])!;
                    tilemap.tiles[i].area = area;
                    tilemap.tiles[i].subarea = subarea;

                    // register the area if it doesn't exist
                    if (!tilemap.areas.has(area)) {
                        tilemap.areas.set(area, new Area(area));
                    }

                    // register the subarea if it doesn't exist
                    const areaObj = tilemap.areas.get(area)!;
                    if (!areaObj.subareas.has(subarea)) {
                        areaObj.subareas.set(subarea, new Subarea(subarea));
                    }
                }
            } catch (e) {
                throw `Error parsing area data at (${i % size.x}, ${Math.floor(i / size.x)}): ${e}`;
            }
        }

        // add all objects to their respective areas
        const objectLayer = mapData.layers.find((layer: any) => layer.name === "Objects");
        if (!objectLayer) {
            throw "no \"Objects\" layer found in the tilemap.";
        }

        const getStringProp = (obj: any, name: string, defaultValue?: string): string => {
            const prop = obj.properties.find((prop: any) => prop.name === name);
            if (prop === undefined) {
                if (defaultValue === undefined) {
                    throw `No property ${name} found for object ${obj.name}.`;
                }
                return defaultValue;
            } else {
                return prop.value;
            }
        }
        const getNumberProp = (obj: any, name: string, defaultValue?: number): number => {
            const prop = obj.properties.find((prop: any) => prop.name === name);
            if (prop === undefined) {
                if (defaultValue === undefined) {
                    throw `No property ${name} found for object ${obj.name}.`;
                }
                return defaultValue;
            } else {
                return parseFloat(prop.value);
            }
        }

        const objects: Map<string, IObject> = new Map();
        for (let objectData of objectLayer.objects) {
            const initState = getStringProp(objectData, "initState").trim();
            const states = getStringProp(objectData, "states", initState).split(";").map((state: string) => state.trim());
            if (!states.includes(initState)) {
                throw `Object ${objectData.name} has initState "${initState}" which is not in states "${states.join(", ")}".`;
            }

            const extentUp = getNumberProp(objectData, "extentUp", 0);
            const extentDown = getNumberProp(objectData, "extentDown", 0);
            const extentLeft = getNumberProp(objectData, "extentLeft", 0);
            const extentRight = getNumberProp(objectData, "extentRight", 0);

            // get the area and subarea by checking the tile at the object's position
            const position = new Vector2(objectData.x / mapData.tilewidth, objectData.y / mapData.tileheight).floor();
            const tile = tilemap.getTile(position);
            if (!tile) {
                throw `Object ${objectData.name} is out of bounds.`;
            }

            const area = tile.area;
            const subarea = tile.subarea;
            if (!area || !subarea) {
                throw `Object ${objectData.name} is not placed on an area tile.`;
            }

            // calculate the tile data offset and size
            const offset = new Vector2(-extentLeft, -extentUp);
            const size = new Vector2(extentLeft + extentRight + 1, extentUp + extentDown + 1);

            // read the tile data for the each object state
            const data: number[][] = [];
            for (let layerId = 0; layerId < states.length; layerId++) {
                const layer = mapData.layers.find((layer: any) => layer.name === `Object State ${layerId}`);
                if (!layer) {
                    throw `Object ${objectData.name} has ${states.length} states, but "Object State ${layerId}" layer was not found.`;
                }

                // cut out a rectangular region of tiles from the layer
                const layerData: number[] = [];
                for (let py = 0; py < size.y; py++) {
                    for (let px = 0; px < size.x; px++) {
                        const x = position.x + offset.x + px;
                        const y = position.y + offset.y + py;
                        const tileId = layer.data[y * layer.width + x];
                        layerData.push(tileId);
                    }
                }
                data.push(layerData);
            }

            const tileData: ObjectTileData = { offset, size, data };

            // create the IObject
            const id = objectData.id.toString();
            const object = new IObject(id, objectData.name.trim(), states, initState, position, area, subarea, tileData);

            // add it to the array and link it to its subarea
            objects.set(id, object);
            tilemap.areas.get(area)!.subareas.get(subarea)!.objectIds.push(id);
        }

        return [tilemap, objects];
    }
}
