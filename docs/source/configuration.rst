.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/configuration.rst">Edit me on GitHub</a></div>

=============
Configuration
=============

The included minified JavaScript and CSS files can be used for demoing or testing, but
you'll want to configure Converse to suit your needs before you deploy it
on your website.

Converse is passed its configuration settings when you call its *initialize* method.

You'll most likely want to call the *initialize* method in your HTML page. For
an example of how this is done, please see the bottom of the *./index.html* page.

Please refer to the `Configuration settings`_ section below for info on
all the available configuration settings.

After you have configured Converse, you'll have to regenerate the minified
JavaScript file so that it will include the new settings. Please refer to the
:ref:`minification` section for more info on how to do this.

.. _`configuration-settings`:

Configuration settings
======================

authentication
--------------

* Default:  ``login``
* Allowed values: `login`_, `external`, `anonymous`_, `prebind`_

This option states the way Converse will authenticate.

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

Converse needs these tokens in order to attach to that same session.

There are two complementary configuration settings to ``prebind``.
They are :ref:`keepalive` and `prebind_url`_.

``keepalive`` can be used keep the session alive without having to pass in
new RID and SID tokens to ``converse.initialize`` every time you reload the page.
This removes the need to set up a new BOSH session every time a page loads.
You do however still need to supply the user's JID so that Converse can be
sure that the session it's resuming is for the right user.

`prebind_url`_ lets you specify a URL which Converse will call whenever a
new BOSH session needs to be set up.

Here's an example of Converse being initialized with these three options:

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

See also: `allow_public_bookmarks`_

allow_chat_pending_contacts
---------------------------

* Default:  ``false``

Allow the user to chat with pending contacts.

allow_contact_removal
---------------------

* Default:  ``true``

