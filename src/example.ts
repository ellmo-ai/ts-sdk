import { init, Traced } from ".";

// const logger = init({
//     apiKey: '1234',
//     baseUrl: 'http://localhost:3000',
//     debug: true,
// });

export class Example {
    @Traced()
    public async exampleMethod(): Promise<void> {
        console.log("Example method called");
        const res = Traced('openAI', () => {
            console.log("Inner method called");
            return 1;
        });
        this.exampleMethod2();
    }

    @Traced()
    public async exampleMethod2(): Promise<void> {
        console.log("Example method2 called");
    }
}

const example = new Example();
console.log('Calling exampleMethod');
example.exampleMethod().then(() => {
    console.log('exampleMethod resolved');
});
