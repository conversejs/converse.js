/*global converse */
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

            it("Subscribe to contact, contact accepts and subscribes back", $.proxy(function () {
                /* The process by which a user subscribes to a contact, including
                * the interaction between roster items and subscription states.
                */
                var contact, stanza, sent_stanza, IQ_id;
                runs($.proxy(function () {
                    var panel = this.chatboxviews.get('controlbox').contactspanel;
                    spyOn(panel, "addContactFromForm").andCallThrough();
                    spyOn(this.roster, "addAndSubscribe").andCallThrough();
                    spyOn(this.roster, "addContact").andCallThrough();
                    spyOn(this.roster, "sendContactAddIQ").andCallThrough();
                    spyOn(this, "getVCard").andCallThrough();
                    var sendIQ = this.connection.sendIQ;
                    spyOn(this.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                        sent_stanza = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
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
                    expect(sent_stanza.toLocaleString()).toBe(
                        "<iq type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
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
                    var create = converse.roster.create;
                    spyOn(converse.connection, 'send').andCallFake(function (stanza) {
                        sent_stanza = stanza;
                    });
                    spyOn(converse.roster, 'create').andCallFake(function () {
                        contact = create.apply(converse.roster, arguments);
                        spyOn(contact, 'subscribe').andCallThrough();
                        return contact;
                    });
                    stanza = $iq({'type': 'set'}).c('query', {'xmlns': 'jabber:iq:roster'})
                        .c('item', {
                            'jid': 'contact@example.org',
                            'subscription': 'none',
                            'name': 'contact@example.org'});
                    this.connection._dataRecv(test_utils.createRequest(stanza));
                    /*
                    * <iq type='result' id='set1'/>
                    */
                    stanza = $iq({'type': 'result', 'id':IQ_id});
                    this.connection._dataRecv(test_utils.createRequest(stanza));

                    // A contact should now have been created
                    expect(this.roster.get('contact@example.org') instanceof this.RosterContact).toBeTruthy();
                    expect(contact.get('jid')).toBe('contact@example.org');
                    expect(this.getVCard).toHaveBeenCalled();

                    /* To subscribe to the contact's presence information,
                    * the user's client MUST send a presence stanza of
                    * type='subscribe' to the contact:
                    *
                    *  <presence to='contact@example.org' type='subscribe'/>
                    */
                    expect(contact.subscribe).toHaveBeenCalled();
                    expect(sent_stanza.toLocaleString()).toBe( // Strophe adds the xmlns attr (although not in spec)
                        "<presence to='contact@example.org' type='subscribe' xmlns='jabber:client'>"+
                            "<nick xmlns='http://jabber.org/protocol/nick'>Max Mustermann</nick>"+
                        "</presence>"
                    );
                    /* As a result, the user's server MUST initiate a second roster
                    * push to all of the user's available resources that have
                    * requested the roster, setting the contact to the pending
                    * sub-state of the 'none' subscription state; this pending
                    * sub-state is denoted by the inclusion of the ask='subscribe'
                    * attribute in the roster item:
                    *
                    *  <iq type='set'>
                    *    <query xmlns='jabber:iq:roster'>
                    *      <item
                    *          jid='contact@example.org'
                    *          subscription='none'
                    *          ask='subscribe'
                    *          name='MyContact'>
                    *      <group>MyBuddies</group>
                    *      </item>
                    *    </query>
                    *  </iq>
                    */
                    spyOn(converse.roster, "updateContact").andCallThrough();
                    stanza = $iq({'type': 'set', 'from': 'dummy@localhost'})
                        .c('query', {'xmlns': 'jabber:iq:roster'})
                        .c('item', {
                            'jid': 'contact@example.org',
                            'subscription': 'none',
                            'ask': 'subscribe',
                            'name': 'contact@example.org'});
                    this.connection._dataRecv(test_utils.createRequest(stanza));
                    expect(converse.roster.updateContact).toHaveBeenCalled();
                }, this));
                waits(50);
                runs($.proxy(function () {
                    // Check that the user is now properly shown as a pending
                    // contact in the roster.
                    var $header = $('a:contains("Pending contacts")');
                    expect($header.length).toBe(1);
                    expect($header.is(":visible")).toBeTruthy();
                    var $contacts = $header.parent().nextUntil('dt', 'dd');
                    expect($contacts.length).toBe(1);

                    spyOn(contact, "ackSubscribe").andCallThrough();
                    /* Here we assume the "happy path" that the contact
                     * approves the subscription request
                     *
                     *  <presence
                     *      to='user@example.com'
                     *      from='contact@example.org'
                     *      type='subscribed'/>
                     */
                    stanza = $pres({
                        'to': converse.bare_jid,
                        'from': 'contact@example.org',
                        'type': 'subscribed'
                    });
                    sent_stanza = ""; // Reset
                    this.connection._dataRecv(test_utils.createRequest(stanza));
                    /* Upon receiving the presence stanza of type "subscribed",
                     * the user SHOULD acknowledge receipt of that
                     * subscription state notification by sending a presence
                     * stanza of type "subscribe".
                     */
                    expect(contact.ackSubscribe).toHaveBeenCalled();
                    expect(sent_stanza.toLocaleString()).toBe( // Strophe adds the xmlns attr (although not in spec)
                        "<presence type='subscribe' to='contact@example.org' xmlns='jabber:client'/>"
                    );

                    /* The user's server MUST initiate a roster push to all of the user's
                     * available resources that have requested the roster,
                     * containing an updated roster item for the contact with
                     * the 'subscription' attribute set to a value of "to";
                     *
                     *  <iq type='set'>
                     *    <query xmlns='jabber:iq:roster'>
                     *      <item
                     *          jid='contact@example.org'
                     *          subscription='to'
                     *          name='MyContact'>
                     *        <group>MyBuddies</group>
                     *      </item>
                     *    </query>
                     *  </iq>
                     */
                    IQ_id = converse.connection.getUniqueId('roster');
                    stanza = $iq({'type': 'set', 'id': IQ_id})
                        .c('query', {'xmlns': 'jabber:iq:roster'})
                        .c('item', {
                            'jid': 'contact@example.org',
                            'subscription': 'to',
                            'name': 'contact@example.org'});
                    this.connection._dataRecv(test_utils.createRequest(stanza));
                    // Check that the IQ set was acknowledged.
                    expect(sent_stanza.toLocaleString()).toBe( // Strophe adds the xmlns attr (although not in spec)
                        "<iq type='result' id='"+IQ_id+"' from='dummy@localhost/resource' xmlns='jabber:client'/>"
                    );
                    expect(converse.roster.updateContact).toHaveBeenCalled();

                    // The contact should now be visible as an existing
                    // contact (but still offline).
                    $header = $('a:contains("My contacts")');
                    expect($header.length).toBe(1);
                    expect($header.is(":visible")).toBeTruthy();
                    $contacts = $header.parent().nextUntil('dt', 'dd');
                    expect($contacts.length).toBe(1);
                    // Check that it has the right classes and text
                    expect($contacts.hasClass('to')).toBeTruthy();
                    expect($contacts.hasClass('both')).toBeFalsy();
                    expect($contacts.hasClass('current-xmpp-contact')).toBeTruthy();
                    expect($contacts.text().trim()).toBe('Contact');
                    expect(contact.get('chat_status')).toBe('offline');

                    /*  <presence
                     *      from='contact@example.org/resource'
                     *      to='user@example.com/resource'/>
                     */
                    stanza = $pres({'to': converse.bare_jid, 'from': 'contact@example.org/resource'});
                    this.connection._dataRecv(test_utils.createRequest(stanza));
                    // Now the contact should also be online.
                    expect(contact.get('chat_status')).toBe('online');

                    /* Section 8.3.  Creating a Mutual Subscription
                     *
                     * If the contact wants to create a mutual subscription,
                     * the contact MUST send a subscription request to the
                     * user.
                     *
                     * <presence from='contact@example.org' to='user@example.com' type='subscribe'/>
                     */
                    spyOn(contact, 'authorize').andCallThrough();
                    spyOn(this.roster, 'handleIncomingSubscription').andCallThrough();
                    stanza = $pres({
                        'to': converse.bare_jid,
                        'from': 'contact@example.org/resource',
                        'type': 'subscribe'});
                    this.connection._dataRecv(test_utils.createRequest(stanza));
                    expect(this.roster.handleIncomingSubscription).toHaveBeenCalled();

                    /* The user's client MUST send a presence stanza of type
                     * "subscribed" to the contact in order to approve the
                     * subscription request.
                     *
                     *  <presence to='contact@example.org' type='subscribed'/>
                     */
                    expect(contact.authorize).toHaveBeenCalled();
                    expect(sent_stanza.toLocaleString()).toBe(
                        "<presence to='contact@example.org' type='subscribed' xmlns='jabber:client'/>"
                    );

                    /* As a result, the user's server MUST initiate a
                     * roster push containing a roster item for the
                     * contact with the 'subscription' attribute set to
                     * a value of "both".
                     *
                     *  <iq type='set'>
                     *    <query xmlns='jabber:iq:roster'>
                     *      <item
                     *          jid='contact@example.org'
                     *          subscription='both'
                     *          name='MyContact'>
                     *      <group>MyBuddies</group>
                     *      </item>
                     *    </query>
                     *  </iq>
                     */
                    stanza = $iq({'type': 'set'}).c('query', {'xmlns': 'jabber:iq:roster'})
                        .c('item', {
                            'jid': 'contact@example.org',
                            'subscription': 'both',
                            'name': 'contact@example.org'});
                    this.connection._dataRecv(test_utils.createRequest(stanza));
                    expect(converse.roster.updateContact).toHaveBeenCalled();

                    // The class on the contact will now have switched.
                    expect($contacts.hasClass('to')).toBeFalsy();
                    expect($contacts.hasClass('both')).toBeTruthy();
                }, this));
            }, converse));

            it("Alternate Flow: Contact Declines Subscription Request", $.proxy(function () {
                /* The process by which a user subscribes to a contact, including
                * the interaction between roster items and subscription states.
                */
                var contact, stanza, sent_stanza, sent_IQ;
                runs($.proxy(function () {
                    // Add a new roster contact via roster push
                    stanza = $iq({'type': 'set'}).c('query', {'xmlns': 'jabber:iq:roster'})
                        .c('item', {
                            'jid': 'contact@example.org',
                            'subscription': 'none',
                            'ask': 'subscribe',
                            'name': 'contact@example.org'});
                    this.connection._dataRecv(test_utils.createRequest(stanza));
                }, this));
                waits(50);
                runs($.proxy(function () {
                    // A pending contact should now exist.
                    contact = this.roster.get('contact@example.org');
                    expect(this.roster.get('contact@example.org') instanceof this.RosterContact).toBeTruthy();
                    spyOn(contact, "ackUnsubscribe").andCallThrough();

                    spyOn(converse.connection, 'send').andCallFake(function (stanza) {
                        sent_stanza = stanza;
                    });
                    spyOn(this.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                        sent_IQ = iq;
                    });
                    /* We now assume the contact declines the subscription
                     * requests.
                     *
                    /* Upon receiving the presence stanza of type "unsubscribed"
                     * addressed to the user, the user's server (1) MUST deliver
                     * that presence stanza to the user and (2) MUST initiate a
                     * roster push to all of the user's available resources that
                     * have requested the roster, containing an updated roster
                     * item for the contact with the 'subscription' attribute
                     * set to a value of "none" and with no 'ask' attribute:
                     *
                     *  <presence
                     *      from='contact@example.org'
                     *      to='user@example.com'
                     *      type='unsubscribed'/>
                     *
                     *  <iq type='set'>
                     *  <query xmlns='jabber:iq:roster'>
                     *      <item
                     *          jid='contact@example.org'
                     *          subscription='none'
                     *          name='MyContact'>
                     *      <group>MyBuddies</group>
                     *      </item>
                     *  </query>
                     *  </iq>
                     */
                    // FIXME: also add the <iq>
                    stanza = $pres({
                        'to': converse.bare_jid,
                        'from': 'contact@example.org',
                        'type': 'unsubscribed'
                    });
                    this.connection._dataRecv(test_utils.createRequest(stanza));

                    /* Upon receiving the presence stanza of type "unsubscribed",
                     * the user SHOULD acknowledge receipt of that subscription
                     * state notification through either "affirming" it by
                     * sending a presence stanza of type "unsubscribe
                     */
                    expect(contact.ackUnsubscribe).toHaveBeenCalled();
                    expect(sent_stanza.toLocaleString()).toBe(
                        "<presence type='unsubscribe' to='contact@example.org' xmlns='jabber:client'/>"
                    );

                    /* Converse.js will then also automatically remove the
                     * contact from the user's roster.
                     */
                    expect(sent_IQ.toLocaleString()).toBe(
                        "<iq type='set' xmlns='jabber:client'>"+
                            "<query xmlns='jabber:iq:roster'>"+
                                "<item jid='contact@example.org' subscription='remove'/>"+
                            "</query>"+
                        "</iq>"
                    );
                }, this));
            }, converse));

            it("Unsubscribe to a contact when subscription is mutual", function () {
                var sent_IQ, IQ_id, jid = 'annegreet.gomez@localhost';
                runs(function () {
                    test_utils.createContacts('current');
                });
                waits(50);
                runs(function () {
                    spyOn(window, 'confirm').andReturn(true);
                    // We now have a contact we want to remove
                    expect(this.roster.get(jid) instanceof this.RosterContact).toBeTruthy();

                    var sendIQ = this.connection.sendIQ;
                    spyOn(this.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                        sent_IQ = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });

                    var $header = $('a:contains("My contacts")');
                    // remove the first user
                    $($header.parent().nextUntil('dt', 'dd').find('.remove-xmpp-contact').get(0)).click();
                    expect(window.confirm).toHaveBeenCalled();

                    /* Section 8.6 Removing a Roster Item and Cancelling All
                     * Subscriptions
                     *
                     * First the user is removed from the roster
                     * Because there may be many steps involved in completely
                     * removing a roster item and cancelling subscriptions in
                     * both directions, the roster management protocol includes
                     * a "shortcut" method for doing so. The process may be
                     * initiated no matter what the current subscription state
                     * is by sending a roster set containing an item for the
                     * contact with the 'subscription' attribute set to a value
                     * of "remove":
                     *
                     * <iq type='set' id='remove1'>
                     *   <query xmlns='jabber:iq:roster'>
                     *       <item jid='contact@example.org' subscription='remove'/>
                     *   </query>
                     * </iq>
                     */
                    expect(sent_IQ.toLocaleString()).toBe(
                        "<iq type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='jabber:iq:roster'>"+
                                "<item jid='annegreet.gomez@localhost' subscription='remove'/>"+
                            "</query>"+
                        "</iq>");

                    // Receive confirmation from the contact's server
                    // <iq type='result' id='remove1'/>
                    var stanza = $iq({'type': 'result', 'id':IQ_id});
                    this.connection._dataRecv(test_utils.createRequest(stanza));
                    // Our contact has now been removed
                    expect(typeof this.roster.get(jid) === "undefined").toBeTruthy();
                }.bind(converse));
            }.bind(converse));

            it("Receiving a subscription request", function () {
                runs(function () {
                    test_utils.createContacts('current'); // Create some contacts so that we can test positioning
                });
                waits(50);
                runs(function () {
                    spyOn(converse, "emit");
                    /*
                     * <presence
                     *     from='user@example.com'
                     *     to='contact@example.org'
                     *     type='subscribe'/>
                     */
                    var stanza = $pres({
                        'to': converse.bare_jid,
                        'from': 'contact@example.org',
                        'type': 'subscribe'
                    }).c('nick', {
                        'xmlns': Strophe.NS.NICK,
                    }).t('Clint Contact');
                    this.connection._dataRecv(test_utils.createRequest(stanza));
                    expect(converse.emit).toHaveBeenCalledWith('contactRequest', jasmine.any(Object));
                    var $header = $('a:contains("Contact requests")');
                    expect($header.length).toBe(1);
                    expect($header.is(":visible")).toBeTruthy();
                    var $contacts = $header.parent().nextUntil('dt', 'dd');
                    expect($contacts.length).toBe(1);
                }.bind(converse));
            }.bind(converse));
        }, converse, mock, test_utils));
    }, converse, mock, test_utils));
}));
