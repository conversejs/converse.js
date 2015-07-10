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
    "use strict";
    var Strophe = converse_api.env.Strophe;
    var $iq = converse_api.env.$iq;
    var $pres = converse_api.env.$pres;
    // See:
    // https://xmpp.org/rfcs/rfc3921.html

    describe("Message Archive Management", $.proxy(function (mock, test_utils) {
        // Implement the protocol defined in https://xmpp.org/extensions/xep-0313.html#config

        describe("The default preference", $.proxy(function (mock, test_utils) {
            beforeEach(function () {
                test_utils.closeAllChatBoxes();
                test_utils.removeControlBox();
                converse.roster.browserStorage._clear();
                test_utils.initConverse();
                test_utils.openControlBox();
                test_utils.openContactsPanel();
            });

            it("is set once server support for MAM has been confirmed", function () {
                var sent_stanza, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                spyOn(converse.features, 'onMAMPreferences').andCallThrough();

                var feature = new converse.Feature({
                    'var': Strophe.NS.MAM
                });
                spyOn(feature, 'save').andCallFake(feature.set); // Save will complain about a url not being set
                converse.features.onFeatureAdded(feature);

                expect(converse.connection.sendIQ).toHaveBeenCalled();
                expect(sent_stanza.toLocaleString()).toBe(
                    "<iq type='get' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<prefs xmlns='urn:xmpp:mam:0'/>"+
                    "</iq>"
                );

                converse.message_archiving = 'never';
                /* Example 15. Server responds with current preferences
                 *
                 * <iq type='result' id='juliet2'>
                 *   <prefs xmlns='urn:xmpp:mam:0' default='roster'>
                 *     <always/>
                 *     <never/>
                 *   </prefs>
                 * </iq>
                 */
                var stanza = $iq({'type': 'result', 'id': IQ_id})
                    .c('prefs', {'xmlns': Strophe.NS.MAM, 'default':'roster'})
                    .c('always').c('jid').t('romeo@montague.lit').up().up()
                    .c('never').c('jid').t('montague@montague.lit');
                converse.connection._dataRecv(test_utils.createRequest(stanza));

                expect(converse.features.onMAMPreferences).toHaveBeenCalled();

                expect(converse.connection.sendIQ.callCount).toBe(2);
                expect(sent_stanza.toString()).toBe(
                    "<iq type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<prefs xmlns='urn:xmpp:mam:0' default='never'>"+
                            "<always><jid>romeo@montague.lit</jid></always>"+
                            "<never><jid>montague@montague.lit</jid></never>"+
                        "</prefs>"+
                    "</iq>"
                );

                expect(feature.get('preference')).toBe(undefined);
                /* <iq type='result' id='juliet3'>
                 *   <prefs xmlns='urn:xmpp:mam:0' default='always'>
                 *       <always>
                 *          <jid>romeo@montague.lit</jid>
                 *       </always>
                 *       <never>
                 *          <jid>montague@montague.lit</jid>
                 *       </never>
                 *   </prefs>
                 * </iq>
                 */
                stanza = $iq({'type': 'result', 'id': IQ_id})
                    .c('prefs', {'xmlns': Strophe.NS.MAM, 'default':'always'})
                    .c('always').up()
                    .c('never').up();
                converse.connection._dataRecv(test_utils.createRequest(stanza));
                expect(feature.save).toHaveBeenCalled();
                expect(feature.get('preferences').default).toBe('never');

                // Restore
                converse.message_archiving = 'never';
            });
        }, converse, mock, test_utils));
    }, converse, mock, test_utils));
}));
