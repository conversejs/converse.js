.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

.. _`events-API`:

Events and promises
===================

Converse and its plugins emit various events which you can listen to via the
:ref:`listen-grouping`.

Some of these events are also available as `ES2015 Promises <http://es6-features.org/#PromiseUsage>`_,
although not all of them could logically act as promises, since some events
might be fired multpile times whereas promises are to be resolved (or
rejected) only once.

The core events, which are also promises are:

* `cachedRoster`_
* `chatBoxesFetched`_
* `connectionInitialized`_
* `controlboxInitialized`_ (only via the `converse-controlbox` plugin)
* `pluginsInitialized`_
* `roomsPanelRendered`_ (only via the `converse-muc` plugin)
* `rosterContactsFetched`_
* `rosterGroupsFetched`_
* `rosterInitialized`_
* `roster`_
* `statusInitialized`_

For more info on how to use (or add promises), you can read the
:ref:`promises-grouping` in the API documentation.

Below we will now list all events and also specify whether they are available
as promises.

Global events
-------------

With global events, we mean events triggered in the global context, i.e. on the
`window` object in browsers.

converse-loaded
---------------

Once Converse.js has loaded, it'll dispatch a custom event with the name
``converse-loaded``.

You can listen for this event in your scripts and thereby be informed as soon
as converse.js has been loaded, which would mean it's safe to call
``converse.initialize``.

For example:

.. code-block:: javascript

    window.addEventListener('converse-loaded', () => {
        converse.initialize();
    });


List protected of events (and promises)
----------------------------------------

Hooking into events that Converse.js emits is a great way to extend or
customize its functionality.

From version 3.0.0 and up, it's only possible to register event handlers inside
a plugin, by using the closured ``_converse`` object. When writing a plugin,
remember that it will also have to be whitelisted, before it will be loaded.
Refer to the :ref:`whitelisted_plugins` setting.

Here follows the different events that are emitted:

afterMessagesFetched
~~~~~~~~~~~~~~~~~~~~

Emitted whenever a chatbox has fetched its messages from ``sessionStorage`` and
**NOT** from the server.

This event is listened to by the ``converse-mam`` plugin to know when it can
fetch archived messages from the server.

The event handler is passed the ``Backbone.View`` instance of the relevant chat
box.

``_converse.api.listen.on('afterMessagesFetched', function (chatboxview) { ... });``

.. _`cachedRoster`:

cachedRoster
~~~~~~~~~~~~

The contacts roster has been retrieved from the local cache (`sessionStorage`).

``_converse.api.listen.on('cachedRoster', function (items) { ... });``

Also available as an `ES2015 Promise <http://es6-features.org/#PromiseUsage>`_:

.. code-block:: javascript

    _converse.api.waitUntil('cachedRoster').then(function () {
        // Your code here...
    });

See also the `roster`_ event further down.

callButtonClicked
~~~~~~~~~~~~~~~~~

When a call button (i.e. with class .toggle-call) on a chatbox has been clicked.

``_converse.api.listen.on('callButtonClicked', function (connection, model) { ... });``

.. _`chatBoxesFetched`:

chatBoxesFetched
~~~~~~~~~~~~~~~~

Any open chatboxes (from this current session) has been retrieved from the local cache (`sessionStorage`).

You should wait for this event or promise before attempting to do things
related to open chatboxes.

``_converse.api.listen.on('chatBoxesFetched', function (items) { ... });``

Also available as an `ES2015 Promise <http://es6-features.org/#PromiseUsage>`_:

.. code-block:: javascript

    _converse.api.waitUntil('chatBoxesFetched').then(function () {
        // Your code here...
    });

chatBoxInitialized
~~~~~~~~~~~~~~~~~~

When a chatbox has been initialized. Relevant to converse-chatview.js plugin.

``_converse.api.listen.on('chatBoxInitialized', function (chatbox) { ... });``

chatBoxOpened
~~~~~~~~~~~~~

When a chatbox has been opened. Relevant to converse-chatview.js plugin.

``_converse.api.listen.on('chatBoxOpened', function (chatbox) { ... });``

