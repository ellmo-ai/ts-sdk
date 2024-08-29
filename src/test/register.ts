#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { program } from 'commander';

import { findConfigFile, readConfig } from './config';
import { TestManager } from './process';
import chalk from 'chalk';

program
    .name('ollyllm-cli')
    .description('CLI to validate OllyLLM test files')
    .action(async () => {
        const currentDir = process.cwd();
        const configPath = findConfigFile(currentDir);

        if (!configPath) {
            console.error('Error: ollyllm.config.json not found in the current directory or any parent directory.');
            process.exit(1);
        }

        const config = readConfig(configPath);
        config.tests.testsPath = path.resolve(path.dirname(configPath), config.tests.testsPath);
        config.tests.packageJsonPath = config.tests.packageJsonPath.map(p => path.resolve(path.dirname(configPath), p));
        config.tests.includeDependencies.push(...['@ollyllm/test']);

        if (!fs.existsSync(config.tests.testsPath)) {
            console.error(`Error: Tests directory ${config.tests.testsPath} does not exist.`);
            process.exit(1);
        }

        if (!config.apiBaseUrl) {
            console.error('Error: apiBaseUrl is not defined in the config file.');
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

        console.log('\nAll test files validated successfully. Registering tests...');

        const result = await fetch(`${config.apiBaseUrl}/api/v1/test/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tests: Object.fromEntries(tests),
            })
        });

        const { message, error } = await result.json();

        if (error) {
            console.error(chalk.red('Error:'), message);
            process.exit(1);
        }

        console.log(chalk.green('Success:'), message);

    });

program.parse(process.argv);

