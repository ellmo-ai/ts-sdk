import { Test } from "@ollyllm/test";

export const noUUID = new Test({
    id: 'noUUID',
    version: '1.0.0',
    func: (result: string) => {
        const regexp = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig
        const matches = Array.from(result.matchAll(regexp))

        return matches.length === 0;
    }
});

export const no420 = new Test({
    id: 'no420',
    version: '2.0.1',
    func: (result: number) => {
        return result !== 420;
    }
});
