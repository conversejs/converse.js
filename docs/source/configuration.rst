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

.. _`configuration-settings`:

Configuration settings
======================

.. _`allowed_audio_domains`:

allowed_audio_domains
---------------------

* Default: ``null``

If falsy, all domains are allowed. Set it to an array to specify a whitelist of allowed domains.


.. _`allowed_image_domains`:

allowed_image_domains
---------------------

* Default: ``null``

If falsy, all domains are allowed. Set it to an array to specify a whitelist of allowed domains.

E.g. ``['imgur.com', 'imgbb.com']``

.. _`allowed_video_domains`:

allowed_video_domains
---------------------

* Default: ``null``

If falsy, all domains are allowed. Set it to an array to specify a whitelist of allowed domains.

E.g. ``['imgur.com']``

authentication
--------------

* Default:  ``login``
* Allowed values: `login`_, `external`, `anonymous`_, `prebind`_

This option states the way Converse will authenticate.

login
~~~~~

The default means is ``login``, which means that the user either logs in manually with their
username and password, or automatically if used together with `auto_login`_ set to ``true``
and ``jid`` and ``password`` values.

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

.. _`prebind`:

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

In addition to setting `authentication`_ to ``prebind``, you'll also need to
set the `prebind_url`_ and `bosh-service-url`_.

Here's an example of Converse being initialized with these options:

.. code-block:: javascript

    converse.initialize({
        bosh_service_url: 'https://bind.example.com',
        jid: 'me@example.com',
        authentication: 'prebind',
        prebind_url: 'http://example.com/api/prebind',
        auto_login: true,
        allow_logout: false
    });


allow_adhoc_commands
--------------------

* Default:  ``true``

Allows privileged users to run XEP-0050 Ad-Hoc commands via the settings modal.


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
CSS properties set on a chatboxes (specifically on the ``.chatbox > .box-flyout`` element)
will be honored, IF they are set in pixels.

allow_logout
------------

* Default: ``true``

Determines whether the user is allowed to log out. If set to ``false``, there will be no logout button.


.. _`allow_message_corrections`:

allow_message_corrections
-------------------------

* Default:  ``'all'``
* Possible values: ``'all'``, ``'last'``

Configures the last message correction (LMC) feature of Converse. By default you can edit all of your own
messages. Setting this to ``'last'`` will limit this feature to the message sent most recently as suggested by
`XEP-0308: Last Message Correction <https://xmpp.org/extensions/xep-0308.html>`_.
Setting it to anything else (including ``false``) will disable the ability to correct sent messages.


allow_message_retraction
------------------------

* Default:  ``'all'``
* Possible values: ``'all'``, ``'own'``, ``'moderator'`` or any falsy value

Determines who is allowed to retract messages. If set to ``'all'``, then normal
users may retract their own messages and ``'moderators'`` may retract the messages of
other users.

allow_message_styling
---------------------

* Default:  ``true``
* Possible values: ``true``, ``false``

Determines wehether support for XEP-0393 Message Styling hints are enabled or not.

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
Setting this to ``true`` increases your chances of receiving spam (when using a
federated server), while setting it to ``false`` means that people not on your
roster can't contact you unless one (or both) of you subscribe to one another's
presence (i.e. adding as a roster contact).

allow_public_bookmarks
----------------------

* Default: ``false``

Some XMPP servers don't support private PEP/PubSub nodes, as required for
private bookmarks and outlined in `XEP-0223 <https://xmpp.org/extensions/xep-0223.html>`_.

Even though Converse asks for the bookmarks to be kept private (via the
`<publish-options>` XML node), the server simply ignores the privacy settings
and publishes the node contents under the default privacy setting, which makes
the information available to all roster contacts.

If your XMPP server does not support `XEP-0223`'s ``#publish-options``
feature and you don't mind that your room bookmarks are visible to all
contacts, then you can set this setting to ``true``. Otherwise you won't be
able to have any room bookmarks at all for an account on that XMPP server.

allow_registration
------------------

* Default:  ``true``

Support for `XEP-0077: In band registration <https://xmpp.org/extensions/xep-0077.html>`_

Allow XMPP account registration showing the corresponding UI register form interface.

allow_url_history_change
------------------------

* Default:  ``true``

Allow Converse to change the browser url bar through the History API <https://developer.mozilla.org/en-US/docs/Web/API/History_API>.

allow_user_trust_override
-------------------------

* Default: ``true``
* Allowed values: ``true``, ``false``, ``off``

This setting determines whether a user may decide whether
Converse is ``trusted`` or not (e.g. in the particular browser).

This is done via a *This is a trusted device* checkbox in the login form.
If this setting is set to ``true`` or ``off``, the checkbox will be shown to the user, otherwise not.

When this setting is set to ``true``, the checkbox will be checked by default.
To not have it checked by default, set this setting to ``off``.

If the user indicates that this device/browser is not trusted, then effectively
it's the same as setting `clear_cache_on_logout`_ to ``true``
and `persistent_store`_ to ``sessionStorage``.

``sessionStorage`` only persists while the current tab or window containing a Converse instance is open.
As soon as it's closed, the data is cleared.

The data that is cached (or cleared) includes your sent and received messages, which chats you had
open, what features the XMPP server supports and what your online status was.

