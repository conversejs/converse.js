import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { log, u } = converse.env;

describe('api.emojis.initialize', function () {
    it(
        'resolves when a loadEmojis hook listener throws',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;
            // Emoji data is loaded once per page, and each spec file gets a fresh page.
            expect(converse.emojis.initialized).toBe(false);
            const error = vi.spyOn(log, 'error');
            const listener = vi.fn((_context, json) => {
                json.custom ??= {};
                json.custom[':my_emoji:'] = { sn: ':my_emoji:', url: 'https://example.org/my_emoji.png', c: 'custom' };
                delete json.people;
                throw new Error('broken plugin');
            });
            api.listen.on('loadEmojis', listener);

            await api.emojis.initialize();
            await api.emojis.initialize();
            expect(listener).toHaveBeenCalledOnce();
            expect(error).toHaveBeenCalledWith(expect.stringContaining('loadEmojis'), expect.any(Error));
            // emoji.json is still used, without the failed listener's changes.
            expect(converse.emojis.by_sn[':thumbsup:']).toBeDefined();
            expect(converse.emojis.by_sn[':my_emoji:']).toBeUndefined();
            expect(converse.emojis.toned.length).toBeGreaterThan(0);
        }),
    );

    it(
        'resolves when a loadEmojis hook listener returns malformed emoji data',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;
            const saved = { ...converse.emojis };
            Object.assign(converse.emojis, { initialized: false, initialized_promise: u.getOpenPromise() });
            try {
                const error = vi.spyOn(log, 'error');
                api.listen.on('loadEmojis', (_context, json) => {
                    json.custom = { ':no_sn:': { url: 'https://example.org/no_sn.png' } };
                    return json;
                });

                await api.emojis.initialize();
                await api.emojis.initialize();
                expect(error).toHaveBeenCalledWith(expect.stringContaining('malformed'), expect.any(Error));
                expect(converse.emojis.json).toEqual({});
                expect(converse.emojis.list).toEqual([]);
            } finally {
                Object.assign(converse.emojis, saved);
            }
        }),
    );
});