chatRoomOpened
~~~~~~~~~~~~~~

When a chatroom has been opened. Relevant to converse-chatview.js plugin.

``_converse.api.listen.on('chatRoomOpened', function (chatbox) { ... });``

chatBoxClosed
~~~~~~~~~~~~~

When a chatbox has been closed. Relevant to converse-chatview.js plugin.

``_converse.api.listen.on('chatBoxClosed', function (chatbox) { ... });``

chatBoxFocused
~~~~~~~~~~~~~~

When the focus has been moved to a chatbox. Relevant to converse-chatview.js plugin.

``_converse.api.listen.on('chatBoxFocused', function (chatbox) { ... });``

chatBoxToggled
~~~~~~~~~~~~~~

When a chatbox has been minimized or maximized. Relevant to converse-chatview.js plugin.

``_converse.api.listen.on('chatBoxToggled', function (chatbox) { ... });``

clearSession
~~~~~~~~~~~~

Called when the user is logging out and provides the opportunity to remove session data.

connected
~~~~~~~~~

After connection has been established and converse.js has got all its ducks in a row.

``_converse.api.listen.on('connected', function () { ... });``

connectionInitialized
~~~~~~~~~~~~~~~~~~~~~

Called once the ``Strophe.Connection`` constructor has been initialized, which
will be responsible for managing the connection to the XMPP server.

contactRequest
~~~~~~~~~~~~~~

Someone has requested to subscribe to your presence (i.e. to be your contact).

The `Backbone.Model <http://backbonejs.org/#Model>`_ instance representing the
roster contact is passed to the event listener.

``_converse.api.listen.on('contactRequest', function (contact) { ... });``

contactRemoved
~~~~~~~~~~~~~~

The user has removed a contact.

``_converse.api.listen.on('contactRemoved', function (data) { ... });``


contactPresenceChanged
~~~~~~~~~~~~~~~~~~~~~~

When a chat buddy's presence status has changed.
The presence status is either `online`, `offline`, `dnd`, `away` or `xa`.

``_converse.api.listen.on('contactPresenceChanged', function (presence) { ... });``

contactStatusMessageChanged
~~~~~~~~~~~~~~~~~~~~~~~~~~~

When a chat buddy's custom status message has changed.

``_converse.api.listen.on('contactStatusMessageChanged', function (data) { ... });``

controlboxInitialized
~~~~~~~~~~~~~~~~~~~~~

Called when the controlbox has been initialized and therefore exists.

The controlbox contains the login and register forms when
the user is logged out and a list of the user's contacts and group chats when
logged in.

``_converse.api.listen.on('controlboxInitialized', function () { ... });``

Also available as an `ES2015 Promise <http://es6-features.org/#PromiseUsage>`_:

.. code-block:: javascript

    _converse.api.waitUntil('controlboxInitialized').then(function () {
        // Your code here...
    });

discoInitialized
~~~~~~~~~~~~~~~~

Emitted once the ``converse-disco`` plugin has been initialized and the
``_converse.disco_entities`` collection will be available and populated with at
least the service discovery features of the user's own server.

``_converse.api.listen.on('discoInitialized', function () { ... });``

disconnected
~~~~~~~~~~~~

After converse.js has disconnected from the XMPP server.

``_converse.api.listen.on('disconnected', function () { ... });``

initialized
~~~~~~~~~~~

Once converse.js has been initialized.

``_converse.api.listen.on('initialized', function () { ... });``

See also `pluginsInitialized`_.

logout
~~~~~~

The user has logged out.

``_converse.api.listen.on('logout', function () { ... });``

messageAdded
~~~~~~~~~~~~

Once a message has been added to a chatbox. The passed in data object contains
a `chatbox` attribute, referring to the chatbox receiving the message, as well
as a `message` attribute which refers to the Message model.

.. code-block:: javascript

    _converse.api.listen.on('messageAdded', function (data) {
        // The message is at `data.message`
        // The original chatbox is at `data.chatbox`.
    });


messageNotification
~~~~~~~~~~~~~~~~~~~