Clearing the cache makes Converse much slower when the user logs in again, because all data needs to be fetch anew.


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


autocomplete_add_contact
------------------------

* Default: ``true``

Determines whether search suggestions are shown in the "Add Contact" modal.


auto_focus
----------

* Default:  ``true``

If set to ``true``, the textarea for composing chat messages will automatically
become focused as soon as a chat is opened. This means you don't need to click
the textarea first before starting to type a message. This also applies to the
username field which is automatically focused after the login controlbox is
loaded.

For applications where chat is not the main feature, automatic focus of the
chat box might be undesired.


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

If `authentication`_ is set to ``login``, then you will also need to provide a
valid ``jid`` and ``password`` values, either manually by passing them in, or
by the `credentials_url`_ setting. Setting a ``credentials_url`` is preferable
to manually passing in ``jid`` and ``password`` values, because it allows
better reconnection with `auto_reconnect`_. When the connection drops,
Converse will automatically fetch new login credentials from the
``credentials_url`` and reconnect.

If `authentication`_ is set to ``anonymous``, then you will also need to provide the
server's domain via the `jid`_ setting.

This is a useful setting if you'd like to create a custom login form in your
website. You'll need to write some JavaScript to accept that custom form's
login credentials, then you can pass those credentials (``jid`` and
``password``) to ``converse.initialize`` to start Converse and log the user
in to their XMPP account.

.. note::

  The interaction between ``keepalive`` and ``auto_login`` is unfortunately
  inconsistent depending on the `authentication`_ method used.

  If ``auto_login`` is set to ``false`` and `authentication`_ is set to
  ``anonymous``, ``external`` or ``prebind``, then Converse won't automatically
  log the user in.

  If `authentication`_ set to ``login`` the situation is much more
  ambiguous, since we don't have a way to distinguish between wether we're
  restoring a previous session (``keepalive``) or whether we're
  automatically setting up a new session (``auto_login``).

  So currently if EITHER ``keepalive`` or ``auto_login`` is ``true`` and
  `authentication`_ is set to ``login``, then Converse will try to log the user in.


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

This option works best when you have `authentication`_ set to ``prebind`` and have
also specified a ``prebind_url`` URL, from where Converse can fetch the BOSH
tokens. In this case, Converse will automaticallly reconnect when the
connection drops but also reestablish earlier lost connections (due to
network outages, closing your laptop etc.).

When `authentication`_ is set to `login`, then this option will only work when
the page hasn't been reloaded yet, because then the user's password has been
wiped from memory. This configuration can however still be useful when using
Converse in desktop apps, for example those based on `CEF <https://bitbucket.org/chromiumembedded/cef>`_
or `electron <http://electron.atom.io/>`_.

auto_register_muc_nickname
--------------------------

* Default: ``false``
* Allowed values: ``false``, ``true``, ``'unregister'``

If truthy, Converse will automatically register a user's nickname upon entering
a groupchat.

See here fore more details: https://xmpp.org/extensions/xep-0045.html#register

