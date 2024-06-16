import { Tracing } from '../../logger';
import { OpenAI } from 'openai';
import { CompletionCreateFunction } from './types';

export function wrappedOpenAI(client: OpenAI) {
    let completionProxy = new Proxy(client.chat.completions, {
        get(target, name, receiver) {
            const selectedValue = Reflect.get(target, name, receiver);
            if (name === "create") {
                // Trace the method
                return wrapChatCompletion(selectedValue.bind(target));
            }
            return selectedValue;
        },
    });

    let chatProxy = new Proxy(client.chat, {
        get(target, name, receiver) {
            if (name === "completions") {
                return completionProxy;
            }
            return Reflect.get(target, name, receiver);
        },
    });

    return new Proxy(client, {
        get(target, name, receiver) {
            if (name === "chat") {
                return chatProxy;
            }
            return Reflect.get(target, name, receiver);
        },
    });
}
export interface Test {
    version: string;
}

function wrapChatCompletion(
    completion: CompletionCreateFunction,
): (...params: Parameters<CompletionCreateFunction>) => Promise<unknown> {
    return async (...params) => {
        const [body, options] = params;
        return Tracing.trace('openai.chat.completions.create', async () => {
            // @ts-ignore FIXME:
            const { messages, model } = body;

            const currentSpan = Tracing.currentSpan();
            // TODO: this should be an attribute instead
            currentSpan?.log({ metadata: { model, messages } });

            try {
                const { data, response } = await completion(body, options).withResponse();
                // send the tests and the response
                return data;
            } finally {
                // end
            }
        });
    };
}
