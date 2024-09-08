import { Eval } from "@polay-ai/ts-sdk/dist/eval";
import { RemoveUUID } from "./RemoveUUID";

export default new Eval({
    id: "RemoveUUID",
    prompt: RemoveUUID,
    data: () => ([
        {
            input: "3dab098f-6e74-4352-a9e2-adc84eb78447, hello, world",
            expected: "hello, world",
        },
        {
            input: "hello, world",
            expected: "hello, world",
        },
        {
            input: "3dab098f-6e74-4352-a9e2-adc84eb78447",
            expected: "",
        }
    ]),
    run: async (input: string) => {
        const prompt = new RemoveUUID();
        return await prompt.execute(input);
    },
    scoring: async (_input: string, _expected: string, output: string) => {
        const regexp = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig
        const matches = Array.from(output.matchAll(regexp))

        return matches.length === 0 ? 1 : 0;
    }
});
