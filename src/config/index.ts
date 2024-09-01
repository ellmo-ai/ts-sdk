import path from "path";
import fs from 'fs';
import { Trie } from "./trie";

export interface OllyLLMConfig {
    /** Base URL for the API */
    apiBaseUrl: string;
    tests: {
        /** Path to the tests directory */
        testsPath: string;
        /** Path to the package.json file */
        packageJsonPath: string,
        /** Allowlist of dependencies to include in the bundle */
        includeDependencies: string[];
    },
}

/** 
 * Finds the nearest ollyllm.config.json file starting from the given directory 
 * 
 * @param startDir The starting directory for the search
 * @returns The config file path, if it is found
*/
export function findConfigFile(startDir: string): string {
    let currentDir = startDir;
    while (currentDir !== path.parse(currentDir).root) {
        const configPath = path.join(currentDir, 'ollyllm.config.json');
        if (fs.existsSync(configPath)) {
            return configPath;
        }
        currentDir = path.dirname(currentDir);
    }

    throw new Error('ollyllm.config.json not found in the current directory or any parent directory.');
}

/** 
 * Reads and parses the OllyLLM config file
 * 
 * @param configPath The path of the config
 * @returns The parsed config object
 */
export function readConfig(configPath: string): OllyLLMConfig {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent) as OllyLLMConfig;
}

export class Config {
    public opts: OllyLLMConfig;
    private allowedDeps: Trie;

    constructor() {
        const currentDir = process.cwd();
        const configPath = findConfigFile(currentDir);

        if (!configPath) {
            throw new Error('ollyllm.config.json not found in the current directory or any parent directory.');
        }

        this.opts = readConfig(configPath);
        this.opts.tests.testsPath = path.resolve(path.dirname(configPath), this.opts.tests.testsPath);
        this.opts.tests.packageJsonPath = path.resolve(path.dirname(configPath), this.opts.tests.packageJsonPath);
        this.opts.tests.includeDependencies.push(...['@ollyllm/*']);

        if (!fs.existsSync(this.opts.tests.testsPath)) {
            throw new Error(`Tests directory ${this.opts.tests.testsPath} does not exist.`);
        }

        if (!this.opts.apiBaseUrl) {
            throw new Error('apiBaseUrl is not defined in the config file.');
        }

        this.allowedDeps = Trie.buildTrie(this.opts.tests.includeDependencies);
        console.log(this.allowedDeps.search('@ollyllm/test'));
    }

    public isDependencyAllowed(dependency: string): boolean {
        return this.allowedDeps.search(dependency);
    }
}

