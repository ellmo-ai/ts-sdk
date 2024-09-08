import { BinaryLike, createHash } from "crypto";
import { Prompt } from "../prompt";

type EvalData<T, U> = {
    input: T,
    expected: U,
}[];

type EvalDataFunction<T, U> = () => EvalData<T, U> | Promise<EvalData<T, U>>;
type EvalRunFunction<T, U> = (input: T) => U | Promise<U>;
type EvalScoringFunction<T, U> = (input: T, expected: U, output: U) => number | Promise<number>;

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
export type EvalScores = UnwrapPromise<ReturnType<Eval<any, any>['_runEval']>>;

export class Eval<T extends BinaryLike, U extends string | boolean | number> {
    public constructor(
        {
            id,
            data,
            run,
            scoring
        }: {
            /** The ID of the eval. */
            id: string,
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
        this.data = data;
        this.run = run;
        this.scoring = scoring;
    }

    public id: string;
    public data: EvalDataFunction<T, U>;
    public run: EvalRunFunction<T, U>;
    public scoring: EvalScoringFunction<T, U>;

    private async _runEval() {
        const data = await this.data();

        return await Promise.all(data.map(async ({ input, expected }) => {
            const output = await this.run(input);

            const evalHash = createHash('sha256').update(`${input}${expected}`).digest('hex');
            return {
                hash: evalHash,
                score: await this.scoring(input, expected, output),
                io: {
                    input,
                    expected,
                    output,
                }
            }
        }));
    }
}

export function HasEval(constructor: Function) {
    // no-op
}
