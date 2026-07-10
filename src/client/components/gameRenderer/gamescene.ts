import Phaser from "phaser";
import { Client, Room } from "colyseus.js";
import GameState from "../../../common/state/gamestate";
import { PlayerMoveMessage, PlayerStopMessage } from "../../../common/messages/player";
import { DialogLineRequest, DialogLineResponse, LegacyInteractionFailureResponse, LegacyInteractionRequest, LegacyInteractionSuccessResponse, ObjectStateRequest, ObjectStateResponse } from "../../../common/messages/interaction";
import Direction from "../../../common/utils/direction";
import { ResourceLoader, Renderer } from "./renderers/renderer";
import AgentRenderer, { AgentResourceLoader } from "./renderers/agent";
import TilemapRenderer, { TilemapResourceLoader } from "./renderers/tilemap";
import IObjectRenderer, { IObjectResourceLoader } from "./renderers/iobject";
import { type Game } from "../../game";
import EventEmitter from "events";
import Player from "../../../common/state/player";

class MovementController {
    static KEY_BINDINGS: { [key: string]: Direction } = {
        W: Direction.UP,
        A: Direction.LEFT,
        S: Direction.DOWN,
        D: Direction.RIGHT
    };

    currentDirection: Direction | null = null;
    directionActive: boolean[] = [];

    shiftPressed: boolean = false;

    constructor(private scene: GameScene, private room: Room<GameState>) {
        if (!scene.input.keyboard) {
            throw "Cannot register keys";
        }

        // register callback functions for player movement keys
        for (const key in MovementController.KEY_BINDINGS) {
            scene.input.keyboard.on(`keydown-${key}`, () => this.move(MovementController.KEY_BINDINGS[key]));
            scene.input.keyboard.on(`keyup-${key}`, () => this.stop(MovementController.KEY_BINDINGS[key]));
            this.directionActive[MovementController.KEY_BINDINGS[key]] = false;
        }

        // sprinting
        scene.input.keyboard.on("keydown-SHIFT", () => {
            this.shiftPressed = true;
            if (this.currentDirection !== null) this.move(this.currentDirection, true);
        });
        scene.input.keyboard.on("keyup-SHIFT", () => {
            this.shiftPressed = false;
            if (this.currentDirection !== null) this.move(this.currentDirection, true);
        });
    }

    move(direction: Direction, allowSameDirection = false) {
        this.directionActive[direction] = true;

        // send the move command only if the direction has changed
        if (direction === this.currentDirection && !allowSameDirection) {
            return;
        }

        // follow our player again
        this.scene.followPlayer(this.room.sessionId);

        this.currentDirection = direction;
        const message = new PlayerMoveMessage(direction, this.shiftPressed);
        this.room.send(message.messageName, message);
    }

    stop(direction: Direction) {
        this.directionActive[direction] = false;

        // send the stop command if the released key corresponds to the current direction
        if (direction !== this.currentDirection) {
            return;
        }

        this.currentDirection = null;
        const message = new PlayerStopMessage();
        this.room.send(message.messageName, message);

        // check if another direction is still active. If it is, move in that direction
        const activeDirection = this.directionActive.findIndex((active) => active);
        if (activeDirection !== -1) {
            this.move(activeDirection);
        }
    }
}

class InteractionController {
    constructor(private scene: GameScene, private room: Room<GameState>) {
        /* if (!scene.input.keyboard) {
            throw "Cannot register keys";
        }

        // register callback function for interaction key
        scene.input.keyboard.on("keydown-SPACE", () => this.startObjectInteraction());

        // handle response messages
        this.room.onMessage(LegacyInteractionSuccessResponse.NAME, () => {
            console.log("Interaction complete");
        });
        this.room.onMessage(LegacyInteractionFailureResponse.NAME, (message: LegacyInteractionFailureResponse) => {
            console.error(`Interaction failed: ${message.reason}`);
        });

        // handle dialog line requests
        this.room.onMessage(DialogLineRequest.NAME, async (message: DialogLineRequest) => {
            const ownAgentId = this.room.state.players.get(this.room.sessionId)!.controlledAgent!;

            // TODO: use a more beautiful text input

            // view a user prompt to enter a dialog line
            let promptMessage = `You are talking to ${message.listenerName}. End your line with \"END\" to stop the conversation. The interlocutor may also end the conversation with a certain probability.\n`;
            message.history.forEach(({ line, speakerId }) => {
                const name = speakerId === ownAgentId ? "You" : this.room.state.agents.get(speakerId)?.name ?? "Unknown";
                promptMessage += `    ${name}: ${line}\n`;
            });
            promptMessage += "    You:";
            const input = prompt(promptMessage) ?? "END";

            // parse the prompt input
            const endConversation = input.endsWith("END");
            const line = (endConversation ? input.slice(0, -3) : input).trim();

            // send the response
            const response = new DialogLineResponse(line, endConversation);
            this.room.send(response.messageName, response);
        });

        // handle object state requests
        this.room.onMessage(ObjectStateRequest.NAME, async (message: ObjectStateRequest) => {
            // view a user prompt to enter a new state
            let promptMessage = `You are interacting with ${message.name}. The current state is \"${message.currentState}\".\n`
                + ` Available states are: ${message.availableStates.map(s => "\"" + s + "\"").join(", ")}. Enter a new state or cancel.\n`;
            let input = prompt(promptMessage)?.trim();

            // make sure we get a valid state
            while (input && !message.availableStates.includes(input)) {
                input = prompt(`Invalid state. Please choose one of the following: ${message.availableStates.map(s => "\"" + s + "\"").join(", ")}`)?.trim();
            }

            // send the response
            const response = new ObjectStateResponse(message.id, input ?? message.currentState);
            this.room.send(response.messageName, response);
        }); */
    }

