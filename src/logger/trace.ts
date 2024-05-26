import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';
import { Log, ISpan, LogLevel } from "./types";

const _currentSpan = new AsyncLocalStorage<Span | undefined>();

export class Span implements ISpan {
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
        const span = new Span(this.id, name);
        this.childSpans.push(span);
        return span;
    }

    public endSpan(): void {
        this.endTime = Date.now();
    }
}

export function getCurrentSpan(): Span | undefined {
    return _currentSpan.getStore();
}

export class Trace {
    private rootSpan: Span | undefined = undefined;
    private tracesBuffer: Span[] = [];

    trace<T>(name: string, callback: () => T): T {
        if (_currentSpan.getStore()) {
            throw new Error('There is already an active trace.');
        }

        this.startTrace(name);

        return _currentSpan.run(this.rootSpan, () => {
            let result: T;
            try {
                console.log("Entry", _currentSpan.getStore());
                result = callback();
            } catch (error) {
                this.error({ error: error as Error });
                throw error;
            } finally {
                console.log("Exit", _currentSpan.getStore());
                this.endSpan();
            }
            return result;
        });
    }

    public startTrace(name: string): Span {
        const span = new Span(null, name);
        this.rootSpan = span;
        _currentSpan.enterWith(span);
        return span;
    }

    public endTrace(): void {
        const rootSpan = _currentSpan.getStore();
        if (!rootSpan) {
            throw new Error('No active trace to end.');
        }
        rootSpan.endSpan();
        this.tracesBuffer.push(rootSpan);
        _currentSpan.disable();
    }

    public startSpan(name: string): Span {
        const currentSpan = _currentSpan.getStore();
        if (!currentSpan) {
            throw new Error('No active span. Start a trace first.');
        }
        const span = new Span(currentSpan.id, name);
        currentSpan.childSpans.push(span);
        _currentSpan.enterWith(span);
        return span;
    }

    public endSpan(): void {
        const currentSpan = _currentSpan.getStore();
        if (!currentSpan) {
            throw new Error('No active span to end.');
        }
        currentSpan.endSpan();
        const parentSpan = this.findParentSpan(currentSpan);
        if (parentSpan) {
            _currentSpan.enterWith(parentSpan);
        } else {
            this.tracesBuffer.push(this.rootSpan!);
            _currentSpan.disable();
        }
    }

    private log(level: LogLevel, log: Log): void {
        const currentSpan = _currentSpan.getStore();
        if (!currentSpan) {
            throw new Error('No active span to log message.');
        }
        const _log = { ...log, timestamp: Date.now() };
        currentSpan.logs.push(_log);
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
