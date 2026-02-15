/* global converse */
import mock from '../../../tests/mock.js';
const { u, Strophe, stx, sizzle } = converse.env;

describe('XEP-0231: Bits of Binary', function () {
    describe('BOB Cache', function () {
        it(
            'stores and retrieves BOB data',
            mock.initConverse(['chatBoxesInitialized', 'BOBsInitialized'], {}, async (_converse) => {
                const { api } = _converse;
                const cid = 'cid:sha1+8f35fef110ffc5df08d579a50083ff9308fb6242@bob.xmpp.org';
                const data = 'iVBORw0KGgoAAAANSUhEUg==';
                const type = 'image/png';

                // Store data
                await api.bob.store(cid, data, type, 86400);

                // Verify it's cached
                expect(await api.bob.has(cid)).toBe(true);

                // Retrieve as Blob URL
                const blobUrl = await api.bob.get(cid);
                expect(blobUrl).toBeTruthy();
                expect(blobUrl.startsWith('blob:')).toBe(true);
            }),
        );

        it(
            'respects max-age expiration',
            mock.initConverse(['chatBoxesInitialized', 'BOBsInitialized'], {}, async (_converse) => {
                const { api } = _converse;
                const cid = 'cid:sha1+test@bob.xmpp.org';
                const data = 'iVBORw0KGgoAAAANSUhEUg==';

                // Store with 1 second max-age
                await api.bob.store(cid, data, 'image/png', 1);
                expect(await api.bob.has(cid)).toBe(true);

                // Wait 2 seconds
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Should be expired
                expect(await api.bob.has(cid)).toBe(false);
            }),
        );

        it(
            'rejects oversized data',
            mock.initConverse(['chatBoxesInitialized', 'BOBsInitialized'], {}, async (_converse) => {
                const { api } = _converse;
                const cid = 'cid:sha1+large@bob.xmpp.org';
                // Create valid base64 that decodes to >8KB (need ~12KB base64 for 9KB decoded)
                const largeData = btoa('A'.repeat(9000));

                await api.bob.store(cid, largeData, 'image/png', 86400);

                // Should not be cached
                expect(await api.bob.has(cid)).toBe(false);
            }),
        );

        it(
            'rejects non-image MIME types',
            mock.initConverse(['chatBoxesInitialized', 'BOBsInitialized'], {}, async (_converse) => {
                const { api } = _converse;
                const cid = 'cid:sha1+pdf@bob.xmpp.org';
                const data = 'JVBERi0xLjQK';

                await api.bob.store(cid, data, 'application/pdf', 86400);

                // Should not be cached
                expect(await api.bob.has(cid)).toBe(false);
            }),
        );
    });

    describe('Message Parsing', function () {
        it(
            'extracts BOB data from incoming messages',
            mock.initConverse(['chatBoxesInitialized', 'BOBsInitialized'], {}, async (_converse) => {
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

                const cid = 'cid:sha1+abc123@bob.xmpp.org';
                const bobData = 'iVBORw0KGgoAAAANSUhEUg==';

                const stanza = stx`<message from="${contact_jid}" to="${_converse.bare_jid}" type="chat" xmlns="jabber:client">
                    <body>Check this out! ${cid}</body>
                    <data xmlns="urn:xmpp:bob" cid="${cid}" type="image/png" max-age="3600">${bobData}</data>
                </message>`;

                await _converse.handleMessageStanza(stanza.tree());

                // Verify data was cached
                expect(await _converse.api.bob.has(cid)).toBe(true);
            }),
        );

        it(
            'extracts BOB cid from XHTML-IM img tags (Pidgin-style custom smileys)',
            mock.initConverse(['chatBoxesInitialized', 'BOBsInitialized'], {}, async (_converse) => {
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

                const cid = 'sha1+8f35fef110ffc5df08d579a50083ff9308fb6242@bob.xmpp.org';
                const bobData = 'iVBORw0KGgoAAAANSUhEUg==';

                // Pidgin-style stanza: body has only the alt/shortname text,
                // the cid: URI is only in the XHTML-IM <img> tag.
                // Based on XEP-0231 Example 1.
                // Note: Using raw XML string because stx template doesn't
                // properly handle XHTML namespace on nested elements.
                const xml =
                    `<message from="${contact_jid}" to="${_converse.bare_jid}" type="chat" xmlns="jabber:client">` +
                    `<body>Here is a smiley: myemoji</body>` +
                    `<html xmlns="http://jabber.org/protocol/xhtml-im">` +
                    `<body xmlns="http://www.w3.org/1999/xhtml">` +
                    `<p>Here is a smiley: <img alt="myemoji" src="cid:${cid}"/></p>` +
                    `</body>` +
                    `</html>` +
                    `<data xmlns="urn:xmpp:bob" cid="cid:${cid}" type="image/png" max-age="86400">${bobData}</data>` +
                    `</message>`;
                const parser = new DOMParser();
                const doc = parser.parseFromString(xml, 'application/xml');
                const stanza = doc.documentElement;

                await _converse.handleMessageStanza(stanza);

                // Verify the BOB data was cached
                expect(await _converse.api.bob.has(`cid:${cid}`)).toBe(true);

                // Verify the message body was updated to include the cid: URI
                const msg = await _converse.api.chats.get(contact_jid);
                const messages = msg.messages;
                const last_msg = messages.at(-1);
                expect(last_msg.get('body')).toContain(`cid:${cid}`);
                expect(last_msg.get('body')).not.toContain('myemoji');
            }),
        );
    });

    describe('IQ Requests', function () {
        it(
            'fetches uncached BOB data via IQ-get',
            mock.initConverse(['chatBoxesInitialized', 'BOBsInitialized'], {}, async (_converse) => {
                const { api } = _converse;
                const contact_jid = 'romeo@montague.lit';
                const cid = 'cid:sha1+fetch@bob.xmpp.org';
                const bobData = 'iVBORw0KGgoAAAANSUhEUg==';

                // Mock IQ response
                const response = stx`<iq type="result" xmlns="jabber:client">
                    <data xmlns="urn:xmpp:bob" cid="${cid}" type="image/png" max-age="3600">${bobData}</data>
                </iq>`;
                spyOn(api, 'sendIQ').and.returnValue(Promise.resolve(response.tree()));

                // Fetch data
                const blobUrl = await api.bob.get(cid, contact_jid);

                // Verify IQ was sent
                expect(api.sendIQ).toHaveBeenCalled();

                // Verify data was cached
                expect(await api.bob.has(cid)).toBe(true);
                expect(blobUrl).toBeTruthy();
            }),
        );

        it(
            'handles IQ errors gracefully',
            mock.initConverse(['chatBoxesInitialized', 'BOBsInitialized'], {}, async (_converse) => {
                const { api } = _converse;
                const contact_jid = 'romeo@montague.lit';
                const cid = 'cid:sha1+notfound@bob.xmpp.org';

                // Mock IQ error
                spyOn(api, 'sendIQ').and.returnValue(Promise.reject(new Error('item-not-found')));

                // Attempt to fetch
                const blobUrl = await api.bob.get(cid, contact_jid);

                // Should return null on error
                expect(blobUrl).toBeNull();
                expect(await api.bob.has(cid)).toBe(false);
            }),
        );
    });
});
