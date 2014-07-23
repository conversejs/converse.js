Subscription flow
=================

Happy flow
----------

Contact1 makes a presence subscription request to contact2.

::
    <presence type="subscribe" to="contact2@localhost"/>

Contact1 receives a roster update

::
    <iq type="set" to="contact1@localhost">
        <query xmlns="jabber:iq:roster">
            <item jid="contact2@localhost" ask="subscribe" subscription="none"></item>
        </query>
    </iq>

Contact2 receives the presence subscription, but no
roster update. We create a roster item manually in
handleIncomingSubscription and add the 'requesting'
property to indicate that this is an incoming request.

Contact2 clicks "Accept". This confirms the
subscription and subscribes back.

::
    <presence type="subscribed" to="contact1@localhost"/>
    <presence type="subscribe" to="contact1@localhost"/>

IF Contact1 is still online and likewise subscribes back, Contact2 will receive a roster update

::
    <iq type="set" to="contact2@localhost">
        <query xmlns="jabber:iq:roster">
            <item jid="contact1@localhost" ask="subscribe" subscription="from"></item>
        </query>
    </iq>

ELSE, Contact 2 will receive a roster update (but not an IQ stanza)

::
    ask = null
    subscription = "from"


Contact1's converse.js client will automatically
approve.

Contact2 receives a roster update (as does contact1).

::
    <iq type="set" to="contact2@localhost">
        <query xmlns="jabber:iq:roster">
            <item jid="contact1@localhost" subscription="both"></item>
        </query>
    </iq>