    startObjectInteraction() {
        const message = new LegacyInteractionRequest();
        this.room.send(message.messageName, message);
    }
}

export default class GameScene extends Phaser.Scene {
    static readonly TILE_SIZE = 16;

    client: Client;
    room: Room<GameState>;
    movementController!: MovementController;
    interactionController!: InteractionController;

    layers: { [key: string]: Phaser.GameObjects.Layer | Phaser.GameObjects.Container } = {};

    loaders: Map<string, ResourceLoader> = new Map();
    renderers: Map<string, Renderer<any, any>> = new Map();

    created: boolean = false;
    rendererEvents = new EventEmitter();

    globalInfo?: Phaser.GameObjects.Container;

    pointerPrevX: number = 0;
    pointerPrevY: number = 0;
    currentFollowTarget: Phaser.GameObjects.Sprite | null = null;

    constructor(game: Game) {
        super({ key: "GameScene", active: true });
        this.client = game.client!;
        this.room = game.room!;
    }

    preload() {
        // load tileset images and tilemap data
        this.load.image("modernExteriors", "static/images/tilesets/modernExteriors.png");
        this.load.image("InteriorsRooms", "static/images/tilesets/InteriorsRooms.png");
        this.load.image("ModernInteriors_Rearranged", "static/images/tilesets/ModernInteriors_Rearranged.png");
        this.load.image("OfficeUtilitiesWithShadow", "static/images/tilesets/OfficeUtilitiesWithShadow.png");
        this.load.image("OfficeRooms", "static/images/tilesets/OfficeRooms.png");
        // this.load.tilemapTiledJSON("default", "static/tilemaps/default.json");

        // setup all layers. Note that layers will be rendered in the order they were added
        this.layers.background = this.add.layer();
        this.layers.obstacles1 = this.add.layer();
        this.layers.iobjects = this.add.layer();
        this.layers.obstacles2 = this.add.layer();
        this.layers.players = this.add.layer();
        this.layers.foreground = this.add.layer();
        this.layers.debug = this.add.layer();

        // create all resource loaders
        this.loaders.set("tilemap", new TilemapResourceLoader(this));
        this.loaders.set("agent", new AgentResourceLoader(this));
        this.loaders.set("iobject", new IObjectResourceLoader(this));
    }

