import path from "path";
import fs from 'fs';

export interface OllyLLMConfig {
    /** Base URL for the API */
    apiBaseUrl: string;
    tests: {
        /** Path to the tests directory */
        testsPath: string;
        /** Path to the package.json file */
        packageJsonPath: string[],
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
