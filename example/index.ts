import { init, Tracing } from "../src/tracing/logger";
import { wrappedOpenAI } from "../src/tracing/wrap/openai";
import { OpenAI } from "openai";

const logger = init({
    apiKey: '1234',
    baseUrl: 'http://localhost:3000',
    debug: false,
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

const openai = new OpenAI({
    apiKey: '1234',
});
const wrappedClient = wrappedOpenAI(openai);
