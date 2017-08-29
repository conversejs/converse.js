.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/configuration.rst">Edit me on GitHub</a></div>

=============
Configuration
=============

.. contents:: Table of Contents
   :depth: 2
   :local:

The included minified JS and CSS files can be used for demoing or testing, but
you'll want to configure *Converse.js* to suit your needs before you deploy it
on your website.

*Converse.js* is passed its configuration settings when you call its *initialize* method.

You'll most likely want to call the *initialize* method in your HTML page. For
an example of how this is done, please see the bottom of the *./index.html* page.

Please refer to the `Configuration settings`_ section below for info on
all the available configuration settings.

After you have configured *Converse.js*, you'll have to regenerate the minified
JS file so that it will include the new settings. Please refer to the
:ref:`minification` section for more info on how to do this.

.. _`configuration-settings`:

Configuration settings
======================

authentication
--------------

* Default:  ``login``
* Allowed values: `login`_, `external`, `anonymous`_, `prebind`_

This option states the way converse.js will authenticate.

login
~~~~~

The default means is ``login``, which means that the user either logs in manually with their
username and password, or automatically if used together with ``auto_login=true``
and ``jid`` and ``password`` values. See `auto_login`_.

external
~~~~~~~~

This setting will still show a login form and submit button, but the form will
only contain an input for the user's JID, *not* for the password.

That's because this setting is intended to be used when you are using
SASL-EXTERNAL as authentication mechanism, in which case a password is usually
not required.

SASL-EXTERNAL is generally used together with x509 client certificates to
enable passwordless login or 2-factor authentication.

For more details on this, `read this blog post <https://opkode.com/blog/strophe_converse_sasl_external/>`_.

anonymous
~~~~~~~~~

This enables anonymous login if the XMPP server supports it. This option can be
used together with `auto_login`_ to automatically and anonymously log a user in
as soon as the page loads.

The server's domain is passed in via the `jid`_ setting.

prebind
~~~~~~~

See also: :ref:`session-support`

Use this option when you want to attach to an existing XMPP
`BOSH <https://en.wikipedia.org/wiki/BOSH>`_ session.

Usually a BOSH session is set up server-side in your web app.

Attaching to an existing BOSH session that was set up server-side is useful
when you want to maintain a persistent single session for your users instead of
requiring them to log in manually.

When a BOSH session is initially created, you'll receive three tokens.
A JID (jabber ID), SID (session ID) and RID (Request ID).

Converse.js needs these tokens in order to attach to that same session.

There are two complementary configuration settings to ``prebind``.
They are :ref:`keepalive` and `prebind_url`_.

``keepalive`` can be used keep the session alive without having to pass in
new RID and SID tokens to ``converse.initialize`` every time you reload the page.
This removes the need to set up a new BOSH session every time a page loads.
You do however still need to supply the user's JID so that converse.js can be
sure that the session it's resuming is for the right user.

`prebind_url`_ lets you specify a URL which converse.js will call whenever a
new BOSH session needs to be set up.

Here's an example of converse.js being initialized with these three options:

.. code-block:: javascript

    converse.initialize({
        bosh_service_url: 'https://bind.example.com',
        keepalive: true,
        jid: 'me@example.com',
        authentication: 'prebind',
        prebind_url: 'http://example.com/api/prebind',
        allow_logout: false
    });

allow_bookmarks
---------------

* Default:  ``true``

Enables/disables chatroom bookmarks functionality.
This setting is only applicable if the ``converse-bookmarks`` plugin is loaded.

allow_chat_pending_contacts
---------------------------

* Default:  ``false``

Allow the user to chat with pending contacts.

allow_contact_removal
---------------------

* Default:  ``true``

Allow the user to remove roster contacts by clicking on the delete icon
(i.e. traschcan) next to a contact's name in the roster.

allow_contact_requests
----------------------

* Default:  ``true``

Allow users to add one another as contacts. If this is set to false, the
**Add a contact** widget, **Contact Requests** and **Pending Contacts** roster
sections will all not appear. Additionally, all incoming contact requests will be
ignored.

allow_dragresize
----------------

* Default: ``true``

