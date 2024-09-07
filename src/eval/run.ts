#!/usr/bin/env -S ts-node || node

import { Command } from 'commander';
import path from 'path';
import ts from 'typescript';
import fs from 'fs';
import { Config } from '../config';
import { Eval } from '.';
import { RecordEvalRequest, RecordEvalResponse, EvalOutcome } from '../gen/polay/v1/eval';
import chalk from 'chalk';

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type Scores = UnwrapPromise<ReturnType<Eval<any, any>['runEval']>>;

const program = new Command()
    .version('1.0.0')
    .description('CLI to run evals')
    .requiredOption('-path, --path <path>', 'Path to the prompt file to run evals for')
    .action(async ({ path: promptPath }: { path: string }) => {
        let config: Config;
        try {
            config = new Config();
        } catch (error) {
            console.error('Error:', error);
            process.exit(1);
        }

        const workingDirectory = process.cwd();
        const absolutePath = path.resolve(workingDirectory, promptPath);

        const classes = getPromptClasses(config, absolutePath);
        if (classes.length === 0) {
            console.log('No classes with the @HasEval decorator found in the specified file.');
            process.exit(0);
        }

        const evalFilesToRun = getEvalFilesToRun(config, classes);

        for (const { file, exportName } of evalFilesToRun) {
            console.log('Running eval file:', file, 'with export:', exportName);

            let ev: Eval<any, any> | undefined;
            try {
                const evalFile = await import(file);
                ev = evalFile[exportName];

                if (!ev) {
                    throw new Error('Eval not found in the specified file');
                }
            } catch (error) {
                console.error('Error loading eval file:', error);
                process.exit(1);
            }

            let scores: Scores;
            try {
                scores = await ev.runEval();
            } catch (error) {
                console.error('Error executing eval:', error);
                process.exit(1);
            }

            const hashToIOPair = new Map<string, Scores[number]['io']>();
            for (const score of scores) {
                hashToIOPair.set(score.hash, score.io);
            }

            const payload = formPayload(ev, scores);

            let response: RecordEvalResponse;
            try {
                const res = await config.rpcClient.recordEval(payload);
                response = res.response;
            } catch (error) {
                console.error('Error recording eval:', error);
                process.exit(1);
            }

            console.log('');

            let color = undefined;
            switch (response.outcome) {
                case EvalOutcome.IMPROVEMENT:
                    color = chalk.green;
                    console.log(chalk.green('Eval improved!'));
                    break;
                case EvalOutcome.REGRESSION:
                    color = chalk.red;
                    console.log(chalk.red('Eval regressed!'));
                    break;
                case EvalOutcome.NO_CHANGE:
                    console.log('Eval did not significantly change.');
                    break;
                case EvalOutcome.UNKNOWN:
                    console.log('Eval outcome unknown.');
                    break;
                default:
                    console.error('Unknown result:', response.outcome);
                    break;
            }

            const meaningfulScores = response.meaningfulEvalScores;
            if (meaningfulScores.length > 0) {
                if (color) {
                    console.log(color.bold.underline('\nMeaningful eval scores:'));
                } else {
                    console.log(chalk.bold.underline('\nMeaningful eval scores:'));
                }

                for (const score of meaningfulScores) {
                    const ioPair = hashToIOPair.get(score.evalHash);
                    if (!ioPair) {
                        // Should never happen
                        throw new Error('Input/expected pair not found for eval hash');
                    }

                    // Pretty print the input/output pair and the score change
                    console.log(`\nInput: ${chalk.blue(JSON.stringify(ioPair.input))}`);
                    console.log(`Expected: ${chalk.blue(JSON.stringify(ioPair.expected))}`);
                    console.log(`Actual: ${chalk.blue(JSON.stringify(ioPair.output))}`);

                    let color = chalk.gray;
                    if (score.outcome === EvalOutcome.IMPROVEMENT) {
                        color = chalk.green;
                    } else if (score.outcome === EvalOutcome.REGRESSION) {
                        color = chalk.red;
                    }

                    console.log(chalk.bold(`Score: ${color(`${score.previousScore} -> ${score.currentScore}`)}`));
                }
            }
        }
    });

