(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const Strophe = converse.env.Strophe;
    const $iq = converse.env.$iq;
    const _ = converse.env._;
    const sizzle = converse.env.sizzle;
    const u = converse.env.utils;

    describe("XEP-0363: HTTP File Upload", function () {

        describe("Discovering support", function () {

            it("is done automatically", mock.initConverse(async (done, _converse) => {
                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const IQ_ids =  _converse.connection.IQ_ids;
                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], []);
                await u.waitUntil(() => _.filter(
                    IQ_stanzas,
                    iq => iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]')).length
                );

                /* <iq type='result'
                 *      from='plays.shakespeare.lit'
                 *      to='romeo@montague.net/orchard'
                 *      id='info1'>
                 *  <query xmlns='http://jabber.org/protocol/disco#info'>
                 *      <identity
                 *          category='server'
                 *          type='im'/>
                 *      <feature var='http://jabber.org/protocol/disco#info'/>
                 *      <feature var='http://jabber.org/protocol/disco#items'/>
                 *  </query>
                 *  </iq>
                 */
                let stanza = _.find(IQ_stanzas, function (iq) {
                    return iq.querySelector(
                        'iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                });
                const info_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                stanza = $iq({
                    'type': 'result',
                    'from': 'montague.lit',
                    'to': 'romeo@montague.lit/orchard',
                    'id': info_IQ_id
                }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info'})
                    .c('identity', {
                        'category': 'server',
                        'type': 'im'}).up()
                    .c('feature', {
                        'var': 'http://jabber.org/protocol/disco#info'}).up()
                    .c('feature', {
                        'var': 'http://jabber.org/protocol/disco#items'});
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                let entities = await _converse.api.disco.entities.get();
                expect(entities.length).toBe(2);
                expect(_.includes(entities.pluck('jid'), 'montague.lit')).toBe(true);
                expect(_.includes(entities.pluck('jid'), 'romeo@montague.lit')).toBe(true);

                expect(entities.get(_converse.domain).features.length).toBe(2);
                expect(entities.get(_converse.domain).identities.length).toBe(1);

                // Converse.js sees that the entity has a disco#items feature,
                // so it will make a query for it.
                await u.waitUntil(() => _.filter(
                        IQ_stanzas,
                        iq => iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]')
                    ).length
                );
                /* <iq from='montague.tld'
                 *      id='step_01'
                 *      to='romeo@montague.tld/garden'
                 *      type='result'>
                 *  <query xmlns='http://jabber.org/protocol/disco#items'>
                 *      <item jid='upload.montague.tld' name='HTTP File Upload' />
                 *      <item jid='conference.montague.tld' name='Chatroom Service' />
                 *  </query>
                 *  </iq>
                 */
                stanza = _.find(IQ_stanzas, function (iq) {
                    return iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]');
                });
                const items_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                stanza = $iq({
                    'type': 'result',
                    'from': 'montague.lit',
                    'to': 'romeo@montague.lit/orchard',
                    'id': items_IQ_id
                }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#items'})
                    .c('item', {
                        'jid': 'upload.montague.lit',
                        'name': 'HTTP File Upload'});

                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                _converse.api.disco.entities.get().then(function (entities) {
                    expect(entities.length).toBe(2);
                    expect(entities.get('montague.lit').items.length).toBe(1);
                    return u.waitUntil(function () {
                        // Converse.js sees that the entity has a disco#info feature,
                        // so it will make a query for it.
                        return _.filter(IQ_stanzas, function (iq) {
                            return iq.querySelector('iq[to="upload.montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                        }).length > 0;
                    }, 300);
                });

                stanza = await u.waitUntil(() =>
                    _.filter(
                        IQ_stanzas,
                        iq => iq.querySelector('iq[to="upload.montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]')
                    ).pop()
                );
                const IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];

                expect(Strophe.serialize(stanza)).toBe(
                    `<iq from="romeo@montague.lit/orchard" id="`+IQ_id+`" to="upload.montague.lit" type="get" xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/disco#info"/>`+
                    `</iq>`);

                // Upload service responds and reports a maximum file size of 5MiB
                /* <iq from='upload.montague.tld'
                 *     id='step_02'
                 *     to='romeo@montague.tld/garden'
                 *     type='result'>
                 * <query xmlns='http://jabber.org/protocol/disco#info'>
                 *     <identity category='store'
                 *             type='file'
                 *             name='HTTP File Upload' />
                 *     <feature var='urn:xmpp:http:upload:0' />
                 *     <x type='result' xmlns='jabber:x:data'>
                 *     <field var='FORM_TYPE' type='hidden'>
                 *         <value>urn:xmpp:http:upload:0</value>
                 *     </field>
                 *     <field var='max-file-size'>
                 *         <value>5242880</value>
                 *     </field>
                 *     </x>
                 * </query>
                 * </iq>
                 */
                stanza = $iq({'type': 'result', 'to': 'romeo@montague.lit/orchard', 'id': IQ_id, 'from': 'upload.montague.lit'})
                    .c('query', {'xmlns': 'http://jabber.org/protocol/disco#info'})
                        .c('identity', {'category':'store', 'type':'file', 'name':'HTTP File Upload'}).up()
                        .c('feature', {'var':'urn:xmpp:http:upload:0'}).up()
                        .c('x', {'type':'result', 'xmlns':'jabber:x:data'})
                            .c('field', {'var':'FORM_TYPE', 'type':'hidden'})
                                .c('value').t('urn:xmpp:http:upload:0').up().up()
                            .c('field', {'var':'max-file-size'})
                                .c('value').t('5242880');
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                entities = await _converse.api.disco.entities.get();
                expect(entities.get('montague.lit').items.get('upload.montague.lit').identities.where({'category': 'store'}).length).toBe(1);
                const supported = await _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain);
                expect(supported).toBe(true);
                const features = await _converse.api.disco.features.get(Strophe.NS.HTTPUPLOAD, _converse.domain);
                expect(features.length).toBe(1);
                expect(features[0].get('jid')).toBe('upload.montague.lit');
                expect(features[0].dataforms.where({'FORM_TYPE': {value: "urn:xmpp:http:upload:0", type: "hidden"}}).length).toBe(1);
                done();
            }));
        });

        describe("When not supported", function () {
            describe("A file upload toolbar button", function () {

                it("does not appear in private chats",
                        mock.initConverse([], {}, async function (done, _converse) {

                    await test_utils.waitForRoster(_converse, 'current', 3);
                    test_utils.openControlBox(_converse);
                    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await test_utils.openChatBoxFor(_converse, contact_jid);
                    await test_utils.waitUntilDiscoConfirmed(
                        _converse, _converse.domain,
                        [{'category': 'server', 'type':'IM'}],
                        ['http://jabber.org/protocol/disco#items'], [], 'info');

                    await test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], [], 'items');
                    const view = _converse.chatboxviews.get(contact_jid);
                    expect(view.el.querySelector('.chat-toolbar .upload-file')).toBe(null);
                    done();
                }));

                it("does not appear in MUC chats", mock.initConverse(
                        ['rosterGroupsFetched'], {},
                        async (done, _converse) => {

                    await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                    test_utils.waitUntilDiscoConfirmed(
                        _converse, _converse.domain,
                        [{'category': 'server', 'type':'IM'}],
                        ['http://jabber.org/protocol/disco#items'], [], 'info');

                    await test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.lit'], 'items');
                    await test_utils.waitUntilDiscoConfirmed(_converse, 'upload.montague.lit', [], [Strophe.NS.HTTPUPLOAD], []);
                    const view = _converse.chatboxviews.get('lounge@montague.lit');
                    expect(view.el.querySelector('.chat-toolbar .upload-file')).toBe(null);
                    done();
                }));

            });
        });

        describe("When supported", function () {

            describe("A file upload toolbar button", function () {

                it("appears in private chats", mock.initConverse(async (done, _converse) => {
                    await test_utils.waitUntilDiscoConfirmed(
                        _converse, _converse.domain,
                        [{'category': 'server', 'type':'IM'}],
                        ['http://jabber.org/protocol/disco#items'], [], 'info');

                    await test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.lit'], 'items')
                    await test_utils.waitUntilDiscoConfirmed(_converse, 'upload.montague.lit', [], [Strophe.NS.HTTPUPLOAD], []);
                    await test_utils.waitForRoster(_converse, 'current', 3);
                    const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await test_utils.openChatBoxFor(_converse, contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);
                    u.waitUntil(() => view.el.querySelector('.upload-file'));
                    expect(view.el.querySelector('.chat-toolbar .upload-file')).not.toBe(null);
                    done();
                }));

                it("appears in MUC chats", mock.initConverse(
                        ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        async (done, _converse) => {

                    await test_utils.waitUntilDiscoConfirmed(
                        _converse, _converse.domain,
                        [{'category': 'server', 'type':'IM'}],
                        ['http://jabber.org/protocol/disco#items'], [], 'info');

                    await test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.lit'], 'items');
                    await test_utils.waitUntilDiscoConfirmed(_converse, 'upload.montague.lit', [], [Strophe.NS.HTTPUPLOAD], []);
                    await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
                    await u.waitUntil(() => _converse.chatboxviews.get('lounge@montague.lit').el.querySelector('.upload-file'));
                    const view = _converse.chatboxviews.get('lounge@montague.lit');
                    expect(view.el.querySelector('.chat-toolbar .upload-file')).not.toBe(null);
                    done();
                }));

                describe("when clicked and a file chosen", function () {

                    it("is uploaded and sent out", mock.initConverse(async (done, _converse) => {
                        const base_url = 'https://conversejs.org';
                        await test_utils.waitUntilDiscoConfirmed(
                            _converse, _converse.domain,
                            [{'category': 'server', 'type':'IM'}],
                            ['http://jabber.org/protocol/disco#items'], [], 'info');

                        const send_backup = XMLHttpRequest.prototype.send;
                        const IQ_stanzas = _converse.connection.IQ_stanzas;

                        await test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.tld'], 'items');
                        await test_utils.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []);
                        await test_utils.waitForRoster(_converse, 'current');
                        const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        await test_utils.openChatBoxFor(_converse, contact_jid);
                        const view = _converse.chatboxviews.get(contact_jid);
                        const file = {
                            'type': 'image/jpeg',
                            'size': '23456' ,
                            'lastModifiedDate': "",
                            'name': "my-juliet.jpg"
                        };
                        view.model.sendFiles([file]);
                        await new Promise(resolve => view.model.messages.once('rendered', resolve));

                        await u.waitUntil(() => _.filter(IQ_stanzas, iq => iq.querySelector('iq[to="upload.montague.tld"] request')).length);
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
                            <iq from="upload.montague.tld"
                                id="${iq.getAttribute("id")}"
                                to="romeo@montague.lit/orchard"
                                type="result">
                            <slot xmlns="urn:xmpp:http:upload:0">
                                <put url="https://upload.montague.tld/4a771ac1-f0b2-4a4a-9700-f2a26fa2bb67/my-juliet.jpg">
                                <header name="Authorization">Basic Base64String==</header>
                                <header name="Cookie">foo=bar; user=romeo</header>
                                </put>
                                <get url="${message}" />
                            </slot>
                            </iq>`);

                        spyOn(XMLHttpRequest.prototype, 'send').and.callFake(function () {
                            const message = view.model.messages.at(0);
                            expect(view.el.querySelector('.chat-content progress').getAttribute('value')).toBe('0');
                            message.set('progress', 0.5);
                            u.waitUntil(() => view.el.querySelector('.chat-content progress').getAttribute('value') === '0.5')
                            .then(() => {
                                message.set('progress', 1);
                                u.waitUntil(() => view.el.querySelector('.chat-content progress').getAttribute('value') === '1')
                            }).then(() => {
                                message.save({
                                    'upload': _converse.SUCCESS,
                                    'oob_url': message.get('get'),
                                    'message': message.get('get')
                                });
                                return new Promise(resolve => view.model.messages.once('rendered', resolve));
                            });
                        });
                        let sent_stanza;
                        spyOn(_converse.connection, 'send').and.callFake(stanza => (sent_stanza = stanza));
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));

                        await u.waitUntil(() => sent_stanza, 1000);
                        expect(sent_stanza.toLocaleString()).toBe(
                            `<message from="romeo@montague.lit/orchard" `+
                                `id="${sent_stanza.nodeTree.getAttribute("id")}" `+
                                `to="lady.montague@montague.lit" `+
                                `type="chat" `+
                                `xmlns="jabber:client">`+
                                    `<body>${message}</body>`+
                                    `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                    `<request xmlns="urn:xmpp:receipts"/>`+
                                    `<x xmlns="jabber:x:oob">`+
                                        `<url>${message}</url>`+
                                    `</x>`+
                                    `<origin-id id="${sent_stanza.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                            `</message>`);
                        await u.waitUntil(() => view.el.querySelector('.chat-image'), 1000);
                        // Check that the image renders
                        expect(view.el.querySelector('.chat-msg .chat-msg__media').innerHTML.trim()).toEqual(
                            `<!-- src/templates/image.html -->\n`+
                            `<a href="${base_url}/logo/conversejs-filled.svg" target="_blank" rel="noopener">`+
                                `<img class="chat-image img-thumbnail" src="${base_url}/logo/conversejs-filled.svg">`+
                            `</a>`);
                        XMLHttpRequest.prototype.send = send_backup;
                        done();
                    }));

                    it("is uploaded and sent out from a groupchat", mock.initConverse(async (done, _converse) => {

                        const base_url = 'https://conversejs.org';
                        await test_utils.waitUntilDiscoConfirmed(
                            _converse, _converse.domain,
                            [{'category': 'server', 'type':'IM'}],
                            ['http://jabber.org/protocol/disco#items'], [], 'info');

                        const send_backup = XMLHttpRequest.prototype.send;
                        const IQ_stanzas = _converse.connection.IQ_stanzas;

                        await test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.tld'], 'items');
                        await test_utils.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []);
                        await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');

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
                        await new Promise(resolve => view.model.messages.once('rendered', resolve));

                        await u.waitUntil(() => _.filter(IQ_stanzas, iq => iq.querySelector('iq[to="upload.montague.tld"] request')).length);
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

                        spyOn(XMLHttpRequest.prototype, 'send').and.callFake(function () {
                            const message = view.model.messages.at(0);
                            expect(view.el.querySelector('.chat-content progress').getAttribute('value')).toBe('0');
                            message.set('progress', 0.5);
                            u.waitUntil(() => view.el.querySelector('.chat-content progress').getAttribute('value') === '0.5')
                            .then(() => {
                                message.set('progress', 1);
                                u.waitUntil(() => view.el.querySelector('.chat-content progress').getAttribute('value') === '1')
                            }).then(() => {
                                message.save({
                                    'upload': _converse.SUCCESS,
                                    'oob_url': message.get('get'),
                                    'message': message.get('get')
                                });
                                return new Promise(resolve => view.model.messages.once('rendered', resolve));
                            });
                        });
                        let sent_stanza;
                        spyOn(_converse.connection, 'send').and.callFake(stanza => (sent_stanza = stanza));
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));

                        await u.waitUntil(() => sent_stanza, 1000);
                        expect(sent_stanza.toLocaleString()).toBe(
                            `<message `+
                                `from="romeo@montague.lit/orchard" `+
                                `id="${sent_stanza.nodeTree.getAttribute("id")}" `+
                                `to="lounge@montague.lit" `+
                                `type="groupchat" `+
                                `xmlns="jabber:client">`+
                                    `<body>${message}</body>`+
                                    `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                    `<x xmlns="jabber:x:oob">`+
                                        `<url>${message}</url>`+
                                    `</x>`+
                                    `<origin-id id="${sent_stanza.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                            `</message>`);
                        await u.waitUntil(() => view.el.querySelector('.chat-image'), 1000);
                        // Check that the image renders
                        expect(view.el.querySelector('.chat-msg .chat-msg__media').innerHTML.trim()).toEqual(
                            `<!-- src/templates/image.html -->\n`+
                            `<a href="${base_url}/logo/conversejs-filled.svg" target="_blank" rel="noopener">`+
                                `<img class="chat-image img-thumbnail" src="${base_url}/logo/conversejs-filled.svg">`+
                            `</a>`);
                        XMLHttpRequest.prototype.send = send_backup;
                        done();
                    }));

                    it("shows an error message if the file is too large",
                            mock.initConverse([], {}, async function (done, _converse) {

                        const IQ_stanzas = _converse.connection.IQ_stanzas;
                        const IQ_ids =  _converse.connection.IQ_ids;

                        await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], []);
                        await u.waitUntil(() => _.filter(
                            IQ_stanzas,
                            iq => iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]')).length
                        );

                        let stanza = _.find(IQ_stanzas, function (iq) {
                            return iq.querySelector(
                                'iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                        });
                        const info_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                        stanza = $iq({
                            'type': 'result',
                            'from': 'montague.lit',
                            'to': 'romeo@montague.lit/orchard',
                            'id': info_IQ_id
                        }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info'})
                            .c('identity', {
                                'category': 'server',
                                'type': 'im'}).up()
                            .c('feature', {
                                'var': 'http://jabber.org/protocol/disco#info'}).up()
                            .c('feature', {
                                'var': 'http://jabber.org/protocol/disco#items'});
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));
                        let entities = await _converse.api.disco.entities.get();

                        expect(entities.length).toBe(2);
                        expect(_.includes(entities.pluck('jid'), 'montague.lit')).toBe(true);
                        expect(_.includes(entities.pluck('jid'), 'romeo@montague.lit')).toBe(true);

                        expect(entities.get(_converse.domain).features.length).toBe(2);
                        expect(entities.get(_converse.domain).identities.length).toBe(1);

                        await u.waitUntil(function () {
                            // Converse.js sees that the entity has a disco#items feature,
                            // so it will make a query for it.
                            return _.filter(IQ_stanzas, function (iq) {
                                return iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]');
                            }).length > 0;
                        }, 300);

                        stanza = _.find(IQ_stanzas, function (iq) {
                            return iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]');
                        });
                        var items_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                        stanza = $iq({
                            'type': 'result',
                            'from': 'montague.lit',
                            'to': 'romeo@montague.lit/orchard',
                            'id': items_IQ_id
                        }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#items'})
                            .c('item', {
                                'jid': 'upload.montague.lit',
                                'name': 'HTTP File Upload'});

                        _converse.connection._dataRecv(test_utils.createRequest(stanza));

                        entities = await _converse.api.disco.entities.get()

                        expect(entities.length).toBe(2);
                        expect(entities.get('montague.lit').items.length).toBe(1);
                        await u.waitUntil(function () {
                            // Converse.js sees that the entity has a disco#info feature,
                            // so it will make a query for it.
                            return _.filter(IQ_stanzas, function (iq) {
                                return iq.querySelector('iq[to="upload.montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                            }).length > 0;
                        }, 300);

                        stanza = _.find(IQ_stanzas, iq => iq.querySelector('iq[to="upload.montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]'));
                        const IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                        expect(Strophe.serialize(stanza)).toBe(
                            `<iq from="romeo@montague.lit/orchard" id="${IQ_id}" to="upload.montague.lit" type="get" xmlns="jabber:client">`+
                                `<query xmlns="http://jabber.org/protocol/disco#info"/>`+
                            `</iq>`);

                        // Upload service responds and reports a maximum file size of 5MiB
                        stanza = $iq({'type': 'result', 'to': 'romeo@montague.lit/orchard', 'id': IQ_id, 'from': 'upload.montague.lit'})
                            .c('query', {'xmlns': 'http://jabber.org/protocol/disco#info'})
                                .c('identity', {'category':'store', 'type':'file', 'name':'HTTP File Upload'}).up()
                                .c('feature', {'var':'urn:xmpp:http:upload:0'}).up()
                                .c('x', {'type':'result', 'xmlns':'jabber:x:data'})
                                    .c('field', {'var':'FORM_TYPE', 'type':'hidden'})
                                        .c('value').t('urn:xmpp:http:upload:0').up().up()
                                    .c('field', {'var':'max-file-size'})
                                        .c('value').t('5242880');
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));
                        entities = await _converse.api.disco.entities.get();
                        expect(entities.get('montague.lit').items.get('upload.montague.lit').identities.where({'category': 'store'}).length).toBe(1);
                        await _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain);
                        await test_utils.waitForRoster(_converse, 'current');

                        const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        await test_utils.openChatBoxFor(_converse, contact_jid);
                        const view = _converse.chatboxviews.get(contact_jid);
                        var file = {
                            'type': 'image/jpeg',
                            'size': '5242881',
                            'lastModifiedDate': "",
                            'name': "my-juliet.jpg"
                        };
                        view.model.sendFiles([file]);
                        await u.waitUntil(() => view.el.querySelectorAll('.message').length)
                        const messages = view.el.querySelectorAll('.message.chat-error');
                        expect(messages.length).toBe(1);
                        expect(messages[0].textContent.trim()).toBe(
                            'The size of your file, my-juliet.jpg, exceeds the maximum allowed by your server, which is 5 MB.');
                        done();
                    }));
                });
            });

            describe("While a file is being uploaded", function () {

                it("shows a progress bar", mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                    await test_utils.waitUntilDiscoConfirmed(
                        _converse, _converse.domain,
                        [{'category': 'server', 'type':'IM'}],
                        ['http://jabber.org/protocol/disco#items'], [], 'info');

                    const IQ_stanzas = _converse.connection.IQ_stanzas;

                    await test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.tld'], 'items');
                    await test_utils.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []);
                    await test_utils.waitForRoster(_converse, 'current');
                    const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await test_utils.openChatBoxFor(_converse, contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);
                    const file = {
                        'type': 'image/jpeg',
                        'size': '23456' ,
                        'lastModifiedDate': "",
                        'name': "my-juliet.jpg"
                    };
                    view.model.sendFiles([file]);
                    await new Promise(resolve => view.model.messages.once('rendered', resolve));
                    await u.waitUntil(() => _.filter(IQ_stanzas, iq => iq.querySelector('iq[to="upload.montague.tld"] request')).length)
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
                    const stanza = u.toStanza(`
                        <iq from="upload.montague.tld"
                            id="${iq.getAttribute("id")}"
                            to="romeo@montague.lit/orchard"
                            type="result">
                        <slot xmlns="urn:xmpp:http:upload:0">
                            <put url="https://upload.montague.tld/4a771ac1-f0b2-4a4a-9700-f2a26fa2bb67/my-juliet.jpg">
                                <header name="Authorization">Basic Base64String==</header>
                                <header name="Cookie">foo=bar; user=romeo</header>
                            </put>
                            <get url="${message}" />
                        </slot>
                        </iq>`);
                    spyOn(XMLHttpRequest.prototype, 'send').and.callFake(function () {
                        const message = view.model.messages.at(0);
                        expect(view.el.querySelector('.chat-content progress').getAttribute('value')).toBe('0');
                        message.set('progress', 0.5);
                        u.waitUntil(() => view.el.querySelector('.chat-content progress').getAttribute('value') === '0.5')
                        .then(() => {
                            message.set('progress', 1);
                            u.waitUntil(() => view.el.querySelector('.chat-content progress').getAttribute('value') === '1')
                        }).then(() => {
                            expect(view.el.querySelector('.chat-content .chat-msg__text').textContent).toBe('Uploading file: my-juliet.jpg, 22.91 KB');
                            done();
                        });
                    });
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                }));
            });
        });
    });
}));
