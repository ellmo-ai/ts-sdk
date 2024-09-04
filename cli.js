#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const command = process.argv[2];

function execute() {
    function parseArgs(args) {
        const options = {};
        let input = undefined;

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--path') {
                options.path = args[++i];
            } else if (args[i] === '--test') {
                options.test = args[++i];
            } else {
                input = JSON.stringify(args[i]);
            }
        }

        return { command, options, input };
    }

    const { options, input } = parseArgs(process.argv.slice(3));

    if (!options.path || !options.test || !input) {
        console.error('Usage: execute --path <path> --test <test> <input>');
        process.exit(1);
    }

    execSync(`ts-node ${path.join(__dirname, 'dist/test/execute.js')} --path ${options.path} --test ${options.test} ${input}`, { stdio: 'inherit' });
}

const commandMap = {
    register: () => execSync(`ts-node ${path.join(__dirname, 'dist/test/register/index.js')}`, { stdio: 'inherit' }),
    execute: execute
};

if (commandMap[command]) {
    commandMap[command]();
} else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
