import { Schema, ArraySchema, type } from "@colyseus/schema";
import Event, { type EventLevel } from "../types/events";

export class EventLogEntry extends Schema {
    @type("int64") systemTime: number;
    @type("int64") simulationTime: number;

    @type("string") level: EventLevel;
    @type("string") category: string;
    @type("string") dataStr: string;

    constructor(systemTime: number, simulationTime: number, event: Event) {
        super();
        this.systemTime = systemTime;
        this.simulationTime = simulationTime;
        this.level = event.level;
        this.category = event.category;
        this.dataStr = JSON.stringify(event.data);
    }
}

export default class EventLog extends Schema {
    @type([EventLogEntry]) entries = new ArraySchema<EventLogEntry>();

    addEntry(systemTime: number, simulationTime: number, event: Event) {
        this.entries.push(new EventLogEntry(systemTime, simulationTime, event));
    }
}
