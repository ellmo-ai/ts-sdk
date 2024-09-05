

export abstract class Prompt<T, U> {
    protected abstract id: string;
    protected abstract version: string;

    /**
     * The system prompt that defines the behavior of the LLM
     */
    protected abstract get systemPrompt(): string;

    protected abstract model: string;

    /**
     * Prepares the prompt for evaluation, returning a function that will used to execute the prompt.
     */
    protected abstract prepare(): Promise<(input: T) => Promise<U>>;

    public async execute(input: T): Promise<U> {
        const prompt = this.systemPrompt;
        const model = this.model;

        const prepare = await this.prepare();
        return prepare(input);
    }
}
