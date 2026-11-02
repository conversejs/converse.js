#!/usr/bin/env node
// Fails when a manifest declares a semver range for a workspace package that
// the workspace's own version doesn't satisfy. npm would then silently install
// the published copy instead of linking the local workspace.
import { readFileSync } from 'node:fs';
import process from 'node:process';
import semver from 'semver';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const root = read('package.json');
const workspaces = root.workspaces.map((dir) => ({ dir, pkg: read(`${dir}/package.json`) }));
const manifests = [{ dir: '.', pkg: root }, ...workspaces];

let failed = false;
for (const { dir, pkg } of manifests) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    for (const ws of workspaces) {
        const range = deps[ws.pkg.name];
        if (!range || !semver.validRange(range)) continue; // absent, or a file:/link: spec
        if (!semver.satisfies(ws.pkg.version, range)) {
            console.error(
                `${dir}/package.json requires ${ws.pkg.name}@${range}, ` +
                    `but ${ws.dir} is at ${ws.pkg.version}. Bump one of them.`,
            );
            failed = true;
        }
    }
}
if (failed) process.exitCode = 1;
