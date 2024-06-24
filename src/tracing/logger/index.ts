import { Test } from "../../test";
import { Logger, type LoggerOptions } from "./Logger";
import { Span } from "./trace";

let logger: Logger | undefined;

/** Initialize the logger */
export function init(opts: LoggerOptions): Logger {
    const isProduction = process.env.NODE_ENV === 'production';

    if (!opts.apiKey) {
        throw new Error('OllyLLM: apiKey is required');
    }
    if (!opts.baseUrl) {
        throw new Error('OllyLLM: baseUrl is required');
    }

    logger = Logger.getInstance({
        apiKey: opts.apiKey,
        baseUrl: opts.baseUrl,
        debug: opts.debug,
    });

    return logger;
}


export namespace Tracing {
    type DecoratorFn = (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => void;

    /** Retrieve the current span if any */
    export function currentSpan(): Span | undefined {
        return logger?.currentSpan();
    }

    export function traceWithTests<T>(name: string, tests: Test<T>[], callback: () => T): T {
        if (!logger) {
            return callback();
        }

        const result = trace(name, callback);

        tests.forEach(test => {
            // TODO: send the tests to the backend
        });

        return result;
    }

    /** Trace a function call */
    export function trace(name?: string): DecoratorFn;
    export function trace<T>(name: string, callback: () => T): T;
    export function trace<T>(name?: string, callback?: () => T): T | DecoratorFn {
        if (!logger) {
            console.warn('OllyLLM: Logger not initialized. Call init() before using Traced.');
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