Emitted just before an HTML5 message notification will be sent out.

.. code-block:: javascript

    _converse.api.listen.on('messageNotification', stanza => {

        const body = sizzle(`encrypted[xmlns="${Strophe.NS.OMEMO}"]`, message).length ?
                        __('OMEMO Message received') :
                        _.get(message.querySelector('body'), 'textContent');
        alert(body);
    });

messageSend
~~~~~~~~~~~

When a message will be sent out.

``_converse.api.listen.on('messageSend', function (messageText) { ... });``

noResumeableSession
~~~~~~~~~~~~~~~~~~~

When keepalive=true but there aren't any stored prebind tokens.

``_converse.api.listen.on('noResumeableSession', function () { ... });``

.. _`pluginsInitialized`:

pluginsInitialized
~~~~~~~~~~~~~~~~~~

Emitted once all plugins have been initialized. This is a useful event if you want to
register event handlers but would like your own handlers to be overridable by
plugins. In that case, you need to first wait until all plugins have been
initialized, so that their overrides are active. One example where this is used
is in `converse-notifications.js <https://github.com/jcbrand/converse.js/blob/master/src/converse-notification.js>`.

``_converse.api.listen.on('pluginsInitialized', function () { ... });``

Also available as an `ES2015 Promise <http://es6-features.org/#PromiseUsage>`_:

.. code-block:: javascript

    _converse.api.waitUntil('pluginsInitialized').then(function () {
        // Your code here...
    });

privateChatsAutoJoined
~~~~~~~~~~~~~~~~~~~~~~

Emitted once any private chats have been automatically joined as specified by
the _`auto_join_private_chats` settings.

.. code-block:: javascript

    _converse.api.listen.on('privateChatsAutoJoined', function () { ... });

Also available as an `ES2015 Promise <http://es6-features.org/#PromiseUsage>`_.

.. code-block:: javascript

    _converse.api.waitUntil('privateChatsAutoJoined').then(function () {
        // Your code here...
    });


reconnecting
~~~~~~~~~~~~

Fired once converse.js has determined that it will attempt to reconnect (and
each subsequent time, if it attempts repeatedly).

reconnected
~~~~~~~~~~~

After the connection has dropped and converse.js has reconnected.
Any Strophe stanza handlers (as registered via `converse.listen.stanza`) will
have to be registered anew.

.. code-block:: javascript

    _converse.api.listen.on('reconnected', function () { ... });

registeredGlobalEventHandlers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Called once Converse has registered its global event handlers (for events such
as window resize or unload).

Plugins can listen to this event as cue to register their own global event
handlers.

roomsAutoJoined
~~~~~~~~~~~~~~~

Emitted once any rooms that have been configured to be automatically joined,
specified via the _`auto_join_rooms` setting, have been entered.

.. code-block:: javascript

    _converse.api.listen.on('roomsAutoJoined', function () { ... });

Also available as an `ES2015 Promise <http://es6-features.org/#PromiseUsage>`_:

.. code-block:: javascript

    _converse.api.waitUntil('roomsAutoJoined').then(function () {
        // Your code here...
    });

roomInviteSent
~~~~~~~~~~~~~~

After the user has sent out a direct invitation, to a roster contact, asking them to join a room.

``_converse.api.listen.on('roomInvite', function (data) { ... });``

roomInviteReceived
~~~~~~~~~~~~~~~~~~

After the user has sent out a direct invitation, to a roster contact, asking them to join a room.

``_converse.api.listen.on('roomInvite', function (data) { ... });``

.. _`roomsPanelRendered`:

roomsPanelRendered
~~~~~~~~~~~~~~~~~~

Emitted once the "Rooms" panel in the control box has been rendered.
Used by `converse-bookmarks` and `converse-roomslist` to know when they can
render themselves in that panel.

``_converse.api.listen.on('roomsPanelRendered', function (data) { ... });``

Also available as an `ES2015 Promise <http://es6-features.org/#PromiseUsage>`_:

