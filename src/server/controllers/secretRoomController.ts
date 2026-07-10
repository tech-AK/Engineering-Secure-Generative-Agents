import { Client } from "colyseus";
import Message from "../../common/messages/message";
import GameState from "../../common/state/gamestate";
import GameEngine from "../gameengine";
import Controller from "../gameengine/controller";
import IObject from "../../common/state/iobject";
import { ObjectTileData } from "../../common/types/objectTileData";
import Tile from "../../common/state/tile";
import Vector2 from "../../common/utils/vector";
import CollisionController from "./collisionController";
import { PinCodeRequest, PinCodeResponse } from "../../common/messages/interaction";
import MovementController from "./movementController";

export default class SecretRoomController extends Controller<GameState> {
    static readonly PINCODES = ["84562", "83528", "15684"];

    levelObjectIds: [string, string, string] = ["", "", ""];

    constructor(game: GameEngine<GameState>) {
        super(game);

        // find all secret room door objects
        const objectArray = Array(...this.state.objects.values());
        for (let i = 0; i < 3; i++) {
            const secretRoomDoor = objectArray.find((obj) => obj.name === `door to secret room ${i + 1}`);
            if (!secretRoomDoor) {
                throw new Error(`Secret room ${i + 1} not found`);
            }

            this.levelObjectIds[i] = secretRoomDoor.id;
        }

        // close all doors
        this.levelObjectIds.forEach((id) => this.closeDoor(id));
    }

    private doorTiles(door: IObject): Tile[] {
        const tileData: ObjectTileData = JSON.parse(door.tileData);

        const tiles: Tile[] = [];
        const sx = door.position.x + tileData.offset.x;
        const sy = door.position.y + tileData.offset.y;
        for (let x = sx; x < sx + tileData.size.x; x++) {
            for (let y = sy; y < sy + tileData.size.y; y++) {
                const tile = this.state.tilemap.getTile(new Vector2(x, y));
                if (!tile) {
                    throw new Error(`Tile at ${x}, ${y} not found`);
                }

                tiles.push(tile);
            }
        }

        return tiles;
    }

    public openDoor(objectId: string) {
        const door = this.state.objects.get(objectId);
        if (!door) {
            throw new Error(`Door with id ${objectId} not found`);
        }

        // open the door
        door.state = "open";

        // EVIL HACK: level 3 is not an actual door, but a safe. So we don't set the collides property
        if (objectId === this.levelObjectIds[2]) {
            return;
        }

        // remove the door tiles
        this.doorTiles(door).forEach(tile => tile.collides = false);
        this.game.getController<CollisionController>("collision").rebuildCollisionMap();
        this.game.getController<MovementController>("movement").rebuildPathfinder();
    }

    public closeDoor(objectId: string) {
        const door = this.state.objects.get(objectId);
        if (!door) {
            throw new Error(`Door with id ${objectId} not found`);
        }

        // close the door
        door.state = "closed";

        // add the door tiles
        this.doorTiles(door).forEach(tile => { tile.collides = true });
        this.game.getController<CollisionController>("collision").rebuildCollisionMap();
        this.game.getController<MovementController>("movement").rebuildPathfinder();
    }

    update(delta: number) {}

    async onMessage(message: Message, client: Client): Promise<Message | void> {
        if (message.messageName === PinCodeRequest.NAME) {
            // check which level the object is belongs to
            const pinCodeMessage = message as PinCodeRequest;
            const level = this.levelObjectIds.findIndex((id) => id === pinCodeMessage.doorId);
            if (level === -1) {
                throw new Error(`Door with id ${pinCodeMessage.doorId} not found`);
            }

            // check the pin code
            if (SecretRoomController.PINCODES[level] === pinCodeMessage.code) {
                this.openDoor(pinCodeMessage.doorId);
                return new PinCodeResponse(pinCodeMessage.doorId, true);
            } else {
                return new PinCodeResponse(pinCodeMessage.doorId, false);
            }
        }
    }
}