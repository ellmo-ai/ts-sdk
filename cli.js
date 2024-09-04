#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const command = process.argv[2];
const args = process.argv.slice(3).join(' ');

if (command === 'register') {
    execSync(`ts-node ${path.join(__dirname, 'dist/src/test/register/index.js')} ${args}`, { stdio: 'inherit' });
} else if (command === 'execute') {
    execSync(`ts-node ${path.join(__dirname, 'dist/src/test/execute.js')} ${args}`, { stdio: 'inherit' });
} else {
    console.log('Unknown command. Available commands: register, execute');
}
