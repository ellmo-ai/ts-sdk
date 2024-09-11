#!/usr/bin/env -S ts-node || node

import { Command } from 'commander';
import path from 'path';
import ts from 'typescript';
import fs from 'fs';
import { Config } from '../config';
import { Eval, EvalScores } from '.';
import { RecordEvalRequest, RecordEvalResponse, EvalOutcome } from '../gen/polay/v1/eval';
import chalk from 'chalk';
import { execSync } from 'child_process';

type Prompt = {
    name: string,
    version: string,
    class: ts.ClassDeclaration
};

const program = new Command()
    .version('1.0.0')
    .description('CLI to run evals')
    .requiredOption('-path, --path <path>', 'Path to the prompt file to run evals for')
    .option('--base <base>', 'Base version to compare against, if not provided will use the previous version.')
    .action(async ({ path: promptPath, base }: { path: string, base?: string }) => {
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

        for (const { file, exportName, prompt } of evalFilesToRun) {
            console.log(`Running ${file} for ${prompt.name} v${prompt.version}...`);

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

            let scores: EvalScores;
            try {
                // @ts-ignore - We know _runEval exists
                scores = await ev._runEval();
            } catch (error) {
                console.error('Error executing eval:', error);
                process.exit(1);
            }

            const hashToIOPair = new Map<string, EvalScores[number]['io']>();
            for (const score of scores) {
                hashToIOPair.set(score.hash, score.io);
            }

            const payload = formPayload(ev, scores, prompt, base);

            let response: RecordEvalResponse;
            try {
                const res = await config.rpcClient.recordEval(payload);
                response = res.response;
            } catch (error) {
                console.error('Error recording eval:', error);
                process.exit(1);
            }

            console.log('');

            printScores(scores.map(s => s.score), response.previousEvalScores.map(s => s.score));

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
                    console.log(chalk.green('Eval did not significantly change.'));
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

function formPayload(ev: Eval<any, any>, scores: EvalScores, prompt: Prompt, base?: string): RecordEvalRequest {
    return {
        eval: {
            name: ev.id,
        },
        prompt: {
            name: prompt.name,
            version: prompt.version,
        },
        baseVersion: base,
        evalScores: scores.map(score => {
            return {
                evalHash: score.hash,
                score: score.score
            }
        }),
    };
}

function getPromptClasses(config: Config, promptPath: string) {
    const sourceFile = ts.createSourceFile(
        promptPath,
        fs.readFileSync(promptPath, 'utf-8'),
        ts.ScriptTarget.Latest,
        true
    );

    // Get the prompt name and version from each class with the @HasEval decorator
    const prompts: Prompt[] = [];

    let hasPromptImport = false;
    ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node)) {
            const moduleSpecifier = node.moduleSpecifier as ts.StringLiteral;
            if (moduleSpecifier.text === '@polay-ai/ts-sdk/dist/prompt') {
                const namedImports = node.importClause?.namedBindings as ts.NamedImports;
                if (namedImports.elements.some(importSpecifier => {


                    // Check if the import is named 'Prompt' or aliased to 'Prompt'
                    hasPromptImport ||= importSpecifier.name.text === 'Prompt' || importSpecifier.propertyName?.text === 'Prompt';
                })) {
                    return;
                }
            }
        }
    });

    if (!hasPromptImport) {
        return [];
    }

    ts.forEachChild(sourceFile, (node) => {
        if (ts.isClassDeclaration(node)) {
            const decorators = node.modifiers?.filter(mod => ts.isDecorator(mod));
            if (!decorators) {
                return;
            }

            const hasEval = decorators.some(decorator => {
                if (ts.isDecorator(decorator)) {
                    return (decorator.expression as ts.Identifier).text === 'HasEval';
                }
                return false;
            });

            if (hasEval) {
                let name: string | undefined = undefined;
                let version: string | undefined = undefined;

                ts.forEachChild(node, (child) => {
                    if (ts.isPropertyDeclaration(child)) {
                        if (child.name.getText() === 'id') {
                            const initializer = child.initializer as ts.StringLiteral;
                            name = initializer.text;
                        } else if (child.name.getText() === 'version') {
                            const initializer = child.initializer as ts.StringLiteral;
                            version = initializer.text;
                        }
                    }
                });

                if (name && version) {
                    prompts.push({ name, version, class: node });
                }
            }
        }
    });

    return prompts;
}

