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