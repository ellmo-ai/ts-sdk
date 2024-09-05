import { Prompt } from "@ollyllm/ts-sdk/dist/prompt"
import { HasEval } from "@ollyllm/ts-sdk/dist/eval"

@HasEval
export class ParseInteger extends Prompt<string, number> {
    protected id = "ParseInteger";
    protected version = "0.0.1";
    protected model = "gpt-3.5-turbo";

    protected get systemPrompt(): string {
        return "This is a test prompt.";
    }

    protected async prepare(): Promise<(input: string) => Promise<number>> {
        return async (input: string) => {
            const firstAlphaNumericWord = input.match(/\w+/)?.[0] ?? "";
            switch (firstAlphaNumericWord.toLowerCase()) {
                case "one":
                    return 1;
                case "two":
                    return 2;
                case "three":
                    return 3;
                default:
                    return 0;
            }
        }
    }
}