Allow the user to remove roster contacts by clicking on the delete icon
(i.e. trashcan) next to a contact's name in the roster.

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
CSS properties set on a chatboxes (specifically on the ``#converse.js .chatbox > .box-flyout`` element)
will be honored, IF they are set in pixels.

allow_logout
------------

* Default: ``true``

Determines whether the user is allowed to log out. If set to ``false``, there will be no logout button.

allow_muc
---------

* Default:  ``true``

Allow multi-user chat (muc) in chatrooms. Setting this to ``false`` will remove
the ``Chatrooms`` tab from the control box.

allow_muc_invitations
---------------------

* Default:  ``true``

Allows users to be invited to join MUC chatrooms. An "Invite" widget will
appear in the sidebar of the chatroom where you can type in the JID of a user
to invite into the chatroom.

.. _`allow_non_roster_messaging`:

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

allow_public_bookmarks
----------------------

* Default: ``false``

Some XMPP servers don't support private PEP/PubSub nodes, as required for
private bookmarks and outlined in `XEP-0223 <https://xmpp.org/extensions/xep-0223.html>`_.

Even though Converse asks for the bookmarks to be kept private (via the
`<publish-options>` XML node), the server simply ignores the privacy settings
and publishes the node contents under the default privacy setting, which makes
the information available to all roster contacts.

If your your XMPP server does not support `XEP-0223`'s ``#publish-options``
feature and you don't mind that your room bookmarks are visible to all
contacts, then you can set this setting to ``true``. Otherwise you won't be
able to have any room bookmarks at all for an account on that XMPP server.

allow_registration
------------------

* Default:  ``true``

Support for `XEP-0077: In band registration <https://xmpp.org/extensions/xep-0077.html>`_

Allow XMPP account registration showing the corresponding UI register form interface.

animate
-------

* Default:  ``true``

Show animations, for example when opening and closing chatboxes.

archived_messages_page_size
---------------------------

* Default:  ``50``

See also: `message_archiving`_

This feature applies to `XEP-0313: Message Archive Management (MAM) <https://xmpp.org/extensions/xep-0313.html>`_
and will only take effect if your server supports MAM.

It allows you to specify the maximum amount of archived messages to be returned per query.
When you open a chatbox or room, archived messages will be displayed (if
available) and the amount returned will be no more than the page size.

You will be able to query for even older messages by scrolling upwards in the chatbox or room
(the so-called infinite scrolling pattern).

auto_list_rooms
---------------

* Default:  ``false``

If true, and the XMPP server on which the current user is logged in supports
multi-user chat, then a list of rooms on that server will be fetched in the
"Query for Groupchats" modal.

Not recommended for servers with lots of chatrooms.

For each room on the server a query is made to fetch further details (e.g.
features, number of occupants etc.), so on servers with many rooms this
option will create lots of extra connection traffic.

If the `muc_domain`_ is locked with the `locked_muc_domain`_ setting, then
rooms will automatically be fetched in the "Query for Groupchats" modal,
regardless of the value of this setting.

.. _`auto_login`:

auto_login
----------

* Default:  ``false``

This option can be used to let Converse automatically log the user in as
soon as the page loads.

It should be used either with ``authentication`` set to ``anonymous`` or to ``login``.

If ``authentication`` is set to ``login``, then you will also need to provide a
valid ``jid`` and ``password`` values, either manually by passing them in, or
by the `credentials_url`_ setting. Setting a ``credentials_url`` is preferable
to manually passing in ``jid`` and ``password`` values, because it allows
better reconnection with ``auto_reconnect``. When the connection drops,
Converse will automatically fetch new login credentials from the
``credentials_url`` and reconnect.

If ``authentication`` is set to ``anonymous``, then you will also need to provide the
server's domain via the `jid`_ setting.

This is a useful setting if you'd like to create a custom login form in your
website. You'll need to write some JavaScript to accept that custom form's
login credentials, then you can pass those credentials (``jid`` and
``password``) to ``converse.initialize`` to start Converse and log the user
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
also specified a `prebind_url` URL, from where Converse can fetch the BOSH
tokens. In this case, Converse will automaticallly reconnect when the
connection drops but also reestablish earlier lost connections (due to
network outages, closing your laptop etc.).

When `authentication` is set to `login`, then this option will only work when
the page hasn't been reloaded yet, because then the user's password has been
wiped from memory. This configuration can however still be useful when using
Converse in desktop apps, for example those based on `CEF <https://bitbucket.org/chromiumembedded/cef>`_
or `electron <http://electron.atom.io/>`_.

auto_register_muc_nickname
--------------------------

* Default: ``false``

Determines whether Converse should automatically register a user's nickname
when they enter a groupchat.

See here fore more details: https://xmpp.org/extensions/xep-0045.html#register

auto_subscribe
--------------

* Default:  ``false``

If true, the user will automatically subscribe back to any contact requests.

auto_join_on_invite
-------------------

* Default:  ``false``

If true, the user will automatically join a chatroom on invite without any confirm.


auto_join_private_chats
-----------------------

* Default:  ``[]``

Allows you to provide a list of user JIDs for private (i.e. single) chats that
should automatically be started upon login.

For example::

    `['tom@example.org', 'dick@example.org', 'harry@example.org']`


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


blacklisted_plugins
-------------------

* Default: ``[]``

A list of plugin names that are blacklisted and will therefore not be
initialized once ``converse.initialize`` is called, even if the same plugin is
whitelisted.

From Converse 3.0 onwards most of the API is available only to plugins and
all plugins need to be whitelisted first.

The usecase for blacklisting is generally to disable removed core plugins
(which are automatically whitelisted) to prevent other (potentially malicious)
plugins from registering themselves under those names.

The core, and by default whitelisted, plugins are::

    converse-bookmarks
    converse-chatboxes
    converse-chatview
    converse-controlbox
    converse-core
    converse-disco
    converse-dragresize
    converse-fullscreen
    converse-headline
    converse-mam
    converse-minimize
    converse-muc
    converse-muc-embedded
    converse-notification
    converse-otr
    converse-ping
    converse-profile
    converse-register
    converse-roomslist
    converse-rosterview
    converse-singleton
    converse-spoilers
    converse-vcard'

Example:

.. code-block:: javascript

    require(['converse-core', 'converse-muc-embedded'], function (converse) {
        converse.initialize({
            // other settings removed for brevity
            blacklisted_plugins: [
                'converse-dragresize',
                'converse-minimize'
            ],
        });
    });


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

Converse relies on `Strophe.js <http://strophe.im>`_ to establish and
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

It allows you to specify a URL which Converse will call when it needs to get
the username and password (or authentication token) which Converse will use
to automatically log the user in.

If ``auto_reconnect`` is also set to true, then Converse will automatically
fetch new credentials from the ``credentials_url`` whenever the connection or
session drops, and then attempt to reconnect and establish a new session.

The server behind ``credentials_url`` should return a JSON encoded object::

    {
        "jid": "me@example.com/resource",
        "password": "Ilikecats!"
    }


csi_waiting_time
----------------

* Default: ``0``

This option adds support for `XEP-0352 Client State Indication <https://xmpp.org/extensions/xep-0352.html>_`

If Converse is idle for the configured amount of seconds, a chat state
indication of ``inactive`` will be sent out to the XMPP server (if the server
supports CSI).

Afterwards, ss soon as there is any activity (for example, the mouse moves),
a chat state indication of ``active`` will be sent out.

A value of ``0`` means that this feature is disabled.

debug
-----

* Default:  ``false``

If set to ``true``, debugging output will be logged to the browser console.

You can also set this value by changing the URL fragment to `#converse?debug=true` or `#converse?debug=false`.


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
``'chat'``, then Converse will send out a presence stanza with ``"show"``
set to ``'chat'`` as soon as you've been logged in.

domain_placeholder
------------------

* Default: ``e.g. conversejs.org``

The placeholder text shown in the domain input on the registration form.


emoji_image_path
----------------

* Default: ``'https://twemoji.maxcdn.com/2/'``

When `use_system_emojis`_ is set to ``false``, then this is the URL from where image files for
displaying emojis will be fetched.

If you've run ``make dev``, then these files are also available in ``./node_modules/twemoji/2/``,
which means you can avoid the CDN and host them yourself if you wish.


enable_muc_push
---------------

* Default: ``false``

If true, then Converse will try to register
`XEP-0357 push notification App Server(s) <https://xmpp.org/extensions/xep-0357.html#general-architecture>`_
for the MUC domain of any newly entered groupchat.

The app servers are specified with the `push_app_servers`_ option.

.. note::
    Registering a push app server against a MUC domain is not (yet) standardized
    and this feature should be considered experimental.

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

Before version 1.0.3 Converse would ignore received messages if they were
intended for a different resource then the current user had. It was decided to
drop this restriction but leave it configurable.

forward_messages
----------------

* Default:  ``false``

If set to ``true``, sent messages will also be forwarded to the sending user's
bare JID (their Jabber ID independent of any chat clients aka resources).

This means that sent messages are visible from all the user's chat clients,
and not just the one from which it was actually sent.

This is especially important for web chat, such as Converse, where each
browser tab functions as a separate chat client, with its own resource.

This feature uses Stanza forwarding, see also `XEP 0297: Stanza Forwarding <http://www.xmpp.org/extensions/xep-0297.html>`_

For an alternative approach, see also `message_carbons`_.

fullname
--------

If you are using prebinding, can specify the fullname of the currently
logged in user, otherwise the user's vCard will be fetched.

geouri_regex
----------------

* Default:  ``/https:\/\/www.openstreetmap.org\/.*#map=[0-9]+\/([\-0-9.]+)\/([\-0-9.]+)\S*/g``

Regular expression used to extract geo coordinates from links to openstreetmap.

geouri_replacement
------------------

* Default:  ``'https://www.openstreetmap.org/?mlat=$1&mlon=$2#map=18/$1/$2'``

String used to replace geo-URIs with. Ought to be a link to osm or similar. ``$1`` and ``$2`` is replaced by
latitude and longitude respectively.

hide_offline_users
------------------

* Default:  ``false``

If set to ``true``, then don't show offline users.

hide_open_bookmarks
-------------------

* Default:  ``false`` (``true`` when the :ref:`view_mode` is set to ``fullscreen``).

This setting applies to the ``converse-bookmarks`` plugin and specfically the
list of bookmarks shown in the ``Rooms`` tab of the control box.

By default all bookmarks are shown in that list, if this setting is set to
``true``, then only bookmarks for rooms not currently open (i.e. that the
current user hasn't joined), are shown.

Makes sense to set this to ``true`` when also using the non-core
``converse-roomslist`` plugin, which shows a list of currently open (i.e.
"joined") rooms.

.. _`i18n`:

i18n
----

* Default:  Auto-detection of the User/Browser language or ``en``;

Specify the locale/language.

The translations for that locale must be available in JSON format at the
`locales_url`_

If an explicit locale is specified via the ``i18n`` setting and the
translations for that locale are not found at the `locales_url``, then 
then Converse will fall back to trying to determine the browser's language
and fetching those translations, or if that fails the default English texts
will be used.

idle_presence_timeout
---------------------

* Default:  ``300``

The amount of seconds after which the user is considered to be idle
and an idle presence according to XEP-0319 is sent.

If the given value is negative or ``0``, this feature is disabled.

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

Determines whether Converse will maintain the chat session across page
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
    `XEP-0198 <https://xmpp.org/extensions/xep-0198.html>`_, specifically
    with regards to "stream resumption".

.. _`locales`:

locales
-------

* Default:

.. code-block:: javascript

    locales: [
        'af', 'ca', 'de',
        'es', 'en', 'fr',
        'he', 'hu', 'id',
        'it', 'ja', 'nb',
        'nl', 'pl', 'pt_BR',
        'ru', 'uk', 'zh'
    ]

This setting restricts the locales that are supported by Converse and
therefore what may be given as value for the :ref:`i18n` option.

Any other locales will be ignored.

When self-hosting, also make sure that the locales are served and therefore
fetchable (via ``XMLHttpRequest``) at the URL specified by :ref:`locales-url`.

.. _`locales-url`:

locales_url
-----------

* Default: ``/locale/{{{locale}}}/LC_MESSAGES/converse.json``,

The URL from where Converse should fetch translation JSON.

The three curly braces ``{{{ }}}`` are
`Mustache <https://github.com/janl/mustache.js#readme>`_-style
variable interpolation which HTML-escapes the value being inserted. It's
important that the inserted value is HTML-escaped, otherwise a malicious script
injection attack could be attempted.

The variable being interpolated via the curly braces is ``locale``, which is
the value passed in to the `i18n`_ setting, or the browser's locale or the
default local or `en` (resolved in that order).

From version 3.3.0, Converse no longer bundles all translations into its
final build file. Instead, only the relevant translations are fetched at
runtime.

This change also means that it's no longer possible to pass in the translation
JSON data directly into ``_converse.initialize`` via the `i18n`_ setting.
Instead, you only specify the language code (e.g. `de`) and that language's
JSON translations will automatically be fetched via XMLHTTPRequest at
``locales_url``.

locked_domain
-------------

* Default:  ``undefined``

Similar to `default_domain`_ but no other domains are allowed.

For example, if ``locked_domain`` is set to ``example.org``, then the user
``johnny@example.org`` can log in with only ``johnny``.

Additionally, only users registered on the ``example.org`` host can log in, no
other users are allowed to log in.

locked_muc_domain
-----------------

* Default: ``false``

This setting allows you to restrict the multi-user chat (MUC) domain to only the value
specified in `muc_domain`_.


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

* Default:  ``20000``

The amount of time (in milliseconds) to wait when requesting archived messages
from the XMPP server.

Used in conjunction with `message_archiving` and in context of `XEP-0313: Message Archive Management <https://xmpp.org/extensions/xep-0313.html>`_.

message_carbons
---------------

* Default:  ``true``

Support for `XEP-0280: Message Carbons <https://xmpp.org/extensions/xep-0280.html>`_

In order to keep all IM clients for a user engaged in a conversation,
outbound messages are carbon-copied to all interested resources.

This is especially important in webchat, like Converse, where each browser
tab serves as a separate IM client.

Both message_carbons and `forward_messages`_ try to solve the same problem
(showing sent messages in all connected chat clients aka resources), but go about it
in two different ways.

Message carbons is the XEP (Jabber protocol extension) specifically drafted to
solve this problem, while `forward_messages`_ uses
`stanza forwarding <http://www.xmpp.org/extensions/xep-0297.html>`_

muc_disable_moderator_commands
------------------------------

* Default: ``false``

Allows you to disable the moderator commands such as ``/kick`` or ``/ban``.
Ìf set to ``true`` all commands will be disabled.

You can also selectively disable some moderator commands by setting it to an
array of commands you don't want.

The following example will disable 'mute' and 'voice' command:

.. code-block:: javascript

    muc_disable_moderator_commands: ['mute', 'voice'],

muc_domain
----------

* Default:  ``undefined``

The default MUC (multi-user chat) domain that should be used.

When setting this value, users can only enter the name when opening a new MUC,
and don't have to add the whole address (i.e. including the domain part).

Users can however still enter the domain and they can still open MUCs with
other domains.

If you want to restrict MUCs to only this domain, then set `locked_domain`_ to
``true``.

muc_history_max_stanzas
-----------------------

* Default:  ``undefined``

This option allows you to specify the maximum amount of messages to be shown in a
chatroom when you enter it. By default, the amount specified in the room
configuration or determined by the server will be returned.

Please note, this option is not related to
`XEP-0313 Message Archive Management <https://xmpp.org/extensions/xep-0313.html>`_,
which also allows you to show archived chatroom messages, but follows a
different approach.

If you're using MAM for archiving chatroom messages, you might want to set
this option to zero.

muc_instant_rooms
------------------

* Default: ``true``

Determines whether 'instant' (also called 'dynamic' in OpenFire) rooms are created.
Otherwise rooms first have to be configured before they're available to other
users (so-called "registered rooms" in `MUC-0045 <https://xmpp.org/extensions/xep-0045.html#createroom>`_).

From a UX perspective, if this settings is `false`, then a configuration form will
render, that has to be filled in first, before the room can be joined by other
users.

muc_nickname_from_jid
---------------------

* Default: ``false``

When set to ``true``, then users will not be prompted to provide nicknames for
chatrooms. Instead, the node part of a user's JID (i.e. JID = node@domain/resource)
will be used. If the user's nickname is already taken by another user in the
chatroom, then an integer will be added to make it unique.

So, for example, if john@example.com joins a chatroom, his nickname will
automatically be "john". If now john@differentdomain.com tries to join the
room, his nickname will be "john-2", and if john@somethingelse.com joins, then
his nickname will be "john-3", and so forth.

muc_respect_autojoin
--------------------

* Default; ``true``

Determines whether Converse will respect the autojoin-attribute of bookmarks. Per default
all MUCs with set autojoin flag in their respective bookmarks will be joined on
startup of Converse. When set to ``false`` no MUCs are automatically joined based on
their bookmarks.

muc_show_join_leave
-------------------

* Default; ``true``

Determines whether Converse will show info messages inside a chatroom
whenever a user joins or leaves it.

nickname
--------

* Default: ``undefined``

This setting allows you to specify the nickname for the current user.
The nickname will be included in presence requests to other users and will also
be used as the default nickname when entering MUC chatrooms.

notify_all_room_messages
------------------------

* Default: ``false``

By default, sound and desktop notifications will only be made when you are
mentioned in a room. If you set this setting to `true`, then you will be
notified of all messages received in a room.

You can also pass an array of room JIDs to this option, to only apply it to
certain rooms.

notification_delay
------------------

* Default: ``5000``

Desktop notifications will be shown for a time of ``notification_delay``
ms. Setting this to ``0`` will make the notification stay until dismissed by
the user (requires browser support).

notification_icon
-----------------

* Default: ``'logo/conversejs-filled.svg'``

This option specifies which icon is shown in HTML5 notifications, as provided
by the ``src/converse-notification.js`` plugin.

oauth_providers
---------------

* Default: ``[]``

Allows you to specify a list of OAuth providers that the user may use to log in
with.

.. note::
    Your XMPP server will have to support Oauth logins

.. code-block:: javascript

        converse.initialize({
            oauth_providers: {
                'github': {
                    'client_id': '1338d9f7ff52b1309b29',
                    'host': 'chat.example.org',
                    'class': 'fa-github-alt',
                    'id': 'github',
                    'name': 'Github'
                },
                'twitter': {
                    'client_id': '0332d98cff83b1999b22',
                    'host': 'chat.example.org',
                    'class': 'fa-twitter',
                    'id': 'twitter',
                    'name': 'Twitter'
                }
            },
        });


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
nickname is mentioned in a chatroom.

Inside the ``./sounds`` directory of the Converse repo you'll see MP3 and Ogg
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

It allows you to specify a URL which Converse will call when it needs to get
the RID and SID (Request ID and Session ID) tokens of a BOSH connection, which
Converse will then attach to.

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
(i.e. this instance of Converse).

The priority of a given XMPP chat client determines the importance of its presence
stanzas in relation to stanzas received from other clients of the same user.

In Converse, the indicated chat status of a roster contact will be taken from the
presence stanza (and associated resource) with the highest priority.

If multiple resources have the same top priority, then the chat status will be
taken from the most recent present stanza.

For more info you can read `Section 2.2.2.3 of RFC-3921 <https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.3>`_.

providers_link
--------------

* Default:  ``https://xmpp.net/directory.php``

The hyperlink on the registration form which points to a directory of public
XMPP servers.

push_app_servers
----------------

* Default: ``[]``

This option lets you enable or disable so-called push notification "App Servers"
(as per `XEP-0357 <https://xmpp.org/extensions/xep-0357.html>`_).

For each "App Server" an object needs to be passed in. When enabling, you need
to specify ``jid`` and ``node`` values. You can also provide a
``secret``, if required by your App Server.

When disabling, you need to specify at least a ``jid`` and set ``disabled`` to
``true``. This will disable notifications to all pubsub nodes on that "App
Server". If you want to disable only a particular node, then specify a ``node``
value as well.

For example:


.. code-block:: javascript

        converse.initialize({
            'push_app_servers':  [{
                'jid': 'push-4@client.example',
                'node': 'yxs32uqsflafdk3iuqo',
                'disable': true
            }, {
                'jid': 'push-5@client.example',
                'node': 'yxs32uqsflafdk3iuqo',
            }]
        });


.. _`roomconfig_whitelist`:

roomconfig_whitelist
--------------------

* Default: ``[]``

A list of room config-option names. If this list is non-empty, only the corresponding room
config-options will be shown in the room configuration form. The default will show all options.

In the following example the user can only see (and thus change) the roomname and nothing else:

.. code-block:: javascript

    roomconfig_whitelist: ['muc#roomconfig_roomname'],

root
----

* Default: ``window.document``

When using Converse inside a web component's shadow DOM, you will need to set this settings'
value to the shadow-root of the shadow DOM.

For example:

.. code-block:: javascript

  class CustomChatComponent extends HTMLElement {
    constructor() {
      super();
      const shadowRoot  = this.attachShadow({mode: "open"});
      this.initConverse(shadowRoot);
    }

    initConverse(shadowRoot) {
        window.addEventListener("converse-loaded", function(event) {
            converse.initialize({
                root: shadowRoot,
                // Other settings go here...
            });
        });
      }
    }


roster_groups
-------------

* Default:  ``true``

If set to ``true``, Converse will show any roster groups you might have configured.

.. note::
    It's currently not possible to use Converse to assign contacts to groups.
    Converse can only show users and groups that were previously configured
    elsewhere.

show_chatstate_notifications
----------------------------

* Default:  ``false``

Specifies whether chat state (online, dnd, away) HTML5 desktop notifications should be shown.

show_client_info
----------------

* Default:  ``true``

Specifies whether the info icon is shown on the controlbox which when clicked opens an
"About" modal with more information about the version of Converse being used.

show_controlbox_by_default
--------------------------

* Default:  ``false`` (``true`` when the ``view_mode`` is set to ``fullscreen``)

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

If set to ``true``, notifications will be shown in the following cases:

* the browser is not visible nor focused and a private message is received.
* the browser is not visible nor focused and a groupchat message is received which mentions you.
* `auto_subscribe` is set to `false` and a new contact request is received.

If set to ``all``, notifications will be shown even if the above conditions are
not fulfilled.

Requires the `src/converse-notification.js` plugin.

use_system_emojis
-----------------
* Default: ``true``

Determines whether emojis should be rendered by the user's system.

Not all operating systems support (all) emojis. So alternatively you can let
Converse render the emojis with [Twemoji](https://twemoji.twitter.com/).

See also `emoji_image_path`_.

send_chat_state_notifications
-----------------------------

* Default: ``true``

Determines whether chat state notifications (see `XEP-0085 <https://xmpp.org/extensions/xep-0085.html>`_)
should be sent out or not.

show_images_inline
------------------

* Default:  ``true``

If set to false, images won't be rendered in chats, instead only their links will be shown.

show_only_online_users
----------------------

* Default:  ``false``

If set to ``true``, only online users will be shown in the contacts roster.
Users with any other status (e.g. away, busy etc.) will not be shown.

show_send_button
----------------

* Default:  ``false``

If set to ``true``, a button will be visible which can be clicked to send a message.

sounds_path
-----------

* Default: ``sounds/``

This option only makes sense in conjunction with the `play_sounds`_ option and
specifies the URL of the sound files to be played (exluding the file names
themselves).

In order to support all browsers we need both an MP3 and an Ogg file. Make sure
to name your files ``msg_received.ogg`` and ``msg_received.mp3``.


sticky_controlbox
-----------------

* Default: ``false`` (``true`` when the ``view_mode`` is set to ``fullscreen``).

If set to ``true``, the control box (which includes the login, registration,
contacts and rooms tabs) will not be closeable. It won't have a close button at
all.

The idea behind this setting is to provide a better experience on mobile
devices when the intent is to use Converse as a web app. In this case
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

The Converse plugins architecture can have an :ref:`dependencies`
plugin attribute. This enables you to specify an array of other plugins which
this one depends on.
Converse (more specifically, `pluggable.js <https://jcbrand.github.io/pluggable.js/>`_)
will first load these dependencies before executing the plugin's overrides and
calling its ``initialize`` method.

This is especially important if you register event handlers in your plugin for
events that fire in other plugins. In this case, you want to specify those
other plugins as dependencies.

If ``strict_plugin_dependencies`` is set to ``false``, an error won't be raised
if the optional dependencies aren't found.

synchronize_availability
------------------------

* Default: ``true``

Valid options: ``true``, ``false``, ``a resource name``.

This option lets you synchronize your chat status (`online`, `busy`, `away`) with other chat clients. In other words,
if you change your status to `busy` in a different chat client, your status will change to `busy` in Converse as well.

If set to ``true``, Converse will synchronize with all other clients you are logged in with.

If set to ``false``, this feature is disabled.

If set to ``a resource name``, Converse will synchronize only with a client that has that particular resource assigned to it.

theme
-----

* Default: ``default``

Valid options: ``default``, ``concord``

Let's you set a color theme for Converse.


trusted
-------

* Default: ``true``

This setting determines whether the default value of the "This is a trusted device"
checkbox in the login form.

When the current device is not trusted, then the cache will be cleared when
the user logs out.

Additionally, it determines the type of `browser storage <https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Storage>`_
(``localStorage`` or ``sessionStorage``) used by Converse to cache user data.

If ``trusted`` is set to ``false``, then ``sessionStorage`` is used instead of
``localStorage``.

The main difference between the two is that ``sessionStorage`` only persists while
the current tab or window containing a Converse instance is open. As soon as
it's closed, the data is cleared (as long as there aren't any other tabs with
the same domain open).

Data in ``localStorage`` on the other hand is kept indefinitely.

The data that is cached includes your sent and received messages, which chats you had
open, what features the XMPP server supports and what your online status was.

Clearing the cache makes Converse much slower when the user logs
in again, because all data needs to be fetch anew.

If ``trusted`` is set to ``on`` or ``off`` the "This is a trusted device"
checkbox in the login form will not appear at all and cannot be changed by the user.
``on`` means to trust the device as stated above and use ``localStorage``. ``off``
means to not trust the device (cache is cleared when the user logs out) and to use
``sessionStorage``.

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

If set to ``true``, Converse will automatically try to initiate an OTR (off-the-record)
encrypted chat session every time you open a chatbox.

visible_toolbar_buttons
-----------------------

* Default:

.. code-block:: javascript

    {
        call: false,
        spoiler: false,
        emoji: true,
        toggle_occupants: true
    }

Allows you to show or hide buttons on the chatboxes' toolbars.

* *call*:
    Provides a button with a picture of a telephone on it.
    When the call button is pressed, it will emit an event that can be used by a third-party library to initiate a call.

    .. code-block:: javascript

        converse.listen.on('callButtonClicked', function(data) {
            console.log('Strophe connection is', data.connection);
            console.log('Bare buddy JID is', data.model.get('jid'));
            // ... Third-party library code ...
        });
* *emoji*:
    Enables rendering of emoji and provides a toolbar button for choosing them.
* *spoiler*:
    Shows a button for showing`XEP-0382 <https://xmpp.org/extensions/xep-0382.html>`_ spoiler messages.
* *toggle_occupants*:
    Shows a button for toggling (i.e. showing/hiding) the list of occupants in a chatroom.

.. _`websocket-url`:

websocket_url
-------------

* Default: ``undefined``

This option is used to specify a
`websocket <https://developer.mozilla.org/en/docs/WebSockets>`_ URI to which
Converse can connect to.

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
    Converse does not yet support "keepalive" with websockets.

.. _`view_mode`:

view_mode
---------

* Default: ``overlayed``
* Allowed values: ``overlayed``, ``fullscreen``, ``mobile``, ``embedded``

The ``view_mode`` setting configures Converse's mode and resulting behavior.

* ``overlayed`` is the original mode, in which the chats appeared as small boxes overlaying a webpage which can contain arbitrary content.
* ``fullscreen`` is for a fullpage and single-page app.
* ``embedded`` is used to embed a single chat into a DOM element in the page. The DOM element must have the id ``#conversejs``.
* ``mobile`` is for smaller viewports. Converse is responsive, and the other views will also resize to fit a smaller viewport, but certain behavioural changes won't be made. For example, when using ``overlayed`` in a mobile view, Converse won't know which chat is currently visible and therefore won't be able to properly show notifications for chats that are obscured.

.. note::

    Before the introduction of this setting (in version 3.3.0), there were there
    different builds, each for the different modes.

    These were:

    * ``converse-mobile.js`` for the ``mobile`` mode
    * ``converse-muc-embedded.js`` for embedding a single MUC room into a DOM element with id ``conversejs``
    * ``converse.js`` for the ``overlayed`` mode
    * ``inverse.js`` for the ``fullscreen`` mode

    Besides having different builds, certain plugins had to be whitelisted
    and blacklisted for the different modes.

    ``converse-singleton`` had to be whitelisted for the ``mobile`` and ``fullscreen``
    modes, additionally ``converse-inverse`` had to be whitelisted for the
    ``fullscreen`` mode.

    For both those modes the ``converse-minimize`` and ``converse-dragresize``
    plugins had to be blacklisted.

    When using ``converse-muc-embedded.js`` various plugins also had to manually be
    blacklisted.

    Since version 3.3.0 it's no longer necessary to blacklist any plugins (except
    for ``converse-muc-embedded.js``, which is from version 3.3.3).

    Blacklisting now happens automatically.

    Since version 3.3.0, the ``inverse.js`` and ``converse-mobile.js`` builds no
    longer exist. Instead the standard ``converse.js`` build is used, together with
    the appropriate ``view_mode`` value.

    Since version 4.0.0, there is now also only one CSS file to be used for all
    the different view modes, ``converse.css``.

    The ``converse-muc-embedded.js`` build can still be built, because it's smaller
    than ``converse.js`` due to unused code being removed. It doesn't however contain
    any new code, so the full ``converse.js`` build could be used instead, as long
    as ``view_mode`` is set to ``embedded``.

    Furthermore, it's no longer necessary to whitelist or blacklist any plugins
    when switching view modes.


.. _`whitelisted_plugins`:

whitelisted_plugins
-------------------

* Default: ``[]``

A list of plugin names that are whitelisted and will therefore be
initialized once ``converse.initialize`` is called.

From Converse 3.0 onwards most of the API is available only to plugins and
all plugins need to be whitelisted first.

This is done to prevent malicious scripts from using the API to trick users or
to read their conversations.

By default all the core plugins are already whitelisted.

These are::

    converse-bookmarks
    converse-chatboxes
    converse-chatview
    converse-controlbox
    converse-core
    converse-disco
    converse-dragresize
    converse-fullscreen
    converse-headline
    converse-mam
    converse-minimize
    converse-muc
    converse-muc-embedded
    converse-notification
    converse-otr
    converse-ping
    converse-profile
    converse-register
    converse-roomslist
    converse-rosterview
    converse-singleton
    converse-spoilers
    converse-vcard'

.. note::
    If you are using a custom build which excludes some core plugins, then you
    should blacklist them so that malicious scripts can't register their own
    plugins under those names. See `blacklisted_plugins`_ for more info.

Example:

.. code-block:: javascript

    require(['converse-core', 'converse-muc-embedded'], function (converse) {
        converse.initialize({
            // other settings removed for brevity
            whitelisted_plugins: ['myplugin']
        });
    });


xhr_user_search_url
-------------------

.. note::
    XHR stands for XMLHTTPRequest, and is meant here in the AJAX sense (Asynchronous JavaScript and XML).

* Default: ``null``

There are two ways to add users.

* The user inputs a valid JID (Jabber ID, aka XMPP address), and the user is added as a pending contact.
* The user inputs some text (for example part of a first name or last name),
  an XHR (Ajax Request) will be made to a remote server, and a list of matches are returned.
  The user can then choose one of the matches to add as a contact.

By providing an XHR search URL, you're enabling the second mechanism.

*What is expected from the remote server?*

A default JSON encoded list of objects must be returned. Each object
corresponds to a matched user and needs the keys ``jid`` and ``fullname``.

.. code-block:: javascript

    [{"jid": "marty@mcfly.net", "fullname": "Marty McFly"}, {"jid": "doc@brown.com", "fullname": "Doc Brown"}]

.. note::
    Make sure your server script sets the header `Content-Type: application/json`.

This is the URL to which an XHR GET request will be made to fetch user data from your remote server.
The query string will be included in the request with ``q`` as its key.

The data returned must be a JSON encoded list of user JIDs.

.. note::
    Converse will construct the XHR get URL by simply appending
    ``q=<query string entered>`` to the URL given by ``xhr_user_search_url``.
    It is therefore important that the necessary question mark (``?``) preceding the
    URL's query component or necessary delimiters (``&``) are included. See valid
    examples below.

Examples:

.. code-block:: javascript

    xhr_user_search_url: 'https://some.url/some_path?',

    xhr_user_search_url: 'https://some.url/some_path?api_key=somekey&',
