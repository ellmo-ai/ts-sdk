import path from "path";
import fs from 'fs';

export interface OllyLLMConfig {
    testsPath: string;
}

/** Finds the nearest ollyllm.config.json file starting from the given directory */
export function findConfigFile(startDir: string): string | null {
    let currentDir = startDir;
    while (currentDir !== path.parse(currentDir).root) {
        const configPath = path.join(currentDir, 'ollyllm.config.json');
        if (fs.existsSync(configPath)) {
            return configPath;
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}

/** Reads and parses the OllyLLM config file */
export function readConfig(configPath: string): OllyLLMConfig {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent) as OllyLLMConfig;
}