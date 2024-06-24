import path from "path";
import ts from "typescript";

/** Determines if a test file imports modules outside of the tests directory */
export function determineInvalidImport(sourceFile: ts.SourceFile, testsDir: string): boolean {
    let hasInvalidImport = false;
    ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node)) {
            const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
            const resolvedPath = path.resolve(path.dirname(sourceFile.fileName), importPath);
            if (!resolvedPath.startsWith(testsDir)) {
                hasInvalidImport = true;
            }
        }
    });

    return hasInvalidImport;
}
