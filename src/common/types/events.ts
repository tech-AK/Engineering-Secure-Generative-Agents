import Vector2 from "../utils/vector";
import { type Dialog } from "./dialog";

export type EventLevel = "info" | "warning" | "error";

export default class Event {
    constructor(
        public readonly level: EventLevel,
        public readonly category: string,
        public readonly data?: any
    ) {}

    static info = (message: string) => new Event("info", "general.info", message);
    static warning = (message: string) => new Event("warning", "general.warning", message);
    static error = (message: string) => new Event("error", "general.error", message);

    static agent = (id: string, name: string) => {
        const data: any = { agent: { id, name } };

        return {
            traversal: (path: Vector2[]) => {
                data.path = path;
                return {
                    start: () => new Event("info", "agent.traversal.start", data),
                    finish: () => new Event("info", "agent.traversal.finish", data),
                    cancel: () => new Event("info", "agent.traversal.cancel", data)
                }
            },
            action: {
                idle: () => ({
                    start: () => new Event("info", "agent.action.idle.start", data),
                    finish: () => new Event("info", "agent.action.idle.finish", data)
                }),
                move: (target: Vector2) => {
                    data.target = target;
                    return {
                        start: () => new Event("info", "agent.action.move.start", data),
                        finish: () => new Event("info", "agent.action.move.finish", data),
                        cancel: () => new Event("info", "agent.action.move.cancel", data)
                    }
                },
                agentInteraction: (id: string, name: string) => {
                    data.interlocutor = { id, name };
                    return {
                        start: () => new Event("info", "agent.action.agentInteraction.start", data),
                        dialogUpdate: (dialog: Dialog) => new Event("info", "agent.action.agentInteraction.dialogUpdate", { ...data, dialog }),
                        finish: () => new Event("info", "agent.action.agentInteraction.finish", data),
                        cancel: () => new Event("info", "agent.action.agentInteraction.cancel", data)
                    }
                },
                objectInteraction: (id: string, name: string) => {
                    data.object = { id, name };
                    return {
                        start: (data?: object) => new Event("info", "agent.action.objectInteraction.start", data),
                        finish: (data?: object) => new Event("info", "agent.action.objectInteraction.finish", data),
                        cancel: (data?: object) => new Event("info", "agent.action.objectInteraction.cancel", data)
                    }
                }
            }
        };
    };
};
