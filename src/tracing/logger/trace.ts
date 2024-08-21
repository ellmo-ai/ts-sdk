import { v4 as uuidv4 } from 'uuid';
import { Log, ISpan } from "./types";

export class Span implements ISpan {
    public id: string;
    public traceId: string;
    public startTime: number;
    public endTime: number | null = null;
    public logs: Log[] = [];
    public childSpans: Span[] = [];

    public constructor(
        public operationName: string, traceId?: string, public parentSpanId?: string,
    ) {
        this.id = uuidv4();
        this.traceId = traceId || uuidv4();
        this.startTime = Date.now();
    }

    public startSpan(name: string): Span {
        const span = new Span(name, this.traceId, this.id);
        this.childSpans.push(span);
        return span;
    }

    public endSpan(): void {
        this.endTime = Date.now();
    }

    public log(log: Log): void {
        if (process.env.NODE_ENV === 'development') {
            console.log(log);
        }
        this.logs.push(log);
    }
}
