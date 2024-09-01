/** A test definition. */
export class Test<T> {
    public constructor(
        { id, version, func }: { id: string, version: string, func: (input: T) => string | boolean | number }
    ) {
        this.id = id;
        this.version = version;
        this.func = (input: T) => {
            const result = func(input);
            console.log(`Test ${id} returned ${result}`);
            return result;
        };
    }

    public id: string;
    public version: string;
    public func: (input: T) => unknown;
}
