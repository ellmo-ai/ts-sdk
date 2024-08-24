import path from "path";
import fs from "fs";
import ts from "typescript";
import { OllyLLMConfig } from "./config";

type Test = {
    /** The test id */
    id: string;
    /** The named export of the test */
    exportName: string;
    /** The test version */
    version: string;
    /** The path to the test */
    filePath: string;
};

type TestId = string;

export class TestManager {
    private tests: Map<TestId, Test[]> = new Map();

    constructor(
        public config: OllyLLMConfig,
    ) { }

    private addTest(test: Test): void {
        this.tests.set(test.id, [...(this.tests.get(test.id) || []), test]);
    }

    public processTests(): typeof this.tests {
        const processDir = (dirPath: string) => {
            const dirFiles = fs.readdirSync(dirPath);

            for (const file of dirFiles) {
                if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
                    // Recursively process directories
                    processDir(path.join(dirPath, file));
                } else {
                    const filePath = path.join(dirPath, file);

                    validateFile(filePath, this.config);

                    const sourceFile = ts.createSourceFile(
                        filePath,
                        fs.readFileSync(filePath, 'utf-8'),
                        ts.ScriptTarget.Latest,
                        true
                    );

                    const tests = getTestsInFile(sourceFile);
                    tests.forEach(test => {
                        this.addTest({ ...test, filePath });
                    });
                }
            }
        }

        processDir(this.config.testsPath);
        return this.tests;
    }
}

function getTestsInFile(sourceFile: ts.SourceFile) {
    const tests: Omit<Test, 'filePath'>[] = [];

    ts.forEachChild(sourceFile, (node) => {
        if (ts.isVariableStatement(node)) {
            const declarations = node.declarationList.declarations;

            if (declarations.length !== 1) {
                return;
            }
            const [declaration] = declarations;
            const initializer = declaration.initializer as ts.CallExpression | undefined;

            if (!initializer) {
                return;
            }

            const name = initializer.expression.getText();
            if (name !== 'Test') {
                return;
            }

            const isExported = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
            // FIXME: need to account for default exports (separate TS node)
            if (!isExported) {
                return;
            }

            const { id, version } = getIdAndVersion(initializer);
            const exportName = declaration.name.getText();
            tests.push({ id, version, exportName: exportName });
        }
    });

    return tests;
}

/** Get the ID and version from a Test constructor call. */
function getIdAndVersion(initializer: ts.CallExpression): { id: string, version: string } {
    const args = initializer.arguments;
    const options = args[0] as ts.ObjectLiteralExpression;

    const idProp = options.properties.find((prop) => prop.name?.getText() === 'id') as ts.PropertyAssignment;
    const versionProp = options.properties.find((prop) => prop.name?.getText() === 'version') as ts.PropertyAssignment;

    return { id: idProp.initializer.getText(), version: (versionProp.initializer as ts.StringLiteral).text };
}

/** Validate a test file. */
function validateFile(filePath: string, config: OllyLLMConfig) {
    const sourceFile = ts.createSourceFile(
        filePath,
        fs.readFileSync(filePath, 'utf-8'),
        ts.ScriptTarget.Latest,
        true
    );

    const hasInvalidImport = determineInvalidImport(sourceFile, config);
    if (hasInvalidImport) {
        console.error(`Error: Test file ${filePath} imports modules outside of the tests directory.`);
        process.exit(1);
    }
}

/** Determines if a test file has an invalid import */
function determineInvalidImport(sourceFile: ts.SourceFile, config: OllyLLMConfig): boolean {
    let hasInvalidImport = false;
    ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node)) {
            // FIXME: need to account for import path aliasing

            const isLocalImport = (node.moduleSpecifier as ts.StringLiteral).text.startsWith('.');

            // If the import is not local, check if it's in the allowed dependencies
            if (!isLocalImport) {
                hasInvalidImport ||= config.includeDependencies.includes(node.moduleSpecifier.getText());
                return;
            }

            // Check that the import path doesn't leave test directory
            const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
            const resolvedPath = path.resolve(path.dirname(sourceFile.fileName), importPath);
            if (!resolvedPath.startsWith(config.testsPath)) {
                hasInvalidImport = true;
            }
        }
    });

    return hasInvalidImport;
}
