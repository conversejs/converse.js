/*global mock, converse */

// See: https://xmpp.org/rfcs/rfc3921.html

const Strophe = converse.env.Strophe;

describe("The Protocol", function () {

    describe("Integration of Roster Items and Presence Subscriptions", function () {
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
        it("Subscribe to contact, contact accepts and subscribes back",
                mock.initConverse([], { roster_groups: false }, async function (_converse) {

            const { u, $iq, $pres, sizzle, Strophe } = converse.env;
            let stanza;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], ['vcard-temp']);
            await u.waitUntil(() => _converse.xmppstatus.vcard.get('fullname'), 300);
            /* The process by which a user subscribes to a contact, including
             * the interaction between roster items and subscription states.
             */
            mock.openControlBox(_converse);
            const cbview = _converse.chatboxviews.get('controlbox');

            spyOn(_converse.roster, "addAndSubscribe").and.callThrough();
            spyOn(_converse.roster, "addContactToRoster").and.callThrough();
            spyOn(_converse.roster, "sendContactAddIQ").and.callThrough();
            spyOn(_converse.api.vcard, "get").and.callThrough();

            cbview.querySelector('.add-contact').click()
            const modal = _converse.api.modal.get('converse-add-contact-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);
            modal.delegateEvents();

            // Fill in the form and submit
            const form = modal.querySelector('form.add-xmpp-contact');
            form.querySelector('input[name="jid"]').value = 'contact@example.org';
            form.querySelector('input[name="name"]').value = 'Chris Contact';
            form.querySelector('input[name="group"]').value = 'My Buddies';
            form.querySelector('[type="submit"]').click();

            /* In preparation for being able to render the contact in the
             * user's client interface and for the server to keep track of the
             * subscription, the user's client SHOULD perform a "roster set"
             * for the new roster item.
             */
            expect(_converse.roster.addAndSubscribe).toHaveBeenCalled();
            expect(_converse.roster.addContactToRoster).toHaveBeenCalled();

            /* The request consists of sending an IQ
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
            await mock.waitForRoster(_converse, 'all', 0);
            expect(_converse.roster.sendContactAddIQ).toHaveBeenCalled();

            const IQ_stanzas = _converse.connection.IQ_stanzas;
            const roster_set_stanza = IQ_stanzas.filter(s => sizzle('query[xmlns="jabber:iq:roster"]', s)).pop();

            expect(Strophe.serialize(roster_set_stanza)).toBe(
                `<iq id="${roster_set_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                    `<query xmlns="jabber:iq:roster">`+
                        `<item jid="contact@example.org" name="Chris Contact">`+
                            `<group>My Buddies</group>`+
                        `</item>`+
                    `</query>`+
                `</iq>`
            );

            const sent_stanzas = [];
            let sent_stanza;
            spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                sent_stanza = stanza;
                sent_stanzas.push(stanza);
            });

            /* As a result, the user's server (1) MUST initiate a roster push
             * for the new roster item to all available resources associated
             * with the user that have requested the roster, setting the
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
            _converse.connection._dataRecv(mock.createRequest(
                $iq({'type': 'set'})
                    .c('query', {'xmlns': 'jabber:iq:roster'})
                        .c('item', {
                            'jid': 'contact@example.org',
                            'subscription': 'none',
                            'name': 'Chris Contact'
                        }).c('group').t('My Buddies')
            ));

            _converse.connection._dataRecv(mock.createRequest(
                $iq({'type': 'result', 'id': roster_set_stanza.getAttribute('id')})
            ));

            await u.waitUntil(() => _converse.roster.length === 1);

            // A contact should now have been created
            const contact = _converse.roster.at(0);
            expect(contact.get('jid')).toBe('contact@example.org');
            expect(contact.get('nickname')).toBe('Chris Contact');
            expect(contact.get('groups')).toEqual(['My Buddies']);
            await u.waitUntil(() => contact.initialized);

            /* To subscribe to the contact's presence information,
             * the user's client MUST send a presence stanza of
             * type='subscribe' to the contact:
             *
             *  <presence to='contact@example.org' type='subscribe'/>
             */
            const sent_presence = await u.waitUntil(() => sent_stanzas.filter(s => s.matches('presence')).pop());
            expect(Strophe.serialize(sent_presence)).toBe(
                `<presence to="contact@example.org" type="subscribe" xmlns="jabber:client">`+
                    `<nick xmlns="http://jabber.org/protocol/nick">Romeo Montague</nick>`+
                `</presence>`
            );

            /* As a result, the user's server MUST initiate a second roster
             * push to all of the user's available resources that have
             * requested the roster, setting the contact to the pending
             * sub-state of the 'none' subscription state; The pending
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
            _converse.connection._dataRecv(mock.createRequest(
                $iq({'type': 'set', 'from': _converse.bare_jid})
                    .c('query', {'xmlns': 'jabber:iq:roster'})
                        .c('item', {
                            'jid': 'contact@example.org',
                            'subscription': 'none',
                            'ask': 'subscribe',
                            'name': 'Chris Contact'
                        }).c('group').t('My Buddies')
            ));

            const rosterview = document.querySelector('converse-roster');

            // Check that the user is now properly shown as a pending contact in the roster.
            await u.waitUntil(() => {
                const header = sizzle('a:contains("Pending contacts")', rosterview).pop();
                const contacts = Array.from(header?.parentElement.querySelectorAll('li') ?? []).filter(u.isVisible);
                return contacts.length;
            }, 600);

            let header = sizzle('a:contains("Pending contacts")', rosterview).pop();
            let contacts = header.parentElement.querySelectorAll('li');
            expect(contacts.length).toBe(1);
            expect(u.isVisible(contacts[0])).toBe(true);
            sent_stanza = ""; // Reset

            spyOn(contact, "ackSubscribe").and.callThrough();

            /* Here we assume the "happy path" that the contact
             * approves the subscription request
             *
             *  <presence
             *      to='user@example.com'
             *      from='contact@example.org'
             *      type='subscribed'/>
             */
            _converse.connection._dataRecv(mock.createRequest(
                stanza = $pres({
                    'to': _converse.bare_jid,
                    'from': 'contact@example.org',
                    'type': 'subscribed'
                })
            ));

            /* Upon receiving the presence stanza of type "subscribed",
             * the user SHOULD acknowledge receipt of that
             * subscription state notification by sending a presence
             * stanza of type "subscribe".
             */
            expect(contact.ackSubscribe).toHaveBeenCalled();
            expect(Strophe.serialize(sent_stanza)).toBe( // Strophe adds the xmlns attr (although not in spec)
                `<presence to="contact@example.org" type="subscribe" xmlns="jabber:client"/>`
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
            const IQ_id = _converse.connection.getUniqueId('roster');
            stanza = $iq({'type': 'set', 'id': IQ_id})
                .c('query', {'xmlns': 'jabber:iq:roster'})
                .c('item', {
                    'jid': 'contact@example.org',
                    'subscription': 'to',
                    'name': 'Nicky'});

            _converse.connection._dataRecv(mock.createRequest(stanza));
            // Check that the IQ set was acknowledged.
            expect(Strophe.serialize(sent_stanza)).toBe( // Strophe adds the xmlns attr (although not in spec)
                `<iq from="romeo@montague.lit/orchard" id="${IQ_id}" type="result" xmlns="jabber:client"/>`
            );

            // The contact should now be visible as an existing contact (but still offline).
            await u.waitUntil(() => {
                const header = sizzle('a:contains("My contacts")', rosterview).pop();
                return sizzle('li', header?.parentNode).filter(l => u.isVisible(l)).length;
            }, 600);
            header = sizzle('a:contains("My contacts")', rosterview);
            expect(header.length).toBe(1);
            expect(u.isVisible(header[0])).toBeTruthy();
            contacts = header[0].parentNode.querySelectorAll('li');
            expect(contacts.length).toBe(1);
            // Check that it has the right classes and text
            expect(u.hasClass('to', contacts[0])).toBeTruthy();
            expect(u.hasClass('both', contacts[0])).toBeFalsy();
            expect(u.hasClass('current-xmpp-contact', contacts[0])).toBeTruthy();

            await u.waitUntil(() => contacts[0].textContent.trim() === 'Nicky');

            expect(contact.presence.get('show')).toBe('offline');

            /*  <presence
             *      from='contact@example.org/resource'
             *      to='user@example.com/resource'/>
             */
            stanza = $pres({'to': _converse.bare_jid, 'from': 'contact@example.org/resource'});
            _converse.connection._dataRecv(mock.createRequest(stanza));
            // Now the contact should also be online.
            expect(contact.presence.get('show')).toBe('online');

            /* Section 8.3.  Creating a Mutual Subscription
             *
             * If the contact wants to create a mutual subscription,
             * the contact MUST send a subscription request to the
             * user.
             *
             * <presence from='contact@example.org' to='user@example.com' type='subscribe'/>
             */
            spyOn(contact, 'authorize').and.callThrough();
            spyOn(_converse.roster, 'handleIncomingSubscription').and.callThrough();
            stanza = $pres({
                'to': _converse.bare_jid,
                'from': 'contact@example.org/resource',
                'type': 'subscribe'});
            _converse.connection._dataRecv(mock.createRequest(stanza));
            expect(_converse.roster.handleIncomingSubscription).toHaveBeenCalled();

            /* The user's client MUST send a presence stanza of type
             * "subscribed" to the contact in order to approve the
             * subscription request.
             *
             *  <presence to='contact@example.org' type='subscribed'/>
             */
            expect(contact.authorize).toHaveBeenCalled();
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<presence to="contact@example.org" type="subscribed" xmlns="jabber:client"/>`
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
            _converse.connection._dataRecv(mock.createRequest(
                $iq({'type': 'set'}).c('query', {'xmlns': 'jabber:iq:roster'})
                    .c('item', {
                        'jid': 'contact@example.org',
                        'subscription': 'both',
                        'name': 'contact@example.org'})
            ));

            // The class on the contact will now have switched.
            await u.waitUntil(() => !u.hasClass('to', contacts[0]));
            expect(u.hasClass('both', contacts[0])).toBe(true);

        }));

        it("Alternate Flow: Contact Declines Subscription Request",
                mock.initConverse([], {}, async function (_converse) {

            const { $iq, $pres } = converse.env;
            /* The process by which a user subscribes to a contact, including
             * the interaction between roster items and subscription states.
             */
            var contact, stanza, sent_stanza, sent_IQ;
            await mock.waitForRoster(_converse, 'current', 0);
            mock.openControlBox(_converse);
            // Add a new roster contact via roster push
            stanza = $iq({'type': 'set'}).c('query', {'xmlns': 'jabber:iq:roster'})
                .c('item', {
                    'jid': 'contact@example.org',
                    'subscription': 'none',
                    'ask': 'subscribe',
                    'name': 'contact@example.org'});
            _converse.connection._dataRecv(mock.createRequest(stanza));
            // A pending contact should now exist.
            contact = _converse.roster.get('contact@example.org');
            expect(_converse.roster.get('contact@example.org') instanceof _converse.RosterContact).toBeTruthy();
            spyOn(contact, "ackUnsubscribe").and.callThrough();

            spyOn(_converse.connection, 'send').and.callFake(stanza => { sent_stanza = stanza });
            spyOn(_converse.connection, 'sendIQ').and.callFake(iq => { sent_IQ = iq });
            /* We now assume the contact declines the subscription
             * requests.
             *
             * Upon receiving the presence stanza of type "unsubscribed"
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
                'to': _converse.bare_jid,
                'from': 'contact@example.org',
                'type': 'unsubscribed'
            });
            _converse.connection._dataRecv(mock.createRequest(stanza));

            /* Upon receiving the presence stanza of type "unsubscribed",
             * the user SHOULD acknowledge receipt of that subscription
             * state notification through either "affirming" it by
             * sending a presence stanza of type "unsubscribe
             */
            expect(contact.ackUnsubscribe).toHaveBeenCalled();
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<presence to="contact@example.org" type="unsubscribe" xmlns="jabber:client"/>`
            );

            /* _converse.js will then also automatically remove the
             * contact from the user's roster.
             */
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq type="set" xmlns="jabber:client">`+
                    `<query xmlns="jabber:iq:roster">`+
                        `<item jid="contact@example.org" subscription="remove"/>`+
                    `</query>`+
                `</iq>`
            );
        }));

        it("Unsubscribe to a contact when subscription is mutual",
                mock.initConverse([], { roster_groups: false }, async function (_converse) {

            const { u, $iq, sizzle, Strophe } = converse.env;
            const jid = 'abram@montague.lit';
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current');
            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
            // We now have a contact we want to remove
            expect(_converse.roster.get(jid) instanceof _converse.RosterContact).toBeTruthy();

            const rosterview = document.querySelector('converse-roster');
            const header = sizzle('a:contains("My contacts")', rosterview).pop();
            await u.waitUntil(() => header.parentElement.querySelectorAll('li').length);

            // remove the first user
            header.parentElement.querySelector('li .remove-xmpp-contact').click();
            expect(_converse.api.confirm).toHaveBeenCalled();

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
            const iq_stanzas = _converse.connection.IQ_stanzas;
            await u.waitUntil(() => Strophe.serialize(iq_stanzas.at(-1)) ===
                `<iq id="${iq_stanzas.at(-1).getAttribute('id')}" type="set" xmlns="jabber:client">`+
                    `<query xmlns="jabber:iq:roster">`+
                        `<item jid="abram@montague.lit" subscription="remove"/>`+
                    `</query>`+
                `</iq>`);
            const sent_iq = iq_stanzas.at(-1);

            // Receive confirmation from the contact's server
            // <iq type='result' id='remove1'/>
            const stanza = $iq({'type': 'result', 'id': sent_iq.getAttribute('id')});
            _converse.connection._dataRecv(mock.createRequest(stanza));
            // Our contact has now been removed
            await u.waitUntil(() => typeof _converse.roster.get(jid) === "undefined");
        }));

        it("Receiving a subscription request", mock.initConverse(
                [], {}, async function (_converse) {

            const { u, $pres, sizzle, Strophe } = converse.env;
            spyOn(_converse.api, "trigger").and.callThrough();
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current');
            /* <presence
             *     from='user@example.com'
             *     to='contact@example.org'
             *     type='subscribe'/>
             */
            const stanza = $pres({
                'to': _converse.bare_jid,
                'from': 'contact@example.org',
                'type': 'subscribe'
            }).c('nick', {
                'xmlns': Strophe.NS.NICK,
            }).t('Clint Contact');


            _converse.connection._dataRecv(mock.createRequest(stanza));
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => {
                const header = sizzle('a:contains("Contact requests")', rosterview).pop();
                return Array.from(header?.parentElement.querySelectorAll('li') ?? []).filter(u.isVisible)?.length;
            }, 500);
            expect(_converse.api.trigger).toHaveBeenCalledWith('contactRequest', jasmine.any(Object));

            const header = sizzle('a:contains("Contact requests")', rosterview).pop();
            expect(u.isVisible(header)).toBe(true);
            const contacts = header.nextElementSibling.querySelectorAll('li');
            expect(contacts.length).toBe(1);
        }));
    });
});
