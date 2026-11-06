import { describe, expect, it } from 'vitest';
import { COMMANDS } from '../commands/index.js';
import { flag, option, parseOptions, unexpectedOptions } from '../options.js';

describe('The command line options', () => {
    it('take a value only when declared with one', () => {
        const parsed = parseOptions(COMMANDS);
        expect(parsed.limit).toEqual({ type: 'string' });
        expect(parsed.full).toEqual({ type: 'boolean' });
        expect(parsed.help).toEqual({ type: 'boolean', short: 'h' });
    });

    it('refuse an option that two commands declare differently', () => {
        const command = { summary: '', description: '', examples: [], run: () => 0 };
        expect(() =>
            parseOptions({
                one: { ...command, options: [option('limit', '<n>', 'At most this many')] },
                two: { ...command, options: [flag('limit', 'Limit it')] },
            }),
        ).toThrow('--limit is declared both with and without a value.');
    });

    it("name those given that a command doesn't take", () => {
        expect(unexpectedOptions(COMMANDS.read, { limit: '5', json: true, nick: 'romeo' })).toEqual(['nick']);
    });
});
