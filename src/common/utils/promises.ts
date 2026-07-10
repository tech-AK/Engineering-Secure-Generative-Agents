import EventEmitter from "events";

export const delayPromise = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const timeoutPromise = <T = any>(ms: number) => new Promise<T>((_, reject) => setTimeout(reject, ms));

export const withTimeout = <T>(promise: Promise<T>, timeout: number = 0): Promise<T> => timeout > 0
    ? Promise.race([promise, timeoutPromise<T>(timeout)])
    : promise;

export const eventPromise = (emitter: EventEmitter, eventName: string | symbol, timeout: number = 0): Promise<void | any | any[]> => withTimeout(new Promise((resolve) => {
    emitter.once(eventName, (...args) => args.length === 1 ? resolve(args[0]) : resolve(args));
}), timeout);
