import Message from "./message";
import Direction from "../utils/direction";

export class PlayerMoveMessage extends Message {
    static readonly NAME = "player-move";

    constructor(public direction: Direction, public sprint: boolean = false) {
        super(PlayerMoveMessage.NAME);
    }
}

export class PlayerStopMessage extends Message {
    static readonly NAME = "player-stop";

    constructor() {
        super(PlayerStopMessage.NAME);
    }
}
