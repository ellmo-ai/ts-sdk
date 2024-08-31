#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import chalk from 'chalk';
import { create } from 'tar'
import axios from 'axios';

import { findConfigFile, readConfig } from './config';
import { TestManager } from './process';

async function createTarball(testsPath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const tarStream = create({ gzip: true, cwd: testsPath }, ['.']);

        tarStream.on('data', chunk => chunks.push(Buffer.from(chunk)));
        tarStream.on('end', () => resolve(Buffer.concat(chunks)));
        tarStream.on('error', reject);
    });
}

async function uploadToS3(url: string, buffer: Buffer): Promise<void> {
    try {
        const response = await axios.put(url, buffer, {
            headers: { 'Content-Type': 'application/gzip' },
        });
        console.log('File uploaded successfully:', response.status);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Failed to upload to S3:', error.response?.statusText);
        } else {
            console.error('An unexpected error occurred:', error);
        }
    }
}

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

        const result: Response = await fetch(`${config.apiBaseUrl}/api/v1/test/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tests: Object.fromEntries(tests),
            })
        });

        const body = await result.json();
        const { error, message, uploadUrl } = body;

        if (error || !uploadUrl || result.status !== 200) {
            console.error(chalk.red('\nError:'), error ?? message ?? 'An unexpected error occurred.');
            process.exit(1);
        }

        try {
            const buffer = await createTarball(config.tests.testsPath);
            await uploadToS3(uploadUrl, buffer);
        } catch (error) {
            console.error('Error:', error);
        }
    });

program.parse(process.argv);

