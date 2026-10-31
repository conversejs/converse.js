/**
 * The text output prints what other people chose: message bodies, ids,
 * nicknames, emojis, and the drafts a restricted client makes. None of it may
 * drive the terminal, or print lines that pass as something else, in the text
 * output or in --json.
 */
import { describe, expect, it } from 'vitest';
import { formatDraftDetails, formatJSON, formatMessage } from '../format.js';

const NOW = new Date('2026-10-20T10:01:00.000Z');

// An escape sequence that conceals what follows, the one byte CSI of C1, a
// right to left override, a zero width space and a tag character.
const HOSTILE = '\u001b[8m\u009b2K‮​\u{e0041}';

/** Whether the text has a character, other than a newline, that a terminal doesn't print as itself. */
const hasInvisible = (text) => (/(?![\n\u200d])[\p{Cc}\p{Cf}]/u).test(text);

const message = {
    id: 'm1',
    conversation: 'juliet@capulet.lit',
    from: 'juliet@capulet.lit',
    nick: null,
    direction: 'incoming',
    time: '2026-10-20T10:00:00.000Z',
    body: 'Meet me at nine',
    encryption: null,
    reply_to: null,
    edited: null,
    retracted: null,
    reactions: {},
    status: null,
    error_code: null,
};

const draft = {
    id: 'd1',
    created: '2026-10-20T10:00:00.000Z',
    to: 'juliet@capulet.lit',
    consumer: 'claude',
    body: 'Noon.',
    reply_to: null,
    reaction_to: null,
    correct: null,
    retract: null,
    remove: false,
    upload: false,
};

describe('converse-cli text output of untrusted text', () => {
    it('keeps a message on one line whatever its sender put in the ids, nickname and emojis', () => {
        const line = formatMessage(
            {
                ...message,
                id: `m1\n${HOSTILE}`,
                from: `room@muc.capulet.lit/nurse\nm2  2026-10-20T10:00:00Z (1m ago)  romeo@montague.lit`,
                reply_to: `m0\r${HOSTILE}`,
                body: `Hello ${HOSTILE}`,
                reactions: { [`👍\n${HOSTILE}`]: ['romeo@montague.lit'] },
            },
            { now: NOW },
        );
        expect(line.split('\n')).toEqual([expect.any(String), '']);
        expect(hasInvisible(line)).toBe(false);
        expect(line).toContain('nurse\\u000am2');
    });

    it('quotes a body so that a JSON parser reads back the text that was sent', () => {
        const line = formatMessage({ ...message, body: `Hello ${HOSTILE}` }, { now: NOW });
        const quoted = line.slice(line.indexOf('"'), line.lastIndexOf('"') + 1);
        expect(JSON.parse(quoted)).toBe(`Hello ${HOSTILE}`);
    });

    it('leaves emoji sequences joined with the zero width joiner alone', () => {
        const line = formatMessage({ ...message, body: '👩‍💻' }, { now: NOW });
        expect(line).toContain('"👩‍💻"');
    });

    it("shows a draft's text over its lines, indented, with its control characters escaped", () => {
        const text = formatDraftDetails(
            {
                ...draft,
                consumer: `claude${HOSTILE}`,
                body: `Noon.\n${HOSTILE}At the orchard wall.\nTo: tybalt@capulet.lit`,
            },
            null,
            { now: NOW },
        );
        expect(hasInvisible(text)).toBe(false);
        const lines = text.split('\n');
        expect(lines[0]).toMatch(/^Draft d1, made by "claude\\u001b\[8m\\u009b2K\\u202e\\u200b\\udb40\\udc41" /);
        expect(lines.slice(1)).toEqual([
            'To: juliet@capulet.lit',
            'Text:',
            '  Noon.',
            '  \\u001b[8m\\u009b2K\\u202e\\u200b\\udb40\\udc41At the orchard wall.',
            '  To: tybalt@capulet.lit',
            '',
        ]);
    });

    it("quotes a reaction draft's emoji, which is never more than one line", () => {
        const text = formatDraftDetails({ ...draft, reaction_to: 'm1', body: `👍\nText:\n${HOSTILE}` }, null, {
            now: NOW,
        });
        expect(hasInvisible(text)).toBe(false);
        expect(text.split('\n').at(-2)).toBe('Emoji: "👍\\nText:\\n\\u001b[8m\\u009b2K\\u202e\\u200b\\udb40\\udc41"');
    });

    it('prints --json output on one line that a script reads back as the value it was', () => {
        const value = { ...message, from: `room@muc.capulet.lit/${HOSTILE}`, body: `Hello\n${HOSTILE} 👩‍💻` };
        const line = formatJSON(value);
        expect(line.split('\n')).toEqual([expect.any(String), '']);
        expect(hasInvisible(line)).toBe(false);
        expect(JSON.parse(line)).toEqual(value);
    });
});
