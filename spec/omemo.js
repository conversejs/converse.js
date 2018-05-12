(function (root, factory) {
    define(["jasmine", "mock", "converse-core", "test-utils"], factory);
} (this, function (jasmine, mock, converse, test_utils) {
    var Strophe = converse.env.Strophe;
    var b64_sha1 = converse.env.b64_sha1;
    var $iq = converse.env.$iq;
    var _ = converse.env._;

    window.libsignal = {
        'KeyHelper': {
            'generateIdentityKeyPair': function () {
                return Promise.resolve({
                    'pubKey': 1234,
                    'privKey': 4321
                });
            },
            'generateRegistrationId': function () {
                return 1234;
            }
        }
    };

    describe("The OMEMO module", function() {

        it("will add processing hints to sent out encrypted <message> stanzas",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {
            // TODO
            done();
        }));

        it("adds a toolbar button for starting an encrypted chat session",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            let devicelist_iq,
                disco_info_iq;
            test_utils.createContacts(_converse, 'current');
            const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';

            test_utils.waitUntil(function () {
                return _.filter(_converse.connection.IQ_stanzas, function (iq) {
                    const node = iq.nodeTree.querySelector('iq[to="dummy@localhost"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                    if (node) { disco_info_iq = iq; }
                    return node;
                }).length > 0;
            }, 1000).then(function () {
                /* PEP support is prerequisite for OMEMO */
                const stanza = $iq({
                    'type': 'result',
                    'from': 'dummy@localhost',
                    'to': 'dummy@localhost/resource',
                    'id': disco_info_iq.nodeTree.getAttribute('id'),
                }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info'})
                    .c('identity', {
                        'category': 'pubsub',
                        'type': 'pep'});
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                return test_utils.waitUntil(() => {
                    return _.filter(
                        _converse.connection.IQ_stanzas,
                        (iq) => {
                            const node = iq.nodeTree.querySelector('iq[to="'+_converse.bare_jid+'"] query[node="eu.siacs.conversations.axolotl.devicelist"]');
                            if (node) {
                                devicelist_iq = iq;
                            }
                            return node;
                        }).length;
                });
            }).then(function () {
                expect(devicelist_iq.toLocaleString()).toBe(
                    "<iq type='get' from='dummy@localhost' to='dummy@localhost' xmlns='jabber:client' id='"+devicelist_iq.nodeTree.getAttribute('id')+"'>"+
                        "<query xmlns='http://jabber.org/protocol/disco#items' "+
                               "node='eu.siacs.conversations.axolotl.devicelist'/>"+
                    "</iq>");
                const stanza = $iq({
                    'from': contact_jid,
                    'id': devicelist_iq.nodeTree.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result',
                }).c('query', {
                    'xmlns': 'http://jabber.org/protocol/disco#items',
                    'node': 'eu.siacs.conversations.axolotl.devicelist'
                }).c('device', {'id': '482886413b977930064a5888b92134fe'}).up()
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                expect(_converse.devicelists.length).toBe(1);
                const devicelist = _converse.devicelists.get(_converse.bare_jid);
                expect(devicelist.devices.length).toBe(1);
                expect(devicelist.devices.at(0).get('id')).toBe('482886413b977930064a5888b92134fe');

                test_utils.openChatBoxFor(_converse, contact_jid);
                return test_utils.waitUntil(() => {
                    return _.filter(
                        _converse.connection.IQ_stanzas,
                        (iq) => {
                            const node = iq.nodeTree.querySelector('iq[to="'+contact_jid+'"] query[node="eu.siacs.conversations.axolotl.devicelist"]');
                            if (node) {
                                devicelist_iq = iq;
                            }
                            return node;
                        }).length;});
            }).then(function () {
                expect(devicelist_iq.toLocaleString()).toBe(
                    "<iq type='get' from='dummy@localhost' to='"+contact_jid+"' xmlns='jabber:client' id='"+devicelist_iq.nodeTree.getAttribute('id')+"'>"+
                        "<query xmlns='http://jabber.org/protocol/disco#items' "+
                               "node='eu.siacs.conversations.axolotl.devicelist'/>"+
                    "</iq>");
                const stanza = $iq({
                    'from': contact_jid,
                    'id': devicelist_iq.nodeTree.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result',
                }).c('query', {
                    'xmlns': 'http://jabber.org/protocol/disco#items',
                    'node': 'eu.siacs.conversations.axolotl.devicelist'
                }).c('device', {'id': '368866411b877c30064a5f62b917cffe'}).up()
                  .c('device', {'id': '3300659945416e274474e469a1f0154c'}).up()
                  .c('device', {'id': '4e30f35051b7b8b42abe083742187228'}).up()
                  .c('device', {'id': 'ae890ac52d0df67ed7cfdf51b644e901'});
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                expect(_converse.devicelists.length).toBe(2);
                const devicelist = _converse.devicelists.get(contact_jid);
                expect(devicelist.devices.length).toBe(4);
                expect(devicelist.devices.at(0).get('id')).toBe('368866411b877c30064a5f62b917cffe');
                expect(devicelist.devices.at(1).get('id')).toBe('3300659945416e274474e469a1f0154c');
                expect(devicelist.devices.at(2).get('id')).toBe('4e30f35051b7b8b42abe083742187228');
                expect(devicelist.devices.at(3).get('id')).toBe('ae890ac52d0df67ed7cfdf51b644e901');
                return test_utils.waitUntil(() => _converse.chatboxviews.get(contact_jid).el.querySelector('.chat-toolbar'));
            }).then(function () {
                const view = _converse.chatboxviews.get(contact_jid);
                const toolbar = view.el.querySelector('.chat-toolbar');
                expect(_.isNull(toolbar.querySelector('.toggle-omemo'))).toBe(false);
                spyOn(view, 'toggleOMEMO').and.callThrough();
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                toolbar.querySelector('.toggle-omemo').click();
                expect(view.toggleOMEMO).toHaveBeenCalled();
                done();
            });
        }));
    });

    describe("A chatbox with an active OMEMO session", function() {

        it("will not show the spoiler toolbar button",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {
            // TODO
            done()
        }));
    });
}));