If set to ``'unregister'``, then the user's nickname will be registered
(because it's a truthy value) and also be unregistered when the user
permanently leaves the MUC by closing it.

auto_subscribe
--------------

* Default:  ``false``

If true, the user will automatically subscribe back to any contact requests.

auto_join_on_invite
-------------------

* Default:  ``false``

If true, the user will automatically join a chatroom on invite without any confirm.
Also inviting users won't be prompted for a reason.


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
specifies the room's JID and other options.

For example::

    `[{'jid': 'room@example.org', 'nick': 'WizardKing69', 'minimized': true }]`


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

    converse-bosh
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
    converse-ping
    converse-profile
    converse-register
    converse-roomslist
    converse-rosterview
    converse-singleton
    converse-smacks
    converse-spoilers
    converse-vcard

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

Example: ``http://xmpp.example.com:5280/bosh/``

Example with reverse-proxy and TLS: ``https://xmpp.example.com/bosh/``

To connect to an XMPP server over HTTP you need a `BOSH <https://en.wikipedia.org/wiki/BOSH>`_
connection manager which acts as a middle man between the HTTP and XMPP
protocols.

The bosh_service_url setting takes the URL of a BOSH connection manager.

Please refer to your XMPP server's documentation on how to enable BOSH.
For more information, read this blog post: `Which BOSH server do you need? <http://metajack.im/2008/09/08/which-bosh-server-do-you-need>`_

A more modern alternative to BOSH is to use `websockets <https://developer.mozilla.org/en/docs/WebSockets>`_.
Please see the :ref:`websocket-url` configuration setting.


clear_cache_on_logout
---------------------

* Default: ``false``

If set to ``true``, all locally cached data will be cleared when the user logs out,
regardless of the `persistent_store`_ being used (``localStorage``, ``IndexedDB`` or ``sessionStorage``).

*Note*: If `allow_user_trust_override`_ is set to ``true`` and the user
indicates that this device/browser is **not** trusted, then the cache will be
cleared on logout, even if this setting is set to ``true``.

*Note*: If this setting is set to ``true``, then OMEMO will be disabled, since
otherwise it won't be possible to decrypt archived messages that were
already decrypted previously (due to forward security).


clear_messages_on_reconnection
------------------------------

* Default: ``false``

In some cases, it might be desirable to clear cached chat messages once you've
reconnected to the XMPP server.

For example, if you want to prevent the chat history from getting too long or
if you want to avoid gaps in the chat history (for example due to MAM not
returning all messages since the last cached message).

Beware, if you're using OMEMO, then you probably don't want to set this setting to
``true``. OMEMO messages can be decrypted only once, so if they then
subsequently get cleared, you won't get the plaintext back.


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

Restricting the supported authentication mechanisms:
****************************************************

As an example, suppose you want to restrict the supported SASL authentication
mechanisms, then you'd pass in the ``mechanisms`` as a ``connection_options``
``key:value`` pair:

.. code-block:: javascript

        converse.initialize({
            connection_options: {
                'mechanisms': [
                    converse.env.Strophe.SASLMD5,
                ]
            }
        });

Running the XMPP Connection inside a shared worker
**************************************************

Newer versions of Strophe.js, support the ability to run the XMPP Connection
inside a `shared worker <https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker>`_ that's shared
between open tabs in the browser in which Converse is running (and which have the same domain).

*Note:* This feature is experimental and there currently is no way to
synchronize actions between tabs. For example, sent 1-on-1 messages aren't
reflected by the server, so you if you send such a message in one tab, it won't
appear in another.


.. code-block:: javascript

        converse.initialize({
            connection_options: { 'worker': true }
        });


.. _`credentials_url`:

credentials_url
---------------

* Default:  ``null``
* Type:  URL

This setting should be used in conjunction with `authentication`_ set to ``login``.

It allows you to specify a URL which Converse will call when it needs to get
the username and password (or authentication token) which Converse will use
to automatically log the user in.

If `auto_reconnect`_ is also set to ``true``, then Converse will automatically
fetch new credentials from the ``credentials_url`` whenever the connection or
session drops, and then attempt to reconnect and establish a new session.

If the request to the ``credentials_url`` URL fails for whatever reason,
Converse will continuously retry to fetch the credentials every 2 seconds.

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

.. _`loglevel`:

loglevel
--------

* Default:  ``'info'``
* Allowed values: ``'debug'``, ``'info'``, ``'warn'``, ``'error'``, ``'fatal'``

You can also set this value by changing a URL fragment `#converse?loglevel=debug`

dark_theme
----------

* Default:  ``'dracula'``

The theme being used in dark mode.

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

default_state
-------------

* Default: ``'online'``

The default chat status that the user wil have. If you for example set this to
``'chat'``, then Converse will send out a presence stanza with ``"show"``
set to ``'chat'`` as soon as you've been logged in.


discover_connection_methods
---------------------------

* Default: ``true``

Use `XEP-0156 <https://xmpp.org/extensions/xep-0156.html>`_ to discover whether
the XMPP host for the current user advertises any Websocket or BOSH connection
URLs that can be used.

If this is set to ``false``, then a `websocket_url`_ or `bosh_service_url`_ need to be
set.

Currently only the XML encoded host-meta resource is supported as shown in
`Example 2 under section 3.3 <https://xmpp.org/extensions/xep-0156.html#httpexamples>`_.


domain_placeholder
------------------

* Default: ``e.g. conversejs.org``

The placeholder text shown in the domain input on the registration form.


emoji_categories
----------------

* Default:

::

    {
      "smileys": ":grinning:",
      "people": ":thumbsup:",
      "activity": ":soccer:",
      "travel": ":motorcycle:",
      "objects": ":bomb:",
      "nature": ":rainbow:",
      "food": ":hotdog:",
      "symbols": ":musical_note:",
      "flags": ":flag_ac:",
      "custom": ":converse:"
    }


This setting lets you define the categories that are available in the emoji
picker, as well as the default image that's shown for each category.

The keys of the map are the categories and the values are the shortnames of the
representative images.

If you want to remove a category, don't just remove the key, instead set its
value to ``undefined``.

Due to restrictions intended to prevent addition of undeclared configuration
settings, it's not possible to add new emoji categories. There is however a
``custom`` category where you can put your own custom emojis (also known as
"stickers").

To add custom emojis, you need to edit ``src/headless/emojis.json`` to add new
entries to the map under the  ``custom`` key.


emoji_categories_label
----------------------

* Default:

::

    {
      "smileys": "Smileys and emotions",
      "people": "People",
      "activity": "Activities",
      "travel": "Travel",
      "objects": "Objects",
      "nature": "Animals and nature",
      "food": "Food and drink",
      "symbols": "Symbols",
      "flags": "Flags",
      "custom": "Stickers"
    }


This setting lets you pass in the text value that goes into the `title`
attribute for the emoji categories. These strings will be translated, but for
your custom text to be translatable, you'll need to wrap it in `__()``
somewhere in your own code.

emoji_image_path
----------------

* Default: ``'https://twemoji.maxcdn.com/2/'``

When `use_system_emojis`_ is set to ``false``, then this is the URL from where image files for
displaying emojis will be fetched.

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

enable_smacks
-------------

* Default: ``false``

Determines whether `XEP-0198 Stream Management <https://xmpp.org/extensions/xep-0198.html>`_
support is turned on or not.

Recommended to set to ``true`` if a websocket connection is used.
Please see the :ref:`websocket-url` configuration setting.

filter_by_resource
------------------

* Default:  ``false``

Before version 1.0.3 Converse would ignore received messages if they were
intended for a different resource then the current user had. It was decided to
drop this restriction but leave it configurable.

filter_url_query_params
-----------------------

* Default: ``null``

Accepts a string or array of strings. Any query strings from URLs that match this setting will be removed.

fullname
--------

If you are using prebinding, can specify the fullname of the currently
logged in user, otherwise the user's vCard will be fetched.

geouri_regex
------------

* Default:  ``/https:\/\/www.openstreetmap.org\/.*#map=[0-9]+\/([\-0-9.]+)\/([\-0-9.]+)\S*/g``

Regular expression used to extract geo coordinates from links to openstreetmap.

geouri_replacement
------------------

* Default:  ``'https://www.openstreetmap.org/?mlat=$1&mlon=$2#map=18/$1/$2'``

String used to replace geo-URIs with. Ought to be a link to osm or similar. ``$1`` and ``$2`` is replaced by
latitude and longitude respectively.

hide_muc_participants
---------------------

* Default:  ``false``

Option which allows you to hide the participants list by default.


hide_offline_users
------------------

* Default:  ``false``

If set to ``true``, then offline users aren't shown in the roster.

hide_open_bookmarks
-------------------

* Default:  ``false`` (``true`` when the `view_mode`_ is set to ``fullscreen``).

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

The translations for that locale must be served in JSON format at `/dist/locales/${i18n}-LC_MESSAGES-converse-po.js`.
The default webpack configuration for Converse.js ensures that these files are
generated and placed in the right location.

If an explicit locale is specified via the ``i18n`` setting and the
translations for that locale are not found, then Converse will fall back to trying to determine the browser's language
and fetching those translations, or if that fails the default English strings will be used.

idle_presence_timeout
---------------------

* Default:  ``300``

The amount of seconds after which the user is considered to be idle
and an idle presence according to XEP-0319 is sent.

If the given value is negative or ``0``, this feature is disabled.

image_urls_regex
----------------

* Default: ``null``

Any URL in a message that matches the regex in this setting will be considered an image and rendered, if `show_images_inline`_ is set to ``true``.
If the image cannot be rendered, a hyperlink will be rendered instead.


For example, to render Imgur images inline, you can use the following regex: ``/^https?:\/\/(?:www.)?(?:imgur\.com\/\w{7})\/?$/i``

jid
---

The Jabber ID or "JID" of the current user. The JID uniquely identifies a user
on the XMPP network. It looks like an email address, but it's used for instant
messaging instead.

This value may be provided together with a ``password`` instead of supplying a
`credentials_url`_ when setting ``auto_login`` to ``true``.

.. _`keepalive`:

keepalive
---------

* Default:    ``true``

Determines whether Converse will attempt to keep you logged in across page loads.

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
* Allowed values: ``false``, ``true``, ``'hidden'``

By setting this value to something truthy, you restrict the multi-user chat (MUC) domain to only the value
specified in `muc_domain`_.

If the value is set to `'hidden'` (which is also truthy), then the MUC domain
will not be shown to users.

locked_muc_nickname
-------------------

* Default: ``false``

This setting allows you to restrict the multi-user chat (MUC) nickname that a
user uses to a particular value.

Where the nickname value comes from depends on other settings.

The `nickname`_ configuration setting takes precedence ahead of any other
nickname value. If that's not set, then the "nickname" value from the user's
VCard is taken, and if that is not set but `muc_nickname_from_jid`_ is set to
``true``, then the node of the user's JID (the part before the ``@``) is used.

If no nickame value is found, then an error will be raised.

mam_request_all_pages
---------------------

* Default: ``true``

When requesting messages from the archive, Converse will ask only for messages
newer than the most recent cached message.

When there are many archived messages since that one, the returned results will
be broken up in to pages, set by `archived_messages_page_size`_.

By default Converse will request all the pages until all messages have been
fetched, however for large archives this can slow things down dramatically.

This setting turns the paging off, and Converse will only fetch the latest
page.

.. note::

  If paging is turned off, there will appear gaps in the message history.
  Converse currently doesn't yet have a way to inform the user of these gaps or
  to let them be filled.


muc_hats
--------

* Default: ``['xep317']``

Since version 7 Converse now has rudimentary support for `XEP-0317 Hats <https://xmpp.org/extensions/xep-0317.html>`_.

It is also possible to display VCard roles, MUC affiliation and MUC role along with hats.
By default only XEP-0317 hats are considered.
For the inclusion of VCard roles ``'vcard_roles'`` must be added to the list.
For the inclusion of MUC affiliation and MUC role, the specific affiliations and roles
to be used must be added to the list e.g. ``'owner','participant'``.

Example:

For XEP-0317 hats and VCard roles this setting should be set to:
``'muc_hats': ['xep317', 'vcard_roles']``

For VCard roles, admin MUC affiliation and moderator MUC role:
``'muc_hats': ['vcard_roles', 'admin', 'moderator']``

And to prevent the displaying of anything, an empty list must be used:
``'muc_hats': []``


muc_mention_autocomplete_min_chars
-----------------------------------

* Default:  ``0``

The number of characters that need to be entered before the auto-complete list
of matching nicknames is shown.

muc_mention_autocomplete_filter
-------------------------------

* Default:  ``contains``

The method used for filtering MUC participants when using auto-complete.
Valid values are ``contains`` and ``starts_with``.

muc_mention_autocomplete_show_avatar
------------------------------------

* Default:  ``true``

Show avatars of MUC participants when using auto-complete.

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

Used in conjunction with ``message_archiving`` and in context of `XEP-0313: Message Archive Management <https://xmpp.org/extensions/xep-0313.html>`_.

message_carbons
---------------

* Default:  ``true``

Support for `XEP-0280: Message Carbons <https://xmpp.org/extensions/xep-0280.html>`_

In order to keep all IM clients for a user engaged in a conversation,
outbound messages are carbon-copied to all interested resources.

This is especially important with Converse, where each browser
tab serves as a separate IM client.

XEP-0280 requires server support, so make sure that message carbons are enabled
on your server.


message_limit
-------------

* Default:  ``0``

Determines the allowed amount of characters in a chat message. A value of zero means there is no limit.
Note, this limitation only applies to the Converse UX code running in the browser
and it's trivial for an attacker to bypass this restriction.

You should therefore also configure your XMPP server to limit message sizes.

modtools_disable_assign
-----------------------

* Default: ``false``
* Possible Values: ``true``, ``false``, ``['owner', 'admin', 'member', 'outcast', 'none', 'moderator', 'participant', 'visitor']``

This setting allows you to disable (either completely, or fine-grained) which affiliations and or roles
may be assigned in the moderator tools modal.


modtools_disable_query
----------------------

* Default: ``[]``
* Possible Values: ``['owner', 'admin', 'member', 'outcast', 'none', 'moderator', 'participant', 'visitor']``

This setting allows you to disable which affiliations or roles may be queried in the moderator tools modal.
If all roles or all affiliations are disabled, then the relevant tab won't be
showed at all.


muc_clear_messages_on_leave
---------------------------

* Default: ``true``

Starting with Converse 8.0.0, when leaving a MUC, all cached messages in the history is cleared.

Note: This means that you lose your history of decrypted OMEMO messages and cannot recover it.


muc_disable_slash_commands
--------------------------

* Default: ``false``

Allows you to disable the moderator commands such as ``/kick`` or ``/ban``.
Ìf set to ``true`` all commands will be disabled.

You can also selectively disable some moderator commands by setting it to an
array of commands you don't want.

The following example will disable 'mute' and 'voice' command:

.. code-block:: javascript

    muc_disable_slash_commands: ['mute', 'voice'],

muc_domain
----------

* Default:  ``undefined``

The default MUC (multi-user chat) domain that should be used.

When setting this value, users can only enter the name when opening a new MUC,
and don't have to add the whole address (i.e. including the domain part).

Users can however still enter the domain and they can still open MUCs with
other domains.

If you want to restrict MUCs to only this domain, then set `locked_muc_domain`_ to
``true``.


muc_fetch_members
-----------------

* Default:  ``true``

* Possible values: Array containing any of the following: ``['member', 'admin', 'owner']``

Determines whether Converse.js will fetch the member lists for a MUC
(multi-user chat) when the user first enters it.

Here's the relevant part from the MUC XEP: https://xmpp.org/extensions/xep-0045.html#getmemberlist

The MUC service won't necessarily allow any user to fetch member lists,
but can usually be configured to do so.

The member lists consists of three lists of users who have the affiliations
``member``, ``admin`` and ``owner`` respectively.

By fetching member lists, Converse.js will always show these users as
participants of the MUC, giving them a permanent "presence" in the MUC.


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

muc_send_probes
---------------

* Default: ``false``

If set to ``true``,  then whenever Converse receives a MUC message with an author for which we don't have
any information (i.e. because that user is currently not in the MUC), then Converse will send out a ``<presence>``
stanza of type ``probe`` in order to request the authors presence data.

Prosody has support in `trunk` for this.

The point of sending out presence probes is in order to receive
presence-related metadata, such as `XEP-0317 Hats <https://xmpp.org/extensions/xep-0317.html>`_.

.. note::
  Although this behavior is described in the `presence business rules of XEP-0045, section 17.3 point 4 <https://xmpp.org/extensions/xep-0045.html#bizrules-presence>`_,
  few XMPP servers support this.

.. note::
  If member lists are fetched via muc_fetch_members, then the occupants created
  based on those member lists won't be probed again later (given that the
  occupants are already created). Certain metadata like XEP-0317 hats are not
  included in the member lists, which means that this metadata will be missing for
  those occupants.


