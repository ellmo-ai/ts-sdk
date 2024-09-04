#!/usr/bin/env -S ts-node || node

import { Command } from 'commander';
import { Test } from '.';
import path from 'path';

const program = new Command()
    .version('1.0.0')
    .description('CLI to execute Test functions')
    .requiredOption('-path, --path <path>', 'Path to the test file')
    .requiredOption('-test, --test <import>', 'Import path to the particular test')
    .argument('<input>', 'Input string to be processed')
    .action(async (input: string, { path: testPath, test: testImport }: { path: string, test: string }) => {
        const workingDirectory = process.cwd();
        const absolutePath = path.resolve(workingDirectory, testPath);

        console.log('Executing test:', testImport, 'from', testPath);

        let test: Test<any> | undefined;
        try {
            const testFile = await import(absolutePath);
            test = testFile[testImport];

            if (!test) {
                throw new Error('Test not found in the specified file');
            }
        } catch (error) {
            console.error('Error loading test file:', error);
            process.exit(1);
        }

        let inputToUse: any;
        try {
            if (input.trim().startsWith('{') || input.trim().startsWith('[')) {
                // Handle JSON objects and arrays
                inputToUse = JSON.parse(input);
            } else if (input.trim() === 'null') {
                // Handle null
                inputToUse = null;
            } else if (input.trim() === 'true' || input.trim() === 'false') {
                // Handle boolean
                inputToUse = input.trim() === 'true';
            } else if (!isNaN(Number(input.trim()))) {
                // Handle number
                inputToUse = Number(input.trim());
            } else {
                // Handle string
                inputToUse = input;
            }
        } catch (error) {
            console.error('Error parsing input:', error);
            process.exit(1);
        }

        try {
            const result = test.func(inputToUse);
            // TODO: maybe add an argument to specify output path
            console.log(JSON.stringify({ result }));
        } catch (error) {
            console.error('Error executing function:', error);
            process.exit(1);
        }
    });

// Parse the command-line arguments
program.parse(process.argv);
