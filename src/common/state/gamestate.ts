import { Schema, MapSchema, type } from "@colyseus/schema";
import Tilemap from "./tilemap";
import Player from "./player";
import Agent from "./agent";
import EventLog, { EventLogEntry } from "./eventlog";
import IObject from "./iobject";

/**
 * The state (i.e., Schema) is shared and automatically synchronized between
 * server and client thanks to colyseus. Make sure to only use 'POJO' here!
 */

export default class GameState extends Schema {
    @type("int64") time;
    @type(EventLog) eventLog = new EventLog();

    @type(Tilemap) tilemap;
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Agent }) agents = new MapSchema<Agent>();
    @type({ map: IObject }) objects = new MapSchema<IObject>();

    @type("boolean") ready = false;

    constructor(tilemap: Tilemap, agents: Map<string, Agent>, objects: Map<string, IObject>, start_time: number = 0) {
        super();
        this.time = start_time;
        this.tilemap = tilemap;
        this.agents = new MapSchema<Agent>(agents);
        this.objects = new MapSchema<IObject>(objects);
    }

    log(event: EventLogEntry) {
        const systemTime = Date.now();
        const simulationTime = this.time;
        this.eventLog.addEntry(systemTime, simulationTime, event);
    }
}