muc_respect_autojoin
--------------------

* Default; ``true``

Determines whether Converse will respect the autojoin-attribute of bookmarks. Per default
all MUCs with set autojoin flag in their respective bookmarks will be joined on
startup of Converse. When set to ``false`` no MUCs are automatically joined based on
their bookmarks.

muc_roomid_policy
-----------------

* Default: ``null``

This option defines the regular expression that a room id must satisfy to allow the
room creation. Server administrators may want to impose restrictions on the minimum
and maximum length and the allowed character set allowed for room ids. Otherwise
users might create rooms which are difficult to handle.

However, restricting that on the server only leads to bad UX as users might learn of
the servers policy only after they have tried to create a room. Furthermore error
messages from XMPP-servers might not be self-explanatory.

Therefore this option allows converse to already check the policy and disallow the
user from even trying to entering/creating such a room.

As this only makes sense on your own server, the check is applied only if the domain
part equals `muc_domain`_. If `muc_domain`_ is unset, then this check is disabled
completely.

Example:

.. code-block:: javascript

    muc_roomid_policy: /^[a-z0-9._-]{5,40}$/,

See also: `muc_roomid_policy_hint`_

muc_roomid_policy_hint
----------------------

* Default: ``null``

This option can be used in conjuction with `muc_roomid_policy`_ in order to give
a written explanation of the imposed room id policy. You can use the html-tags
``<br>``, ``<b>``, and ``<em>`` to allow some basic styling.

