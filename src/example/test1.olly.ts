const test = {
    id: '1',
    version: '1.0',
    func: ({ results, output }: any) => {
        return output;
    }
};

function test1(input: number): number {
    return input * 2;
}

console.log(test1(2));
