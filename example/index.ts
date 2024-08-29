import { OpenAI } from "openai";

import { init, Tracing } from "../src/tracing/logger";
import { wrappedOpenAI } from "../src/tracing/wrap/openai";
import { no420, noUUID } from "./tests/simple/noUUID.olly";

const _logger = init({
    apiKey: '1234',
    baseUrl: 'localhost:50051',
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

    @Tracing.traceWithTests([no420])
    public testedMethod(): number {
        Tracing.traceWithTests('testedMethod-inner', [noUUID], () => {
            return '0a0a0a0a-0a0a-0a0a-0a0a-0a0a0a0a0a';
        });

        return 420;
    }
}

const example = new Example();
console.log('Calling tested method');
example.testedMethod();

const openai = new OpenAI({
    apiKey: '1234',
});
const wrappedClient = wrappedOpenAI(openai);