Example:

.. code-block:: javascript

    muc_roomid_policy_hint: '<br><b>Policy for groupchat id:</b><br>- between 5 and 40 characters,<br>- lowercase from a to z (no special characters) or<br>- digits or<br>- dots (.) or<br>- underlines (_) or<br>- hyphens (-),<br>- no spaces<br>',

muc_show_info_messages
----------------------

* Default: List composed of MUC status codes, role changes, join and leave events and affiliation changes. The values of converse.MUC_INFO_CODES below are joined to build the default list:

.. code-block:: javascript

    converse.MUC_AFFILIATION_CHANGES_LIST = ['owner', 'admin', 'member', 'exowner', 'exadmin', 'exmember', 'exoutcast']
    converse.MUC_ROLE_CHANGES_LIST = ['op', 'deop', 'voice', 'mute'];
    converse.MUC_TRAFFIC_STATES_LIST = ['entered', 'exited'];

    converse.MUC_INFO_CODES = {
        'visibility_changes': ['100', '102', '103', '172', '173', '174'],
        'self': ['110'],
        'non_privacy_changes': ['104', '201'],
        'muc_logging_changes': ['170', '171'],
        'nickname_changes': ['210', '303'],
        'disconnect_messages': ['301', '307', '321', '322', '332', '333'],
        'affiliation_changes': [...converse.AFFILIATION_CHANGES_LIST],
        'join_leave_events': [...converse.MUC_TRAFFIC_STATES_LIST],
        'role_changes': [...converse.MUC_ROLE_CHANGES_LIST],
    };

