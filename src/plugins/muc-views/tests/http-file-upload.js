/*global mock, converse */

const { Strophe, sizzle, u } = converse.env;


describe("XEP-0363: HTTP File Upload", function () {

    describe("When not supported", function () {
        describe("A file upload toolbar button", function () {

            it("does not appear in MUC chats", mock.initConverse([], {}, async (_converse) => {
                await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                mock.waitUntilDiscoConfirmed(
                    _converse, _converse.domain,
                    [{'category': 'server', 'type':'IM'}],
                    ['http://jabber.org/protocol/disco#items'], [], 'info');

                await mock.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], [], 'items');
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                await u.waitUntil(() => view.querySelector('.chat-toolbar .fileupload') === null);
                expect(1).toBe(1);
            }));

        });
    });

    describe("When supported", function () {

        describe("A file upload toolbar button", function () {

            it("appears in MUC chats", mock.initConverse(['chatBoxesFetched'], {}, async (_converse) => {
                await mock.waitUntilDiscoConfirmed(
                    _converse, _converse.domain,
                    [{'category': 'server', 'type':'IM'}],
                    ['http://jabber.org/protocol/disco#items'], [], 'info');

                await mock.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.lit'], 'items');
                await mock.waitUntilDiscoConfirmed(_converse, 'upload.montague.lit', [], [Strophe.NS.HTTPUPLOAD], []);
                await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                await u.waitUntil(() => _converse.chatboxviews.get('lounge@montague.lit').querySelector('.fileupload'));
                const view = _converse.chatboxviews.get('lounge@montague.lit');
                expect(view.querySelector('.chat-toolbar .fileupload')).not.toBe(null);
            }));

            describe("when clicked and a file chosen", function () {

                it("is uploaded and sent out from a groupchat", mock.initConverse(['chatBoxesFetched'], {} ,async (_converse) => {
                    const base_url = 'https://conversejs.org';
                    await mock.waitUntilDiscoConfirmed(
                        _converse, _converse.domain,
                        [{'category': 'server', 'type':'IM'}],
                        ['http://jabber.org/protocol/disco#items'], [], 'info');

                    const send_backup = XMLHttpRequest.prototype.send;
                    const IQ_stanzas = _converse.connection.IQ_stanzas;

                    await mock.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.tld'], 'items');
                    await mock.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []);
                    await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');

                    // Wait until MAM query has been sent out
                    const sent_stanzas = _converse.connection.sent_stanzas;
                    await u.waitUntil(() => sent_stanzas.filter(s => sizzle(`[xmlns="${Strophe.NS.MAM}"]`, s).length).pop());

                    const view = _converse.chatboxviews.get('lounge@montague.lit');
                    const file = {
                        'type': 'image/jpeg',
                        'size': '23456' ,
                        'lastModifiedDate': "",
                        'name': "my-juliet.jpg"
                    };
                    view.model.sendFiles([file]);

                    await u.waitUntil(() => IQ_stanzas.filter(iq => iq.querySelector('iq[to="upload.montague.tld"] request')).length);
                    const iq = IQ_stanzas.pop();
                    expect(Strophe.serialize(iq)).toBe(
                        `<iq from="romeo@montague.lit/orchard" `+
                            `id="${iq.getAttribute("id")}" `+
                            `to="upload.montague.tld" `+
                            `type="get" `+
                            `xmlns="jabber:client">`+
                        `<request `+
                            `content-type="image/jpeg" `+
                            `filename="my-juliet.jpg" `+
                            `size="23456" `+
                            `xmlns="urn:xmpp:http:upload:0"/>`+
                        `</iq>`);

                    const message = base_url+"/logo/conversejs-filled.svg";
                    const stanza = u.toStanza(`
                        <iq from='upload.montague.tld'
                            id="${iq.getAttribute('id')}"
                            to='romeo@montague.lit/orchard'
                            type='result'>
                        <slot xmlns='urn:xmpp:http:upload:0'>
                            <put url='https://upload.montague.tld/4a771ac1-f0b2-4a4a-9700-f2a26fa2bb67/my-juliet.jpg'>
                            <header name='Authorization'>Basic Base64String==</header>
                            <header name='Cookie'>foo=bar; user=romeo</header>
                            </put>
                            <get url="${message}" />
                        </slot>
                        </iq>`);

                    spyOn(XMLHttpRequest.prototype, 'send').and.callFake(async function () {
                        const message = view.model.messages.at(0);
                        const el = await u.waitUntil(() => view.querySelector('.chat-content progress'));
                        expect(el.getAttribute('value')).toBe('0');
                        message.set('progress', 0.5);
                        await u.waitUntil(() => view.querySelector('.chat-content progress').getAttribute('value') === '0.5')
                        message.set('progress', 1);
                        await u.waitUntil(() => view.querySelector('.chat-content progress')?.getAttribute('value') === '1')
                        message.save({
                            'upload': _converse.SUCCESS,
                            'oob_url': message.get('get'),
                            'body': message.get('get'),
                        });
                        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                    });
                    let sent_stanza;
                    spyOn(_converse.connection, 'send').and.callFake(stanza => (sent_stanza = stanza));
                    _converse.connection._dataRecv(mock.createRequest(stanza));

                    await u.waitUntil(() => sent_stanza, 1000);
                    expect(Strophe.serialize(sent_stanza)).toBe(
                        `<message `+
                            `from="romeo@montague.lit/orchard" `+
                            `id="${sent_stanza.getAttribute("id")}" `+
                            `to="lounge@montague.lit" `+
                            `type="groupchat" `+
                            `xmlns="jabber:client">`+
                                `<body>${message}</body>`+
                                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                `<x xmlns="jabber:x:oob">`+
                                    `<url>${message}</url>`+
                                `</x>`+
                                `<origin-id id="${sent_stanza.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                        `</message>`);
                    const img_link_el = await u.waitUntil(() => view.querySelector('converse-chat-message-body .chat-image__link'), 1000);
                    // Check that the image renders
                    expect(img_link_el.outerHTML.replace(/<!-.*?->/g, '').trim()).toEqual(
                        `<a class="chat-image__link" target="_blank" rel="noopener" href="${base_url}/logo/conversejs-filled.svg">`+
                        `<img class="chat-image img-thumbnail" loading="lazy" src="${base_url}/logo/conversejs-filled.svg"></a>`);

                    expect(view.querySelector('.chat-msg .chat-msg__media')).toBe(null);
                    XMLHttpRequest.prototype.send = send_backup;
                }));


            });
        });
    });
});
