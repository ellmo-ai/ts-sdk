#!/usr/bin/env ts-node

import * as ts from 'typescript';
import * as fs from 'fs';
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
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        if (endpoint) {
            const response = await axios.post(endpoint, { content: fileContent });
            console.log('Response:', response.data);
        }
        // console.log('File content:', fileContent);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Helper function to handle circular references in AST
function getCircularReplacer() {
    const seen = new WeakSet();
    return (key: any, value: any) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return;
            }
            seen.add(value);
        }
        return value;
    };
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
