import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

/**
 * Emoji shortnames are matched case-sensitively, because `converse.emojis.by_sn` is
 * keyed on the exact shortname. A case-insensitive match would look up a key that
 * isn't there, which used to throw while rendering the message.
 *
 * These specs live in their own file because `converse.emojis` is initialized once
 * per page: the `loadEmojis` hook below only takes effect if it's registered before
 * anything else initializes the emojis, so it has to run in the first spec of a file.
 */
describe('An emoji shortname', function () {
    it(
        'is matched case-sensitively against custom emojis',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            _converse.api.listen.on('loadEmojis', (_context, json) => {
                json.custom = json.custom || {};
                json.custom[':MyEmoji:'] = {
                    'sn': ':MyEmoji:',
                    'url': 'https://example.com/MyEmoji.png',
                    'c': 'custom',
                };
                return json;
            });

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            await _converse.api.emojis.initialize();
            // If the emojis were already initialized before the hook was registered, the
            // custom emoji is missing and everything below would pass without testing anything.
            expect(converse.emojis.by_sn[':MyEmoji:']).toBeDefined();
            expect(converse.emojis.by_sn[':myemoji:']).toBeUndefined();

            await mock.setComposerText(view, 'Look at :MyEmoji: and :myemoji:');
            await mock.pressComposerKey(view, 'Enter');

            // The shortname is left as-is, since a custom emoji has no unicode
            // representation to convert it to.
            const message = await u.waitUntil(() => view.model.messages.last());
            expect(message.get('body')).toBe('Look at :MyEmoji: and :myemoji:');

            const body = await u.waitUntil(() => view.querySelector('converse-chat-message-body'));
            // Only the exact match renders as the custom emoji. Matching `:myemoji:`
            // case-insensitively used to resolve to an undefined emoji and throw here.
            const img = await u.waitUntil(() => body.querySelector('img.emoji'));
            expect(img.getAttribute('title')).toBe(':MyEmoji:');
            expect(img.src).toBe('https://example.com/MyEmoji.png');
            expect(body.querySelectorAll('img.emoji').length).toBe(1);
            expect(body.textContent).toContain(':myemoji:');
        }),
    );

    it(
        'is matched case-sensitively against unicode emojis',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            await mock.setComposerText(view, 'hello :smile: and :SMILE:');
            await mock.pressComposerKey(view, 'Enter');
            await new Promise((resolve) => view.model.messages.once('rendered', resolve));

            // Only the exactly matching shortname is converted to unicode.
            expect(view.model.messages.last().get('body')).toBe('hello 😄 and :SMILE:');

            const sent_stanza = await u.waitUntil(() =>
                _converse.api.connection
                    .get()
                    .sent_stanzas.filter((s) => s.nodeName === 'message' && s.querySelector('body'))
                    .pop(),
            );
            expect(sent_stanza.querySelector('body').innerHTML).toBe('hello 😄 and :SMILE:');
        }),
    );
});
