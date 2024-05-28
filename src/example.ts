import { init, Tracing } from ".";

init({
    apiKey: '1234',
    baseUrl: 'http://localhost:3000',
    debug: true,
});

export class Example {
    @Tracing.trace('workflow')
    public async exampleMethod(): Promise<number> {
        console.log("Example method called");
        return Tracing.trace('openAI', () => {
            console.log("Inner method called");
            this.exampleMethod2();
            return 1;
        });
    }

    @Tracing.trace()
    public async exampleMethod2(): Promise<void> {
        console.log("Example method2 called");
    }
}

const example = new Example();
console.log('Calling exampleMethod');
example.exampleMethod().then(() => {
    console.log('exampleMethod resolved');
});
