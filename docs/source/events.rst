.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

.. _`events-API`:

Events emitted by converse.js
=============================

.. contents:: Table of Contents
   :depth: 2
   :local:


.. note:: see also :ref:`listen-grouping` above.

Event Types
-----------

Here are the different events that are emitted:

cachedRoster
~~~~~~~~~~~~

The contacts roster has been retrieved from the local cache (`sessionStorage`).

``converse.listen.on('cachedRoster', function (event, items) { ... });``

See also the `roster` event further down.

callButtonClicked
~~~~~~~~~~~~~~~~~

When a call button (i.e. with class .toggle-call) on a chat box has been clicked.

``converse.listen.on('callButtonClicked', function (event, connection, model) { ... });``

chatBoxInitialized
~~~~~~~~~~~~~~~~~~

When a chat box has been initialized. Relevant to converse-chatview.js plugin.

``converse.listen.on('chatBoxInitialized', function (event, chatbox) { ... });``

chatBoxOpened
~~~~~~~~~~~~~

When a chat box has been opened. Relevant to converse-chatview.js plugin.

``converse.listen.on('chatBoxOpened', function (event, chatbox) { ... });``

chatRoomOpened
~~~~~~~~~~~~~~

When a chat room has been opened. Relevant to converse-chatview.js plugin.

``converse.listen.on('chatRoomOpened', function (event, chatbox) { ... });``

chatBoxClosed
~~~~~~~~~~~~~

When a chat box has been closed. Relevant to converse-chatview.js plugin.

``converse.listen.on('chatBoxClosed', function (event, chatbox) { ... });``

chatBoxFocused
~~~~~~~~~~~~~~

When the focus has been moved to a chat box. Relevant to converse-chatview.js plugin.

``converse.listen.on('chatBoxFocused', function (event, chatbox) { ... });``

chatBoxToggled
~~~~~~~~~~~~~~

When a chat box has been minimized or maximized. Relevant to converse-chatview.js plugin.

``converse.listen.on('chatBoxToggled', function (event, chatbox) { ... });``

connected
~~~~~~~~~

After connection has been established and converse.js has got all its ducks in a row.

``converse.listen.on('connected', function (event) { ... });``

contactRequest
~~~~~~~~~~~~~~

Someone has requested to subscribe to your presence (i.e. to be your contact).

``converse.listen.on('contactRequest', function (event, user_data) { ... });``

contactRemoved
~~~~~~~~~~~~~~

The user has removed a contact.

``converse.listen.on('contactRemoved', function (event, data) { ... });``


contactStatusChanged
~~~~~~~~~~~~~~~~~~~~

When a chat buddy's chat status has changed.

``converse.listen.on('contactStatusChanged', function (event, buddy) { ... });``

contactStatusMessageChanged
~~~~~~~~~~~~~~~~~~~~~~~~~~~

When a chat buddy's custom status message has changed.

``converse.listen.on('contactStatusMessageChanged', function (event, data) { ... });``

disconnected
~~~~~~~~~~~~

After converse.js has disconnected from the XMPP server.

``converse.listen.on('disconnected', function (event) { ... });``

initialized
~~~~~~~~~~~

Once converse.js has been initialized.

``converse.listen.on('initialized', function (event) { ... });``

See also `pluginsInitialized`_.

logout
~~~~~~

The user has logged out.

``converse.listen.on('logout', function (event) { ... });``

messageSend
~~~~~~~~~~~

When a message will be sent out.

``converse.listen.on('messageSend', function (event, messageText) { ... });``

noResumeableSession
~~~~~~~~~~~~~~~~~~~

When keepalive=true but there aren't any stored prebind tokens.

``converse.listen.on('noResumeableSession', function (event) { ... });``

pluginsInitialized
~~~~~~~~~~~~~~~~~~

Once all plugins have been initialized. This is a useful event if you want to
register event handlers but would like your own handlers to be overridable by
plugins. In that case, you need to first wait until all plugins have been
initialized, so that their overrides are active. One example where this is used
is in `converse-notifications.js <https://github.com/jcbrand/converse.js/blob/master/src/converse-notification.js>`.

``converse.listen.on('pluginsInitialized', function (event) { ... });``

reconnecting
~~~~~~~~~~~~

Fired once converse.js has determined that it will attempt to reconnect (and
each subsequent time, if it attempts repeatedly).

reconnected
~~~~~~~~~~~

After the connection has dropped and converse.js has reconnected.
Any Strophe stanza handlers (as registered via `converse.listen.stanza`) will
have to be registered anew.

``converse.listen.on('reconnected', function (event) { ... });``

roomInviteSent
~~~~~~~~~~~~~~

After the user has sent out a direct invitation, to a roster contact, asking them to join a room.

``converse.listen.on('roomInvite', function (event, data) { ... });``

roomInviteReceived
~~~~~~~~~~~~~~~~~~

After the user has sent out a direct invitation, to a roster contact, asking them to join a room.

``converse.listen.on('roomInvite', function (event, data) { ... });``

roster
~~~~~~

When the roster has been received from the XMPP server.

``converse.listen.on('roster', function (event, items) { ... });``

See also the `cachedRoster` event further up, which gets called instead of
`roster` if its already in `sessionStorage`.

rosterContactsFetched
~~~~~~~~~~~~~~~~~~~~~

Triggered once roster contacts have been fetched. Used by the
`converse-rosterview.js` plugin to know when it can start to show the roster.

rosterGroupsFetched
~~~~~~~~~~~~~~~~~~~

Triggered once roster groups have been fetched. Used by the
`converse-rosterview.js` plugin to know when it can start alphabetically
position roster groups.

rosterInitialized
~~~~~~~~~~~~~~~~~

The Backbone collections `RosterContacts` and `RosterGroups` have been created,
but not yet populated with data.

This event is useful when you want to create views for these collections.

rosterPush
~~~~~~~~~~

When the roster receives a push event from server. (i.e. New entry in your buddy list)

``converse.listen.on('rosterPush', function (event, items) { ... });``

rosterReadyAfterReconnection
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Similar to `rosterInitialized`, but instead pertaining to reconnection. This
event indicates that the Backbone collections representing the roster and its
groups are now again available after converse.js has reconnected.

statusInitialized
~~~~~~~~~~~~~~~~~

When own chat status has been initialized.

``converse.listen.on('statusInitialized', function (event, status) { ... });``

statusChanged
~~~~~~~~~~~~~

When own chat status has changed.

``converse.listen.on('statusChanged', function (event, status) { ... });``

statusMessageChanged
~~~~~~~~~~~~~~~~~~~~

When own custom status message has changed.

``converse.listen.on('statusMessageChanged', function (event, message) { ... });``

serviceDiscovered
~~~~~~~~~~~~~~~~~

When converse.js has learned of a service provided by the XMPP server. See XEP-0030.

``converse.listen.on('serviceDiscovered', function (event, service) { ... });``