This setting determines which info messages will Converse show inside a chatroom.
It is recommended to use the aforementioned Converse object in the following fashion
to build the list of desired info messages that will be shown:

.. code-block:: javascript

    muc_show_info_messages: [
        ...converse.MUC_INFO_CODES.visibility_changes,
        ...converse.MUC_INFO_CODES.self,
        ...converse.MUC_INFO_CODES.non_privacy_changes,
        ...converse.MUC_INFO_CODES.muc_logging_changes,
        ...converse.MUC_INFO_CODES.nickname_changes,
        ...converse.MUC_INFO_CODES.disconnect_messages,
        ...converse.MUC_INFO_CODES.affiliation_changes,
        ...converse.MUC_INFO_CODES.join_leave_events,
        ...converse.MUC_INFO_CODES.role_changes,
    ]

By default all info messages are shown.

The behaviour of this setting is whitelisting, so if it is overriden all the desired
events must be specified.

If an empty list is provided, no info message will be displayed at all.

muc_show_logs_before_join
-------------------------

* Default: ``false``

If set to ``true``, when opening a MUC for the first time (or if you don't have
a nickname configured for it), you'll see the message history (if the
server supports `XEP-0313 Message Archive Management <https://xmpp.org/extensions/xep-0313.html>`_)
and the nickname form at the bottom.


muc_subscribe_to_rai
--------------------

* Default: ``false``

This option enables support for `XEP-0437 Room Activity Indicators <https://xmpp.org/extensions/xep-0437.html>`_.

When a MUC is no longer visible (specifically, when the ``hidden`` flag becomes ``true``),
then Converse will exit the MUC and subscribe to activity indicators on the MUC host.

When the MUC becomes visible again (``hidden`` gets set to ``false``), the MUC will be rejoined.


.. _`nickname`:

nickname
--------

* Default: ``undefined``

This setting allows you to specify the nickname for the current user.
The nickname will be included in presence requests to other users and will also
be used as the default nickname when entering MUC chatrooms.

This value will have first preference ahead of other nickname sources, such as
the VCard ``nickname`` value.


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

notify_nicknames_without_references
-----------------------------------

* Default: ``false``

Enables notifications for nicknames in messages that don't have associated
XEP-0372 references linking them to the JID of the person being mentioned.

In Converse, these would be nicknames that weren't mentioned via the ``@`` sign.

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


omemo_default
-------------

* Default:  ``false``

Use OMEMO encryption by default when the chat supports it.

ping_interval
-------------

* Default:  ``60``

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

You can set the URL where the sound files are hosted with the `sounds_path`_ option.

Requires the `src/converse-notification.js` plugin.

.. _`prebind_url`:

prebind_url
-----------

* Default:  ``null``
* Type:  URL

See also: :ref:`session-support`

