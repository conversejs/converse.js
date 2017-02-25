(function (root, factory) {
    define(["mock", "converse-core", "test_utils"], factory);
} (this, function (mock, converse, test_utils) {
    var _ = converse.env._;
    var $iq = converse.env.$iq;

    describe("Profiling", function() {
        afterEach(function () {
            converse.user.logout();
            test_utils.clearBrowserStorage();
        });

        xit("adds hundreds of contacts to the roster", mock.initConverse(function(_converse) {
            _converse.roster_groups = false;
            expect(this.roster.pluck('jid').length).toBe(0);
            var stanza = $iq({
                to: this.connection.jid,
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
            this.roster.onReceivedFromServer(stanza.tree());
            // expect(this.roster.pluck('jid').length).toBe(400);
        }));

        xit("adds hundreds of contacts to the roster, with roster groups", mock.initConverse(function(_converse) {
            // _converse.show_only_online_users = true;
            _converse.roster_groups = true;
            expect(this.roster.pluck('jid').length).toBe(0);
            var stanza = $iq({
                to: this.connection.jid,
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
            this.roster.onReceivedFromServer(stanza.tree());
            //expect(this.roster.pluck('jid').length).toBe(400);
        }));
    });
}));