.. code-block:: javascript

    _converse.api.waitUntil('roomsPanelRendered').then(function () {
        // Your code here...
    });

.. _`roster`:

roster
~~~~~~

When the roster has been received from the XMPP server.

``_converse.api.listen.on('roster', function (items) { ... });``

Also available as an `ES2015 Promise <http://es6-features.org/#PromiseUsage>`_:

.. code-block:: javascript

    _converse.api.waitUntil('roster').then(function () {
        // Your code here...
    });

See also the `cachedRoster` event further up, which gets called instead of
`roster` if its already in `sessionStorage`.

.. _`rosterContactsFetched`:

rosterContactsFetched
~~~~~~~~~~~~~~~~~~~~~

Triggered once roster contacts have been fetched. Used by the
`converse-rosterview.js` plugin to know when it can start to show the roster.

Also available as an `ES2015 Promise <http://es6-features.org/#PromiseUsage>`_:

.. code-block:: javascript

    _converse.api.waitUntil('rosterContactsFetched').then(function () {
        // Your code here...
    });

.. _`rosterGroupsFetched`:

rosterGroupsFetched
~~~~~~~~~~~~~~~~~~~

Triggered once roster groups have been fetched. Used by the
`converse-rosterview.js` plugin to know when it can start alphabetically
position roster groups.

Also available as an `ES2015 Promise <http://es6-features.org/#PromiseUsage>`_:

.. code-block:: javascript

    _converse.api.waitUntil('rosterGroupsFetched').then(function () {
        // Your code here...
    });

.. _`rosterInitialized`:

rosterInitialized
~~~~~~~~~~~~~~~~~

The Backbone collections `RosterContacts` and `RosterGroups` have been created,
but not yet populated with data.

This event is useful when you want to create views for these collections.

Also available as an `ES2015 Promise <http://es6-features.org/#PromiseUsage>`_:

.. code-block:: javascript

    _converse.api.waitUntil('rosterInitialized').then(function () {
        // Your code here...
    });

rosterPush
~~~~~~~~~~

When the roster receives a push event from server. (i.e. New entry in your buddy list)

``_converse.api.listen.on('rosterPush', function (items) { ... });``

rosterReadyAfterReconnection
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Similar to `rosterInitialized`, but instead pertaining to reconnection. This
event indicates that the Backbone collections representing the roster and its
groups are now again available after converse.js has reconnected.

serviceDiscovered
~~~~~~~~~~~~~~~~~

When converse.js has learned of a service provided by the XMPP server. See XEP-0030.

``_converse.api.listen.on('serviceDiscovered', function (service) { ... });``


.. _`statusInitialized`:

statusInitialized
~~~~~~~~~~~~~~~~~

When the user's own chat status has been initialized.

``_converse.api.listen.on('statusInitialized', function (status) { ... });``

Also available as an `ES2015 Promise <http://es6-features.org/#PromiseUsage>`_:

.. code-block:: javascript

    _converse.api.waitUntil('statusInitialized').then(function () {
        // Your code here...
    });

statusChanged
~~~~~~~~~~~~~

When own chat status has changed.

``_converse.api.listen.on('statusChanged', function (status) { ... });``

statusMessageChanged
~~~~~~~~~~~~~~~~~~~~

When own custom status message has changed.

``_converse.api.listen.on('statusMessageChanged', function (message) { ... });``

streamFeaturesAdded
~~~~~~~~~~~~~~~~~~~

Emitted as soon as Converse has processed the stream features as advertised by
the server. If you want to check whether a stream feature is supported before
proceeding, then you'll first want to wait for this event.

windowStateChanged
~~~~~~~~~~~~~~~~~~

When window state has changed. Used to determine when a user left the page and when came back.

``_converse.api.listen.on('windowStateChanged', function (data) { ... });``


List of events on the ChatRoom Backbone.Model
---------------------------------------------

configurationNeeded
~~~~~~~~~~~~~~~~~~~

Triggered when a new room has been created which first needs to be configured
and when `auto_configure` is set to `false`.

Used by the core `ChatRoomView` view in order to know when to render the
configuration form for a new room.