This setting should be used in conjunction with `authentication`_ set to `prebind`.

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

.. _`assets_path`:

assets_path
-----------

* Default: ``'/dist/'`` or the `publicPath <https://webpack.js.org/guides/public-path/>`_ value as configured in the relevant Webpack configuration.

Since version 5.0.0, Converse serves a smaller bundle by extracting various
resources (for example emojis and translations) into separate files (aka
"chunks") which are loaded asynchronously on demand.

The URL path at which these resources are loaded is normally set by the ``publicPath``
setting of Webpack but this means that it's hardcoded to a particular value at
compile time.

This configuration seting allows this value to be set at runtime as well.


persistent_store
----------------

* Default: ``localStorage``
* Valid options: ``localStorage``, ``IndexedDB``, ``sessionStorage``, ``BrowserExtLocal``, ``BrowserExtSync``

Determines which store is used for storing persistent data.

From version 6.0.0 onwards, Converse supports storing data in
`IndexedDB <https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Concepts_Behind_IndexedDB>`_.

IndexedDB is not subjected to the same space constraints as localStorage and is
also a requirement for progressive web apps which don't need persistent a
internet connectivity to be functional.

From version 7.0.0 onwards, Converse supports storing data in
`Browser Extension storage <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage#Example_extensions>`_.

When Converse is running inside a web browser extension, it can now take advantage of storage optimized to meet the specific storage needs of extensions.

BrowserExtSync represents the sync storage area.
Items in sync storage are synced by the browser and are available across all instances of that browser that the user is logged into, across different devices.

BrowserExtLocal represents the local storage area.
Items in local storage are local to the machine the extension was installed on

prune_messages_above
--------------------

* Default: ``undefined``
* Valid options: Any integer value above 0.

If this option is set to a positive integer, the chat history will be kept to
that number. As new messages come in, older messages will be deleted to
maintain the history size.

.. note::
  When deleting locally stored decrypted OMEMO messages, you will **not** be
  able to decrypt them again after fetching them from the server archive.

pruning_behavior
----------------

* Default: ``unscrolled``
* Valid options: ``unscrolled``, ``scrolled``

By default the chat history will only be pruned when the chat window isn't
scrolled up (``'unscrolled'``).

If set to ``'scrolled'``, then pruning will also happen when the chat is
scrolled up. Be aware that this will interfere with MAM-based infinite
scrolling, and this setting only makes sense when infinite scrolling with MAM
is disabled.


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


registration_domain
-------------------

* Default: ``''``

Specify a domain name for which the registration form will be fetched automatically,
without the user having to enter any XMPP server domain name.

render_media
------------

* Default: ``true``

* Possible values: ``true``, ``false`` or an array of domains for which media
  should automatically be rendered.

If ``true``, media URLs (images, audio and video) will be rendered in the chat.

If ``false``, the URLs won't render as media, and instead only clickable links
will be shown.

Setting it to an array of domains means that media will be rendered only for URLs
matching those domains.

