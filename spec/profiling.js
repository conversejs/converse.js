(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    var _ = converse.env._;
    var $iq = converse.env.$iq;
    var u = converse.env.utils;

    describe("Profiling", function() {
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
