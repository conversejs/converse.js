import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, stx, u, sizzle } = converse.env;

describe('The OMEMO module', function () {
    it(
        "shows an error when it can't download a received encrypted file",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.initializedOMEMO(_converse);
            await mock.openChatBoxFor(_converse, contact_jid);
            await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid, ['555']));

            await u.waitUntil(() => _converse.state.omemo_store);
            const devicelist = _converse.state.devicelists.get({ 'jid': contact_jid });
            await u.waitUntil(() => devicelist.devices.length === 1);

            const view = _converse.chatboxviews.get(contact_jid);
            view.model.set('omemo_active', true);

            await mock.setComposerText(view, 'This message will be encrypted');
            await mock.pressComposerKey(view, 'Enter');

            await u.waitUntil(() =>
                mock.bundleFetched(_converse, {
                    jid: contact_jid,
                    device_id: '555',
                    identity_key: '3333',
                    signed_prekey_id: '4223',
                    signed_prekey_public: '1111',
                    signed_prekey_sig: '2222',
                    prekeys: ['1001', '1002', '1003'],
                }),
            );
            await u.waitUntil(() =>
                mock.bundleFetched(_converse, {
                    jid: _converse.bare_jid,
                    device_id: '482886413b977930064a5888b92134fe',
                    identity_key: '300000',
                    signed_prekey_id: '4224',
                    signed_prekey_public: '100000',
                    signed_prekey_sig: '200000',
                    prekeys: ['1991', '1992', '1993'],
                }),
            );
            const sent_stanzas = _converse.api.connection.get().sent_stanzas;
            await u.waitUntil(() => sent_stanzas.filter((s) => sizzle('body', s).length).pop(), 1000);

            // Test reception of an encrypted file
            let obj = await u.omemo.encryptMessage(
                'aesgcm://upload.example.org/b9e3eaaa-2eae-4900-ae41/k9mKam2JT.jpg#6b5ba0f96eae',
            );

            // XXX: Normally the key will be encrypted via libsignal.
            // However, we're mocking libsignal in the tests, so we include it as plaintext in the message.
            let stanza = stx`<message from="${contact_jid}"
                        to="${_converse.api.connection.get().jid}"
                        type="chat"
                        id="${_converse.api.connection.get().getUniqueId()}"
                        xmlns="jabber:client">
                    <body>This is a fallback message</body>
                    <encrypted xmlns="${Strophe.NS.OMEMO}">
                        <header sid="555">
                            <key rid="${_converse.state.omemo_store.get('device_id')}">${u.arrayBufferToBase64(obj.key_and_tag)}</key>
                            <iv>${obj.iv}</iv>
                        </header>
                        <payload>${obj.payload}</payload>
                    </encrypted>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
            await new Promise((resolve) => view.model.messages.once('rendered', resolve));

            expect(view.model.messages.length).toBe(2);
            const error = await u.waitUntil(() => view.querySelector('.error'), 5000);
            expect(error.textContent).toBe(
                'Error: could not decrypt a received encrypted file, because it could not be downloaded',
            );
        }),
    );

    it(
        'preserves the original filename when rendering a received encrypted image',
        // Regression test for https://github.com/conversejs/converse.js/issues/2632
        // A decrypted OMEMO image is served from an opaque `blob:` URL which has
        // lost the original filename, so the browser would save it as `index.png`
        // or the blob uuid. The original filename (from the `aesgcm://` URL) must be
        // carried through to the `download` attribute and `data-filename`.
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            // A real 1x1 PNG so the rendered <img> actually loads (otherwise it
            // errors and falls back to a plain hyperlink).
            const png_b64 =
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const png_bytes = Uint8Array.from(atob(png_b64), (c) => c.charCodeAt(0));

            // Stub the download + file-decryption so a valid image blob is produced.
            // The `aesgcm://` URL is handled for any message body, so no OMEMO
            // envelope (which would itself use crypto.subtle.decrypt) is needed.
            spyOn(window, 'fetch').and.returnValue(Promise.resolve(new Response(png_bytes.buffer, { status: 200 })));
            spyOn(crypto.subtle, 'importKey').and.returnValue(Promise.resolve(/** @type {CryptoKey} */ ({})));
            spyOn(crypto.subtle, 'decrypt').and.returnValue(Promise.resolve(png_bytes.buffer));

            // The hash carries the IV + 64-char key.
            const iv = '0'.repeat(24);
            const key = '0'.repeat(64);
            const aesgcm_url = `aesgcm://upload.example.org/b9e3eaaa-2eae-4900-ae41/k9mKam2JT.jpg#${iv}${key}`;
            const stanza = stx`<message from="${contact_jid}"
                        to="${_converse.api.connection.get().jid}"
                        type="chat"
                        id="${_converse.api.connection.get().getUniqueId()}"
                        xmlns="jabber:client">
                    <body>${aesgcm_url}</body>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            const img_link = await u.waitUntil(() => view.querySelector('a.chat-image__link'), 5000);
            expect(img_link.getAttribute('download')).toBe('k9mKam2JT.jpg');
            expect(img_link.getAttribute('href').startsWith('blob:')).toBe(true);

            const img = img_link.querySelector('img.chat-image');
            expect(img.dataset.filename).toBe('k9mKam2JT.jpg');
            expect(img.getAttribute('src').startsWith('blob:')).toBe(true);
        }),
    );

    it(
        'allows the user to hide and show a received encrypted image',
        // Regression test for https://github.com/conversejs/converse.js/issues/2606
        // Hiding media must also collapse decrypted OMEMO media, instead of
        // always re-rendering it.
        mock.initConverse(converse, ['chatBoxesFetched'], { 'render_media': true }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const png_b64 =
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const png_bytes = Uint8Array.from(atob(png_b64), (c) => c.charCodeAt(0));

            // Return a fresh Response each call, since the body stream can only
            // be read once and the image is fetched again when re-shown.
            spyOn(window, 'fetch').and.callFake(() =>
                Promise.resolve(new Response(png_bytes.buffer, { status: 200 })),
            );
            spyOn(crypto.subtle, 'importKey').and.returnValue(Promise.resolve(/** @type {CryptoKey} */ ({})));
            spyOn(crypto.subtle, 'decrypt').and.returnValue(Promise.resolve(png_bytes.buffer));

            const iv = '0'.repeat(24);
            const key = '0'.repeat(64);
            const aesgcm_url = `aesgcm://upload.example.org/b9e3eaaa-2eae-4900-ae41/k9mKam2JT.jpg#${iv}${key}`;
            const stanza = stx`<message from="${contact_jid}"
                        to="${_converse.api.connection.get().jid}"
                        type="chat"
                        id="${_converse.api.connection.get().getUniqueId()}"
                        xmlns="jabber:client">
                    <body>${aesgcm_url}</body>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            // The decrypted image is rendered by default.
            await u.waitUntil(() => view.querySelector('converse-chat-message-body img.chat-image'), 5000);

            const actions_el = view.querySelector('converse-message-actions');
            await u.waitUntil(() => actions_el.textContent.includes('Hide media'));

            // Hiding media collapses the image and leaves the URL as text.
            actions_el.querySelector('.chat-msg__action-hide-previews').click();
            await u.waitUntil(() => actions_el.textContent.includes('Show media'));
            await u.waitUntil(() => !view.querySelector('converse-chat-message-body img.chat-image'));
            expect(view.querySelector('converse-chat-message-body').textContent.includes(aesgcm_url)).toBe(true);

            // Showing media renders the decrypted image again.
            actions_el.querySelector('.chat-msg__action-hide-previews').click();
            await u.waitUntil(() => actions_el.textContent.includes('Hide media'));
            await u.waitUntil(() => view.querySelector('converse-chat-message-body img.chat-image'), 5000);
        }),
    );

    it(
        'implements XEP-0454 to encrypt uploaded files',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const base_url = 'https://example.org/';
            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.domain,
                [{ 'category': 'server', 'type': 'IM' }],
                ['http://jabber.org/protocol/disco#items'],
                [],
                'info',
            );

            const send_backup = XMLHttpRequest.prototype.send;
            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;

            await mock.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.tld'], 'items');
            await mock.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []);
            await mock.waitForRoster(_converse, 'current', 3);
            const contact_jid = mock.cur_names[2].replace(/ /g, '.').toLowerCase() + '@montague.lit';

            await u.waitUntil(() => mock.initializedOMEMO(_converse));
            await mock.openChatBoxFor(_converse, contact_jid);

            let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
            let stanza = stx`
            <iq from="${contact_jid}"
                id="${iq_stanza.getAttribute('id')}"
                to="${_converse.api.connection.get().jid}"
                type="result"
                xmlns="jabber:client">
            <pubsub xmlns="http://jabber.org/protocol/pubsub">
                <items node="eu.siacs.conversations.axolotl.devicelist">
                    <item xmlns="http://jabber.org/protocol/pubsub"> // TODO: must have an id attribute
                        <list xmlns="eu.siacs.conversations.axolotl">
                            <device id="555"/>
                        </list>
                    </item>
                </items>
            </pubsub>
            </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
            await u.waitUntil(() => _converse.state.omemo_store);
            const devicelist = _converse.state.devicelists.get({ 'jid': contact_jid });
            await u.waitUntil(() => devicelist.devices.length === 1);

            const view = _converse.chatboxviews.get(contact_jid);
            const file = new File(['secret'], 'secret.txt', { type: 'text/plain' });
            view.model.set('omemo_active', true);
            await view.model.sendFiles([file]);

            await u.waitUntil(
                () => IQ_stanzas.filter((iq) => iq.querySelector('iq[to="upload.montague.tld"] request')).length,
            );
            const iq = IQ_stanzas.pop();
            const url = base_url + '/secret.txt';
            stanza = stx`
            <iq from="upload.montague.tld"
                id="${iq.getAttribute('id')}"
                to="romeo@montague.lit/orchard"
                type="result"
                xmlns="jabber:client">
            <slot xmlns="urn:xmpp:http:upload:0">
                <put url="https://upload.montague.tld/4a771ac1-f0b2-4a4a-9700-f2a26fa2bb67/secret.txt">
                    <header name="Authorization">Basic Base64String==</header>
                    <header name="Cookie">foo=bar; user=romeo</header>
                </put>
                <get url="${url}" />
            </slot>
            </iq>`;

            spyOn(XMLHttpRequest.prototype, 'send').and.callFake(async function () {
                const message = view.model.messages.at(0);
                message.set('progress', 1);
                await u.waitUntil(() => view.querySelector('.chat-content progress')?.getAttribute('value') === '1');
                message.save({
                    upload: _converse.SUCCESS,
                    oob_url: message.get('get'),
                    body: message.get('get'),
                });
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
            });
            let sent_stanza;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            iq_stanza = await u.waitUntil(() => mock.bundleIQRequestSent(_converse, contact_jid, '555'));
            stanza = stx`
            <iq from="${contact_jid}"
                id="${iq_stanza.getAttribute('id')}"
                to="${_converse.bare_jid}"
                type="result"
                xmlns="jabber:client">
            <pubsub xmlns="http://jabber.org/protocol/pubsub">
                <items node="eu.siacs.conversations.axolotl.bundles:555">
                    <item>
                        <bundle xmlns="eu.siacs.conversations.axolotl">
                            <signedPreKeyPublic signedPreKeyId="4223">${btoa('1111')}</signedPreKeyPublic>
                            <signedPreKeySignature>${btoa('2222')}</signedPreKeySignature>
                            <identityKey>${btoa('3333')}</identityKey>
                            <prekeys>
                                <preKeyPublic preKeyId="1">${btoa('1001')}</preKeyPublic>
                                <preKeyPublic preKeyId="2">${btoa('1002')}</preKeyPublic>
                                <preKeyPublic preKeyId="3">${btoa('1003')}</preKeyPublic>
                            </prekeys>
                        </bundle>
                    </item>
                </items>
            </pubsub>
            </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
            iq_stanza = await u.waitUntil(() =>
                mock.bundleIQRequestSent(_converse, _converse.bare_jid, '482886413b977930064a5888b92134fe'),
            );
            stanza = stx`
            <iq from="${_converse.bare_jid}"
                id="${iq_stanza.getAttribute('id')}"
                to="${_converse.bare_jid}"
                type="result"
                xmlns="jabber:client">
            <pubsub xmlns="http://jabber.org/protocol/pubsub">
                <items node="eu.siacs.conversations.axolotl.bundles:482886413b977930064a5888b92134fe">
                    <item>
                        <bundle xmlns="eu.siacs.conversations.axolotl">
                            <signedPreKeyPublic signedPreKeyId="4223">${btoa('100000')}</signedPreKeyPublic>
                            <signedPreKeySignature>${btoa('200000')}</signedPreKeySignature>
                            <identityKey>${btoa('300000')}</identityKey>
                            <prekeys>
                                <preKeyPublic preKeyId="1">${btoa('1991')}</preKeyPublic>
                                <preKeyPublic preKeyId="2">${btoa('1992')}</preKeyPublic>
                                <preKeyPublic preKeyId="3">${btoa('1993')}</preKeyPublic>
                            </prekeys>
                        </bundle>
                    </item>
                </items>
            </pubsub>
            </iq>`;

            spyOn(_converse.api.connection.get(), 'send').and.callFake((stanza) => (sent_stanza = stanza));
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => sent_stanza);

            const fallback =
                'This is an OMEMO encrypted message which your client doesn’t seem to support. Find more information on https://conversations.im/omemo';
            expect(sent_stanza).toEqualStanza(stx`
            <message from="romeo@montague.lit/orchard"
                id="${sent_stanza.getAttribute('id')}"
                to="lady.montague@montague.lit"
                type="chat"
                xmlns="jabber:client">
                    <body>${fallback}</body>
                    <request xmlns="urn:xmpp:receipts"/>
                    <origin-id id="${sent_stanza.getAttribute('id')}" xmlns="urn:xmpp:sid:0"/>
                    <encrypted xmlns="eu.siacs.conversations.axolotl">
                    <header sid="123456789">
                        <key rid="482886413b977930064a5888b92134fe">YzFwaDNSNzNYNw==</key>
                        <key rid="555">YzFwaDNSNzNYNw==</key>
                        <iv>${sent_stanza.querySelector('header iv').textContent}</iv>
                    </header>
                <payload>${sent_stanza.querySelector('payload').textContent}</payload>
                </encrypted>
                <store xmlns="urn:xmpp:hints"/>
                <encryption namespace="eu.siacs.conversations.axolotl" xmlns="urn:xmpp:eme:0"/>
            </message>`);

            const link_el = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
            expect(link_el.textContent.trim()).toBe(url);

            const message = view.model.messages.at(0);
            expect(message.get('is_encrypted')).toBe(true);

            XMLHttpRequest.prototype.send = send_backup;
        }),
    );
});
