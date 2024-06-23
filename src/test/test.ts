export class Test<T> {
    public constructor(
        { id, version, func }: { id: string, version: string, func: (input: T) => string | boolean | number }
    ) {
        this.id = id;
        this.version = version;
        this.func = func;
    }

    public id: string;
    public version: string;
    public func: (input: any) => unknown;
}
