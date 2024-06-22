/** The log object that can be added to a span. */
export type Log = {
    /** Any metadata associated with the log */
    metadata?: object;
} & ({
    /** The message of the log */
    message: string;
} | {
    /** The error message */
    error?: Error;
});

/** The span object that represents a trace. */
export interface ISpan {
    id: string;
    operationName: string;
    startTime: number;
    endTime: number | null;
    logs: Log[];
    childSpans: ISpan[];
}

/** The log level for a log. */
export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}
