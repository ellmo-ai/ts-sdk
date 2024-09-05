import { Prompt } from "../prompt";

type EvalData<T, U> = {
    input: T,
    expected: U,
}[];

type EvalDataFunction<T, U> = () => EvalData<T, U> | Promise<EvalData<T, U>>;
type EvalRunFunction<T, U> = (input: T) => U | Promise<U>;
type EvalScoringFunction<T, U> = (input: T, expected: U, output: U) => number | Promise<number | boolean>;

export class Eval<T, U extends string | boolean | number> {
    public constructor(
        {
            id,
            version,
            data,
            run,
            scoring
        }: {
            /** The ID of the eval. */
            id: string,
            /** The version of the eval. */
            version: string,
            /** The prompt being evaluated. */
            prompt: typeof Prompt<T, U>,
            /** The data function. */
            data: EvalDataFunction<T, U>,
            /** The run function that performs the LLM task. */
            run: EvalRunFunction<T, U>,
            /** The scoring function that scores the output of the LLM task. */
            scoring: EvalScoringFunction<T, U>,
        }
    ) {
        this.id = id;
        this.version = version;
        this.data = data;
        this.run = run;
        this.scoring = scoring;
    }

    public id: string;
    public version: string;
    public data: EvalDataFunction<T, U>;
    public run: EvalRunFunction<T, U>;
    public scoring: EvalScoringFunction<T, U>;

    public async runEval() {
        const data = await this.data();

        return await Promise.all(data.map(async ({ input, expected }) => {
            try {
                const output = await this.run(input);
                return {
                    result: await this.scoring(input, expected, output),
                };
            } catch (error) {
                return {
                    error: true,
                };
            }
        }));
    }
}

export function HasEval(constructor: Function) {
    // no-op
}
