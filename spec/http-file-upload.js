(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    var Strophe = converse.env.Strophe;
    var $iq = converse.env.$iq;
    var _ = converse.env._;
    var f = converse.env.f;

    describe("XEP-0363: HTTP File Upload", function () {

        describe("Discovering support", function () {

            it("is done automatically", mock.initConverseWithAsync(function (done, _converse) {
                var IQ_stanzas = _converse.connection.IQ_stanzas;
                var IQ_ids =  _converse.connection.IQ_ids;

                test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], []).then(function () {
                    test_utils.waitUntil(function () {
                        return _.filter(IQ_stanzas, function (iq) {
                            return iq.nodeTree.querySelector(
                                'iq[to="localhost"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                        }).length > 0;
                    }, 300).then(function () {
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
                        var stanza = _.find(IQ_stanzas, function (iq) {
                            return iq.nodeTree.querySelector(
                                'iq[to="localhost"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                        });
                        var info_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];

                        stanza = $iq({
                            'type': 'result',
                            'from': 'localhost',
                            'to': 'dummy@localhost/resource',
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

                        _converse.api.disco.entities.get().then(function(entities) {
                            expect(entities.length).toBe(2);
                            expect(_.includes(entities.pluck('jid'), 'localhost')).toBe(true);
                            expect(_.includes(entities.pluck('jid'), 'dummy@localhost')).toBe(true);

                            expect(entities.get(_converse.domain).features.length).toBe(2);
                            expect(entities.get(_converse.domain).identities.length).toBe(1);

                            return test_utils.waitUntil(function () {
                                // Converse.js sees that the entity has a disco#items feature,
                                // so it will make a query for it.
                                return _.filter(IQ_stanzas, function (iq) {
                                    return iq.nodeTree.querySelector('iq[to="localhost"] query[xmlns="http://jabber.org/protocol/disco#items"]');
                                }).length > 0;
                            }, 300);
                        });
                    }).then(function () {
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
                    var stanza = _.find(IQ_stanzas, function (iq) {
                        return iq.nodeTree.querySelector('iq[to="localhost"] query[xmlns="http://jabber.org/protocol/disco#items"]');
                    });
                    var items_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                    stanza = $iq({
                        'type': 'result',
                        'from': 'localhost',
                        'to': 'dummy@localhost/resource',
                        'id': items_IQ_id
                    }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#items'})
                        .c('item', {
                            'jid': 'upload.localhost',
                            'name': 'HTTP File Upload'});
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));

                        _converse.api.disco.entities.get().then(function (entities) {
                            expect(entities.length).toBe(2);
                            expect(entities.get('localhost').items.length).toBe(1);
                            return test_utils.waitUntil(function () {
                                // Converse.js sees that the entity has a disco#info feature,
                                // so it will make a query for it.
                                return _.filter(IQ_stanzas, function (iq) {
                                    return iq.nodeTree.querySelector('iq[to="upload.localhost"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                                }).length > 0;
                            }, 300);
                        });
                    }).then(function () {
                        var stanza = _.find(IQ_stanzas, function (iq) {
                            return iq.nodeTree.querySelector('iq[to="upload.localhost"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                        });
                        var IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                        expect(stanza.toLocaleString()).toBe(
                            `<iq from="dummy@localhost/resource" id="`+IQ_id+`" to="upload.localhost" type="get" xmlns="jabber:client">`+
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
                        stanza = $iq({'type': 'result', 'to': 'dummy@localhost/resource', 'id': IQ_id, 'from': 'upload.localhost'})
                            .c('query', {'xmlns': 'http://jabber.org/protocol/disco#info'})
                                .c('identity', {'category':'store', 'type':'file', 'name':'HTTP File Upload'}).up()
                                .c('feature', {'var':'urn:xmpp:http:upload:0'}).up()
                                .c('x', {'type':'result', 'xmlns':'jabber:x:data'})
                                    .c('field', {'var':'FORM_TYPE', 'type':'hidden'})
                                        .c('value').t('urn:xmpp:http:upload:0').up().up()
                                    .c('field', {'var':'max-file-size'})
                                        .c('value').t('5242880');
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));

                        _converse.api.disco.entities.get().then(function (entities) {
                            expect(entities.get('localhost').items.get('upload.localhost').identities.where({'category': 'store'}).length).toBe(1);
                            _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain).then(
                                function (result) {
                                    expect(result.length).toBe(1);
                                    expect(result[0].get('jid')).toBe('upload.localhost');
                                    expect(result[0].dataforms.where({'FORM_TYPE': {value: "urn:xmpp:http:upload:0", type: "hidden"}}).length).toBe(1);
                                    done();
                                }
                            );
                        }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                    })
                })
            }));
        });

        describe("When not supported", function () {
            describe("A file upload toolbar button", function () {

                it("does not appear in private chats", mock.initConverseWithAsync(function (done, _converse) {
                    var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                    test_utils.createContacts(_converse, 'current');
                    test_utils.openChatBoxFor(_converse, contact_jid);

                    test_utils.waitUntilDiscoConfirmed(
                        _converse, _converse.domain,
                        [{'category': 'server', 'type':'IM'}],
                        ['http://jabber.org/protocol/disco#items'], [], 'info').then(function () {

                        test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], [], 'items').then(function () {
                            var view = _converse.chatboxviews.get(contact_jid);
                            expect(view.el.querySelector('.chat-toolbar .upload-file')).toBe(null);
                            done();
                        });
                    });
                }));

                it("does not appear in MUC chats", mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                        test_utils.waitUntilDiscoConfirmed(
                            _converse, _converse.domain,
                            [{'category': 'server', 'type':'IM'}],
                            ['http://jabber.org/protocol/disco#items'], [], 'info').then(function () {

                            test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.localhost'], 'items').then(function () {
                                test_utils.waitUntilDiscoConfirmed(_converse, 'upload.localhost', [], [Strophe.NS.HTTPUPLOAD], []).then(function () {
                                    var view = _converse.chatboxviews.get('lounge@localhost');
                                    expect(view.el.querySelector('.chat-toolbar .upload-file')).toBe(null);
                                    done();
                                });
                            });
                        });
                    });
                }));

            });
        });

        describe("When supported", function () {

            describe("A file upload toolbar button", function () {

                it("appears in private chats", mock.initConverseWithAsync(function (done, _converse) {
                    test_utils.waitUntilDiscoConfirmed(
                        _converse, _converse.domain,
                        [{'category': 'server', 'type':'IM'}],
                        ['http://jabber.org/protocol/disco#items'], [], 'info').then(function () {

                        let contact_jid, view;

                        test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.localhost'], 'items')
                        .then(() => test_utils.waitUntilDiscoConfirmed(_converse, 'upload.localhost', [], [Strophe.NS.HTTPUPLOAD], []))
                        .then(() => {
                            test_utils.createContacts(_converse, 'current', 3);
                            _converse.emit('rosterContactsFetched');

                            contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                            return test_utils.openChatBoxFor(_converse, contact_jid);
                        }).then(() => {
                            view = _converse.chatboxviews.get(contact_jid);
                            test_utils.waitUntil(() => view.el.querySelector('.upload-file'));
                        }).then(() => {
                            expect(view.el.querySelector('.chat-toolbar .upload-file')).not.toBe(null);
                            done();
                        });
                    });
                }));

                it("appears in MUC chats", mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                    test_utils.waitUntilDiscoConfirmed(
                        _converse, _converse.domain,
                        [{'category': 'server', 'type':'IM'}],
                        ['http://jabber.org/protocol/disco#items'], [], 'info').then(function () {

                        test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.localhost'], 'items')
                        .then(() => test_utils.waitUntilDiscoConfirmed(_converse, 'upload.localhost', [], [Strophe.NS.HTTPUPLOAD], []))
                        .then(() => test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy'))
                        .then(() => test_utils.waitUntil(() => _converse.chatboxviews.get('lounge@localhost').el.querySelector('.upload-file')))
                        .then(() => {
                            const view = _converse.chatboxviews.get('lounge@localhost');
                            expect(view.el.querySelector('.chat-toolbar .upload-file')).not.toBe(null);
                            done();
                        }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                    });
                }));

                describe("when clicked and a file chosen", function () {

                    it("is uploaded and sent out", mock.initConverseWithAsync(function (done, _converse) {
                        test_utils.waitUntilDiscoConfirmed(
                            _converse, _converse.domain,
                            [{'category': 'server', 'type':'IM'}],
                            ['http://jabber.org/protocol/disco#items'], [], 'info').then(function () {

                            var send_backup = XMLHttpRequest.prototype.send;
                            var IQ_stanzas = _converse.connection.IQ_stanzas;
                            let contact_jid;

                           test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.tld'], 'items')
                            .then(() => test_utils.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []))
                            .then(() => {
                                test_utils.createContacts(_converse, 'current');
                                _converse.emit('rosterContactsFetched');
                                contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                                return test_utils.openChatBoxFor(_converse, contact_jid);
                            }).then(() => {
                                var view = _converse.chatboxviews.get(contact_jid);
                                var file = {
                                    'type': 'image/jpeg',
                                    'size': '23456' ,
                                    'lastModifiedDate': "",
                                    'name': "my-juliet.jpg"
                                };
                                view.model.sendFiles([file]);
                                return test_utils.waitUntil(function () {
                                    return _.filter(IQ_stanzas, function (iq) {
                                        return iq.nodeTree.querySelector('iq[to="upload.montague.tld"] request');
                                    }).length > 0;
                                }).then(function () {
                                    var iq = IQ_stanzas.pop();
                                    expect(iq.toLocaleString()).toBe(
                                        `<iq from="dummy@localhost/resource" `+
                                            `id="${iq.nodeTree.getAttribute("id")}" `+
                                            `to="upload.montague.tld" `+
                                            `type="get" `+
                                            `xmlns="jabber:client">`+
                                        `<request `+
                                            `content-type="image/jpeg" `+
                                            `filename="my-juliet.jpg" `+
                                            `size="23456" `+
                                            `xmlns="urn:xmpp:http:upload:0"/>`+
                                        `</iq>`);

                                    var base_url = document.URL.split(window.location.pathname)[0];
                                    var message = base_url+"/logo/conversejs-filled.svg";

                                    var stanza = Strophe.xmlHtmlNode(
                                        "<iq from='upload.montague.tld'"+
                                        "    id='"+iq.nodeTree.getAttribute('id')+"'"+
                                        "    to='dummy@localhost/resource'"+
                                        "    type='result'>"+
                                        "<slot xmlns='urn:xmpp:http:upload:0'>"+
                                        "    <put url='https://upload.montague.tld/4a771ac1-f0b2-4a4a-9700-f2a26fa2bb67/my-juliet.jpg'>"+
                                        "    <header name='Authorization'>Basic Base64String==</header>"+
                                        "    <header name='Cookie'>foo=bar; user=romeo</header>"+
                                        "    </put>"+
                                        "    <get url='"+message+"' />"+
                                        "</slot>"+
                                        "</iq>").firstElementChild;

                                    spyOn(XMLHttpRequest.prototype, 'send').and.callFake(function () {
                                        const message = view.model.messages.at(0);
                                        expect(view.el.querySelector('.chat-content progress').getAttribute('value')).toBe('0');
                                        message.set('progress', 0.5);
                                        expect(view.el.querySelector('.chat-content progress').getAttribute('value')).toBe('0.5');
                                        message.set('progress', 1);
                                        expect(view.el.querySelector('.chat-content progress').getAttribute('value')).toBe('1');
                                        message.save({
                                            'upload': _converse.SUCCESS,
                                            'oob_url': message.get('get'),
                                            'message': message.get('get')
                                        });
                                    });
                                    var sent_stanza;
                                    spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                                        sent_stanza = stanza;
                                    });
                                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                                    return test_utils.waitUntil(function () {
                                        return sent_stanza;
                                    }, 1000).then(function () {
                                        expect(sent_stanza.toLocaleString()).toBe(
                                            `<message from="dummy@localhost/resource" `+
                                                `id="${sent_stanza.nodeTree.getAttribute("id")}" `+
                                                `to="irini.vlastuin@localhost" `+
                                                `type="chat" `+
                                                `xmlns="jabber:client">`+
                                                    `<body>${message}</body>`+
                                                    `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                                    `<x xmlns="jabber:x:oob">`+
                                                        `<url>${message}</url>`+
                                                    `</x>`+
                                            `</message>`);
                                        return test_utils.waitUntil(() => view.el.querySelector('.chat-image'), 1000);
                                    }).then(function () {
                                        // Check that the image renders
                                        expect(view.el.querySelector('.chat-msg .chat-msg__media').innerHTML.trim()).toEqual(
                                            `<!-- src/templates/image.html -->\n`+
                                            `<a href="${window.location.origin}/logo/conversejs-filled.svg" target="_blank" rel="noopener">`+
                                                `<img class="chat-image img-thumbnail" src="${window.location.origin}/logo/conversejs-filled.svg">`+
                                            `</a>`);
                                        XMLHttpRequest.prototype.send = send_backup;
                                        done();
                                    });
                                });
                            });
                        });
                    }));

                    it("is uploaded and sent out from a groupchat", mock.initConverseWithAsync(function (done, _converse) {
                        test_utils.waitUntilDiscoConfirmed(
                            _converse, _converse.domain,
                            [{'category': 'server', 'type':'IM'}],
                            ['http://jabber.org/protocol/disco#items'], [], 'info').then(function () {

                            var send_backup = XMLHttpRequest.prototype.send;
                            var IQ_stanzas = _converse.connection.IQ_stanzas;

                            test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.tld'], 'items').then(function () {
                                test_utils.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []).then(function () {
                                    test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                                        var view = _converse.chatboxviews.get('lounge@localhost');
                                        var file = {
                                            'type': 'image/jpeg',
                                            'size': '23456' ,
                                            'lastModifiedDate': "",
                                            'name': "my-juliet.jpg"
                                        };
                                        view.model.sendFiles([file]);

                                        return test_utils.waitUntil(function () {
                                            return _.filter(IQ_stanzas, function (iq) {
                                                return iq.nodeTree.querySelector('iq[to="upload.montague.tld"] request');
                                            }).length > 0;
                                        }).then(function () {
                                            var iq = IQ_stanzas.pop();
                                            expect(iq.toLocaleString()).toBe(
                                                `<iq from="dummy@localhost/resource" `+
                                                    `id="${iq.nodeTree.getAttribute("id")}" `+
                                                    `to="upload.montague.tld" `+
                                                    `type="get" `+
                                                    `xmlns="jabber:client">`+
                                                `<request `+
                                                    `content-type="image/jpeg" `+
                                                    `filename="my-juliet.jpg" `+
                                                    `size="23456" `+
                                                    `xmlns="urn:xmpp:http:upload:0"/>`+
                                                `</iq>`);

                                            var base_url = document.URL.split(window.location.pathname)[0];
                                            var message = base_url+"/logo/conversejs-filled.svg";

                                            var stanza = Strophe.xmlHtmlNode(
                                                "<iq from='upload.montague.tld'"+
                                                "    id='"+iq.nodeTree.getAttribute('id')+"'"+
                                                "    to='dummy@localhost/resource'"+
                                                "    type='result'>"+
                                                "<slot xmlns='urn:xmpp:http:upload:0'>"+
                                                "    <put url='https://upload.montague.tld/4a771ac1-f0b2-4a4a-9700-f2a26fa2bb67/my-juliet.jpg'>"+
                                                "    <header name='Authorization'>Basic Base64String==</header>"+
                                                "    <header name='Cookie'>foo=bar; user=romeo</header>"+
                                                "    </put>"+
                                                "    <get url='"+message+"' />"+
                                                "</slot>"+
                                                "</iq>").firstElementChild;

                                            spyOn(XMLHttpRequest.prototype, 'send').and.callFake(function () {
                                                const message = view.model.messages.at(0);
                                                expect(view.el.querySelector('.chat-content progress').getAttribute('value')).toBe('0');
                                                message.set('progress', 0.5);
                                                expect(view.el.querySelector('.chat-content progress').getAttribute('value')).toBe('0.5');
                                                message.set('progress', 1);
                                                expect(view.el.querySelector('.chat-content progress').getAttribute('value')).toBe('1');
                                                message.save({
                                                    'upload': _converse.SUCCESS,
                                                    'oob_url': message.get('get'),
                                                    'message': message.get('get')
                                                });
                                            });
                                            var sent_stanza;
                                            spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                                                sent_stanza = stanza;
                                            });
                                            _converse.connection._dataRecv(test_utils.createRequest(stanza));

                                            return test_utils.waitUntil(() => sent_stanza, 1000).then(function () {
                                                expect(sent_stanza.toLocaleString()).toBe(
                                                    `<message `+
                                                        `from="dummy@localhost/resource" `+
                                                        `id="${sent_stanza.nodeTree.getAttribute("id")}" `+
                                                        `to="lounge@localhost" `+
                                                        `type="groupchat" `+
                                                        `xmlns="jabber:client">`+
                                                            `<body>${message}</body>`+
                                                            `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                                            `<x xmlns="jabber:x:oob">`+
                                                                `<url>${message}</url>`+
                                                            `</x>`+
                                                    `</message>`);
                                                return test_utils.waitUntil(() => view.el.querySelector('.chat-image'), 1000);
                                            }).then(function () {
                                                // Check that the image renders
                                                expect(view.el.querySelector('.chat-msg .chat-msg__media').innerHTML.trim()).toEqual(
                                                    `<!-- src/templates/image.html -->\n`+
                                                    `<a href="${window.location.origin}/logo/conversejs-filled.svg" target="_blank" rel="noopener">`+
                                                        `<img class="chat-image img-thumbnail" src="${window.location.origin}/logo/conversejs-filled.svg">`+
                                                    `</a>`);
                                                XMLHttpRequest.prototype.send = send_backup;
                                                done();
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    }));

                    it("shows an error message if the file is too large", mock.initConverseWithAsync(function (done, _converse) {
                        const IQ_stanzas = _converse.connection.IQ_stanzas;
                        const IQ_ids =  _converse.connection.IQ_ids;
                        const send_backup = XMLHttpRequest.prototype.send;
                        let view, contact_jid;

                        test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [])
                        .then(() => test_utils.waitUntil(() => _.filter(
                            IQ_stanzas, (iq) => iq.nodeTree.querySelector('iq[to="localhost"] query[xmlns="http://jabber.org/protocol/disco#info"]')).length
                        )).then(() => {
                            var stanza = _.find(IQ_stanzas, function (iq) {
                                return iq.nodeTree.querySelector(
                                    'iq[to="localhost"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                            });
                            var info_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];

                            stanza = $iq({
                                'type': 'result',
                                'from': 'localhost',
                                'to': 'dummy@localhost/resource',
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
                            return _converse.api.disco.entities.get();
                        }).then(function (entities) {
                            expect(entities.length).toBe(2);
                            expect(_.includes(entities.pluck('jid'), 'localhost')).toBe(true);
                            expect(_.includes(entities.pluck('jid'), 'dummy@localhost')).toBe(true);

                            expect(entities.get(_converse.domain).features.length).toBe(2);
                            expect(entities.get(_converse.domain).identities.length).toBe(1);

                            return test_utils.waitUntil(function () {
                                // Converse.js sees that the entity has a disco#items feature,
                                // so it will make a query for it.
                                return _.filter(IQ_stanzas, function (iq) {
                                    return iq.nodeTree.querySelector('iq[to="localhost"] query[xmlns="http://jabber.org/protocol/disco#items"]');
                                }).length > 0;
                            }, 300);
                        }).then(function () {
                            var stanza = _.find(IQ_stanzas, function (iq) {
                                return iq.nodeTree.querySelector('iq[to="localhost"] query[xmlns="http://jabber.org/protocol/disco#items"]');
                            });
                            var items_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                            stanza = $iq({
                                'type': 'result',
                                'from': 'localhost',
                                'to': 'dummy@localhost/resource',
                                'id': items_IQ_id
                            }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#items'})
                                .c('item', {
                                    'jid': 'upload.localhost',
                                    'name': 'HTTP File Upload'});

                            _converse.connection._dataRecv(test_utils.createRequest(stanza));

                            _converse.api.disco.entities.get().then(function (entities) {
                                expect(entities.length).toBe(2);
                                expect(entities.get('localhost').items.length).toBe(1);
                                return test_utils.waitUntil(function () {
                                    // Converse.js sees that the entity has a disco#info feature,
                                    // so it will make a query for it.
                                    return _.filter(IQ_stanzas, function (iq) {
                                        return iq.nodeTree.querySelector('iq[to="upload.localhost"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                                    }).length > 0;
                                }, 300);
                            });
                        }).then(function () {
                            var stanza = _.find(IQ_stanzas, function (iq) {
                                return iq.nodeTree.querySelector('iq[to="upload.localhost"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                            });
                            var IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                            expect(stanza.toLocaleString()).toBe(
                                `<iq from="dummy@localhost/resource" id="${IQ_id}" to="upload.localhost" type="get" xmlns="jabber:client">`+
                                    `<query xmlns="http://jabber.org/protocol/disco#info"/>`+
                                `</iq>`);

                            // Upload service responds and reports a maximum file size of 5MiB
                            stanza = $iq({'type': 'result', 'to': 'dummy@localhost/resource', 'id': IQ_id, 'from': 'upload.localhost'})
                                .c('query', {'xmlns': 'http://jabber.org/protocol/disco#info'})
                                    .c('identity', {'category':'store', 'type':'file', 'name':'HTTP File Upload'}).up()
                                    .c('feature', {'var':'urn:xmpp:http:upload:0'}).up()
                                    .c('x', {'type':'result', 'xmlns':'jabber:x:data'})
                                        .c('field', {'var':'FORM_TYPE', 'type':'hidden'})
                                            .c('value').t('urn:xmpp:http:upload:0').up().up()
                                        .c('field', {'var':'max-file-size'})
                                            .c('value').t('5242880');
                            _converse.connection._dataRecv(test_utils.createRequest(stanza));
                            return _converse.api.disco.entities.get();
                        }).then(function (entities) {
                            expect(entities.get('localhost').items.get('upload.localhost').identities.where({'category': 'store'}).length).toBe(1);
                            return _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain);
                        }).then(function (result) {
                            test_utils.createContacts(_converse, 'current');
                            _converse.emit('rosterContactsFetched');

                            contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                            return test_utils.openChatBoxFor(_converse, contact_jid);
                        }).then(() => {
                            view = _converse.chatboxviews.get(contact_jid);
                            var file = {
                                'type': 'image/jpeg',
                                'size': '5242881',
                                'lastModifiedDate': "",
                                'name': "my-juliet.jpg"
                            };
                            view.model.sendFiles([file]);
                            return test_utils.waitUntil(() => view.el.querySelectorAll('.message').length)
                        }).then(function () {
                            const messages = view.el.querySelectorAll('.message.chat-error');
                            expect(messages.length).toBe(1);
                            expect(messages[0].textContent).toBe(
                                'The size of your file, my-juliet.jpg, exceeds the maximum allowed by your server, which is 5 MB.');
                            done();
                        }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL))
                    }));
                });
            });

            describe("While a file is being uploaded", function () {

                it("shows a progress bar", mock.initConverseWithPromises(
                            null, ['rosterGroupsFetched', 'chatBoxesFetched'], {}, function (done, _converse) {

                    test_utils.waitUntilDiscoConfirmed(
                        _converse, _converse.domain,
                        [{'category': 'server', 'type':'IM'}],
                        ['http://jabber.org/protocol/disco#items'], [], 'info').then(function () {

                        var send_backup = XMLHttpRequest.prototype.send;
                        var IQ_stanzas = _converse.connection.IQ_stanzas;
                        let view, contact_jid;

                        test_utils.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.tld'], 'items')
                        .then(() => test_utils.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []))
                        .then(() => {
                            test_utils.createContacts(_converse, 'current');
                            _converse.emit('rosterContactsFetched');

                            contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                            return test_utils.openChatBoxFor(_converse, contact_jid);
                        }).then(() => {
                            view = _converse.chatboxviews.get(contact_jid);
                            const file = {
                                'type': 'image/jpeg',
                                'size': '23456' ,
                                'lastModifiedDate': "",
                                'name': "my-juliet.jpg"
                            };
                            view.model.sendFiles([file]);
                            return test_utils.waitUntil(() => _.filter(IQ_stanzas, (iq) => iq.nodeTree.querySelector('iq[to="upload.montague.tld"] request')).length)
                        }).then(function () {
                            const iq = IQ_stanzas.pop();
                            expect(iq.toLocaleString()).toBe(
                                `<iq from="dummy@localhost/resource" `+
                                    `id="${iq.nodeTree.getAttribute("id")}" `+
                                    `to="upload.montague.tld" `+
                                    `type="get" `+
                                    `xmlns="jabber:client">`+
                                `<request `+
                                    `content-type="image/jpeg" `+
                                    `filename="my-juliet.jpg" `+
                                    `size="23456" `+
                                    `xmlns="urn:xmpp:http:upload:0"/>`+
                                `</iq>`);

                            const base_url = document.URL.split(window.location.pathname)[0];
                            const message = base_url+"/logo/conversejs-filled.svg";
                            const stanza = Strophe.xmlHtmlNode(
                                "<iq from='upload.montague.tld'"+
                                "    id='"+iq.nodeTree.getAttribute('id')+"'"+
                                "    to='dummy@localhost/resource'"+
                                "    type='result'>"+
                                "<slot xmlns='urn:xmpp:http:upload:0'>"+
                                "    <put url='https://upload.montague.tld/4a771ac1-f0b2-4a4a-9700-f2a26fa2bb67/my-juliet.jpg'>"+
                                "    <header name='Authorization'>Basic Base64String==</header>"+
                                "    <header name='Cookie'>foo=bar; user=romeo</header>"+
                                "    </put>"+
                                "    <get url='"+message+"' />"+
                                "</slot>"+
                                "</iq>").firstElementChild;
                            spyOn(XMLHttpRequest.prototype, 'send').and.callFake(function () {
                                const message = view.model.messages.at(0);
                                expect(view.el.querySelector('.chat-content progress').getAttribute('value')).toBe('0');
                                message.set('progress', 0.5);
                                expect(view.el.querySelector('.chat-content progress').getAttribute('value')).toBe('0.5');
                                message.set('progress', 1);
                                expect(view.el.querySelector('.chat-content progress').getAttribute('value')).toBe('1');
                                expect(view.el.querySelector('.chat-content .chat-msg__text').textContent).toBe('Uploading file: my-juliet.jpg, 22.91 KB');
                                done();
                            });
                            var sent_stanza;
                            spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                                sent_stanza = stanza;
                            });
                            _converse.connection._dataRecv(test_utils.createRequest(stanza));
                        });
                    });
                }));
            });
        });
    });
}));
