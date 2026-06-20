import { describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, stx, u } = converse.env;

const ATOM = 'http://www.w3.org/2005/Atom';
const PUBSUB_EVENT = `${Strophe.NS.PUBSUB}#event`;
const MICROBLOG_NODE = 'urn:xmpp:microblog:0';

describe('The social feed', function () {
    it(
        'renders incoming posts and publishes via the compose box',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            // Mount the feed component directly.
            const el = document.createElement('converse-social-feed');
            document.querySelector('#conversejs').appendChild(el);

            // It resolves the own feed and renders the compose box.
            const textarea = await u.waitUntil(() => el.querySelector('.social-compose__textarea'));
            expect(el.querySelector('.social-feed__empty')).not.toBe(null);

            // A post arrives via PEP and is rendered (SignalWatcher + collectionSignal).
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                <message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="post-1" publisher="${bare_jid}">
                        <entry xmlns="${ATOM}">
                          <title type="text">Hello social world</title>
                          <id>tag:montague.lit,2024-01-01:posts-post-1</id>
                          <published>2024-01-01T18:30:02Z</published>
                          <updated>2024-01-01T18:30:02Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
                ),
            );

            const body = await u.waitUntil(() => el.querySelector('.social-post__body'));
            expect(body.textContent.trim()).toBe('Hello social world');

            // Publishing via the compose box builds + publishes, then optimistically renders.
            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            textarea.value = 'My first microblog post';
            el.querySelector('.social-compose__toolbar button').click();

            await u.waitUntil(() => publish.mock.calls.length === 1);
            const [jid, node] = publish.mock.calls[0];
            expect(jid).toBe(bare_jid);
            expect(node).toBe(MICROBLOG_NODE);

            await u.waitUntil(() =>
                Array.from(el.querySelectorAll('.social-post__body')).some((n) =>
                    n.textContent.includes('My first microblog post'),
                ),
            );
            // The textarea is cleared after a successful publish.
            expect(textarea.value).toBe('');
        }),
    );

    it(
        'deletes an own post via the delete button',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            const el = document.createElement('converse-social-feed');
            document.querySelector('#conversejs').appendChild(el);
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                <message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="post-1" publisher="${bare_jid}">
                        <entry xmlns="${ATOM}">
                          <title type="text">a doomed post</title>
                          <id>tag:montague.lit,2024-01-01:posts-post-1</id>
                          <published>2024-01-01T18:30:02Z</published>
                          <updated>2024-01-01T18:30:02Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
                ),
            );

            const delete_button = await u.waitUntil(() => el.querySelector('.social-post__action'));
            vi.spyOn(api, 'confirm').mockResolvedValue(true);
            const retract = vi.spyOn(api.pubsub, 'retract').mockResolvedValue(undefined);

            delete_button.click();

            await u.waitUntil(() => retract.mock.calls.length === 1);
            expect(retract).toHaveBeenCalledWith(bare_jid, MICROBLOG_NODE, 'post-1');
            await u.waitUntil(() => el.querySelector('.social-post') === null);
        }),
    );
});