Media URLs are those URLs which appear to point to media files as well as URLs
for which `Open Graph Protocol (OGP) <https://modules.prosody.im/mod_ogp.html`_
data was received (for example via Prosody's `mod_ogp <https://modules.prosody.im/mod_ogp.html>`_).

The OGP metadata must come from the MUC itself, metadata sent from participants
themselves will not be shown.

Based on the OGP metadata Converse will render a URL preview (also known as an
"unfurl").

.. note::

  Note, even if this setting is ``false`` (or if the URL domain is not in the
  array of allowed domains), a user can still click on the message
  dropdown and click to show or hide the media for that particular message.

  If you want to disable this ability, you can set the allowed domains for the
  media type to an empty array.

  See:

  * `allowed_audio_domains`_
  * `allowed_video_domains`_
  * `allowed_image_domains`_

.. note::

  This setting, together with the three allowed domain settings above, obsolete
  the ``show_images_inline``, ``embed_audio`` and ``embed_videos`` settings.


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
            const { converse } = event.detail;
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


send_chat_state_notifications
-----------------------------

* Default: ``true``
* Allowed values: ``'active', 'composing', 'gone' 'inactive', 'paused'``

Determines whether chat state notifications (see `XEP-0085 <https://xmpp.org/extensions/xep-0085.html>`_) should be sent out or not.

Can also be set to an Array in order to allow only certain types of chat state notifications.

For example:

.. code-block:: javascript

        converse.initialize({
            'send_chat_state_notifications':  ['composing']
        });


send_chat_markers
-----------------

* Default: ``['received', 'displayed', 'acknowledged']``

Determines which (if any) of the `XEP-0333 <https://xmpp.org/extensions/xep-0333.html>`_ chat markers will be sent out.

It's still up to Converse to decide when to send out the relevant markers, the
purpose of this setting is merely to turn on or off the sending of the
individual markers.


show_chat_state_notifications
-----------------------------

* Default:  ``false``

Specifies whether chat state (online, dnd, away) HTML5 desktop notifications should be shown.

show_client_info
----------------

* Default:  ``true``

Specifies whether the info icon is shown on the controlbox which when clicked opens an
"About" modal with more information about the version of Converse being used.

show_controlbox_by_default
--------------------------

* Default:  ``false`` (``true`` when the `view_mode`_ is set to ``fullscreen``)

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
* ``auto_subscribe`` is set to ``false`` and a new contact request is received.

If set to ``all``, notifications will be shown even if the above conditions are
not fulfilled.

Requires the `src/converse-notification.js` plugin.


show_message_avatar
-------------------

* Default: ``true``

Whether chat messages should also render the author's avatar.


show_images_inline
------------------

* Default:  ``true``

If set to ``false``, images won't be rendered in chats, instead only their links will be shown.

Users will however still have the ability to render individual images via the message actions dropdown.
If you want to disallow users from doing so, set the ``allowed_image_domains`` option to an empty array ``[]``.


show_retraction_warning
-----------------------

* Default: ``true``

From `XEP-0424: Message Retraction <https://xmpp.org/extensions/xep-0424.html>`_:

::
  Due to the federated and extensible nature of XMPP it's not possible to remove a message with
  full certainty and a retraction can only be considered an unenforceable request for such removal.
  Clients which don't support message retraction are not obligated to enforce the request and
  people could have seen or copied the message contents already.

By default Converse shows a warning to users when they retract a message, to
inform them that they don't have a guarantee that the message will be removed
everywhere.

This warning isn't applicable to all deployments of Converse and can therefore
be turned off by setting this config variable to ``false``.

show_send_button
----------------

* Default: ``true``

Adds a button to the chat which can be clicked or tapped in order to send the
message.


show_tab_notifications
----------------------

* Default: ``true``

Determines whether an unread messages counter is shown in the tab.


singleton
---------

* Default:  ``false``

If set to ``true``, then only one chat (one-on-one or groupchat) will be allowed.

The chat must be specified with the `auto_join_rooms`_ or `auto_join_private_chats`_ options.

This setting is useful together with `view_mode`_ set to ``embedded``, when you
want to embed a chat into the page.

Alternatively you could use it with `view_mode`_ set to ``overlayed`` to create
a single helpdesk-type chat.


smacks_max_unacked_stanzas
--------------------------

* Default: ``5``

This setting relates to `XEP-0198 <https://xmpp.org/extensions/xep-0198.html>`_
and determines the number of stanzas to be sent before Converse will ask the
server for acknowledgement of those stanzas.


sounds_path
-----------

* Default: ``${assets_path}/sounds/``

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
* Valid options: ``true``, ``false``, ``a resource name``.

This option lets you synchronize your chat status (`online`, `busy`, `away`) with other chat clients. In other words,
if you change your status to ``busy`` in a different chat client, your status will change to ``busy`` in Converse as well.

If set to ``true``, Converse will synchronize with all other clients you are logged in with.

If set to ``false``, this feature is disabled.

If set to ``a resource name``, Converse will synchronize only with a client that has that particular resource assigned to it.

theme
-----

* Default: ``default``
* Valid options: ``default``, ``concord``

Let's you set a color theme for Converse.


time_format
-----------

* Default: ``HH:mm``

Examples: ``HH:mm``, ``hh:mm``, ``hh:mm a``.

This option makes the time format for the time shown, for each message, configurable. Converse uses `DayJS <https://github.com/iamkun/dayjs>`_
for showing time. This option allows the configuration of the format in which ``DayJS`` will display the time for the messages. For detailed
description of time-format options available for ``DayJS`` you can check the
`default formatting options <https://github.com/iamkun/dayjs/blob/dev/docs/en/API-reference.md#displaying>`_ and the
`advanced options <https://github.com/iamkun/dayjs/blob/master/docs/en/Plugin.md#advancedformat>`_.

use_system_emojis
-----------------
* Default: ``true``

Determines whether emojis should be rendered by the user's system.

Not all operating systems support (all) emojis. So alternatively you can let
Converse render the emojis with `Twemoji <https://twemoji.twitter.com/>`_.

See also `emoji_image_path`_.


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

Example: ``ws://xmpp.example.com:5280/ws/``

Example with reverse-proxy and TLS: ``wss://xmpp.example.com/ws/``

This option is used to specify a
`websocket <https://developer.mozilla.org/en/docs/WebSockets>`_ URI to which
Converse can connect to.

Websockets provide a more modern and effective two-way communication protocol
between the browser and a server, effectively emulating TCP at the application
layer and therefore overcoming many of the problems with existing long-polling
techniques for bidirectional HTTP (such as `BOSH <https://en.wikipedia.org/wiki/BOSH>`_).

Please refer to your XMPP server's documentation on how to enable websocket
support.


.. _`view_mode`:

view_mode
---------

* Default: ``overlayed``
* Allowed values: ``overlayed``, ``fullscreen``, ``mobile``, ``embedded``

The ``view_mode`` setting configures Converse's mode and resulting behavior.

* ``overlayed`` is the original mode, in which the chats appeared as small boxes overlaying a webpage which can contain arbitrary content.
* ``fullscreen`` is for a fullpage and single-page app.
* ``embedded`` is used to embed Converse into a particular part of the web page. Put the custom element ``<converse-root></converse-root>`` into your page HTML there were you want Converse to appear. See `conversejs.org/demo/embedded.html <https://conversejs.org/demo/embedded.html>`_ for an example of this view mode.
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
