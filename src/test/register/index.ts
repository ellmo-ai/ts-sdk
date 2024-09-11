#!/usr/bin/env -S ts-node || node

import { program } from 'commander';
import chalk from 'chalk';
import axios from 'axios';
import archiver from 'archiver';
import { TestManager } from './process';
import { processPackageJson } from './deps';
import { Config } from '../../config';

async function createTarball(testsPath: string, modifiedPackageJson: { hash: string; content: string }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const archive = archiver('tar', { gzip: true });

        archive.on('data', chunk => chunks.push(Buffer.from(chunk)));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', reject);

        // Add the entire testsPath directory
        archive.directory(testsPath, false);

        // Add modified package.json to the tarball
        archive.append(modifiedPackageJson.content, { name: 'package.json' });

        archive.finalize();
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
    .name('ellmo-cli')
    .description('CLI to validate Ellmo test files')
    .action(async () => {
        let config: Config;
        try {
            config = new Config();
        } catch (error) {
            console.error('Error:', error);
            process.exit(1);
        }

        const packageJson = processPackageJson(config.opts.tests.packageJsonPath, config.opts.tests.includeDependencies);

        const testManager = new TestManager(config);
        const tests = testManager.processTests();

        for (const [testId, testFiles] of tests.entries()) {
            console.log(chalk.green.bold(`\n${testId}`));

            for (const test of testFiles) {
                console.log(`  - v${test.version}`, test.filePath);
            }
        }

        console.log('\nAll test files validated successfully. Registering tests...');

        const result = await fetch(`${config.opts.apiBaseUrl}/api/v1/test/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tests: Object.fromEntries(tests),
                hash: packageJson.hash,
            })
        });

        const body = await result.json();
        const { error, message, uploadUrl } = body;

        if (error || !uploadUrl || result.status !== 200) {
            console.error(chalk.red('\nError:'), error ?? message ?? 'An unexpected error occurred.');
            process.exit(1);
        }

        try {
            const buffer = await createTarball(config.opts.tests.testsPath, packageJson);
            await uploadToS3(uploadUrl, buffer);
        } catch (error) {
            console.error('Error:', error);
        }
    });

program.parse(process.argv);

