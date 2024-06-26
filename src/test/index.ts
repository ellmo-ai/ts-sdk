#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import * as ts from 'typescript';
import { determineInvalidImport } from './validate';
import { findConfigFile, readConfig } from './config';
import { getExportedTests } from './util';

export { Test } from './test';

/** Validates a file */
function processFile(filePath: string, testsDir: string): { id: string, version: string }[] {
    const sourceFile = ts.createSourceFile(
        filePath,
        fs.readFileSync(filePath, 'utf-8'),
        ts.ScriptTarget.Latest,
        true
    );

    const hasInvalidImport = determineInvalidImport(sourceFile, testsDir);
    if (hasInvalidImport) {
        console.error(`Error: Test file ${filePath} imports modules outside of the tests directory.`);
        process.exit(1);
    }

    const tests: { id: string, version: string }[] = [];

    ts.forEachChild(sourceFile, (node) => {
        if (ts.isVariableStatement(node)) {
            const isExported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
            const declarations = node.declarationList.declarations;

            if (declarations.length !== 1) {
                return;
            }
            const [declaration] = declarations;
            const initializer = declaration.initializer as ts.CallExpression | undefined;

            if (!initializer) {
                return;
            }

            const name = initializer.expression.getText();
            if (name !== 'Test') {
                return;
            }

            const { id, version } = getIdAndVersion(initializer);
            tests.push({ id, version });
        }
    });

    return tests;
}

function getIdAndVersion(initializer: ts.CallExpression): { id: string, version: string } {
    const args = initializer.arguments;
    const options = args[0] as ts.ObjectLiteralExpression;

    const idProp = options.properties.find((prop) => prop.name?.getText() === 'id') as ts.PropertyAssignment;
    const versionProp = options.properties.find((prop) => prop.name?.getText() === 'version') as ts.PropertyAssignment;
    return { id: idProp.initializer.getText(), version: versionProp.initializer.getText() };
}

function getTestsInFile(sourceFile: ts.SourceFile): { id: string, version: string }[] {
    const tests: { id: string, version: string }[] = [];

    ts.forEachChild(sourceFile, (node) => {
        if (ts.isVariableStatement(node)) {
            const isExported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

            const declarations = node.declarationList.declarations;

            if (declarations.length !== 1) {
                return;
            }
            const [declaration] = declarations;
            const initializer = declaration.initializer as ts.CallExpression | undefined;

            if (!initializer) {
                return;
            }

            const name = initializer.expression.getText();
            if (name !== 'Test') {
                return;
            }

            const { id, version } = getIdAndVersion(initializer);
            tests.push({ id, version });
        }
    });

    return tests;
}


function processTestDir(testsDir: string): void {
    const exportedTestPaths = getExportedTests(testsDir).map((test) => path.join(testsDir, test));

    const shouldProcessFile = (file: string) => {
        // Ignore non-ts files and the index.ts file
        return file !== 'index.ts' && file.endsWith('.ts') && !file.endsWith('d.ts')
    }

    const testsToUpdate: Map<String, { id: string, version: string }> = new Map();
    const testIds: Set<String> = new Set();

    function processDir(dir: string, isDir: boolean = false) {
        const dirFiles = fs.readdirSync(dir);
        for (const file of dirFiles) {
            if (fs.statSync(path.join(dir, file)).isDirectory()) {
                // Recursively process directories
                processDir(path.join(dir, file), true /* isDir */);
            } else if (shouldProcessFile(file)) {
                console.log(`Processing file: ${file}`);
                const filePath = path.join(dir, file);

                const sourceFile = ts.createSourceFile(
                    filePath,
                    fs.readFileSync(filePath, 'utf-8'),
                    ts.ScriptTarget.Latest,
                    true
                );

                const tests = getTestsInFile(sourceFile);
                tests.forEach(test => {
                    if (testIds.has(test.id)) {
                        console.error(`Error: Test ID ${test.id} is duplicated in ${filePath}`);
                        process.exit(1);
                    }

                    testIds.add(test.id);

                    // Assuming test.id is unique and can be used as a key
                    if (testsToUpdate.has(filePath)) {
                        // Update logic here, if needed
                        // For example, to update the version if the new one is higher
                        const existingTest = testsToUpdate.get(test.id);
                        if (existingTest && existingTest.version < test.version) {
                            testsToUpdate.set(filePath, test);
                        }
                    } else {
                        testsToUpdate.set(filePath, test);
                    }
                });
            }
        }
    }

    processDir(testsDir); // Start processing from the root tests directory

    console.log('Tests to update:', testsToUpdate);
}

program
    .name('ollyllm-cli')
    .description('CLI to validate OllyLLM test files')
    .action(() => {
        const currentDir = process.cwd();
        const configPath = findConfigFile(currentDir);

        if (!configPath) {
            console.error('Error: ollyllm.config.json not found in the current directory or any parent directory.');
            process.exit(1);
        }

        const config = readConfig(configPath);
        const testsDir = path.resolve(path.dirname(configPath), config.testsPath);

        if (!fs.existsSync(testsDir)) {
            console.error(`Error: Tests directory ${testsDir} does not exist.`);
            process.exit(1);
        }

        processTestDir(testsDir);
        console.log('All test files validated successfully.');
    });

program.parse(process.argv);

