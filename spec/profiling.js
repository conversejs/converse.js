(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    var _ = converse.env._;
    var $iq = converse.env.$iq;
    var $pres = converse.env.$pres;
    var u = converse.env.utils;

    describe("Profiling", function() {

        it("shows users currently present in the groupchat",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {'muc_show_join_leave': false},
                async function (done, _converse) {

            test_utils.openControlBox();
            await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit'),
                  occupants = view.el.querySelector('.occupant-list');
            _.rangeRight(3000, 0).forEach(i => {
                const name = `User ${i.toString().padStart(5, '0')}`;
                const presence = $pres({
                        'to': 'romeo@montague.lit/orchard',
                        'from': 'lounge@montague.lit/'+name
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'none',
                    jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                });
                _converse.connection._dataRecv(test_utils.createRequest(presence));

                // expect(occupants.querySelectorAll('li').length).toBe(1+i);
                // const model = view.model.occupants.where({'nick': name})[0];
                // const index = view.model.occupants.indexOf(model);
                // expect(occupants.querySelectorAll('li .occupant-nick')[index].textContent.trim()).toBe(name);
            });
            done();
        }));

        xit("adds hundreds of contacts to the roster",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

            _converse.roster_groups = false;
            test_utils.openControlBox();

            expect(_converse.roster.pluck('jid').length).toBe(0);
            var stanza = $iq({
                to: _converse.connection.jid,
                type: 'result',
                id: 'roster_1'
            }).c('query', {
                xmlns: 'jabber:iq:roster'
            });
            _.each(['Friends', 'Colleagues', 'Family', 'Acquaintances'], function (group) {
                var i;
                for (i=0; i<50; i++) {
                    stanza = stanza.c('item', {
                        jid: Math.random().toString().replace('0.', '')+'@example.net',
                        subscription:'both'
                    }).c('group').t(group).up().up();
                }
            });
            _converse.roster.onReceivedFromServer(stanza.tree());

            return test_utils.waitUntil(function () {
                var $group = _converse.rosterview.$el.find('.roster-group')
                return $group.length && u.isVisible($group[0]);
            }).then(function () {
                var count = 0;
                _converse.roster.each(function (contact) {
                    if (count < 10) {
                        contact.set('chat_status', 'online');
                        count += 1;
                    }
                });
                return test_utils.waitUntil(function () {
                    return _converse.rosterview.$el.find('li.online').length
                })
            }).then(done);
        }));

        xit("adds hundreds of contacts to the roster, with roster groups",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

            // _converse.show_only_online_users = true;
            _converse.roster_groups = true;
            test_utils.openControlBox();

            expect(_converse.roster.pluck('jid').length).toBe(0);
            var stanza = $iq({
                to: _converse.connection.jid,
                type: 'result',
                id: 'roster_1'
            }).c('query', {
                xmlns: 'jabber:iq:roster'
            });
            _.each(['Friends', 'Colleagues', 'Family', 'Acquaintances'], function (group) {
                var i;
                for (i=0; i<100; i++) {
                    stanza = stanza.c('item', {
                        jid: Math.random().toString().replace('0.', '')+'@example.net',
                        subscription:'both'
                    }).c('group').t(group).up().up();
                }
            });
            _converse.roster.onReceivedFromServer(stanza.tree());

            return test_utils.waitUntil(function () {
                var $group = _converse.rosterview.$el.find('.roster-group')
                return $group.length && u.isVisible($group[0]);
            }).then(function () {
                _.each(['Friends', 'Colleagues', 'Family', 'Acquaintances'], function (group) {
                    var count = 0;
                    _converse.roster.each(function (contact) {
                        if (_.includes(contact.get('groups'), group)) {
                            if (count < 10) {
                                contact.set('chat_status', 'online');
                                count += 1;
                            }
                        }
                    });
                });
                return test_utils.waitUntil(function () {
                    return _converse.rosterview.$el.find('li.online').length
                })
            }).then(done);
        }));
    });
}));
