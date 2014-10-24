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
        var roster;
        beforeEach(function() {
            roster = converse.connection.roster;
            converse.connection._changeConnectStatus(Strophe.Status.CONNECTED);
        });

        it("adds contacts on presence stanza", $.proxy(function() {
            spyOn(this.roster, 'clearCache').andCallThrough();
            expect(this.roster.pluck('jid').length).toBe(0);

            var stanza = $pres({from: 'data@enterprise/resource', type: 'subscribe'});
            this.connection._dataRecv(test_utils.createRequest(stanza));
            expect(this.roster.pluck('jid').length).toBe(1);
            expect(_.contains(this.roster.pluck('jid'), 'data@enterprise')).toBeTruthy();

            // Taken from the spec
            // http://xmpp.org/rfcs/rfc3921.html#rfc.section.7.3
            stanza = $iq({
                to: this.connection.jid,
                type: 'result',
                id: 'roster_1'
            }).c('query', {
                xmlns: 'jabber:iq:roster',
            }).c('item', {
                jid: 'romeo@example.net',
                name: 'Romeo',
                subscription:'both'
            }).c('group').t('Friends').up().up()
              .c('item', {
                jid: 'mercutio@example.org',
                name: 'Mercutio',
                subscription:'from'
            }).c('group').t('Friends').up().up()
              .c('item', {
                jid: 'benvolio@example.org',
                name: 'Benvolio',
                subscription:'both'
            }).c('group').t('Friends');
            this.connection.roster._onReceiveRosterSuccess(null, stanza.tree());
            expect(this.roster.clearCache).toHaveBeenCalled();

            expect(_.contains(this.roster.pluck('jid'), 'data@enterprise')).toBeTruthy();
        }, converse));

    });

}));