Allow users to resize chats by dragging the edges. The min-height and min-width
CSS properties set on a chat boxes (specifically on the ``#converse.js .chatbox > .box-flyout`` element)
will be honored, IF they are set in pixels.

allow_muc
---------

* Default:  ``true``

Allow multi-user chat (muc) in chatrooms. Setting this to ``false`` will remove
the ``Chatrooms`` tab from the control box.

allow_muc_invitations
---------------------

* Default:  ``true``

Allows users to be invited to join MUC chat rooms. An "Invite" widget will
appear in the sidebar of the chat room where you can type in the JID of a user
to invite into the chat room.

allow_non_roster_messaging
--------------------------

* Default:  ``false``

Determines whether you'll receive messages from users that are not in your
roster. The XMPP specification allows for this (similar to email).
Setting this to `true` increases your chances of receiving spam (when using a
federated server), while setting it to `false` means that people not on your
roster can't contact you unless one (or both) of you subscribe to one another's
presence (i.e. adding as a roster contact).

allow_otr
---------

* Default:  ``true``

Allow Off-the-record encryption of single-user chat messages.

allow_registration
------------------

* Default:  ``true``

Support for `XEP-0077: In band registration <http://xmpp.org/extensions/xep-0077.html>`_

Allow XMPP account registration showing the corresponding UI register form interface.

animate
-------

* Default:  ``true``

Show animations, for example when opening and closing chat boxes.

archived_messages_page_size
---------------------------

* Default:  ``50``

See also: `message_archiving`_

This feature applies to `XEP-0313: Message Archive Management (MAM) <https://xmpp.org/extensions/xep-0313.html>`_
and will only take effect if your server supports MAM.

It allows you to specify the maximum amount of archived messages to be returned per query.
When you open a chat box or room, archived messages will be displayed (if
available) and the amount returned will be no more than the page size.

You will be able to query for even older messages by scrolling upwards in the chat box or room
(the so-called infinite scrolling pattern).

auto_list_rooms
---------------

* Default:  ``false``

If true, and the XMPP server on which the current user is logged in supports
multi-user chat, then a list of rooms on that server will be fetched.

Not recommended for servers with lots of chat rooms.

For each room on the server a query is made to fetch further details (e.g.
features, number of occupants etc.), so on servers with many rooms this
option will create lots of extra connection traffic.

auto_login
----------

* Default:  ``false``

This option can be used to let converse.js automatically log the user in as
soon as the page loads.

It should be used either with ``authentication`` set to ``anonymous`` or to ``login``.

If ``authentication`` is set to ``login``, then you will also need to provide a
valid ``jid`` and ``password`` values, either manually by passing them in, or
by the `credentials_url`_ setting. Setting a ``credentials_url`` is preferable
to manually passing in ``jid`` and ``password`` values, because it allows
better reconnection with ``auto_reconnect``. When the connection drops,
converse.js will automatically fetch new login credentials from the
``credentials_url`` and reconnect.

If ``authentication`` is set to ``anonymous``, then you will also need to provide the
server's domain via the `jid`_ setting.

This is a useful setting if you'd like to create a custom login form in your
website. You'll need to write some Javascript to accept that custom form's
login credentials, then you can pass those credentials (``jid`` and
``password``) to ``converse.initialize`` to start converse.js and log the user
into their XMPP account.

auto_away
---------

* Default:  ``0``

The amount of seconds after which the user's presence status should
automatically become ``away``.

If the user's status is ``extended away``, it won't be changed to ``away``.

If the given value is negative or ``0``, this option is disabled.

auto_xa
-------

* Default:  ``0``

The amount of seconds after which the user's presence status should
automatically become ``extended away``.

If the value is negative or ``0``, the function is disabled.

auto_reconnect
--------------

* Default:  ``false``

Automatically reconnect to the XMPP server if the connection drops
unexpectedly.

This option works best when you have `authentication` set to `prebind` and have
also specified a `prebind_url` URL, from where converse.js can fetch the BOSH
tokens. In this case, converse.js will automaticallly reconnect when the
connection drops but also reestablish earlier lost connections (due to
network outages, closing your laptop etc.).

When `authentication` is set to `login`, then this option will only work when
the page hasn't been reloaded yet, because then the user's password has been
wiped from memory. This configuration can however still be useful when using
converse.js in desktop apps, for example those based on `CEF <https://bitbucket.org/chromiumembedded/cef>`_
or `electron <http://electron.atom.io/>`_.

auto_subscribe
--------------

* Default:  ``false``

If true, the user will automatically subscribe back to any contact requests.

auto_join_on_invite
-------------------

* Default:  ``false``

If true, the user will automatically join a chatroom on invite without any confirm.


auto_join_rooms
---------------

* Default:  ``[]``

This settings allows you to provide a list of groupchat conversations to be
automatically joined once the user has logged in.

You can either specify a simple list of room JIDs, in which case your nickname
will be taken from your JID, or you can specify a list of maps, where each map
specifies the room's JID and the nickname that should be used.

For example::

    `[{'jid': 'room@example.org', 'nick': 'WizardKing69' }]`

.. _`bosh-service-url`:

bosh_service_url
----------------

* Default: ``undefined``

To connect to an XMPP server over HTTP you need a `BOSH <https://en.wikipedia.org/wiki/BOSH>`_
connection manager which acts as a middle man between the HTTP and XMPP
protocols.

The bosh_service_url setting takes the URL of a BOSH connection manager.

Please refer to your XMPP server's documentation on how to enable BOSH.
For more information, read this blog post: `Which BOSH server do you need? <http://metajack.im/2008/09/08/which-bosh-server-do-you-need>`_

A more modern alternative to BOSH is to use `websockets <https://developer.mozilla.org/en/docs/WebSockets>`_.
Please see the :ref:`websocket-url` configuration setting.

cache_otr_key
-------------

* Default:  ``false``

Let the `OTR (Off-the-record encryption) <https://otr.cypherpunks.ca>`_ private
key be cached in your browser's session storage.

The browser's session storage persists across page loads but is deleted once
the tab or window is closed.

If this option is set to ``false``, a new OTR private key will be generated
for each page load. While more inconvenient, this is a much more secure option.

This setting can only be used together with ``allow_otr = true``.

.. note::
    A browser window's session storage is accessible by all javascript that
    is served from the same domain. So if there is malicious javascript served by
    the same server (or somehow injected via an attacker), then they will be able
    to retrieve your private key and read your all the chat messages in your
    current session. Previous sessions however cannot be decrypted.

chatstate_notification_blacklist
--------------------------------

* Default: ``[]``

A list of JIDs to be ignored when showing desktop notifications of changed chat states.

Some user's clients routinely connect and disconnect (likely on mobile) and
each time a chat state notificaion is received (``online`` when connecting and
then ``offline`` when disconnecting).

When desktop notifications are turned on (see `show-desktop-notifications`_),
then you'll receive notification messages each time this happens.

Receiving constant notifications that a user's client is connecting and disconnecting
is annoying, so this option allows you to ignore those JIDs.

connection_options
------------------

* Default:  ``{}``
* Type:  Object

Converse.js relies on `Strophe.js <http://strophe.im>`_ to establish and
maintain a connection to the XMPP server.

This option allows you to pass a map of configuration options to be passed into
the ``Strophe.Connection`` constructor.

For documentation on the configuration options that ``Strophe.Connection``
accepts, refer to the
`Strophe.Connection documentation <http://strophe.im/strophejs/doc/1.2.8/files/strophe-js.html#Strophe.Connection.Strophe.Connection>`_.

As an example, suppose you want to restrict the supported SASL authentication
mechanisms, then you'd pass in the ``mechanisms`` as a ``connection_options``
``key:value`` pair:

.. code-block:: javascript

        converse.initialize({
            connection_options: {
                'mechanisms': [
                    converse.env.Strophe.SASLMD5,
                ]
            },
        });

.. _`credentials_url`:

credentials_url
---------------

* Default:  ``null``
* Type:  URL

This setting should be used in conjunction with ``authentication`` set to ``login`` and :ref:`keepalive` set to ``true``.

It allows you to specify a URL which converse.js will call when it needs to get
the username and password (or authentication token) which converse.js will use
to automatically log the user in.

If ``auto_reconnect`` is also set to true, then converse.js will automatically
fetch new credentials from the ``credentials_url`` whenever the connection or
session drops, and then attempt to reconnect and establish a new session.

The server behind ``credentials_url`` should return a JSON encoded object::

    {
        "jid": "me@example.com/resource",
        "password": "Ilikecats!",
    }


csi_waiting_time
----------------

* Default: ``0``

This option adds support for `XEP-0352 Client State Indication <http://xmpp.org/extensions/xep-0352.html>_`

If converse.js is idle for the configured amount of seconds, a chat state
indication of ``inactive`` will be sent out to the XMPP server (if the server
supports CSI).

Afterwards, ss soon as there is any activity (for example, the mouse moves),
a chat state indication of ``active`` will be sent out.

A value of ``0`` means that this feature is disabled.

debug
-----

* Default:  ``false``

If set to true, debugging output will be logged to the browser console.

default_domain
--------------

* Default:  ``undefined``

Specify a domain to act as the default for user JIDs. This allows users to log
in with only the username part of their JID, instead of the full JID.

For example, if ``default_domain`` is ``example.org``, then the user
``johnny@example.org`` can log in with only ``johnny``.

JIDs with other domains are still allowed but need to be provided in full.
To specify only one domain and disallow other domains, see the `locked_domain`_
option.

registration_domain
-------------------

* Default: ``''``

Specify a domain name for which the registration form will be fetched automatically,
without the user having to enter any XMPP server domain name.

default_state
-------------

* Default: ``'online'``

The default chat status that the user wil have. If you for example set this to
``'chat'``, then converse.js will send out a presence stanza with ``"show"``
set to ``'chat'`` as soon as you've been logged in.

domain_placeholder
------------------

* Default: ``e.g. conversejs.org``

The placeholder text shown in the domain input on the registration form.


emojione_image_path
-------------------

* Default: ``'https://cdn.jsdelivr.net/emojione/assets/' + emojioneVersion + '/png/'``

When `use_emojione`_ is set to ``true``, then this is the URL from where PNG image files for
displaying emojis will be fetched.


expose_rid_and_sid
------------------

* Default:  ``false``

Allow the prebind tokens, RID (request ID) and SID (session ID), to be exposed
globally via the API. This allows other scripts served on the same page to use
these values.

*Beware*: a malicious script could use these tokens to assume your identity
and inject fake chat messages.

filter_by_resource
------------------

* Default:  ``false``

Before version 1.0.3 converse.js would ignore received messages if they were
intended for a different resource then the current user had. It was decided to
drop this restriction but leave it configurable.

forward_messages
----------------

* Default:  ``false``

If set to ``true``, sent messages will also be forwarded to the sending user's
bare JID (their Jabber ID independent of any chat clients aka resources).

This means that sent messages are visible from all the user's chat clients,
and not just the one from which it was actually sent.

This is especially important for web chat, such as converse.js, where each
browser tab functions as a separate chat client, with its own resource.

This feature uses Stanza forwarding, see also `XEP 0297: Stanza Forwarding <http://www.xmpp.org/extensions/xep-0297.html>`_

For an alternative approach, see also `message_carbons`_.

fullname
--------

If you are using prebinding, can specify the fullname of the currently
logged in user, otherwise the user's vCard will be fetched.

.. _`hide_muc_server`:

hide_muc_server
---------------

* Default:  ``false``

Hide the ``server`` input field of the form inside the ``Room`` panel of the
controlbox. Useful if you want to restrict users to a specific XMPP server of
your choosing.

hide_offline_users
------------------

* Default:  ``false``

If set to ``true``, then don't show offline users.

hide_open_bookmarks
-------------------

* Default:  ``false`` (``true`` for inVerse).

This setting applies to the ``converse-bookmarks`` plugin and specfically the
list of bookmarks shown in the ``Rooms`` tab of the control box.

By default all bookmarks are shown in that list, if this setting is set to
``true``, then only bookmarks for rooms not currently open (i.e. that the
current user hasn't joined), are shown.

Makes sense to set this to ``true`` when also using the non-core
``converse-roomslist`` plugin, which shows a list of currently open (i.e.
"joined") rooms.

include_offline_state
---------------------

* Default: `false`

Originally, converse.js included an `offline` state which the user could
choose (along with `online`, `busy` and `away`).

Eventually it was however decided to remove this state, since the `offline`
state doesn't propagate across tabs like the others do.

What's meant by "propagate across tabs", is that when you set the state to
`offline` in one tab, and you have instances of converse.js open in other tabs
in your browser, then those instances will not have their states changed to
`offline` as well. For the other statees the change is however propagated.

The reason for this is that according to the XMPP spec, there is no `offline`
state. The only defined states are:

* away -- The entity or resource is temporarily away.
* chat -- The entity or resource is actively interested in chattiIng.
* dnd -- The entity or resource is busy (dnd = "Do Not Disturb").
* xa -- The entity or resource is away for an extended period (xa = "eXtended Away").

Read the `relevant section in the XMPP spec <https://xmpp.org/rfcs/rfc6121.html#presence-syntax-children-show>`_
for more info.

What used to happen in converse.js when the `offline` state was chosen, is
that a presence stanza with a `type` of `unavailable` was sent out.

This is actually exactly what happens when you log out of converse.js as well,
with the notable exception that in the `offline` state, the connection is not
terminated. So you can at any time change your state to something else and
start chatting again.

This might be useful to people, however the fact that the `offline` state
doesn't propagate across tabs means that the user experience is inconsistent,
confusing and appears "broken".

If you are however aware of this issue and still want to allow the `offline`
state, then you can set this option to `true` to enable it.

i18n
----

* Default:  Auto-detection of the User/Browser language

If no locale is matching available locales, the default is ``en``.
Specify the locale/language. The language must be in the ``locales`` object. Refer to
``./locale/locales.js`` to see which locales are supported.

jid
---

The Jabber ID or "JID" of the current user. The JID uniquely identifies a user
on the XMPP network. It looks like an email address, but it's used for instant
messaging instead.

This value needs to be provided when using the :ref:`keepalive` option together
with `prebind`_.


.. _`keepalive`:

keepalive
---------

* Default:    ``true``

Determines whether Converse.js will maintain the chat session across page
loads.

This setting should also be used in conjunction with ``authentication`` set to `prebind`_.

When using ``keepalive`` and ``prebind``, you will have to provide the `jid`_
of the current user to ensure that a cached session is only resumed if it
belongs to the current user.

See also:

* :ref:`session-support`

.. note::
    Currently the "keepalive" setting only works with BOSH and not with
    websockets. This is because XMPP over websocket does not use the same
    session token as with BOSH. A possible solution for this is to implement
    `XEP-0198 <http://xmpp.org/extensions/xep-0198.html>`_, specifically
    with regards to "stream resumption".

locked_domain
-------------

* Default:  ``undefined``

Similar to `default_domain`_ but no other domains are allowed.

For example, if ``locked_domain`` is set to ``example.org``, then the user
``johnny@example.org`` can log in with only ``johnny``.

Additionally, only users registered on the ``example.org`` host can log in, no
other users are allowed to log in.

message_archiving
-----------------

* Default:  ``undefined``

Provides support for `XEP-0313: Message Archive Management <https://xmpp.org/extensions/xep-0313.html>`_,
whereby messages are archived in the XMPP server for later retrieval.
Note, your XMPP server must support XEP-0313 MAM for this to work.

This option sets the default archiving preference.
Valid values are ``undefined``, ``never``, ``always`` and ``roster``.

``undefined`` means that any existing MAM configuration, as set by the user or
the server administrator, will be used.

``roster`` means that only messages to and from JIDs in your roster will be
archived. The other two values are self-explanatory.


message_archiving_timeout
-------------------------

* Default:  ``8000``

The amount of time (in milliseconds) to wait when requesting archived messages
from the XMPP server.

Used in conjunction with `message_archiving` and in context of `XEP-0313: Message Archive Management <https://xmpp.org/extensions/xep-0313.html>`_.

message_carbons
---------------

* Default:  ``false``

Support for `XEP-0280: Message Carbons <https://xmpp.org/extensions/xep-0280.html>`_

In order to keep all IM clients for a user engaged in a conversation,
outbound messages are carbon-copied to all interested resources.

This is especially important in webchat, like converse.js, where each browser
tab serves as a separate IM client.

Both message_carbons and `forward_messages`_ try to solve the same problem
(showing sent messages in all connected chat clients aka resources), but go about it
in two different ways.

Message carbons is the XEP (Jabber protocol extension) specifically drafted to
solve this problem, while `forward_messages`_ uses
`stanza forwarding <http://www.xmpp.org/extensions/xep-0297.html>`_

message_storage
----------------

* Default:  ``session``

Valid options: ``session``, ``local``.

This option determines the type of `browser storage <https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Storage>`_
(``localStorage`` or ``sessionStorage``) used by converse.js to cache messages (private and group).

The main difference between the two is that `sessionStorage` only persists while
the current tab or window containing a converse.js instance is open. As soon as
it's closed, the data is cleared.

Data in `localStorage` on the other hand is kept indefinitely, which can have
privacy implications on public computers or when multiple people are using the
same computer.

See also the `storage`_ option, which applies to other cached data, such as
which chats you have open, what features the XMPP server supports and what
your online status is.

muc_disable_moderator_commands
------------------------------

* Default: ``false``

Allows you to disable the moderator commands such as ``/kick`` or ``/ban``.

muc_domain
----------

* Default:  ``undefined``

The MUC (multi-user chat) domain that should be used. By default converse.js
will attempt to get the MUC domain from the XMPP host of the currently logged in
user.

This setting will override that. You might want to combine this setting with `hide_muc_server`_.

muc_history_max_stanzas
-----------------------

* Default:  ``undefined``

This option allows you to specify the maximum amount of messages to be shown in a
chat room when you enter it. By default, the amount specified in the room
configuration or determined by the server will be returned.

Please note, this option is not related to
`XEP-0313 Message Archive Management <https://xmpp.org/extensions/xep-0313.html>`_,
which also allows you to show archived chat room messages, but follows a
different approach.

If you're using MAM for archiving chat room messages, you might want to set
this option to zero.

muc_instant_rooms
------------------

* Default: ``true``

Determines whether 'instant' (also called 'dynamic' in OpenFire) rooms are created.
Otherwise rooms first have to be configured before they're available to other
users (so-called "registered rooms" in `MUC-0045 <http://xmpp.org/extensions/xep-0045.html#createroom>`_).

From a UX perspective, if this settings is `false`, then a configuration form will
render, that has to be filled in first, before the room can be joined by other
users.

muc_nickname_from_jid
---------------------

* Default: ``false``

When set to ``true``, then users will not be prompted to provide nicknames for
chat rooms. Instead, the node part of a user's JID (i.e. JID = node@domain/resource)
will be used. If the user's nickname is already taken by another user in the
chat room, then an integer will be added to make it unique.

So, for example, if john@example.com joins a chatroom, his nickname will
automatically be "john". If now john@differentdomain.com tries to join the
room, his nickname will be "john-2", and if john@somethingelse.com joins, then
his nickname will be "john-3", and so forth.

muc_show_join_leave
-------------------

* Default; ``true``

Determines whether Converse.js will show info messages inside a chat room
whenever a user joins or leaves it.

notify_all_room_messages
------------------------

* Default: ``false``

By default, sound and desktop notifications will only be made when you are
mentioned in a room. If you set this setting to `true`, then you will be
notified of all messages received in a room.

You can also pass an array of room JIDs to this option, to only apply it to
certain rooms.

notification_icon
-----------------

* Default: ``'/logo/conversejs.png'``

This option specifies which icon is shown in HTML5 notifications, as provided
by the ``src/converse-notification.js`` plugin.


ping_interval
-------------

* Default:  ``180``

Make ping to server in order to keep connection with server killing sessions after idle timeout.
The ping are sent only if no messages are sent in the last ``ping_interval`` seconds
You need to set the value to any positive value to enable this functionality.

If you set this value to ``0`` or any negative value, il will disable this functionality.

.. _`play-sounds`:

play_sounds
-----------

* Default:  ``false``

Plays a notification sound when you receive a personal message or when your
nickname is mentioned in a chat room.

Inside the ``./sounds`` directory of the Converse.js repo you'll see MP3 and Ogg
formatted sound files. We need both, because neither format is supported by all browsers.

You can set the URL where the sound files are hosted with the `sounds_path`_
option.

Requires the `src/converse-notification.js` plugin.

.. _`prebind_url`:

prebind_url
-----------

* Default:  ``null``
* Type:  URL

See also: :ref:`session-support`

This setting should be used in conjunction with ``authentication`` set to `prebind` and :ref:`keepalive` set to ``true``.

It allows you to specify a URL which converse.js will call when it needs to get
the RID and SID (Request ID and Session ID) tokens of a BOSH connection, which
converse.js will then attach to.

The server behind ``prebind_url`` should return a JSON encoded object with the
three tokens::

    {
        "jid": "me@example.com/resource",
        "sid": "346234623462",
        "rid": "876987608760"
    }

priority
--------

* Default:  ``0``
* Type:     Number

Determines the priority used for presence stanzas sent out from this resource
(i.e. this instance of Converse.js).

The priority of a given XMPP chat client determines the importance of its presence
stanzas in relation to stanzas received from other clients of the same user.

In Converse.js, the indicated chat status of a roster contact will be taken from the
presence stanza (and associated resource) with the highest priority.

If multiple resources have the same top priority, then the chat status will be
taken from the most recent present stanza.

For more info you can read `Section 2.2.2.3 of RFC-3921 <https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.3>`_.

providers_link
--------------

* Default:  ``https://xmpp.net/directory.php``

The hyperlink on the registration form which points to a directory of public
XMPP servers.


roster_groups
-------------

* Default:  ``false``

If set to ``true``, converse.js will show any roster groups you might have
configured.

.. note::
    It's currently not possible to use converse.js to assign contacts to groups.
    Converse.js can only show users and groups that were previously configured
    elsewhere.

show_chatstate_notifications
----------------------------

* Default:  ``false``

Specifies whether chat state (online, dnd, away) HTML5 desktop notifications should be shown.

show_controlbox_by_default
--------------------------

* Default:  ``false`` (``true`` for inVerse)

The "controlbox" refers to the special chatbox containing your contacts roster,
status widget, chatrooms and other controls.

By default this box is hidden and can be toggled by clicking on any element in
the page with class *toggle-controlbox*.

If this options is set to true, the controlbox will by default be shown upon
page load.

However, be aware that even if this value is set to ``false``, if the
controlbox is open, and the page is reloaded, then it will stay open on the new
page as well.

.. _`show-desktop-notifications`:

show_desktop_notifications
--------------------------

* Default: ``true``

Should HTML5 desktop notifications be shown?

Notification will be shown in the following cases:

* the browser is not visible nor focused and a private message is received.
* the browser is not visible nor focused and a groupchat message is received which mentions you.
* `auto_subscribe` is set to `false` and a new contact request is received.

Requires the `src/converse-notification.js` plugin.

use_emojione
------------
* Default: ``true``

Determines whether `Emojione <https://www.emojione.com/>`_ should be used to
render emojis. If set to ``false``, then rendering support will fall back to
the operating system or browser (which might not support emoji).

See also `emojione_image_path`_.


show_only_online_users
----------------------

* Default:  ``false``

If set to ``true``, only online users will be shown in the contacts roster.
Users with any other status (e.g. away, busy etc.) will not be shown.

show_send_button
----------------------

* Default:  ``false``

If set to ``true``, a button will be visible which can be clicked to send a message.

sounds_path
-----------

* Default: ``/sounds/``

This option only makes sense in conjunction with the `play_sounds`_ option and
specifies the URL of the sound files to be played (exluding the file names
themselves).

In order to support all browsers we need both an MP3 and an Ogg file. Make sure
to name your files ``msg_received.ogg`` and ``msg_received.mp3``.

storage
-------

* Default: ``session``

Valid options: ``session``, ``local``.

This option determines the type of `browser storage <https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Storage>`_
(``localStorage`` or ``sessionStorage``) used by converse.js to cache user data.

Originally converse.js used only `localStorage`, however `sessionStorage` is from a
privacy perspective a better choice.

The main difference between the two is that `sessionStorage` only persists while
the current tab or window containing a converse.js instance is open. As soon as
it's closed, the data is cleared.

Data in `localStorage` on the other hand is kept indefinitely.

The data that is cached includes which chats you had open, what features the
XMPP server supports and what your online status was.

Since version 1.0.7, the store for messages is now configurable separately with
the `message_storage`_ option, to allow you to cache messages for longer in the
browser (with `localStorage`) while still using `sessionStorage` for other
data.

.. note::
    Between versions 0.8.0 and 1.0.7, setting the value of this option to "local"
    is not recommended. The statuses (online, away, busy etc.) of your roster
    contacts are cached in the browser storage. If you use local storage, these
    values are stored for multiple sessions, and they will likely become out of
    sync with your contacts' actual statuses. The session storage doesn't have
    this problem, because roster contact statuses will not become out of sync in
    a single session, only across more than one session.

    Since version 1.0.7, the "storage" option doesn't apply anymore to how roster
    contacts and their statuses are stored (they're now always stored in session
    storage), to address the above issue.


sticky_controlbox
-----------------

* Default: ``false`` (``true`` for inVerse).

If set to ``true``, the control box (which includes the login, registration,
contacts and rooms tabs) will not be closeable. It won't have a close button at
all.

The idea behind this setting is to provide a better experience on mobile
devices when the intent is to use converse.js as a web app. In this case
it doesn't make sense to close the control box, as there's often then nothing
"behind" it that's relevant to the user.

.. _`strict_plugin_dependencies`:

strict_plugin_dependencies
--------------------------

* Default: ``false``

When set to ``true`` and a plugin tries to override an object which doesn't
exist (for example because the plugin which provides that object is not
loaded), then an error will be raised.

Otherwise a message will simply be logged and the override instruction ignored.

The Converse.js plugins architecture can have an :ref:`optional_dependencies`
plugin attribute. This enables you to specify an array of optional, or
"soft", dependencies. Converse.js (more specifically,
`pluggable.js <https://jcbrand.github.io/pluggable.js/>`_) will try to first
load the optional dependencies before executing the plugin's overrides and
calling its ``initialize`` method.

If ``strict_plugin_dependencies`` is set to ``false`` it won't raise an error
if the optional dependencies aren't found. If set to ``true`` these optional
dependencies are treated as normal non-optional ones, which means that an error
will be raised.

synchronize_availability
------------------------

* Default: ``true``

Valid options: ``true``, ``false``, ``a resource name``.

This option lets you synchronize your chat status (`online`, `busy`, `away`) with other chat clients. In other words,
if you change your status to `busy` in a different chat client, your status will change to `busy` in converse.js as well.

If set to ``true``, converse.js will synchronize with all other clients you are logged in with.

If set to ``false``, this feature is disabled.

If set to ``a resource name``, converse.js will synchronize only with a client that has that particular resource assigned to it.

time_format
-----------

* Default: ``HH:mm``

Examples: ``HH:mm``, ``hh:mm``, ``hh:mm a``.

This option makes the time format for the time shown, for each message, configurable. Converse uses `moment.js <https://momentjs.com/>`_
for showing time. This option allows the configuration of the format in which `moment` will display the time for the messages. For detailed
description of time-format options available for `moment` you can check this `link <https://momentjs.com/docs/#/parsing/string-format/>`_.

use_otr_by_default
------------------

* Default:  ``false``

If set to ``true``, Converse.js will automatically try to initiate an OTR (off-the-record)
encrypted chat session every time you open a chat box.

use_vcards
----------

* Default:  ``true``

Determines whether the XMPP server will be queried for roster contacts' VCards
or not. VCards contain extra personal information such as your fullname and
avatar image.

visible_toolbar_buttons
-----------------------

* Default:

.. code-block:: javascript

    {
        call: false,
        clear: true,
        emoji: true,
        toggle_occupants: true
    }

Allows you to show or hide buttons on the chat boxes' toolbars.

* *call*:
    Provides a button with a picture of a telephone on it.
    When the call button is pressed, it will emit an event that can be used by a third-party library to initiate a call.

    .. code-block:: javascript

        converse.listen.on('callButtonClicked', function(data) {
            console.log('Strophe connection is', data.connection);
            console.log('Bare buddy JID is', data.model.get('jid'));
            // ... Third-party library code ...
        });
* *clear*:
    Provides a button for clearing messages from a chat box.
* *emoji*:
    Enables rendering of emoji and provides a toolbar button for choosing them.
* *toggle_occupants*:
    Shows a button for toggling (i.e. showing/hiding) the list of occupants in a chat room.

.. _`websocket-url`:

websocket_url
-------------

* Default: ``undefined``

This option is used to specify a
`websocket <https://developer.mozilla.org/en/docs/WebSockets>`_ URI to which
converse.js can connect to.

Websockets provide a more modern and effective two-way communication protocol
between the browser and a server, effectively emulating TCP at the application
layer and therefore overcoming many of the problems with existing long-polling
techniques for bidirectional HTTP (such as `BOSH <https://en.wikipedia.org/wiki/BOSH>`_).

Please refer to your XMPP server's documentation on how to enable websocket
support.

.. note::
    Please note that not older browsers do not support websockets. For older
    browsers you'll want to specify a BOSH URL. See the :ref:`bosh-service-url`
    configuration setting).

.. note::
    Converse.js does not yet support "keepalive" with websockets.

blacklisted_plugins
-------------------

* Default: ``[]`` (``['converse-minimize', 'converse-dragresize']`` for inVerse)

A list of plugin names that are blacklisted and will therefore not be
initialized once ``converse.initialize`` is called, even if the same plugin is
whitelisted.

From Converse.js 3.0 onwards most of the API is available only to plugins and
all plugins need to be whitelisted first.

The usecase for blacklisting is generally to disable removed core plugins
(which are automatically whitelisted) to prevent other (potentially malicious)
plugins from registering themselves under those names.

The core, and by default whitelisted, plugins are::

    converse-bookmarks
    converse-chatview
    converse-controlbox
    converse-core
    converse-dragresize
    converse-headline
    converse-mam
    converse-minimize
    converse-muc
    converse-notification
    converse-otr
    converse-ping
    converse-register
    converse-rosterview
    converse-vcard

An example from `the embedded room demo <https://conversejs.org/demo/embedded.html>`_

.. code-block:: javascript

    require(['converse-core', 'converse-muc-embedded'], function (converse) {
        converse.initialize({
            // other settings removed for brevity
            blacklisted_plugins: [
                'converse-controlbox',
                'converse-dragresize',
                'converse-minimize',
                'converse-vcard'
            ],
        });
    });


.. _`whitelisted_plugins`:

whitelisted_plugins
-------------------

* Default: ``[]``

A list of plugin names that are whitelisted and will therefore be
initialized once ``converse.initialize`` is called.

From Converse.js 3.0 onwards most of the API is available only to plugins and
all plugins need to be whitelisted first.

This is done to prevent malicious scripts from using the API to trick users or
to read their conversations.

By default all the core plugins are already whitelisted.

These are::

    converse-bookmarks
    converse-chatview
    converse-controlbox
    converse-core
    converse-dragresize
    converse-headline
    converse-mam
    converse-minimize
    converse-muc
    converse-notification
    converse-otr
    converse-ping
    converse-register
    converse-rosterview
    converse-vcard

If you are using a custom build which excludes some core plugins, then you
should blacklist them so that malicious scripts can't register their own
plugins under those names. See `blacklisted_plugins`_ for more info.

An example from `the embedded room demo <https://conversejs.org/demo/embedded.html>`_

.. code-block:: javascript

    require(['converse-core', 'converse-muc-embedded'], function (converse) {
        converse.initialize({
            // other settings removed for brevity
            whitelisted_plugins: ['converse-muc-embedded']
        });
    });


xhr_custom_status
-----------------

* Default:  ``false``

.. note::
    XHR stands for XMLHTTPRequest, and is meant here in the AJAX sense (Asynchronous Javascript and XML).

This option will let converse.js make an AJAX POST with your changed custom chat status to a
remote server.

xhr_custom_status_url
---------------------

.. note::
    XHR stands for XMLHTTPRequest, and is meant here in the AJAX sense (Asynchronous Javascript and XML).

* Default:  Empty string

Used only in conjunction with ``xhr_custom_status``.

This is the URL to which the AJAX POST request to set the user's custom status
message will be made.

The message itself is sent in the request under the key ``msg``.

xhr_user_search
---------------

* Default:  ``false``

.. note::
    XHR stands for XMLHTTPRequest, and is meant here in the AJAX sense (Asynchronous Javascript and XML).

There are two ways to add users.

* The user inputs a valid JID (Jabber ID), and the user is added as a pending contact.
* The user inputs some text (for example part of a firstname or lastname), an XHR (Ajax Request) will be made to a remote server, and a list of matches are returned. The user can then choose one of the matches to add as a contact.

This setting enables the second mechanism, otherwise by default the first will be used.

*What is expected from the remote server?*

A default JSON encoded list of objects must be returned. Each object
corresponds to a matched user and needs the keys ``id`` and ``fullname``.

.. code-block:: javascript

    [{"id": "foo", "fullname": "Foo McFoo"}, {"id": "bar", "fullname": "Bar McBar"}]

.. note::
    Make sure your server script sets the header `Content-Type: application/json`.

xhr_user_search_url
-------------------

.. note::
    XHR stands for XMLHTTPRequest, and is meant here in the AJAX sense (Asynchronous Javascript and XML).

* Default:  Empty string

Used only in conjunction with ``xhr_user_search``.

This is the URL to which an XHR GET request will be made to fetch user data from your remote server.
The query string will be included in the request with ``q`` as its key.

The data returned must be a JSON encoded list of user JIDs.
