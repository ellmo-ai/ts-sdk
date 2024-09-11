import { Test } from "../../test";
import { Logger, type LoggerOptions } from "./Logger";
import { Span } from "./trace";

let logger: Logger | undefined;

/** Initialize the logger */
export function init(opts: LoggerOptions): Logger {
    if (!opts.apiKey) {
        throw new Error('Ellmo: apiKey is required');
    }
    if (!opts.baseUrl) {
        throw new Error('Ellmo: baseUrl is required');
    }

    logger = Logger.init({
        apiKey: opts.apiKey,
        baseUrl: opts.baseUrl,
        debug: opts.debug,
    });

    return logger;
}


export namespace Tracing {
    type DecoratorFn<T = any> = (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => void;

    /** Retrieve the current span if any */
    export function currentSpan(): Span | undefined {
        return logger?.currentSpan();
    }

    /** 
     * Trace a function call and run tests on the result
     * 
     * @template T is the type of the result (and the input of the tests)
     * @param tests The tests to run on the result
     * @param callback The function to trace
     * @returns The result of the function
     */
    export function traceWithTests<T extends (...args: any[]) => any, U extends ReturnType<T>>(name: string, tests: Test<U>[]): DecoratorFn<T>;
    export function traceWithTests<T extends (...args: any[]) => any, U extends ReturnType<T>>(tests: Test<U>[]): DecoratorFn<T>;
    export function traceWithTests<T extends (...args: any[]) => any, U extends ReturnType<T>>(name: string, tests: Test<U>[], callback: T): U;
    export function traceWithTests<T extends (...args: any[]) => any, U extends ReturnType<T>>(tests: Test<U>[], callback: T): U;
    export function traceWithTests<T extends (...args: any[]) => any, U extends ReturnType<T>>(nameOrTests: string | Test<U>[], testsOrCallback?: Test<U>[] | T, callback?: T): U | DecoratorFn<T> {
        let name: string | undefined;
        let tests: Test<U>[];
        let actualCallback: T | undefined;

        // The created child span from the resulting traced function
        let childSpan: Span | undefined;

        if (typeof nameOrTests === 'string') {
            name = nameOrTests;
            tests = testsOrCallback as Test<U>[];
            actualCallback = callback;
        } else {
            tests = nameOrTests;
            actualCallback = testsOrCallback as T;
        }

        if (actualCallback) {
            if (!logger) {
                return actualCallback();
            }

            const result = logger.trace(name ?? "Anonymous", () => {
                childSpan = currentSpan();
                return actualCallback();
            });

            for (const test of tests) {
                logger.requestTestExecution(childSpan?.id, test, result);
            }

            return result;
        } else {
            // Handle decorator usage
            return function (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>): void {
                const originalMethod = descriptor.value as T;
                descriptor.value = function (...args: unknown[]) {
                    if (!logger) {
                        return originalMethod.bind(target, ...args)();
                    }

                    const nameToUse = `${target.constructor.name}.${propertyKey}`;
                    const result = logger.trace(nameToUse, () => {
                        childSpan = currentSpan();
                        return originalMethod.bind(target, ...args)();
                    });

                    for (const test of tests) {
                        logger.requestTestExecution(childSpan?.id, test, result);
                    }

                    return result;
                } as T;
            };
        }
    }

    /** Trace a function call */
    export function trace(name?: string): DecoratorFn;
    export function trace<T>(name: string, callback: () => T): T;
    export function trace<T>(name?: string, callback?: () => T): T | DecoratorFn {
        if (!logger) {
            console.warn('Ellmo: Logger not initialized. Call init() before using Traced.');
        }

        if (typeof callback === "function") {
            // Handle function call with a name and a callback
            if (!logger) {
                return callback();
            }

            return logger.trace(name ?? "Anonymous", callback);
        } else {
            // Handle decorator usage
            return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
                const originalMethod = descriptor.value;
                descriptor.value = function (...args: unknown[]) {
                    if (!logger) {
                        return originalMethod.bind(this, ...args)();
                    }

                    const nameToUse = name ?? `${target.constructor.name}.${propertyKey}`;
                    return logger.trace(nameToUse, originalMethod.bind(this, ...args));
                };
            };
        }
    }
}
