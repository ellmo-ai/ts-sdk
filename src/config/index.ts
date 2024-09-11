import path from "path";
import fs from 'fs';
import { Trie } from "./trie";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import { ChannelCredentials } from "@grpc/grpc-js";
import { PolayServiceClient } from "../gen/polay/v1/polay.client";

export interface EllmoConfig {
    /** Base URL for the API */
    apiBaseUrl: string;
    /** Base URL for the gRPC API */
    rpcBaseUrl: string;
    tests: {
        /** Path to the tests directory */
        testsPath: string;
        /** Path to the package.json file */
        packageJsonPath: string,
        /** Allowlist of dependencies to include in the bundle */
        includeDependencies: string[];
    },
    prompts: {
        /** Path to the prompts directory */
        promptsPath: string;
        /** Path to the evals directory, if not provided, evals will be retrieved from the prompts directory */
        evalsPath?: string;
    }
}

/** 
 * Finds the nearest ellmo.config.json file starting from the given directory 
 * 
 * @param startDir The starting directory for the search
 * @returns The config file path, if it is found
*/
export function findConfigFile(startDir: string): string {
    let currentDir = startDir;
    while (currentDir !== path.parse(currentDir).root) {
        const configPath = path.join(currentDir, 'ellmo.config.json');
        if (fs.existsSync(configPath)) {
            return configPath;
        }
        currentDir = path.dirname(currentDir);
    }

    throw new Error('ellmo.config.json not found in the current directory or any parent directory.');
}

/** 
 * Reads and parses the Ellmo config file
 * 
 * @param configPath The path of the config
 * @returns The parsed config object
 */
export function readConfig(configPath: string): EllmoConfig {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent) as EllmoConfig;
}

export class Config {
    private configPath: string;

    public opts: EllmoConfig;
    private allowedDeps: Trie;
    public rpcClient: PolayServiceClient;

    constructor() {
        const currentDir = process.cwd();
        this.configPath = findConfigFile(currentDir);

        if (!this.configPath) {
            throw new Error('ellmo.config.json not found in the current directory or any parent directory.');
        }

        this.opts = readConfig(this.configPath);
        this.opts = {
            ...this.opts,
            tests: {
                ...this.opts.tests,
                testsPath: this.resolveRelativePath(this.opts.tests.testsPath),
                packageJsonPath: this.resolveRelativePath(this.opts.tests.packageJsonPath),
                includeDependencies: [...this.opts.tests.includeDependencies, '@ellmo-ai/*'],
            },
            prompts: {
                ...this.opts.prompts,
                promptsPath: this.resolveRelativePath(this.opts.prompts.promptsPath),
                evalsPath: this.opts.prompts.evalsPath ? this.resolveRelativePath(this.opts.prompts.evalsPath) : undefined,
            }
        }

        if (!fs.existsSync(this.opts.tests.testsPath)) {
            throw new Error(`Tests directory ${this.opts.tests.testsPath} does not exist.`);
        }

        if (!this.opts.apiBaseUrl) {
            throw new Error('apiBaseUrl is not defined in the config file.');
        }

        this.allowedDeps = Trie.buildTrie(this.opts.tests.includeDependencies);
        const transport = new GrpcTransport({
            host: this.opts.rpcBaseUrl,
            channelCredentials: ChannelCredentials.createInsecure(),
        });
        this.rpcClient = new PolayServiceClient(transport);
    }

    public isDependencyAllowed(dependency: string): boolean {
        return this.allowedDeps.search(dependency);
    }

    public getPath(name: "tests" | "prompts" | "evals"): string {
        switch (name) {
            case "tests":
                return this.opts.tests.testsPath;
            case "prompts":
                return this.opts.prompts.promptsPath;
            case "evals":
                return this.opts.prompts.evalsPath ?? this.opts.prompts.promptsPath;
        }
    }

    public resolveRelativePath(relativePath: string): string {
        return path.resolve(path.dirname(this.configPath), relativePath);
    }
}

