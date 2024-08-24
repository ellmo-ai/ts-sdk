#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { program } from 'commander';

import { findConfigFile, readConfig } from './config';
import { TestManager } from './process';
import chalk from 'chalk';

// The test definition class
export { Test } from './test';

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
        config.testsPath = path.resolve(path.dirname(configPath), config.testsPath);

        if (!fs.existsSync(config.testsPath)) {
            console.error(`Error: Tests directory ${config.testsPath} does not exist.`);
            process.exit(1);
        }

        const testManager = new TestManager(config);
        const tests = testManager.processTests();

        for (const [testId, testFiles] of tests.entries()) {
            console.log(chalk.green.bold(`\n${testId}`));

            for (const test of testFiles) {
                console.log(`  - v${test.version}`, test.filePath);
            }
        }

        console.log(chalk.green('\nAll test files validated successfully.'));
    });

program.parse(process.argv);

