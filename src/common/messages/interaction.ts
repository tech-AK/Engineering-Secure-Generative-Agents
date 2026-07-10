import { type DialogLine } from "../types/dialog";
import Message from "./message";

export class LegacyInteractionRequest extends Message {
    static readonly NAME = "interaction-request";

    constructor() {
        super(LegacyInteractionRequest.NAME);
    }
}

export class LegacyInteractionSuccessResponse extends Message {
    static readonly NAME = "interaction-success";

    constructor() {
        super(LegacyInteractionSuccessResponse.NAME);
    }
}

export class LegacyInteractionFailureResponse extends Message {
    static readonly NAME = "interaction-failure";

    constructor(public readonly reason: string) {
        super(LegacyInteractionFailureResponse.NAME);
    }
}

export class AgentInteractionRequest extends Message {
    static readonly NAME = "agent-interaction-request";

    constructor(public readonly agentId: string) {
        super(AgentInteractionRequest.NAME);
    }
}

export class AgentInteractionSuccessResponse extends Message {
    static readonly NAME = "agent-interaction-success";

    constructor() {
        super(AgentInteractionSuccessResponse.NAME);
    }
}

export class AgentInteractionFailureResponse extends Message {
    static readonly NAME = "agent-interaction-failure";

    constructor(public readonly reason: string) {
        super(AgentInteractionFailureResponse.NAME);
    }
}

export class ObjectInteractionRequest extends Message {
    static readonly NAME = "object-interaction-request";

    constructor(public readonly objectId: string) {
        super(ObjectInteractionRequest.NAME);
    }
}

export class ObjectInteractionSuccessResponse extends Message {
    static readonly NAME = "object-interaction-success";

    constructor() {
        super(ObjectInteractionSuccessResponse.NAME);
    }
}

export class ObjectInteractionFailureResponse extends Message {
    static readonly NAME = "object-interaction-failure";

    constructor(public readonly reason: string) {
        super(ObjectInteractionFailureResponse.NAME);
    }
}

export class DialogLineRequest extends Message {
    static readonly NAME = "dialog-line-request";

    constructor(public readonly listenerName: string, public readonly history: DialogLine[]) {
        super(DialogLineRequest.NAME);
    }
}

export class DialogLineResponse extends Message {
    static readonly NAME = "dialog-line-response";

    constructor(public readonly line: string, public readonly endConversation: boolean = false) {
        super(DialogLineResponse.NAME);
    }
}

export class ObjectStateRequest extends Message {
    static readonly NAME = "object-state-request";

    constructor(public readonly id: string, public readonly name: string, public readonly currentState: string, public readonly availableStates: string[]) {
        super(ObjectStateRequest.NAME);
    }
}

export class ObjectStateResponse extends Message {
    static readonly NAME = "object-state-response";

    constructor(public readonly id: string, public readonly newState: string) {
        super(ObjectStateResponse.NAME);
    }
}

export class PinCodeRequest extends Message {
    static readonly NAME = "pin-code-request";

    constructor(public readonly doorId: string, public readonly code: string) {
        super(PinCodeRequest.NAME);
    }
}

export class PinCodeResponse extends Message {
    static readonly NAME = "pin-code-response";

    constructor(public readonly doorId: string, public readonly success: boolean) {
        super(PinCodeResponse.NAME);
    }
}

export class ForceInteraction extends Message {
    static readonly NAME = "force-interaction";

    constructor(public readonly agentId: string, public readonly interactionType: "agent" | "object", public readonly otherId: string) {
        super(ForceInteraction.NAME);
    }
}