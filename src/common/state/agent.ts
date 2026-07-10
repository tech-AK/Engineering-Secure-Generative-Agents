import { Schema, ArraySchema, type } from "@colyseus/schema";
import VectorSchema from "./vectorSchema";
import Vector2 from "../utils/vector";
import Direction from "../utils/direction";
import { type Traversal } from "../types/traversal";
import Action, { NoneAction } from "./action";
import {type SeenObject} from "../types/SeenObject";

export enum AgentState {
    IDLE,
    TRAVERSING_PATH
}

export enum AgentEventLevel {
    INFO,
    PROCESS,
    WARNING,
    ERROR
}

export class AgentEvent extends Schema {
    @type("number") readonly level: number;
    @type("string") readonly text: string;
    @type("string") readonly category: string;

    constructor(level: number, text: string, category?: string) {
        super();
        this.level = level;
        this.text = text;
        this.category = category ?? "general";
    }

    static info(text: string, category?: string) {
        return new AgentEvent(AgentEventLevel.INFO, text, category);
    }

    static process(text: string, category?: string) {
        return new AgentEvent(AgentEventLevel.PROCESS, text, category);
    }

    static warning(text: string, category?: string) {
        return new AgentEvent(AgentEventLevel.WARNING, text, category);
    }

    static error(text: string, category?: string) {
        return new AgentEvent(AgentEventLevel.ERROR, text, category);
    }
}

export default class Agent extends Schema {
    static readonly MOVEMENT_SPEED = 0.004;
    static readonly SPRINT_SPEED = 0.008;
    static readonly INTERACTION_RADIUS = 1000; // use full radius for now

    @type("string") readonly id: string;
    @type("string") readonly name: string;
    @type("string") readonly characterImage: string;
    @type("string") readonly characterSeed: string;
    @type("string") readonly characterRole: string;
    @type("boolean") readonly isSecretKeeperLevel1: boolean = false;
    @type("boolean") readonly isSecretKeeperLevel2: boolean = false;
    @type("boolean") readonly isSecretKeeperLevel3: boolean = false;
    @type("number") state: AgentState = AgentState.IDLE;
    @type(Action) action: Action = new NoneAction();
    @type(Action) previousAction: Action = new NoneAction();
    @type("string") controllingPlayerId: string = "";
    @type([ AgentEvent ]) events = new ArraySchema<AgentEvent>();

    @type(VectorSchema) position: VectorSchema;
    @type(VectorSchema) velocity: VectorSchema = new VectorSchema(Vector2.ZERO);
    @type("number") direction: Direction = Direction.DOWN;

    @type("string") currentArea: string = "";
    @type("string") currentSubarea: string = "";

    @type([ "string" ]) agentsWithinSight: string[] = [];
    @type([ "string" ]) objectsWithinSight: string[] = [];
    seenObjectsWithinSight: { [id: string]: SeenObject } = {}; //object directory for faster lookup via id

    lastActionCheckTimestamp: number = 0;

    currentTraversal: Traversal = [];
    @type("string") currentTraversalStr: string = "{}";
    currentTraversalOnComplete?: () => void;

    constructor(id: string, position: Vector2, name: string, characterImage: string, characterSeed: string, characterRole: string) {
        super();

        this.id = id;
        this.position = new VectorSchema(position);
        this.name = name;
        this.characterImage = characterImage;
        this.characterSeed = characterSeed;
        this.characterRole = characterRole;

        if (characterRole.includes("secret_keeper_level_1")) {
            this.isSecretKeeperLevel1 = true;
        } else if (characterRole.includes("secret_keeper_level_2")) {
            this.isSecretKeeperLevel2 = true;
        } else if (characterRole.includes("secret_keeper_level_3")) {
            this.isSecretKeeperLevel3 = true;
        }

        this.updateCurrentTraversalStr();
    }

    updateCurrentTraversalStr() {
        this.currentTraversalStr = JSON.stringify(this.currentTraversal);
    }
}
