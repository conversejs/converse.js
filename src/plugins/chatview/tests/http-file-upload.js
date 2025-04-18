/*global mock, converse */
const { stx, Strophe, $iq, u } = converse.env;

describe("XEP-0363: HTTP File Upload", function () {

    describe("Discovering support", function () {

        it("is done automatically", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            const IQ_stanzas = api.connection.get().IQ_stanzas;
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], []);
            let selector = 'iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]';
            let stanza = await u.waitUntil(() => IQ_stanzas.find(iq => iq.querySelector(selector)), 1000);

            stanza = stx`
                <iq type='result'
                    from='montague.lit'
                    to='romeo@montague.lit/orchard'
                    xmlns="jabber:client"
                    id='${stanza.getAttribute('id')}'>
                    <query xmlns='http://jabber.org/protocol/disco#info'>
                        <identity category='server' type='im'/>
                        <feature var='http://jabber.org/protocol/disco#info'/>
                        <feature var='http://jabber.org/protocol/disco#items'/>
                    </query>
                </iq>`;
            api.connection.get()._dataRecv(mock.createRequest(stanza));

            // Converse.js sees that the entity has a disco#items feature,
            // so it will make a query for it.
            selector = 'iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]';
            await u.waitUntil(() => IQ_stanzas.filter(iq => iq.querySelector(selector)).length, 1000);

            selector = 'iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]';
            stanza = IQ_stanzas.find(iq => iq.querySelector(selector), 500);
            stanza = stx`
                <iq type='result'
                    from='montague.lit'
                    xmlns="jabber:client"
                    to='romeo@montague.lit/orchard'
                    id='${stanza.getAttribute('id')}'>
                    <query xmlns='http://jabber.org/protocol/disco#items'>
                        <item jid='upload.montague.lit' name='HTTP File Upload'/>
                    </query>
                </iq>`;

            api.connection.get()._dataRecv(mock.createRequest(stanza));

            let entities = await api.disco.entities.get();
            expect(entities.length).toBe(3);
            expect(entities.pluck('jid')).toEqual(['montague.lit', 'romeo@montague.lit', 'upload.montague.lit']);

            expect(entities.get(_converse.domain).features.length).toBe(2);
            expect(entities.get(_converse.domain).identities.length).toBe(1);

            const domain_items = await api.disco.entities.items('montague.lit')
            expect(domain_items.length).toBe(1);
            // Converse.js sees that the entity has a disco#info feature, so it will make a query for it.

            selector = 'iq[to="upload.montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]';
            stanza = await u.waitUntil(() => IQ_stanzas.filter(iq => iq.querySelector(selector)).pop(), 1000);
            expect(Strophe.serialize(stanza)).toBe(
                `<iq from="romeo@montague.lit/orchard" id="`+stanza.getAttribute('id')+`" to="upload.montague.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/disco#info"/>`+
                `</iq>`);

            // Upload service responds and reports a maximum file size of 5MiB
            stanza = stx`
                <iq type='result'
                    xmlns="jabber:client"
                    to='romeo@montague.lit/orchard'
                    id='${stanza.getAttribute('id')}'
                    from='upload.montague.lit'>
                    <query xmlns='http://jabber.org/protocol/disco#info'>
                        <identity category='store' type='file' name='HTTP File Upload'/>
                        <feature var='urn:xmpp:http:upload:0'/>
                        <x type='result' xmlns='jabber:x:data'>
                            <field var='FORM_TYPE' type='hidden'>
                                <value>urn:xmpp:http:upload:0</value>
                            </field>
                            <field var='max-file-size'>
                                <value>5242880</value>
                            </field>
                        </x>
                    </query>
                </iq>`;
            api.connection.get()._dataRecv(mock.createRequest(stanza));

            entities = await _converse.api.disco.entities.get();
            const entity = await api.disco.entities.get('upload.montague.lit');
            expect(entity.get('parent_jids')).toEqual(['montague.lit']);
            expect(entity.identities.where({'category': 'store'}).length).toBe(1);
            const supported = await _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain);
            expect(supported).toBe(true);
            const features = await _converse.api.disco.features.get(Strophe.NS.HTTPUPLOAD, _converse.domain);
            expect(features.length).toBe(1);
            expect(features[0].get('jid')).toBe('upload.montague.lit');
            expect(features[0].dataforms.where({'FORM_TYPE': {value: "urn:xmpp:http:upload:0", type: "hidden"}}).length).toBe(1);
        }));
    });

    describe("When not supported", function () {
        describe("A file upload toolbar button", function () {

            it("does not appear in private chats",
                    mock.initConverse([], {}, async function (_converse) {

                await mock.waitForRoster(_converse, 'current', 3);
                mock.openControlBox(_converse);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                await mock.waitUntilDiscoConfirmed(
                    _converse, _converse.domain,
                    [{'category': 'server', 'type':'IM'}],
                    ['http://jabber.org/protocol/disco#items'], [], 'info');

                await mock.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], [], 'items');
                const view = _converse.chatboxviews.get(contact_jid);
                expect(view.querySelector('.chat-toolbar .fileupload')).toBe(null);
            }));
        });
    });

    describe("When supported", function () {

        describe("A file upload toolbar button", function () {

            it("appears in private chats", mock.initConverse([], {}, async (_converse) => {
                await mock.waitForRoster(_converse, 'current', 3);
                const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                await mock.waitUntilDiscoConfirmed(
                    _converse, _converse.domain,
                    [{'category': 'server', 'type':'IM'}],
                    ['http://jabber.org/protocol/disco#items'], [], 'info');

                await mock.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.lit'], 'items')
                await mock.waitUntilDiscoConfirmed(_converse, 'upload.montague.lit', [], [Strophe.NS.HTTPUPLOAD], []);

                const el = await u.waitUntil(() => view.querySelector('.chat-toolbar .fileupload'));
                expect(el).not.toEqual(null);
            }));

            describe("when clicked and a file chosen", function () {

                it("is uploaded and sent out", mock.initConverse(['chatBoxesFetched'], {} ,async (_converse) => {
                    const { api } = _converse;
                    const domain = _converse.session.get('domain');
                    const base_url = 'https://conversejs.org';
                    await mock.waitUntilDiscoConfirmed(
                        _converse, domain,
                        [{'category': 'server', 'type':'IM'}],
                        ['http://jabber.org/protocol/disco#items'], [], 'info');

                    const send_backup = XMLHttpRequest.prototype.send;
                    const IQ_stanzas = api.connection.get().IQ_stanzas;

                    await mock.waitUntilDiscoConfirmed(_converse, domain, [], [], ['upload.montague.tld'], 'items');
                    await mock.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []);
                    await mock.waitForRoster(_converse, 'current');
                    const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await mock.openChatBoxFor(_converse, contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);
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

                    const stanza = stx`
                        <iq from="upload.montague.tld"
                            id="${iq.getAttribute("id")}"
                            to="romeo@montague.lit/orchard"
                            xmlns="jabber:client"
                            type="result">
                        <slot xmlns="urn:xmpp:http:upload:0">
                            <put url="https://upload.montague.tld/4a771ac1-f0b2-4a4a-9700-f2a26fa2bb67/my-juliet.jpg">
                            <header name="Authorization">Basic Base64String==</header>
                            <header name="Cookie">foo=bar; user=romeo</header>
                            </put>
                            <get url="${message}" />
                        </slot>
                        </iq>`;

                    spyOn(XMLHttpRequest.prototype, 'send').and.callFake(async function () {
                        const message = view.model.messages.at(0);
                        const el = await u.waitUntil(() => view.querySelector('.chat-content progress'));
                        expect(el.getAttribute('value')).toBe('0');
                        message.set('progress', 0.5);
                        await u.waitUntil(() => view.querySelector('.chat-content progress').getAttribute('value') === '0.5')
                        message.set('progress', 1);
                        await u.waitUntil(() => view.querySelector('.chat-content progress').getAttribute('value') === '1')
                        message.save({
                            'upload': _converse.SUCCESS,
                            'oob_url': message.get('get'),
                            'body': message.get('get'),
                        });
                        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                    });
                    let sent_stanza;
                    spyOn(api.connection.get(), 'send').and.callFake(stanza => (sent_stanza = stanza));
                    api.connection.get()._dataRecv(mock.createRequest(stanza));

                    await u.waitUntil(() => sent_stanza, 1000);
                    expect(Strophe.serialize(sent_stanza)).toBe(
                        `<message from="romeo@montague.lit/orchard" `+
                            `id="${sent_stanza.getAttribute("id")}" `+
                            `to="lady.montague@montague.lit" `+
                            `type="chat" `+
                            `xmlns="jabber:client">`+
                                `<body>${message}</body>`+
                                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                `<request xmlns="urn:xmpp:receipts"/>`+
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
                    XMLHttpRequest.prototype.send = send_backup;
                }));

                it("shows an error message if the file is too large",
                        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

                    const { api } = _converse;
                    const IQ_stanzas = api.connection.get().IQ_stanzas;
                    const IQ_ids =  api.connection.get().IQ_ids;

                    await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], []);
                    await u.waitUntil(() => IQ_stanzas.filter(
                        iq => iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]')).length
                    );

                    let stanza = IQ_stanzas.find((iq) =>
                        iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]'));

                    const info_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                    stanza = stx`
                        <iq type='result'
                            xmlns="jabber:client"
                            from='montague.lit'
                            to='romeo@montague.lit/orchard'
                            id='${info_IQ_id}'>
                            <query xmlns='http://jabber.org/protocol/disco#info'>
                                <identity category='server' type='im'/>
                                <feature var='http://jabber.org/protocol/disco#info'/>
                                <feature var='http://jabber.org/protocol/disco#items'/>
                            </query>
                        </iq>`;
                    api.connection.get()._dataRecv(mock.createRequest(stanza));

                    await u.waitUntil(function () {
                        // Converse.js sees that the entity has a disco#items feature,
                        // so it will make a query for it.
                        return IQ_stanzas.filter(function (iq) {
                            return iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]');
                        }).length > 0;
                    }, 300);

                    stanza = IQ_stanzas.find(function (iq) {
                        return iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]');
                    });
                    const items_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                    stanza = stx`
                        <iq type='result'
                            xmlns="jabber:client"
                            from='montague.lit'
                            to='romeo@montague.lit/orchard'
                            id='${items_IQ_id}'>
                            <query xmlns='http://jabber.org/protocol/disco#items'>
                                <item jid='upload.montague.lit' name='HTTP File Upload'/>
                            </query>
                        </iq>`;

                    api.connection.get()._dataRecv(mock.createRequest(stanza));

                    let entities = await _converse.api.disco.entities.get();

                    expect(entities.length).toBe(3);
                    expect(entities.get(_converse.domain).features.length).toBe(2);
                    expect(entities.get(_converse.domain).identities.length).toBe(1);
                    expect(entities.pluck('jid')).toEqual(['montague.lit', 'romeo@montague.lit', 'upload.montague.lit']);

                    const items = await api.disco.entities.items('montague.lit');
                    expect(items.length).toBe(1);
                    await u.waitUntil(function () {
                        // Converse.js sees that the entity has a disco#info feature,
                        // so it will make a query for it.
                        return IQ_stanzas.filter(iq =>
                            iq.querySelector('iq[to="upload.montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]')
                        ).length > 0;
                    }, 300);

                    stanza = IQ_stanzas.find(iq => iq.querySelector('iq[to="upload.montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]'));
                    const IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                    expect(Strophe.serialize(stanza)).toBe(
                        `<iq from="romeo@montague.lit/orchard" id="${IQ_id}" to="upload.montague.lit" type="get" xmlns="jabber:client">`+
                            `<query xmlns="http://jabber.org/protocol/disco#info"/>`+
                        `</iq>`);

                    // Upload service responds and reports a maximum file size of 5MiB
                    stanza = stx`
                        <iq type='result'
                                xmlns="jabber:client"
                                to='romeo@montague.lit/orchard'
                                id='${IQ_id}'
                                from='upload.montague.lit'>
                            <query xmlns='http://jabber.org/protocol/disco#info'>
                                <identity category='store' type='file' name='HTTP File Upload'/>
                                <feature var='urn:xmpp:http:upload:0'/>
                                <x type='result' xmlns='jabber:x:data'>
                                    <field var='FORM_TYPE' type='hidden'>
                                        <value>urn:xmpp:http:upload:0</value>
                                    </field>
                                    <field var='max-file-size'>
                                        <value>5242880</value>
                                    </field>
                                </x>
                            </query>
                        </iq>`;
                    api.connection.get()._dataRecv(mock.createRequest(stanza));
                    entities = await _converse.api.disco.entities.get();
                    const entity = await api.disco.entities.get('upload.montague.lit');
                    expect(entity.get('parent_jids')).toEqual(['montague.lit']);
                    expect(entity.identities.where({'category': 'store'}).length).toBe(1);
                    await _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain);
                    await mock.waitForRoster(_converse, 'current');

                    const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await mock.openChatBoxFor(_converse, contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);
                    const file = {
                        'type': 'image/jpeg',
                        'size': '5242881',
                        'lastModifiedDate': "",
                        'name': "my-juliet.jpg"
                    };
                    view.model.sendFiles([file]);
                    await u.waitUntil(() => view.querySelectorAll('.message').length)
                    const messages = view.querySelectorAll('.message.chat-error');
                    expect(messages.length).toBe(1);
                    expect(messages[0].textContent.trim()).toBe(
                        'The size of your file, my-juliet.jpg, exceeds the maximum allowed by your server, which is 5.24 MB.');
                }));
            });
        });

        describe("While a file is being uploaded", function () {

            it("shows a progress bar", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitUntilDiscoConfirmed(
                    _converse, _converse.domain,
                    [{'category': 'server', 'type':'IM'}],
                    ['http://jabber.org/protocol/disco#items'], [], 'info');

                const { api } = _converse;
                const IQ_stanzas = api.connection.get().IQ_stanzas;

                await mock.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.tld'], 'items');
                await mock.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []);
                await mock.waitForRoster(_converse, 'current');
                const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                const file = {
                    'type': 'image/jpeg',
                    'size': '23456' ,
                    'lastModifiedDate': "",
                    'name': "my-juliet.jpg"
                };
                view.model.sendFiles([file]);
                await u.waitUntil(() => IQ_stanzas.filter(iq => iq.querySelector('iq[to="upload.montague.tld"] request')).length)
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

                const base_url = 'https://conversejs.org';
                const message = base_url+"/logo/conversejs-filled.svg";
                const stanza = stx`
                    <iq from="upload.montague.tld"
                        id="${iq.getAttribute("id")}"
                        to="romeo@montague.lit/orchard"
                        xmlns="jabber:client"
                        type="result">
                    <slot xmlns="urn:xmpp:http:upload:0">
                        <put url="https://upload.montague.tld/4a771ac1-f0b2-4a4a-9700-f2a26fa2bb67/my-juliet.jpg">
                            <header name="Authorization">Basic Base64String==</header>
                            <header name="Cookie">foo=bar; user=romeo</header>
                        </put>
                        <get url="${message}" />
                    </slot>
                    </iq>`;

                const promise = u.getOpenPromise();

                spyOn(XMLHttpRequest.prototype, 'setRequestHeader');
                spyOn(XMLHttpRequest.prototype, 'send').and.callFake(async () => {
                    const message = view.model.messages.at(0);
                    const el = await u.waitUntil(() => view.querySelector('.chat-content progress'));
                    expect(el.getAttribute('value')).toBe('0');
                    message.set('progress', 0.5);
                    await u.waitUntil(() => view.querySelector('.chat-content progress').getAttribute('value') === '0.5');
                    message.set('progress', 1);
                    await u.waitUntil(() => view.querySelector('.chat-content progress').getAttribute('value') === '1');
                    expect(view.querySelector('.chat-content .chat-msg__text').textContent).toBe('Uploading file: my-juliet.jpg, 23.46 kB');
                    promise.resolve();
                });
                api.connection.get()._dataRecv(mock.createRequest(stanza));
                await promise;
                expect(XMLHttpRequest.prototype.setRequestHeader.calls.count()).toBe(2);
                expect(XMLHttpRequest.prototype.setRequestHeader.calls.all()[0].args[0]).toBe('Content-type');
                expect(XMLHttpRequest.prototype.setRequestHeader.calls.all()[0].args[1]).toBe('image/jpeg');
                expect(XMLHttpRequest.prototype.setRequestHeader.calls.all()[1].args[0]).toBe('Authorization');
                expect(XMLHttpRequest.prototype.setRequestHeader.calls.all()[1].args[1]).toBe('Basic Base64String==');
            }));
        });
    });
});
