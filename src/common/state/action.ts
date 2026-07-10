import { Schema, type } from "@colyseus/schema";
import Tilemap from "./tilemap";
import Vector2 from "../utils/vector";
import VectorSchema from "./vectorSchema";
import type { Location } from "../types/location";
import Agent from "./agent";
import IObject from "./iobject";
import { type DialogLine } from "../types/dialog";

export enum ActionType {
    NONE,
    UNDECIDED,
    MOVING,
    INTERACTING_WITH_AGENT,
    INTERACTING_WITH_OBJECT,
    RESPONDING_TO_AGENT
}

export default abstract class Action<C extends object = any> extends Schema {
    @type("number") kind: ActionType;

    context!: C;
    @type("string") contextStr: string = "{}";

    constructor(kind: ActionType, initialContext: C) {
        super();

        this.kind = kind;
        this.setContext(initialContext);
    }

    protected setContext(context: C) {
        this.context = context;
        this.contextStr = JSON.stringify(this.context);
    }

    protected updateContext(context: Partial<C>) {
        this.setContext({
            ...this.context,
            ...context
        });
    }

    public getContext<SC extends C>(): C {
        return this.context as SC;
    }
}

export type NoneActionContext = {};

export class NoneAction extends Action<NoneActionContext> {
    constructor() {
        super(ActionType.NONE, {});
    }
}

export type UndecidedActionContext = {};

export class UndecidedAction extends Action<UndecidedActionContext> {
    constructor() {
        super(ActionType.UNDECIDED, {});
    }
}

export type MovingActionContext = {
    origin: Location | null;
    target: Location | null;
};

export class MovingAction extends Action<MovingActionContext> {
    constructor() {
        super(ActionType.MOVING, {
            origin: null,
            target: null
        });
    }

    public setOrigin(originPosition: Vector2, tilemap: Tilemap) {
        const originTile = tilemap.getTile(originPosition);
        if (!originTile) {
            throw new Error("Cannot set origin to invalid position");
        }

        this.updateContext({
            origin: {
                position: originPosition,
                area: originTile.area,
                subarea: originTile.subarea
            }
        });
    }

    public setTarget(targetPosition: Vector2, tilemap: Tilemap) {
        const targetTile = tilemap.getTile(targetPosition);
        if (!targetTile) {
            throw new Error("Cannot set target to invalid position");
        }

        this.updateContext({
            target: {
                position: targetPosition,
                area: targetTile.area,
                subarea: targetTile.subarea
            }
        });
    }
}

export type InteractingWithAgentActionContext = {
    interlocutor: {
        id: string;
        name: string;
    } | null,
    dialogHistory: DialogLine[];
};

export class InteractingWithAgentAction extends Action<InteractingWithAgentActionContext> {
    constructor() {
        super(ActionType.INTERACTING_WITH_AGENT, {
            interlocutor: null,
            dialogHistory: []
        });
    }

    public setInterlocutor(interlocutor: Agent) {
        this.updateContext({
            interlocutor: {
                id: interlocutor.id,
                name: interlocutor.name
            }
        });
    }

    public addDialogLine(line: DialogLine) {
        this.updateContext({
            dialogHistory: [...this.getContext().dialogHistory, line]
        });
    }
}

export type InteractingWithObjectActionContext = {
    object: {
        id: string;
        name: string;
    } | null,
    previousState: string | null;
    newState: string | null;
};

export class InteractingWithObjectAction extends Action<InteractingWithObjectActionContext> {
    constructor() {
        super(ActionType.INTERACTING_WITH_OBJECT, {
            object: null,
            previousState: null,
            newState: null
        });
    }

    public setObject(object: IObject) {
        this.updateContext({
            object: {
                id: object.id,
                name: object.name
            },
            previousState: object.state
        });
    }

    public setNewState(newState: string) {
        this.updateContext({
            newState
        });
    }
}

export type RespondingToAgentActionContext = {
    initiator: {
        id: string;
        name: string;
    } | null
};

export class RespondingToAgentAction extends Action<RespondingToAgentActionContext> {
    constructor() {
        super(ActionType.RESPONDING_TO_AGENT, {
            initiator: null
        });
    }

    public setInitiator(initiator: Agent) {
        this.updateContext({
            initiator: {
                id: initiator.id,
                name: initiator.name
            }
        });
    }
}