program.parse(process.argv);

function formPayload(ev: Eval<any, any>, scores: Scores): RecordEvalRequest {
    return {
        versionedEval: {
            name: ev.id,
            version: ev.version,
        },
        evalScores: scores.map(score => {
            return {
                evalHash: score.hash,
                score: score.score
            }
        }),
    };
}

function getPromptClasses(config: Config, promptPath: string): ts.ClassDeclaration[] {
    const sourceFile = ts.createSourceFile(
        promptPath,
        fs.readFileSync(promptPath, 'utf-8'),
        ts.ScriptTarget.Latest,
        true
    );

    let classes: ts.ClassDeclaration[] = [];
    // Check source file for any classes with the @HasEval decorator
    ts.forEachChild(sourceFile, (node) => {
        if (ts.isClassDeclaration(node)) {
            const hasEvalDecorator = node.modifiers?.some(modifier => {
                if (ts.isDecorator(modifier)) {
                    if (ts.isCallExpression(modifier.expression)) {
                        return ts.isIdentifier(modifier.expression.expression) &&
                            modifier.expression.expression.text === 'HasEval';
                    } else if (ts.isIdentifier(modifier.expression)) {
                        return modifier.expression.text === 'HasEval';
                    }
                }
                return false;
            });

            if (hasEvalDecorator) {
                classes.push(node);
            }
        }
    });

    return classes;
}

function getEvalFilesToRun(config: Config, classes: ts.ClassDeclaration[]): { file: string, exportName: string }[] {
    const evalFiles = getAllFilesMatchingPattern(config.getPath("evals"), /\.eval.ts$/);

    // Get the list of eval files that use the classes with the @HasEval decorator
    const evalFilesToRun = evalFiles.map(evalFile => {
        const evalSourceFile = ts.createSourceFile(
            path.resolve(config.getPath("evals"), evalFile),
            fs.readFileSync(path.resolve(config.getPath("evals"), evalFile), 'utf-8'),
            ts.ScriptTarget.Latest,
            true
        );

        let shouldRun = false;
        let evalExport: string | undefined = undefined;

        ts.forEachChild(evalSourceFile, (node) => {
            // Check if the eval file has any variable declaration of Eval type with prompt: <one of the classes>
            if (ts.isVariableStatement(node)) {
                const declarations = node.declarationList.declarations;
                if (declarations.length !== 1) {
                    return;
                }

                const [declaration] = declarations;
                const initializer = declaration.initializer as ts.CallExpression | undefined;

                if (!initializer) {
                    return;
                }

                const name = (initializer.expression as ts.Identifier).text;
                if (name !== 'Eval') {
                    return;
                }

                const isExported = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
                if (!isExported) {
                    return;
                }

                const promptProperty = initializer.arguments[0] as ts.ObjectLiteralExpression;
                const prompt = promptProperty.properties.find(prop => {
                    if (ts.isPropertyAssignment(prop)) {
                        return prop.name.getText() === 'prompt';
                    }
                    return false;
                });

                if (prompt && ts.isIdentifier((prompt as ts.PropertyAssignment).initializer)) {
                    const identifier = (prompt as ts.PropertyAssignment).initializer as ts.Identifier;
                    shouldRun = classes.some(clazz => clazz.name?.text === identifier.text);
                    evalExport = (declaration.name as ts.Identifier).text;
                }
            }
        });

        return shouldRun ? { file: evalFile, exportName: evalExport! } : undefined;
    }).filter(Boolean) as { file: string, exportName: string }[];

    return evalFilesToRun;
}

function getAllFilesMatchingPattern(dir: string, pattern: RegExp): string[] {
    const files = fs.readdirSync(dir);
    const matchingFiles: string[] = [];

    files.forEach(file => {
        const filePath = path.resolve(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            matchingFiles.push(...getAllFilesMatchingPattern(filePath, pattern));
        } else if (pattern.test(file)) {
            matchingFiles.push(filePath);
        }
    });

    return matchingFiles;
}
