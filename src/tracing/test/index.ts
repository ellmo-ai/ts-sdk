#!/usr/bin/env ts-node

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import yargs from "yargs";
import { hideBin } from 'yargs/helpers';

export type Test<T> = {
    id: string;
    version: string;
    func: (input: T) => unknown;
};

async function readAndSendFile(filePath: string, endpoint?: string) {
    try {
        // Read the file content
        let fileContent = fs.readFileSync(filePath, 'utf-8');

        // Check if the file is a TypeScript file
        if (path.extname(filePath) === '.ts') {
            // Transpile the TypeScript code to JavaScript
            const result = ts.transpileModule(fileContent, {
                compilerOptions: { module: ts.ModuleKind.CommonJS }
            });

            fileContent = result.outputText;
        }

        if (endpoint) {
            const response = await axios.post(endpoint, { content: fileContent });
            console.log('Response:', response.data);
        }
        // console.log('File content:', fileContent);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

(async () => {
    const argv = await yargs(hideBin(process.argv))
        .option('filePath', {
            alias: 'f',
            type: 'string',
            description: 'Path to the TypeScript file',
            demandOption: true,
        })
        .option('endpoint', {
            alias: 'e',
            type: 'string',
            description: 'Endpoint URL to send the file content to',
            demandOption: true,
        })
        .help()
        .alias('help', 'h')
        .argv;

    // Run the function with the provided arguments
    readAndSendFile(argv.filePath, argv.endpoint);
})();