    async create() {
        const ts = GameScene.TILE_SIZE;

        // invoke all resource loaders
        this.loaders.forEach((loader) => loader.create());

        // add the tilemap renderer
        const tilemapRenderer = new TilemapRenderer(this, this.client, this.room.state.tilemap, this.loaders.get("tilemap")!);
        await tilemapRenderer.create();

        this.renderers.set("tilemap", tilemapRenderer);
        this.layers.background.add(tilemapRenderer.layers.Background);
        this.layers.background.add(tilemapRenderer.layers.Background2);
        this.layers.obstacles1.add(tilemapRenderer.layers.Obstacles);
        this.layers.obstacles2.add(tilemapRenderer.layers.Obstacles2);
        this.layers.foreground.add(tilemapRenderer.layers.Foreground);
        this.layers.foreground.add(tilemapRenderer.layers.Foreground2);

        // handle agent state
        this.room.state.agents.onAdd(async (agent) => {
            // create a renderer for the agent
            const renderer = new AgentRenderer(this, this.client, agent, this.loaders.get("agent")!);
            await renderer.create();

            this.renderers.set(`agent-${agent.id}`, renderer);
            this.layers.players.add(renderer.sprite);

            // remove agent from the renderers (the sprite will get destroyed by the renderer itself)
            agent.onRemove(() => {
                this.renderers.delete(agent.id);
            });
        });

        // handle object state
        this.room.state.objects.onAdd(async (iobject) => {
            // create a renderer for the iobject
            const renderer = new IObjectRenderer(this, this.client, iobject, this.loaders.get("iobject")!);
            await renderer.create();

            this.renderers.set(`iobject-${iobject.id}`, renderer);
            renderer.visualTiles.forEach((layerTiles) => layerTiles.forEach((tile) => tile && this.layers.iobjects.add(tile)));

            // remove iobject from the renderers (the sprite will get destroyed by the renderer itself)
            iobject.onRemove(() => {
                this.renderers.delete(iobject.id);
            });
        });

        // setup initial scaling
        // this.cameras.main.pan(this.room.state.tilemap.size.x * ts / 2, this.room.state.tilemap.size.y * ts / 2, 0);
        this.cameras.main.setZoom(3);

        // create client controllers
        this.movementController = new MovementController(this, this.room);
        this.interactionController = new InteractionController(this, this.room);

        // await tilemapRenderer.markObstacles(this.layers.debug);

        this.created = true;

        // when creation is complete, the game still needs a few update cycles to probably initialize
        // the camera position. Therefore, we add an additional short timeout before hiding the loading screen
        await new Promise((resolve) => setTimeout(resolve, 300));

        // register mouse events
        this.input.on("wheel", (pointer: any, gameObjects: any, deltaX: any, deltaY: any, deltaZ: any) => {
            this.zoomCamera(-0.015 * deltaY);
        });
        this.input.on("pointermove", (pointer: Phaser.Input.Pointer, _: any) => {
            if (pointer.isDown) {
                const dx = (this.pointerPrevX - pointer.x) / this.cameras.main.zoom;
                const dy = (this.pointerPrevY - pointer.y) / this.cameras.main.zoom;
                this.moveCamera(dx, dy);
            }

            this.pointerPrevX = pointer.x;
            this.pointerPrevY = pointer.y;
        });

        // focus on the player by default
        this.followPlayer(this.room.sessionId, true);

        this.created = true;
        this.rendererEvents.emit("ready");
    }

    zoomCamera(amount: number) {
        this.cameras.main.zoom *= Math.pow(1.1, amount);
    }

    moveCamera(x: number, y: number) {
        this.cameras.main.stopFollow();
        this.currentFollowTarget = null;

        this.cameras.main.scrollX += x;
        this.cameras.main.scrollY += y;
    }

    followSprite(sprite: Phaser.GameObjects.Sprite, panImmediately: boolean = false) {
        if (this.currentFollowTarget === sprite) {
            return;
        }

        const ox = -GameScene.TILE_SIZE / 2;
        const oy = -GameScene.TILE_SIZE / 2;

        this.cameras.main.stopFollow();

        // pan the camera towards the sprite
        if (panImmediately) {
            this.cameras.main.pan(sprite.x - ox, sprite.y - oy, 0);
        } else {
            this.cameras.main.pan(sprite.x - ox, sprite.y - oy, 500, "Sine.easeInOut");
        }

        // follow the sprite
        this.cameras.main.startFollow(sprite, true, 0.3, 0.3, ox, oy);

        this.currentFollowTarget = sprite;
    }

    followAgent(agentId: string, panImmediately: boolean = false) {
        const sprite = (this.renderers.get(`agent-${agentId}`) as AgentRenderer)?.sprite;
        if (!sprite) {
            throw new Error(`Sprite for agent ${agentId} does not exist`);
        }
        this.followSprite(sprite, panImmediately);
    }

    followPlayer(playerId: string, panImmediately: boolean = false) {
        const player = this.room.state.players.get(playerId);
        if (!player) {
            throw new Error(`Player ${playerId} does not exist`);
        }
        if (!player.controlledAgent) {
            throw new Error(`Player ${playerId} does not control an agent`);
        }
        this.followAgent(player.controlledAgent, panImmediately);
    }

    followObject(objectId: string, panImmediately: boolean = false) {
        const object = this.room.state.objects.get(objectId);
        if (!object) {
            throw new Error(`Object ${objectId} does not exist`);
        }

        // get the object position
        const x = (object.position.x + 0.5) * GameScene.TILE_SIZE;
        const y = (object.position.y + 0.5) * GameScene.TILE_SIZE;

        // move to the object position
        this.cameras.main.stopFollow();
        this.currentFollowTarget = null;
        if (panImmediately) {
            this.cameras.main.pan(x, y, 0);
        } else {
            this.cameras.main.pan(x, y, 500, "Sine.easeInOut");
        }
    }

    update(time: number, delta: number) {
        // wait until create() is done before updating the renderers
        if (!this.created) {
            return;
        }

        // update all renderers
        this.renderers.forEach((renderer) => renderer.updateWrapper(delta));

        // sort agents by y position
        this.layers.players.sort("y");
    }
}
