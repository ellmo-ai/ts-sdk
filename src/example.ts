import { Traced } from "./logger/trace";

export class Example {
    @Traced()
    public exampleMethod(): void {
        console.log("Example method called");
        const res = Traced('innerMethod', () => {
            console.log("Inner method called");
            return 1;
        });
    }
}

const example = new Example();
console.log('Calling exampleMethod');
example.exampleMethod();
