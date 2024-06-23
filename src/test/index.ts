#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import * as ts from 'typescript';

export { Test } from './test';

interface OllyLLMConfig {
    testsPath: string;
}

function findConfigFile(startDir: string): string | null {
    let currentDir = startDir;
    while (currentDir !== path.parse(currentDir).root) {
        const configPath = path.join(currentDir, 'ollyllm.config.json');
        if (fs.existsSync(configPath)) {
            return configPath;
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}

function readConfig(configPath: string): OllyLLMConfig {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent) as OllyLLMConfig;
}

function validateTestFile(filePath: string, testsDir: string): void {
    const sourceFile = ts.createSourceFile(
        filePath,
        fs.readFileSync(filePath, 'utf-8'),
        ts.ScriptTarget.Latest,
        true
    );

    let hasInvalidImport = false;

    ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node)) {
            const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
            const resolvedPath = path.resolve(path.dirname(filePath), importPath);
            if (!resolvedPath.startsWith(testsDir)) {
                hasInvalidImport = true;
            }
        }
    });

    if (hasInvalidImport) {
        console.error(`Error: ${filePath} has imports outside of the tests directory.`);
        process.exit(1);
    }
}

function processTestFiles(testsDir: string): void {
    const files = fs.readdirSync(testsDir);
    for (const file of files) {
        if (path.extname(file) === '.ts') {
            const filePath = path.join(testsDir, file);
            validateTestFile(filePath, testsDir);
            console.log(`Validated: ${filePath}`);
        }
    }
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

        processTestFiles(testsDir);
        console.log('All test files validated successfully.');
    });

program.parse(process.argv);