function getEvalFilesToRun(config: Config, prompts: Prompt[]) {
    const evalFiles = getAllFilesMatchingPattern(config.getPath("evals"), /\.eval.ts$/);

    // Get the list of eval files that use the classes with the @HasEval decorator
    const evalFilesToRun = evalFiles.map(evalFile => {
        const evalSourceFile = ts.createSourceFile(
            path.resolve(config.getPath("evals"), evalFile),
            fs.readFileSync(path.resolve(config.getPath("evals"), evalFile), 'utf-8'),
            ts.ScriptTarget.Latest,
            true
        );

        let shouldRun: ReturnType<typeof getPromptClasses>[number] | undefined = undefined;
        let evalExport: string | undefined = undefined;
        let importEvalName: string | undefined = undefined;

        ts.forEachChild(evalSourceFile, (node) => {
            if (ts.isImportDeclaration(node)) {
                const moduleSpecifier = node.moduleSpecifier as ts.StringLiteral;
                if (moduleSpecifier.text === '@polay-ai/ts-sdk/dist/eval') {
                    const namedImports = node.importClause?.namedBindings as ts.NamedImports;
                    if (namedImports.elements.some(importSpecifier => {
                        // Check if the import is named 'Eval' or aliased to 'Eval'
                        return importSpecifier.name.text === 'Eval' || importSpecifier.propertyName?.text === 'Eval';
                    })) {
                        importEvalName = namedImports.elements.find(importSpecifier => {
                            return importSpecifier.name.text === 'Eval' || importSpecifier.propertyName?.text === 'Eval';
                        })?.name.text;
                    }
                }
            }
        });

        if (!importEvalName) {
            return;
        }

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
                if (name !== importEvalName) {
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

                // Check if the prompt is a target Prompt class
                if (prompt && ts.isIdentifier((prompt as ts.PropertyAssignment).initializer)) {
                    const identifier = (prompt as ts.PropertyAssignment).initializer as ts.Identifier;
                    shouldRun = prompts.find(clazz => clazz.name === identifier.text);
                    evalExport = (declaration.name as ts.Identifier).text;
                }
            } else if (ts.isExportAssignment(node)) {
                // Check if the export is an initializer of Eval class
                const expression = node.expression as ts.CallExpression;
                const name = (expression.expression as ts.Identifier).text;
                if (name === 'Eval') {
                    const promptProperty = expression.arguments[0] as ts.ObjectLiteralExpression;
                    const prompt = promptProperty.properties.find(prop => {
                        if (ts.isPropertyAssignment(prop)) {
                            return prop.name.getText() === 'prompt';
                        }
                        return false;
                    });

                    if (prompt && ts.isIdentifier((prompt as ts.PropertyAssignment).initializer)) {
                        const identifier = (prompt as ts.PropertyAssignment).initializer as ts.Identifier;
                        shouldRun = prompts.find(clazz => clazz.name === identifier.text);
                        evalExport = 'default';
                    }
                }
            }
        });

        return shouldRun ? { file: evalFile, exportName: evalExport!, prompt: shouldRun } : undefined;
    }).filter(Boolean) as { file: string, exportName: string, prompt: ReturnType<typeof getPromptClasses>[number] }[];

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

function printScores(currentScores: number[], previousScores: number[]) {
    function format(label: string, scores: number[]) {
        const scoresString = '[' + scores.join(', ') + ']';
        return `${label.padEnd(18)}${scoresString}`;
    }

    const currentScoresFormatted = format('Scores:', currentScores);
    const previousScoresFormatted = format('Previous scores:', previousScores);

    console.log(currentScoresFormatted);
    console.log(previousScoresFormatted);
}