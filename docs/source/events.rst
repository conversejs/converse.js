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

Hooking into events that Converse.js emits is a great way to extend or
customize its functionality.

From version 3.0.0 and up, it's only possible to register event handlers inside
a plugin, by using the closured ``_converse`` object. When writing a plugin,
remember that it will also have to be whitelisted, before it will be loaded.
Refer to the :ref:`whitelisted_plugins` setting.

Here follows the different events that are emitted:

cachedRoster
~~~~~~~~~~~~

The contacts roster has been retrieved from the local cache (`sessionStorage`).

``_converse.on('cachedRoster', function (items) { ... });``

See also the `roster`_ event further down.

callButtonClicked
~~~~~~~~~~~~~~~~~

When a call button (i.e. with class .toggle-call) on a chat box has been clicked.

``_converse.on('callButtonClicked', function (connection, model) { ... });``

chatBoxInitialized
~~~~~~~~~~~~~~~~~~

When a chat box has been initialized. Relevant to converse-chatview.js plugin.

``_converse.on('chatBoxInitialized', function (chatbox) { ... });``

chatBoxOpened
~~~~~~~~~~~~~

When a chat box has been opened. Relevant to converse-chatview.js plugin.

``_converse.on('chatBoxOpened', function (chatbox) { ... });``

chatRoomOpened
~~~~~~~~~~~~~~

When a chat room has been opened. Relevant to converse-chatview.js plugin.

``_converse.on('chatRoomOpened', function (chatbox) { ... });``

chatBoxClosed
~~~~~~~~~~~~~

When a chat box has been closed. Relevant to converse-chatview.js plugin.

``_converse.on('chatBoxClosed', function (chatbox) { ... });``

chatBoxFocused
~~~~~~~~~~~~~~

When the focus has been moved to a chat box. Relevant to converse-chatview.js plugin.

``_converse.on('chatBoxFocused', function (chatbox) { ... });``

chatBoxToggled
~~~~~~~~~~~~~~

When a chat box has been minimized or maximized. Relevant to converse-chatview.js plugin.

``_converse.on('chatBoxToggled', function (chatbox) { ... });``

connected
~~~~~~~~~

After connection has been established and converse.js has got all its ducks in a row.

``_converse.on('connected', function () { ... });``

contactRequest
~~~~~~~~~~~~~~

Someone has requested to subscribe to your presence (i.e. to be your contact).

``_converse.on('contactRequest', function (user_data) { ... });``

contactRemoved
~~~~~~~~~~~~~~

The user has removed a contact.

``_converse.on('contactRemoved', function (data) { ... });``


contactStatusChanged
~~~~~~~~~~~~~~~~~~~~

When a chat buddy's chat status has changed.

``_converse.on('contactStatusChanged', function (buddy) { ... });``

contactStatusMessageChanged
~~~~~~~~~~~~~~~~~~~~~~~~~~~

When a chat buddy's custom status message has changed.

``_converse.on('contactStatusMessageChanged', function (data) { ... });``

disconnected
~~~~~~~~~~~~

After converse.js has disconnected from the XMPP server.

``_converse.on('disconnected', function () { ... });``

initialized
~~~~~~~~~~~

Once converse.js has been initialized.

``_converse.on('initialized', function () { ... });``

See also `pluginsInitialized`_.

logout
~~~~~~

The user has logged out.

``_converse.on('logout', function () { ... });``

messageAdded
~~~~~~~~~~~~

Once a message has been added to a chat box. The passed in data object contains
a `chatbox` attribute, referring to the chat box receiving the message, as well
as a `message` attribute which refers to the Message model.

.. code-block:: javascript
    _converse.on('messageAdded', function (data) {
        // The message is at `data.message`
        // The original chat box is at `data.chatbox`.
    });

messageSend
~~~~~~~~~~~

When a message will be sent out.

``_converse.on('messageSend', function (messageText) { ... });``

noResumeableSession
~~~~~~~~~~~~~~~~~~~

When keepalive=true but there aren't any stored prebind tokens.

``_converse.on('noResumeableSession', function () { ... });``

pluginsInitialized
~~~~~~~~~~~~~~~~~~

Once all plugins have been initialized. This is a useful event if you want to
register event handlers but would like your own handlers to be overridable by
plugins. In that case, you need to first wait until all plugins have been
initialized, so that their overrides are active. One example where this is used
is in `converse-notifications.js <https://github.com/jcbrand/converse.js/blob/master/src/converse-notification.js>`.

``_converse.on('pluginsInitialized', function () { ... });``

reconnecting
~~~~~~~~~~~~

Fired once converse.js has determined that it will attempt to reconnect (and
each subsequent time, if it attempts repeatedly).

reconnected
~~~~~~~~~~~

After the connection has dropped and converse.js has reconnected.
Any Strophe stanza handlers (as registered via `converse.listen.stanza`) will
have to be registered anew.

``_converse.on('reconnected', function () { ... });``

roomInviteSent
~~~~~~~~~~~~~~

After the user has sent out a direct invitation, to a roster contact, asking them to join a room.

``_converse.on('roomInvite', function (data) { ... });``

roomInviteReceived
~~~~~~~~~~~~~~~~~~

After the user has sent out a direct invitation, to a roster contact, asking them to join a room.

``_converse.on('roomInvite', function (data) { ... });``

roster
~~~~~~

When the roster has been received from the XMPP server.

``_converse.on('roster', function (items) { ... });``

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

``_converse.on('rosterPush', function (items) { ... });``

rosterReadyAfterReconnection
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Similar to `rosterInitialized`, but instead pertaining to reconnection. This
event indicates that the Backbone collections representing the roster and its
groups are now again available after converse.js has reconnected.

statusInitialized
~~~~~~~~~~~~~~~~~

When own chat status has been initialized.

``_converse.on('statusInitialized', function (status) { ... });``

statusChanged
~~~~~~~~~~~~~

When own chat status has changed.

``_converse.on('statusChanged', function (status) { ... });``

statusMessageChanged
~~~~~~~~~~~~~~~~~~~~

When own custom status message has changed.

``_converse.on('statusMessageChanged', function (message) { ... });``

serviceDiscovered
~~~~~~~~~~~~~~~~~

When converse.js has learned of a service provided by the XMPP server. See XEP-0030.

``_converse.on('serviceDiscovered', function (service) { ... });``
