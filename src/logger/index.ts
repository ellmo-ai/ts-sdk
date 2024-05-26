import { AsyncLocalStorage } from 'async_hooks';
import { Span, Trace } from "./trace";

class State {
    public _currentSpan: AsyncLocalStorage<Span | undefined> = new AsyncLocalStorage<Span | undefined>();
    public _currentLogger: AsyncLocalStorage<Logger | undefined> = new AsyncLocalStorage<Logger | undefined>();

    public constructor() { }
}

export type LoggerOptions = {
    apiKey: string;
    baseUrl: string;
    debug?: boolean;
}

export class Logger {
    private static instance: Logger;
    private _state: State = new State();
    private tracesBuffer: Span[] = [];

    private _timeout: NodeJS.Timeout | null = null;

    private _apiKey: string;
    private _baseUrl: string;
    private _debug: boolean;

    private constructor(opts: LoggerOptions) {
        this._apiKey = opts.apiKey;
        this._baseUrl = opts.baseUrl;
        this._debug = opts.debug || false;

        this._timeout = setInterval(() => {
            this.flush();
        }, 5 * 1000); // 5 seconds
    }

    /** Get the singleton instance of the Logger */
    public static getInstance(opts: LoggerOptions): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(opts);
        }
        return Logger.instance;
    }

    /** Start a trace with the given name */
    public startTrace(name: string): Span {
        const span = new Span(null, name);
        this.tracesBuffer.push(span);
        this._state._currentSpan.enterWith(span);
        return span;
    }

    /** End the current trace */
    public endTrace(): void {
        const currentSpan = this._state._currentSpan.getStore();
        if (!currentSpan) {
            throw new Error('No active trace to end.');
        }
        currentSpan.endSpan();
        this._state._currentSpan.disable();
    }

    /** Start a span with the given name */
    public startSpan(name: string): void {
        const currentSpan = this._state._currentSpan.getStore();
        if (!currentSpan) {
            throw new Error('No active trace to start a span.');
        }
        const span = currentSpan.startSpan(name);
        this._state._currentSpan.enterWith(span);
    }

    /** End the current span */
    public endSpan(): void {
        const currentSpan = this._state._currentSpan.getStore();
        if (currentSpan) {
            currentSpan.endSpan();
        }
        this._state._currentSpan.disable();
    }

    /** Trace a callback with the given name */
    public trace<T>(name: string, callback: () => T): T {
        const parentSpan = this._state._currentSpan.getStore();
        const hasParentSpan = !!parentSpan;

        const span = hasParentSpan ? parentSpan.startSpan(name) : this.startTrace(name);

        console.log(`Entry - ${name}`, span);
        const result = this._state._currentSpan.run(span, () => {
            let result: T;
            try {
                result = callback();
            } catch (error) {
                throw error;
            }
            return result;
        });

        hasParentSpan ? span.endSpan() : this.endTrace();
        console.log(`Exit - ${name}`, span);

        return result;
    }

    public async flush(): Promise<void> {
        if (this.tracesBuffer.length === 0) {
            return;
        }

        if (this._debug) {
            console.log('Flushing traces', this.tracesBuffer);
            this.tracesBuffer = [];
        }

        const result = await fetch(`${this._baseUrl}/api/v1/traces`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: this._apiKey,
            },
            body: JSON.stringify({
                traces: this.tracesBuffer,
            })
        });
        // TODO: Handle response

        this.tracesBuffer = [];
    }
}
