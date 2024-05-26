import { v4 as uuidv4 } from 'uuid';
import { Log } from "./types";

interface ISpan {
    id: string;
    name: string;
    startTime: number;
    endTime: number | null;
    logs: Log[];
    childSpans: Span[];
}

enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

class Span implements ISpan {
    public id: string;
    public startTime: number;
    public endTime: number | null = null;
    public logs: Log[] = [];
    public childSpans: Span[] = [];

    public constructor(
        public parentSpanId: string | null, public name: string
    ) {
        this.id = uuidv4();
        this.startTime = Date.now();
    }

    public startSpan(name: string): Span {
        const span = new Span(null, name);
        this.childSpans.push(span);
        return span;
    }

    public endSpan(): void {
        this.endTime = Date.now();
    }
}

class Trace {
    private rootSpan: Span | null = null;
    private currentSpan: Span | null = null;
    private tracesBuffer: Span[] = [];

    trace<T>(name: string, callback: () => T): T {
        this.startTrace(name);

        let result: T;
        try {
            console.log("Entry");
            result = callback();
        } catch (error) {
            this.error({
                error: error as Error,
            });
            throw error;
        } finally {
            console.log("Exit");
            this.endSpan();
        }

        return result;
    }

    public startTrace(name: string): Span {
        const span = new Span(null, name);
        this.rootSpan = span;
        this.currentSpan = span;
        return span;
    }

    public endTrace(): void {
        if (!this.rootSpan) {
            throw new Error('No active trace to end.');
        }
        this.rootSpan.endTime = Date.now();
        this.tracesBuffer.push(this.rootSpan);
        this.currentSpan = null;
        this.rootSpan = null;
    }

    public startSpan(name: string): Span {
        if (!this.currentSpan) {
            throw new Error('No active span. Start a trace first.');
        }
        const span = new Span(this.currentSpan.id, name);
        this.currentSpan.childSpans.push(span);
        this.currentSpan = span;
        return span;
    }

    public endSpan(): void {
        if (!this.currentSpan) {
            throw new Error('No active span to end.');
        }
        this.currentSpan.endTime = Date.now();
        const parentSpan = this.findParentSpan(this.currentSpan);
        if (parentSpan) {
            this.currentSpan = parentSpan;
        } else {
            this.tracesBuffer.push(this.rootSpan!);
            this.currentSpan = null;
            this.rootSpan = null;
        }
    }

    private log(level: LogLevel, log: Log): void {
        if (!this.currentSpan) {
            throw new Error('No active span to log message.');
        }
        const _log = {
            ...log,
            timestamp: Date.now(),
        };
        this.currentSpan.logs.push(log);
    }

    info(log: Log): void {
        this.log(LogLevel.INFO, log);
    }

    warn(log: Log): void {
        this.log(LogLevel.WARN, log);
    }

    error(log: Log): void {
        this.log(LogLevel.ERROR, log);
    }

    private findParentSpan(span: Span): Span | null {
        if (!this.rootSpan) {
            return null;
        }
        const stack = [this.rootSpan];
        while (stack.length > 0) {
            const currentSpan = stack.pop()!;
            if (currentSpan.childSpans.includes(span)) {
                return currentSpan;
            }
            stack.push(...currentSpan.childSpans);
        }
        return null;
    }
}

type DecoratorFn = (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => void;

export function Traced(name?: string): DecoratorFn;
export function Traced<T>(name: string, callback: () => T): T;
export function Traced<T>(nameOrCallback?: string | (() => T), callback?: () => T): T | DecoratorFn {
    if (typeof nameOrCallback === "function") {
        // Handle function call with a callback
        return new Trace().trace("Anonymous", nameOrCallback);
    } else if (typeof callback === "function") {
        // Handle function call with a name and a callback
        return new Trace().trace(nameOrCallback ?? "Anonymous", callback);
    } else {
        // Handle decorator usage
        return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
            const originalMethod = descriptor.value;
            descriptor.value = function (...args: unknown[]) {
                const nameToUse = nameOrCallback ?? `${target.constructor.name}.${propertyKey}`;
                return new Trace().trace(nameToUse, originalMethod.bind(this, ...args));
            };
        };
    }
}