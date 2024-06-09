import { Tracing } from '../../logger';
import { OpenAI } from 'openai';
import { CompletionCreateFunction } from './types';

export function wrappedOpenAI(client: OpenAI) {
    let completionProxy = new Proxy(client.chat.completions, {
        get(target, name, receiver) {
            const baseVal = Reflect.get(target, name, receiver);
            if (name === "create") {
                return wrapChatCompletion(baseVal.bind(target));
            }
            return baseVal;
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

function wrapChatCompletion(
    completion: CompletionCreateFunction,
): (...params: Parameters<CompletionCreateFunction>) => Promise<unknown> {
    return async (...params) => {
        const [body, options] = params;
        return Tracing.trace('openai.chat.completions.create', () => {
            return completion(body, options);
        });
    };
}
