import OpenAI from "openai";

import { Prompt } from "@ellmo-ai/ts-sdk/dist/prompt"
import { HasEval } from "@ellmo-ai/ts-sdk/dist/eval"

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

@HasEval
export class RemoveUUID extends Prompt<string, string> {
    protected id = "RemoveUUID";
    protected version = "0.0.2";
    protected model = "gpt-4o-mini";

    protected get systemPrompt(): string {
        return "You will be given a string that may include UUIDs. Return the string.";
    }

    protected async prepare(): Promise<(input: string) => Promise<string>> {
        return async (input: string) => {
            const response = await openai.chat.completions.create({
                model: this.model,
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
