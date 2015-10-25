/*global converse */
(function (root, factory) {
    define([
        "jquery",
        "underscore",
        "mock",
        "test_utils"
        ], function ($, _, mock, test_utils) {
            return factory($, _, mock, test_utils);
        }
    );
} (this, function ($, _, mock, test_utils) {
    var Strophe = converse_api.env.Strophe;
    var $iq = converse_api.env.$iq;

    describe("Profiling", function() {
        beforeEach(function() {
            test_utils.clearBrowserStorage();
            converse.rosterview.model.reset();
            converse.connection._changeConnectStatus(Strophe.Status.CONNECTED);
        });

        xit("adds hundreds of contacts to the roster", $.proxy(function() {
            converse.roster_groups = false;
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
        }, converse));

        xit("adds hundreds of contacts to the roster, with roster groups", $.proxy(function() {
            // converse.show_only_online_users = true;
            converse.roster_groups = true;
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
        }, converse));
    });
}));
