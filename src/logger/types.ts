export type Log = {
    /** Any metadata associated with the log */
    metadata?: object;
} & ({
    /** The message of the log */
    message: string;
} | {
    /** The error message */
    error: Error;
});

export interface ISpan {
    id: string;
    name: string;
    startTime: number;
    endTime: number | null;
    logs: Log[];
    childSpans: ISpan[];
}

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}
