import { Traced, span } from "./logger/trace";

export class Example {
    @Traced()
    public async exampleMethod(): Promise<void> {
        console.log("Example method called");
        const res = span('innerMethod', () => {
            console.log("Inner method called");
            return 1;
        });
    }
}

const example = new Example();
console.log('Calling exampleMethod');
example.exampleMethod().then(() => {
    console.log('exampleMethod resolved');
});
