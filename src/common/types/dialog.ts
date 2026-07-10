import Vector2 from "../utils/vector";

export type DialogLine = {
    speakerId: string;
    line: string;
    endConversation: boolean;
};

export type Dialog = {
    initiator: {
        id: string;
        name: string;
        position: Vector2;
    };
    interlocutor: {
        id: string;
        name: string;
        position: Vector2;
    };
    lines: DialogLine[];
};
