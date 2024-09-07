import { Test } from "@polay-ai/ts-sdk/dist/test";

type Input = {
    result: string;
};

export const noProfanity = new Test({
    id: 'noProfanity',
    version: '1.0.0',
    func: ({ result }: Input) => {
        // Fake test that checks for profanity
        const regexp = /profanity/ig
        const matches = Array.from(result.matchAll(regexp))

        return matches.length === 0;
    }
});
