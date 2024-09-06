import OpenAI from "openai";

import { Prompt } from "@ollyllm/ts-sdk/dist/prompt"
import { HasEval } from "@ollyllm/ts-sdk/dist/eval"
// import { wrappedOpenAI } from "@ollyllm/ts-sdk/dist/tracing/wrap/openai";

const openai = new OpenAI({
    apiKey: '',
});

@HasEval
export class RemoveUUID extends Prompt<string, string> {
    protected id = "ParseInteger";
    protected version = "0.0.1";
    protected model = "gpt-3.5-turbo";

    protected get systemPrompt(): string {
        return "You will be given a string that may include UUIDs. Return the string with all UUIDs removed. Respond only with the string.";
    }

    protected async prepare(): Promise<(input: string) => Promise<string>> {
        return async (input: string) => {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: this.systemPrompt },
                    { role: 'user', content: input }
                ],
            });

            const output = response.choices[0].message.content as string;
            return output;
        }
    }
}
