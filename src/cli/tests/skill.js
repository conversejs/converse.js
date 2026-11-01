/**
 * The agent skill shipped with the CLI teaches commands by example, so an
 * example that drifted from the CLI would teach an agent something that fails.
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_BODY_LENGTH } from '../format.js';
import { HELP, unexpectedOptions } from '../help.js';
import pkg from '../package.json' with { type: 'json' };

const SKILL = fs.readFileSync(new URL('../skill/SKILL.md', import.meta.url), 'utf8');

/**
 * Every invocation the skill shows, as the words after "converse-cli", up to
 * the end of its code span or line.
 * @returns {string[][]}
 */
function invocations() {
    return [...SKILL.matchAll(/converse-cli((?: [^`\n|]*)?)/g)].map(([, rest]) =>
        [...rest.matchAll(/"[^"]*"|'[^']*'|\S+/g)].map(([word]) => word),
    );
}

describe('The converse-cli agent skill', () => {
    it('is a skill named after the CLI, shipped with the package', () => {
        expect(SKILL).toMatch(/^---\nname: converse-cli\ndescription: \S.*\n---\n/);
        expect(pkg.files).toContain('skill/');
    });

    it('only shows commands that exist, with options they take', () => {
        const shown = invocations().filter(([first]) => first && !first.startsWith('-'));
        expect(shown.length).toBeGreaterThan(10);
        for (const words of shown) {
            const [first, second] = words[0] === 'help' ? words.slice(1) : words;
            if (first?.startsWith('<')) continue; // "help <command>"

            const name = Object.hasOwn(HELP, `${first} ${second}`) ? `${first} ${second}` : first;
            expect(Object.hasOwn(HELP, name), words.join(' ')).toBe(true);

            const end = words.indexOf('--');
            const options = (end === -1 ? words : words.slice(0, end))
                .filter((w) => w.startsWith('--'))
                .map((w) => w.slice(2));
            const values = Object.fromEntries(options.map((o) => [o, true]));
            expect(unexpectedOptions(name, values), words.join(' ')).toEqual([]);
        }
    });

    it('says where bodies are truncated, as the CLI does', () => {
        expect(SKILL).toContain(`cut at ${MAX_BODY_LENGTH} characters`);
    });
});
