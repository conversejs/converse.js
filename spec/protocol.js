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
    var Strophe = converse_api.env.Strophe;
    var $iq = converse_api.env.$iq;

    describe("The Protocol", $.proxy(function (mock, test_utils) {
        describe("Integration of Roster Items and Presence Subscriptions", $.proxy(function (mock, test_utils) {
            /* Some level of integration between roster items and presence
            * subscriptions is normally expected by an instant messaging user
            * regarding the user's subscriptions to and from other contacts. This
            * section describes the level of integration that MUST be supported
            * within an XMPP instant messaging applications.
            *
            * There are four primary subscription states:
            *
            * None -- the user does not have a subscription to the contact's
            *      presence information, and the contact does not have a subscription
            *      to the user's presence information
            * To -- the user has a subscription to the contact's presence
            *      information, but the contact does not have a subscription to the
            *      user's presence information
            * From -- the contact has a subscription to the user's presence
            *      information, but the user does not have a subscription to the
            *      contact's presence information
            * Both -- both the user and the contact have subscriptions to each
            *      other's presence information (i.e., the union of 'from' and 'to')
            *
            * Each of these states is reflected in the roster of both the user and
            * the contact, thus resulting in durable subscription states.
            *
            * The 'from' and 'to' addresses are OPTIONAL in roster pushes; if
            * included, their values SHOULD be the full JID of the resource for
            * that session. A client MUST acknowledge each roster push with an IQ
            * stanza of type "result".
            */
            beforeEach(function () {
                test_utils.closeAllChatBoxes();
                test_utils.removeControlBox();
                converse.roster.browserStorage._clear();
                test_utils.initConverse();
                test_utils.openControlBox();
                test_utils.openContactsPanel();
            });

            it("User Subscribes to Contact", $.proxy(function () {
                /* The process by which a user subscribes to a contact, including
                * the interaction between roster items and subscription states.
                */
                var stanzaID;
                var sentStanza;
                var panel = this.chatboxviews.get('controlbox').contactspanel;
                spyOn(panel, "addContactFromForm").andCallThrough();
                spyOn(converse.roster, "addAndSubscribe").andCallThrough();
                spyOn(converse.roster, "addContact").andCallThrough();
                spyOn(converse.roster, "sendContactAddIQ").andCallThrough();
                var sendIQ = this.connection.sendIQ;
                spyOn(this.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sentStanza = iq;
                    stanzaID = sendIQ.bind(this)(iq, callback, errback);
                });
                panel.delegateEvents(); // Rebind all events so that our spy gets called

                /* Add a new contact through the UI */
                var $form = panel.$('form.add-xmpp-contact');
                expect($form.is(":visible")).toBeFalsy();
                // Click the "Add a contact" link.
                panel.$('.toggle-xmpp-contact-form').click();
                // Check that the $form appears
                expect($form.is(":visible")).toBeTruthy();
                // Fill in the form and submit
                $form.find('input').val('contact@example.org');
                $form.submit();

                /* In preparation for being able to render the contact in the
                * user's client interface and for the server to keep track of the
                * subscription, the user's client SHOULD perform a "roster set"
                * for the new roster item.
                */
                expect(panel.addContactFromForm).toHaveBeenCalled();
                expect(converse.roster.addAndSubscribe).toHaveBeenCalled();
                expect(converse.roster.addContact).toHaveBeenCalled();
                // The form should not be visible anymore.
                expect($form.is(":visible")).toBeFalsy();

                /* This request consists of sending an IQ
                * stanza of type='set' containing a <query/> element qualified by
                * the 'jabber:iq:roster' namespace, which in turn contains an
                * <item/> element that defines the new roster item; the <item/>
                * element MUST possess a 'jid' attribute, MAY possess a 'name'
                * attribute, MUST NOT possess a 'subscription' attribute, and MAY
                * contain one or more <group/> child elements:
                *
                *   <iq type='set' id='set1'>
                *   <query xmlns='jabber:iq:roster'>
                *       <item
                *           jid='contact@example.org'
                *           name='MyContact'>
                *       <group>MyBuddies</group>
                *       </item>
                *   </query>
                *   </iq>
                */
                expect(converse.roster.sendContactAddIQ).toHaveBeenCalled();
                expect(sentStanza.toLocaleString()).toBe(
                    "<iq type='set' xmlns='jabber:client' id='"+stanzaID+"'>"+
                        "<query xmlns='jabber:iq:roster'>"+
                            "<item jid='contact@example.org' name='contact@example.org'/>"+
                        "</query>"+
                    "</iq>"
                );
                /* As a result, the user's server (1) MUST initiate a roster push
                * for the new roster item to all available resources associated
                * with this user that have requested the roster, setting the
                * 'subscription' attribute to a value of "none"; and (2) MUST
                * reply to the sending resource with an IQ result indicating the
                * success of the roster set:
                *
                * <iq type='set'>
                *     <query xmlns='jabber:iq:roster'>
                *         <item
                *             jid='contact@example.org'
                *             subscription='none'
                *             name='MyContact'>
                *         <group>MyBuddies</group>
                *         </item>
                *     </query>
                * </iq>
                */
                var contact;
                var send = converse.connection.send;
                var create = converse.roster.create;
                spyOn(converse.roster, 'create').andCallFake(function () {
                    contact = create.apply(converse.roster, arguments);
                    spyOn(contact, 'subscribe').andCallThrough();
                    spyOn(converse.connection, 'send').andCallFake(function (stanza) {
                        sentStanza = stanza;
                    });
                    return contact;
                });
                var iq = $iq({'type': 'set'}).c('query', {'xmlns': 'jabber:iq:roster'})
                    .c('item', {
                        'jid': 'contact@example.org',
                        'subscription': 'none',
                        'name': 'contact@example.org'});
                this.connection._dataRecv(test_utils.createRequest(iq));
                /* 
                 * <iq type='result' id='set1'/>
                 */
                iq = $iq({'type': 'result', 'id':stanzaID});
                this.connection._dataRecv(test_utils.createRequest(iq));

                // A contact should now have been created
                expect(this.roster.get('contact@example.org') instanceof converse.RosterContact).toBeTruthy();
                expect(contact.get('jid')).toBe('contact@example.org');

                /* To subscribe to the contact's presence information,
                 * the user's client MUST send a presence stanza of
                 * type='subscribe' to the contact:
                 *
                 *  <presence to='contact@example.org' type='subscribe'/>
                 */
                expect(contact.subscribe).toHaveBeenCalled();
                expect(sentStanza.toLocaleString()).toBe( // Strophe adds the xmlns attr (although not in spec)
                    "<presence to='contact@example.org' type='subscribe' xmlns='jabber:client'/>"
                );
            }, converse));

            it("Alternate Flow: Contact Declines Subscription Request", $.proxy(function () {
                // TODO
            }, converse));

            it("Creating a Mutual Subscription", $.proxy(function () {
                // TODO
            }, converse));

            it("Alternate Flow: User Declines Subscription Request", $.proxy(function () {
                // TODO
            }, converse));
        }, converse, mock, test_utils));
    }, converse, mock, test_utils));
}));
