(function (root, factory) {
    define([
        "jquery",
        "mock",
        "test_utils"
        ], function ($, mock, test_utils) {
            return factory($, mock, test_utils);
        }
    );
} (this, function ($, mock, test_utils) {
    describe("Profiling", function() {
        beforeEach(function() {
            converse.connection.roster.items = [];
            converse.connection._changeConnectStatus(Strophe.Status.CONNECTED);
        });

        xit("adds hundreds of contacts to the roster", $.proxy(function() {
            converse.roster_groups = false;
            spyOn(this.roster, 'clearCache').andCallThrough();
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
            this.connection.roster._onReceiveRosterSuccess(null, stanza.tree());
            expect(this.roster.clearCache).toHaveBeenCalled();
            expect(this.roster.pluck('jid').length).toBe(400);
        }, converse));

        xit("adds hundreds of contacts to the roster, with roster groups", $.proxy(function() {
            // converse.show_only_online_users = true;
            converse.roster_groups = true;
            spyOn(this.roster, 'clearCache').andCallThrough();
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
            this.connection.roster._onReceiveRosterSuccess(null, stanza.tree());
            expect(this.roster.clearCache).toHaveBeenCalled();
            //expect(this.roster.pluck('jid').length).toBe(400);
        }, converse));

        it("contacts in a very large roster change their statuses", $.proxy(function() {
        }, converse));
    });
}));
