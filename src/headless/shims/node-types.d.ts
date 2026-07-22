/**
 * The sliver of Node's standard library the shims use.
 *
 * Adding `@types/node` to this package's `types` instead would be the obvious
 * move, but it also redefines `setTimeout`, so the published declarations start
 * saying `NodeJS.Timeout` where a browser returns `number`. That leaks a Node
 * type into a package most consumers use in a browser, and breaks anyone
 * type-checking without `@types/node` installed. Declaring just the few the
 * shims touch keeps the browser-facing declarations byte-for-byte unchanged.
 */
declare module 'node:os' {
    export function homedir(): string;
}

declare module 'node:path' {
    export function join(...paths: string[]): string;
}

declare module 'node:fs' {
    export function readFileSync(path: string | URL): { toString(encoding: string): string };
    const fs: { readFileSync: typeof readFileSync };
    export default fs;
}

declare const process: {
    env: Record<string, string | undefined>;
};
