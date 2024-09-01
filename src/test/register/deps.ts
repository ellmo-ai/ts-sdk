import { createHash } from "crypto";
import fs from "fs";
import { Trie } from "../../config/trie";

interface PackageJson {
    dependencies: Record<string, string>;
    [key: string]: any;
}

/** 
 * Processes the package.json file to remove dependencies that are not in the allowlist
 */
export function processPackageJson(packageJsonPath: string, keepDependencies: string[]) {
    const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Use a Trie to handle wildcard dependencies
    const dependenciesTrie = Trie.buildTrie(keepDependencies);

    for (const dependency of Object.keys(packageJson.dependencies)) {
        if (!dependenciesTrie.search(dependency)) {
            delete packageJson.dependencies[dependency];
        }
    }

    const modifiedPackageJsonContent = JSON.stringify(packageJson, null, 2);
    const hash = createHash('sha256').update(modifiedPackageJsonContent).digest('hex');

    return {
        hash,
        content: modifiedPackageJsonContent,
    };
}