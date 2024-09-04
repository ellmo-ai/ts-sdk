import path from "path";
import fs from "fs";
import ts from "typescript";
import { omit } from "../../util/omit";
import { Config } from "src/config";

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
    private tests: Map<TestId, Omit<Test, 'id'>[]> = new Map();

    constructor(
        public config: Config,
    ) { }

    private addTest(test: Test): void {
        const testToRegister = omit(test, ['id']);

        if (this.tests.has(test.id)) {
            this.tests.get(test.id)?.push(testToRegister);
        } else {
            this.tests.set(test.id, [testToRegister]);
        }
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
                    const relativePath = path.relative(this.config.opts.tests.testsPath, filePath);

                    validateFile(filePath, this.config);

                    const sourceFile = ts.createSourceFile(
                        filePath,
                        fs.readFileSync(filePath, 'utf-8'),
                        ts.ScriptTarget.Latest,
                        true
                    );

                    const tests = getTestsInFile(sourceFile);
                    tests.forEach(test => {
                        this.addTest({ ...test, filePath: relativePath });
                    });
                }
            }
        }

        processDir(this.config.opts.tests.testsPath);
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

            const name = (initializer.expression as ts.Identifier).text;
            if (name !== 'Test') {
                return;
            }

            const isExported = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
            // FIXME: need to account for default exports (separate TS node)
            if (!isExported) {
                return;
            }

            const { id, version } = getIdAndVersion(initializer);
            const exportName = (declaration.name as ts.Identifier).text;
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

    const id = (idProp.initializer as ts.StringLiteral).text;
    const version = (versionProp.initializer as ts.StringLiteral).text;

    return { id, version };
}

/** Validate a test file. */
function validateFile(filePath: string, config: Config) {
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
function determineInvalidImport(sourceFile: ts.SourceFile, config: Config): boolean {
    let hasInvalidImport = false;
    ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node)) {
            // FIXME: need to account for import path aliasing

            const importName = (node.moduleSpecifier as ts.StringLiteral).text;

            const isLocalImport = importName.startsWith('.');

            // If the import is not local, check if it's in the allowed dependencies
            if (!isLocalImport) {
                hasInvalidImport ||= !config.isDependencyAllowed(importName);
                return;
            }

            // Check that the import path doesn't leave test directory
            const importPath = importName;
            const resolvedPath = path.resolve(path.dirname(sourceFile.fileName), importPath);
            if (!resolvedPath.startsWith(config.opts.tests.testsPath)) {
                hasInvalidImport = true;
            }
        }
    });

    return hasInvalidImport;
}
