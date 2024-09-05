/** A test definition. */
export class Test<T> {
    public constructor(
        { id, version, func }: {
            /** The ID of the test. */
            id: string,
            /** The version of the test. */
            version: string,
            /** The function that performs the test on the input. */
            func: (input: T) => string | boolean | number
        }
    ) {
        this.id = id;
        this.version = version;
        this.func = (input: T) => {
            const result = func(JSON.parse(JSON.stringify(input)));
            return result;
        };
    }

    public id: string;
    public version: string;
    public func: (input: T) => unknown;
}
