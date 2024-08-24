import { Test } from "@ollyllm/test";

type Input = {
    result: string;
};

export const noUUID = new Test({
    id: 'noUUID',
    version: '1.0.0',
    func: ({ result }: Input) => {
        const regexp = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig
        const matches = Array.from(result.matchAll(regexp))

        return matches.length === 0;
    }
});

export const noUUIDv2 = new Test({
    id: 'noUUID',
    version: '2.0.0',
    func: ({ result }: Input) => {
        const regexp = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig
        const matches = Array.from(result.matchAll(regexp))

        return matches.length === 0;
    }
});
