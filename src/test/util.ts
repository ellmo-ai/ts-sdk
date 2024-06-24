import path from "path";
import fs from 'fs';
import ts from "typescript";

/** Check index.ts for exported tests */
export function getExportedTests(testsDir: string) {
    const indexFilePath = path.join(testsDir, 'index.ts');
    if (!fs.existsSync(indexFilePath)) {
        console.error(`Error: Tests directory ${testsDir} does not contain an index.ts file.`);
        process.exit(1);
    }

    const sourceFile = ts.createSourceFile(
        indexFilePath,
        fs.readFileSync(indexFilePath, 'utf-8'),
        ts.ScriptTarget.Latest,
        true
    );

    const exportedTestPaths: string[] = [];
    ts.forEachChild(sourceFile, (node) => {
        if (ts.isExportDeclaration(node)) {
            const exportPath = (node.moduleSpecifier as ts.StringLiteral).text;
            exportedTestPaths.push(exportPath);
        }
    });

    return exportedTestPaths;
}
