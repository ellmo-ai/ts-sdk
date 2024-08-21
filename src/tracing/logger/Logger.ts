import { AsyncLocalStorage } from 'async_hooks';
import { Span } from "./trace";
import { omit } from '../../util/omit';
import { OllyllmServiceClient } from '../../gen/ollyllm/v1/ollyllm.client';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { ChannelCredentials } from '@grpc/grpc-js';
import { ReportSpanRequest, Span as SpanProto } from '../../gen/ollyllm/v1/span';
import { Timestamp } from '../../gen/google/protobuf/timestamp';

class State {
    public _currentSpan: AsyncLocalStorage<Span | undefined> = new AsyncLocalStorage<Span | undefined>();
    public _currentLogger: AsyncLocalStorage<Logger | undefined> = new AsyncLocalStorage<Logger | undefined>();
}

export type LoggerOptions = {
    apiKey: string;
    baseUrl: string;
    debug?: boolean;
}

const FLUSH_INTERVAL_MS = 5 * 1000; // 5 seconds

export class Logger {
    private static instance: Logger;
    private _state: State = new State();
    private tracesBuffer: Omit<Span, 'childSpans'>[] = [];

    private _timeout: NodeJS.Timeout | null = null;

    private _apiKey: string;
    private _debug: boolean;
    private client: OllyllmServiceClient;

    private constructor(opts: LoggerOptions) {
        this._apiKey = opts.apiKey;
        this._debug = opts.debug || false;

        const transport = new GrpcTransport({
            host: opts.baseUrl,
            channelCredentials: ChannelCredentials.createInsecure(),
        });
        this.client = new OllyllmServiceClient(transport);

        this._timeout = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
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
        const parentSpan = this._state._currentSpan.getStore();
        const span = new Span(name, undefined, parentSpan?.id); // Add parent span id if any
        this.addSpanToBuffer(span);
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
        this.addSpanToBuffer(currentSpan);
        this._state._currentSpan.disable();
    }

    private addSpanToBuffer(span: Span): void {
        this.tracesBuffer.push(omit(span, ['childSpans']));
    }

    /** Start a span with the given name */
    public startSpan(name: string): Span {
        const currentSpan = this._state._currentSpan.getStore();
        if (!currentSpan) {
            throw new Error('No active trace to start a span.');
        }
        const span = currentSpan.startSpan(name);
        this._state._currentSpan.enterWith(span);
        return span;
    }

    /** End the current span */
    public endSpan(): void {
        const currentSpan = this._state._currentSpan.getStore();
        if (currentSpan) {
            currentSpan.endSpan();
        }
        this._state._currentSpan.disable();
    }

    /** Retrieve the current span if any */
    public currentSpan(): Span | undefined {
        return this._state._currentSpan.getStore();
    }

    /** Trace a callback with the given name */
    public trace<T>(name: string, callback: () => T): T {
        const parentSpan = this._state._currentSpan.getStore();
        const hasParentSpan = !!parentSpan;

        const span = hasParentSpan ? parentSpan.startSpan(name) : this.startTrace(name);

        if (this._debug) {
            console.debug(`Entry - ${name}`, span);
        }

        const result = this._state._currentSpan.run(span, () => {
            let result: T;
            try {
                result = callback();
            } catch (error) {
                throw error;
            }
            return result;
        });

        if (hasParentSpan) {
            span.endSpan();
        } else {
            this.endTrace();
        }

        if (this._debug) {
            console.debug(`Exit - ${name}`, span);
        }

        return result;
    }

    /** Flush the traces buffer to the server. */
    public async flush(): Promise<void> {
        if (this.tracesBuffer.length === 0) {
            return;
        }

        if (this._debug) {
            console.debug('Flushing traces', this.tracesBuffer);
            this.tracesBuffer = [];
            return;
        }

        const payload: ReportSpanRequest = {
            spans: this.tracesBuffer.map(span => {
                return {
                    id: span.id,
                    parentId: span.parentSpanId,
                    traceId: span.traceId,
                    operationName: span.operationName,
                    startTimestamp: Timestamp.fromDate(new Date(span.startTime)),
                    endTimestamp: span.endTime ? Timestamp.fromDate(new Date(span.endTime)) : undefined,
                } as SpanProto;
            }),
        };

        try {
            this.client.reportSpan(payload);
        } catch (error) {
            console.error('Failed to flush traces', error);
        } finally {
            this.tracesBuffer = [];
        }
    }
}
