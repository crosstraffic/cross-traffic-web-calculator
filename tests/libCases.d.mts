// Declarations for libCases.mjs, which is plain ESM because the node suites in
// tests/boundary and tests/builder run it without a TypeScript step, while
// app.spec.ts is type-checked and imports the same module.
export declare const LIB_CASES: string;
export declare function libCase(chapterDir: string, name: string): string;
export declare function readCase(chapterDir: string, name: string): any;
