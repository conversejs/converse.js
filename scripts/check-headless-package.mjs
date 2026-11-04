#!/usr/bin/env node
// Packs @converse/headless, installs the tarball into an empty directory and
// imports it from there. Inside the monorepo, workspace hoisting lets headless
// use packages it never declares, so this standalone install is the only place
// an undeclared dependency shows up. Fails when the runtime import throws, or
// when type checking the install reports an error in the shipped .d.ts files.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

const HEADLESS = 'src/headless';
const MINUTE = 60_000;
// "Cannot find module" and "Could not find a declaration file for module"
const UNRESOLVED = /error TS(2307|7016):/;
// An error line, located or not. Continuation lines of multi-line messages
// start with whitespace, so they don't match.
const ERROR = /^(\S.*: )?error TS\d+:/;
// tsc's non-pretty format: path(line,col): error TSxxxx: message
const LOCATED = /^(.+?)\(\d+,\d+\): error TS\d+:/;
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', timeout: 5 * MINUTE, ...opts });

const { dependencies } = read(`${HEADLESS}/package.json`);
// Workspaces that headless depends on are packed too, so the install uses the
// local versions rather than whatever is (or isn't yet) on the registry.
const packages = read('package.json').workspaces.filter(
    (dir) => dir === HEADLESS || read(`${dir}/package.json`).name in dependencies,
);
const names = packages.map((dir) => read(`${dir}/package.json`).name);

// Packages we maintain outside this repo, whose types reach every consumer of
// headless. Errors in them are ours to fix upstream.
const MAINTAINED = /^node_modules\/(@converse\/[^/]+|strophe\.js)\//;

/**
 * Errors count when they are in a package we ship or maintain, outside
 * node_modules (the entry file or tsconfig.json) or not tied to a file at all,
 * or when any .d.ts imports a module the install lacks. Type errors inside
 * other third-party packages are not ours to fix.
 * @param {string} line
 */
function isOurs(line) {
    const file = line.match(LOCATED)?.[1].replaceAll('\\', '/');
    if (!file || !file.startsWith('node_modules/') || UNRESOLVED.test(line)) return true;
    return MAINTAINED.test(file) || names.some((name) => file.startsWith(`node_modules/${name}/`));
}

/**
 * Type checks the install and returns the errors that count, or throws when
 * tsc could not check anything at all.
 * @param {string} cwd
 */
function typeCheck(cwd) {
    const tsc = spawnSync(
        process.execPath,
        [resolve('node_modules/typescript/bin/tsc'), '-p', '.', '--pretty', 'false'],
        {
            cwd,
            encoding: 'utf8',
            timeout: 5 * MINUTE,
        },
    );
    if (tsc.error) throw tsc.error;
    if (tsc.signal) throw new Error(`tsc was killed by ${tsc.signal}`);
    if (tsc.status === 0) return [];

    const errors = tsc.stdout.split('\n').filter((line) => ERROR.test(line));
    if (!errors.length) {
        throw new Error(`tsc exited with status ${tsc.status} without reporting errors:\n${tsc.stdout}${tsc.stderr}`);
    }
    return errors.filter(isOurs);
}

const dir = mkdtempSync(join(tmpdir(), 'converse-headless-'));
let failed = false;
try {
    const tarballs = packages.map((ws) => {
        const [{ filename }] = JSON.parse(
            run('npm', ['pack', `./${ws}`, '--json', '--ignore-scripts', '--pack-destination', dir]),
        );
        return join(dir, filename);
    });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'headless-smoke', private: true, type: 'module' }));
    run('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts', ...tarballs], {
        cwd: dir,
        stdio: 'inherit',
        timeout: 10 * MINUTE,
    });

    try {
        run(
            process.execPath,
            ['--input-type=module', '-e', "await import('@converse/headless/node'); process.exit(0);"],
            {
                cwd: dir,
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: MINUTE,
            },
        );
    } catch (e) {
        const reason = e.signal ? `timed out (killed by ${e.signal})` : 'failed';
        console.error(
            `Importing @converse/headless/node from a standalone install ${reason}:\n${e.stderr ?? e.message}`,
        );
        failed = true;
    }

    writeFileSync(join(dir, 'index.ts'), "import '@converse/headless';\nimport '@converse/headless/node';\n");
    // Bundlers and Node resolve the package's exports differently, so check both.
    for (const [module, moduleResolution] of [
        ['preserve', 'bundler'],
        ['nodenext', 'nodenext'],
    ]) {
        writeFileSync(
            join(dir, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: { module, moduleResolution, strict: true, skipLibCheck: false, noEmit: true },
                files: ['index.ts'],
            }),
        );
        const errors = typeCheck(dir);
        if (errors.length) {
            console.error(
                `Type checking a standalone install of @converse/headless under ${moduleResolution} failed:\n` +
                    errors.join('\n'),
            );
            failed = true;
        }
    }
} finally {
    rmSync(dir, { recursive: true, force: true });
}
if (failed) process.exitCode = 1;
else console.log('@converse/headless installs and imports standalone.');
