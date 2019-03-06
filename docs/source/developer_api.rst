.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

=========================
The old API documentation
=========================

.. note:: The API documented here is available in Converse 0.8.4 and higher.
        Earlier versions of Converse might have different API methods or none at all.

.. note:: From version 3.0.0 and onwards many API methods have been made
        private and available to plugins only. This means that if you want to
        use the API, you'll first need to create a plugin from which you can
        access it. This change is done to avoid leakage of sensitive data to
        malicious or non-whitelisted scripts.

The Converse API is broken up into different logical "groupings" (for
example ``converse.plugins`` or ``converse.contacts``).

There are some exceptions to this, like ``converse.initialize``, which aren't
groupings but single methods.

The groupings logically group methods, such as standardised accessors and
mutators::

    .get
    .set
    .add
    .remove

So for example, to get a contact, you would do the following::

    _converse.api.contacts.get('jid@example.com');

To get multiple contacts, just pass in an array of jids::

    _converse.api.contacts.get(['jid1@example.com', 'jid2@example.com']);

To get all contacts, simply call ``get`` without any jids::

    _converse.api.contacts.get();


Public API methods
==================

Publich API methods are those methods that are accessible on the global
``window.converse`` object. They are public, because any JavaScript in the page
can call them. Public methods therefore don't expose any sensitive or closured
data. To do that, you'll need to create a plugin, which has access to the
private API method.

.. _`initialize`:

initialize
----------

.. note:: This method is the one exception of a method which is not logically grouped as explained above.

Publich API method which initializes Converse.
This method must always be called when using Converse.

The `initialize` method takes a map of :ref:`configuration-settings`.

Example:

.. code-block:: javascript

    converse.initialize({
            allow_otr: true,
            auto_list_rooms: false,
            auto_subscribe: false,
            bosh_service_url: 'https://bind.example.com',
            hide_muc_server: false,
            i18n: locales['en'],
            keepalive: true,
            play_sounds: true,
            prebind: false,
            show_controlbox_by_default: true,
            debug: false,
            roster_groups: true
        });


The **plugin** grouping
------------------------

Exposes methods for adding and removing plugins. You'll need to write a plugin
if you want to have access to the private API methods defined further down below.

For more information on plugins, read the section :ref:`writing-a-plugin`.

add
~~~

Registers a new plugin.

.. code-block:: javascript

    var plugin = {
        initialize: function () {
            // method on any plugin (if it exists) as soon as the plugin has
            // been loaded.

            // Inside this method, you have access to the closured
            // _converse object, which contains the core logic and data
            // structures of Converse
        }
    }
    converse.plugins.add('myplugin', plugin);


Private API methods
===================

The private API methods are only accessible via the closured ``_converse``
object, which is only available to plugins.

These methods are kept private (i.e. not global) because they may return
sensitive data which should be kept off-limits to other 3rd-party scripts
that might be running in the page.

.. note:: The example code snippets shown below are a bit contrived. I've added
    the minimum plugin boilerplace around the actual example, to show that
    these API methods can only be called inside a plugin where the
    ``_converse`` object is available. However, sometimes other considerations
    need to be made as well. For example, for certain API methods it is
    necessary to first wait until the data has been received from the XMPP
    server (or from the browser's sessionStorage cache). Due to
    time-constriaints these limitations are ignored in the examples below. For
    a fuller picture, refer to the section :ref:`events-API` as well.

emit
----

This method allows you to emit events, which can be listened to via
``_converse.api.listen.on`` or ``_converse.api.listen.once``.

For example:

.. code-block:: javascript

    _converse.emit('foo-completed');

Additionally, if a promise has been registered under the same name
(via ``_converse.api.promises.add``), then that promise will also be resolved
when calling ``emit``.

send
----

Allows you to send XML stanzas.

For example, to send a message stanza:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            var msg = converse.env.$msg({
                from: 'juliet@example.com/balcony',
                to:'romeo@example.net',
                type:'chat'
            });
            this._converse.api.send(msg);

        }
    });

.. _`waituntil-grouping`:

waitUntil
---------

This method can be used to wait for promises. Promises are similar to events
(for event handling, refer to the :ref:`listen-grouping`), but they differ in
two important ways:

* A promise gets resolved only once, whereas events can fire multiple times.
* A handler registered for a promise, will still fire *after* the promise has
  been resolved, which is not the case with an event handler.

Converse has the following promises:

* :ref:`cachedRoster`
* :ref:`chatBoxesFetched`
* :ref:`pluginsInitialized`
* :ref:`roster`
* :ref:`rosterContactsFetched`
* :ref:`rosterGroupsFetched`
* :ref:`rosterInitialized`
* :ref:`statusInitialized`
* :ref:`roomsPanelRendered` (only via the `converse-muc` plugin)

Below is an example from `converse-muc.js <https://github.com/jcbrand/converse.js/blob/master/src/converse-muc.js>`_
where the `rosterContactsFetched` promise is waited on. The method
`this.initInviteWidget` will initialize the chatroom invitation widget.

.. code-block:: javascript

    _converse.api.waitUntil('rosterContactsFetched').then(this.initInviteWidget.bind(this));

The line above executes only once a chatroom has been opened and entered, so
using an event handler here would not work, since the event might have fired
already by that time.


The **archive** grouping
------------------------

Converse supports the *Message Archive Management*
(`XEP-0313 <https://xmpp.org/extensions/xep-0313.html>`_) protocol,
through which it is able to query an XMPP server for archived messages.

See also the **message_archiving** option in the :ref:`configuration-settings` section, which you'll usually
want to  in conjunction with this API.

query
~~~~~

The ``query`` method is used to query for archived messages.

It accepts the following optional parameters:

* **options** an object containing the query parameters. Valid query parameters
  are ``with``, ``start``, ``end``, ``first``, ``last``, ``after``, ``before``, ``index`` and ``count``.
* **callback** is the callback method that will be called when all the messages
  have been received.
* **errback** is the callback method to be called when an error is returned by
  the XMPP server, for example when it doesn't support message archiving.

Examples
^^^^^^^^

**Requesting all archived messages**

The simplest query that can be made is to simply not pass in any parameters.
Such a query will return all archived messages for the current user.

Generally, you'll however always want to pass in a callback method, to receive
the returned messages.

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            var errback = function (iq) {
                // The query was not successful, perhaps inform the user?
                // The IQ stanza returned by the XMPP server is passed in, so that you
                // may inspect it and determine what the problem was.
            }
            var callback = function (messages) {
                // Do something with the messages, like showing them in your webpage.
            }
            this._converse.api.archive.query(callback, errback))

        }
    });


**Waiting until server support has been determined**

The query method will only work if Converse has been able to determine that
the server supports MAM queries, otherwise the following error will be raised:

- *This server does not support XEP-0313, Message Archive Management*

The very first time Converse loads in a browser tab, if you call the query
API too quickly, the above error might appear because service discovery has not
yet been completed.

To work solve this problem, you can first listen for the ``serviceDiscovered`` event,
through which you can be informed once support for MAM has been determined.

For example:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            var _converse = this._converse;
            _converse.api.listen.on('serviceDiscovered', function (feature) {
                if (feature.get('var') === converse.env.Strophe.NS.MAM) {
                    _converse.api.archive.query()
                }
            });

    converse.listen.on('serviceDiscovered', function (feature) {
        if (feature.get('var') === converse.env.Strophe.NS.MAM) {
            converse.archive.query()
        }
    });

**Requesting all archived messages for a particular contact or room**

To query for messages sent between the current user and another user or room,
the query options need to contain the the JID (Jabber ID) of the user or
room under the  ``with`` key.

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            // For a particular user
            this._converse.api.archive.query({'with': 'john@doe.net'}, callback, errback);)

            // For a particular room
            this._converse.api.archive.query({'with': 'discuss@conference.doglovers.net'}, callback, errback);)

        }
    });


**Requesting all archived messages before or after a certain date**

The ``start`` and ``end`` parameters are used to query for messages
within a certain timeframe. The passed in date values may either be ISO8601
formatted date strings, or JavaScript Date objects.

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            var options = {
                'with': 'john@doe.net',
                'start': '2010-06-07T00:00:00Z',
                'end': '2010-07-07T13:23:54Z'
            };
            this._converse.api.archive.query(options, callback, errback);

        }
    });


**Limiting the amount of messages returned**

The amount of returned messages may be limited with the ``max`` parameter.
By default, the messages are returned from oldest to newest.

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            // Return maximum 10 archived messages
            this._converse.api.archive.query({'with': 'john@doe.net', 'max':10}, callback, errback);

        }
    });

**Paging forwards through a set of archived messages**

When limiting the amount of messages returned per query, you might want to
repeatedly make a further query to fetch the next batch of messages.

To simplify this usecase for you, the callback method receives not only an array
with the returned archived messages, but also a special RSM (*Result Set
Management*) object which contains the query parameters you passed in, as well
as two utility methods ``next``, and ``previous``.

When you call one of these utility methods on the returned RSM object, and then
pass the result into a new query, you'll receive the next or previous batch of
archived messages. Please note, when calling these methods, pass in an integer
to limit your results.

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            var _converse = this._converse;
            var callback = function (messages, rsm) {
                // Do something with the messages, like showing them in your webpage.
                // ...
                // You can now use the returned "rsm" object, to fetch the next batch of messages:
                _converse.api.archive.query(rsm.next(10), callback, errback))

            }
            _converse.api.archive.query({'with': 'john@doe.net', 'max':10}, callback, errback);

        }
    });

**Paging backwards through a set of archived messages**

To page backwards through the archive, you need to know the UID of the message
which you'd like to page backwards from and then pass that as value for the
``before`` parameter. If you simply want to page backwards from the most recent
message, pass in the ``before`` parameter with an empty string value ``''``.

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            var _converse = this._converse;
            _converse.api.archive.query({'before': '', 'max':5}, function (message, rsm) {
                // Do something with the messages, like showing them in your webpage.
                // ...
                // You can now use the returned "rsm" object, to fetch the previous batch of messages:
                rsm.previous(5); // Call previous method, to update the object's parameters,
                                // passing in a limit value of 5.
                // Now we query again, to get the previous batch.
                _converse.api.archive.query(rsm, callback, errback);
            }

        }
    });

The **connection** grouping
---------------------------

This grouping collects API functions related to the XMPP connection.

connected
~~~~~~~~~

A boolean attribute (i.e. not a callable) which is set to `true` or `false` depending
on whether there is an established connection.

disconnect
~~~~~~~~~~

Terminates the connection.


The **disco** grouping
----------------------

This grouping collects API functions related to `service discovery
<https://xmpp.org/extensions/xep-0030.html>`_.

The **disco.own** grouping
~~~~~~~~~~~~~~~~~~~~~~~~~~

The **disco.own.features** grouping
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

add
***

Paramters:

* (String) name

get
***

Returns all of the identities registered for this client (i.e. instance of Converse).

.. code-block:: javascript

    const identities = _converse.api.disco.own.identities.get();


The **disco.own.identities** grouping
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

add
***

Paramters:

* (String) category
* (String) type
* (String) name
* (String) lang

Lets you add new identities for this client (i.e. instance of Converse).

.. code-block:: javascript

    _converse.api.disco.own.identities.add('client', 'web', 'Converse');


get
***

Returns all of the identities registered for this client (i.e. instance of Converse).

.. code-block:: javascript

    const identities = _converse.api.disco.own.identities.get();

clear
*****

Clears all previously set identities.


getIdentity
~~~~~~~~~~~

Paramters:

* (String) category
* (String) type
* (String) entity JID

Get the identity (with the given category and type) for a given disco entity.

For example, when determining support for PEP (personal eventing protocol), you
want to know whether the user's own JID has an identity with
``category='pubsub'`` and ``type='pep'`` as explained in this section of
XEP-0163: https://xmpp.org/extensions/xep-0163.html#support

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            _converse.api.disco.getIdentity('pubsub', 'pep', _converse.bare_jid).then(
                function (identity) {
                    if (_.isNil(identity)) {
                        // The entity DOES NOT have this identity
                    } else {
                        // The entity DOES have this identity
                    }
                }
            ).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
        }
    });

supports
~~~~~~~~

Used to determine whether an entity supports a given feature.

Returns a `Promise` which, when resolved, returns a map/object with keys
`supported` (a boolean) and `feature` which is a `Backbone.Model <http://backbonejs.org/#Model>`_.

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            _converse.api.disco.supports(Strophe.NS.MAM, _converse.bare_jid)
            .then(value => {
                // `value` is a map with two keys, `supported` and `feature`.
                if (value.supported) {
                    // The feature is supported
                } else {
                    // The feature is not supported
                }
            }).catch(() => {
                _converse.log(
                    "Error or timeout while checking for feature support",
                    Strophe.LogLevel.ERROR
                );
            });
        }
    });


The **user** grouping
---------------------

This grouping collects API functions related to the current logged in user.

jid
~~~

Returns the current user's full JID (Jabber ID).

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            alert(this._converse.api.user.jid());

        }
    });

login
~~~~~

Logs the user in. This method can accept a map with the credentials, like this:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            this._converse.api.user.login({
                'jid': 'dummy@example.com',
                'password': 'secret'
            });

        }
    });

or it can be called without any parameters, in which case Converse will try
to log the user in by calling the `prebind_url` or `credentials_url` depending
on whether prebinding is used or not.

logout
~~~~~~

Log the user out of the current XMPP session.

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            this._converse.api.user.logout();

        }
    });


The **status** sub-grouping
~~~~~~~~~~~~~~~~~~~~~~~~~~~

Set and get the user's chat status, also called their *availability*.

get
^^^

Return the current user's availability status:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            alert(this._converse.api.user.status.get()); // For example "dnd"

        }
    });

set
^^^

The user's status can be set to one of the following values:

* **away**
* **dnd**
* **offline**
* **online**
* **unavailable**
* **xa**

For example:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            this._converse.api.user.status.set('dnd');

        }
    });

Because the user's availability is often set together with a custom status
message, this method also allows you to pass in a status message as a
second parameter:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            this._converse.api.user.status.set('dnd', 'In a meeting');

        }
    });

The **message** sub-grouping
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The ``user.status.message`` sub-grouping exposes methods for setting and
retrieving the user's custom status message.

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {
            this._converse.api.user.status.message.set('In a meeting');
            // Returns "In a meeting"
            return this._converse.api.user.status.message.get();
        }
    });


The **contacts** grouping
-------------------------

get
~~~

This method is used to retrieve roster contacts.

To get a single roster contact, call the method with the contact's JID (Jabber ID):

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            var _converse = this._converse;
            _converse.api.listen.on('rosterContactsFetched', function () {
                var contact = _converse.api.contacts.get('buddy@example.com')
            });

        }
    });

To get multiple contacts, pass in an array of JIDs:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            var _converse = this._converse;
            _converse.api.listen.on('rosterContactsFetched', function () {
                var contacts = _converse.api.contacts.get(
                    ['buddy1@example.com', 'buddy2@example.com']
                )
            });

        }
    });

To return all contacts, simply call ``get`` without any parameters:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            var _converse = this._converse;
            _converse.api.listen.on('rosterContactsFetched', function () {
                var contacts = _converse.api.contacts.get();
            });

        }
    });


The returned roster contact is a `Backbone.Model <http://backbonejs.org/#Model>`_ of type _converse.RosterContacts.

It has the following attributes (which should be accessed via `get <http://backbonejs.org/#Model-get>`_).

+----------------+-----------------------------------------------------------------------------------------------------------------+
| Attribute      |                                                                                                                 |
+================+=================================================================================================================+
| ask            | If ask === 'subscribe', then we have asked this person to be our chat buddy.                                    |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| fullname       | The person's full name.                                                                                         |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| jid            | The person's Jabber/XMPP username.                                                                              |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| requesting     | If true, then this person is asking to be our chat buddy.                                                       |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| subscription   | The subscription state between the current user and this chat buddy. Can be `none`, `to`, `from` or `both`.     |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| id             | A unique id, same as the jid.                                                                                   |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| chat_status    | The person's chat status. Can be `online`, `offline`, `busy`, `xa` (extended away) or `away`.                   |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| user_id        | The user id part of the JID (the part before the `@`).                                                          |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| resources      | The known resources for this chat buddy. Each resource denotes a separate and connected chat client.            |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| groups         | The roster groups in which this chat buddy was placed.                                                          |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| status         | Their human readable custom status message.                                                                     |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| image_type     | The image's file type.                                                                                          |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| image          | The Base64 encoded image data.                                                                                  |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| url            | The buddy's website URL, as specified in their VCard data.                                                      |
+----------------+-----------------------------------------------------------------------------------------------------------------+
| vcard_updated  | When last the buddy's VCard was updated.                                                                        |
+----------------+-----------------------------------------------------------------------------------------------------------------+

add
~~~

Add a contact.

Provide the JID of the contact you want to add:

.. code-block:: javascript

    _converse.api.contacts.add('buddy@example.com')

You may also provide the fullname. If not present, we use the jid as fullname:

.. code-block:: javascript

    _converse.api.contacts.add('buddy@example.com', 'Buddy')

The **chats** grouping
----------------------

Note, for MUC chatrooms, you need to use the "rooms" grouping instead.

get
~~~

Returns an object representing a chat. The chat should already be open.

To return a single chat, provide the JID of the contact you're chatting
with in that chat:

.. code-block:: javascript

    _converse.api.chats.get('buddy@example.com')

To return an array of chats, provide an array of JIDs:

.. code-block:: javascript

    _converse.api.chats.get(['buddy1@example.com', 'buddy2@example.com'])

To return all open chats, call the method without any JIDs::

    _converse.api.chats.get()

open
~~~~

Opens a new chat.

It returns an promise which will resolve with a `Backbone.Model <https://backbonejs.org/#Model>`_ representing the chat.

Note that converse doesn't allow opening chats with users who aren't in your roster
(unless you have set :ref:`allow_non_roster_messaging` to ``true``).

These two events fire only once per session, so they're also available as promises.

So, to open a single chat:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function() {
            var _converse = this._converse;

            // Note, buddy@example.org must be in your contacts roster!
            _converse.api.chats.open('buddy@example.com').then((chat) => {
                // Now you can do something with the chat model
            });
        }
    });

To return an array of chats, provide an array of JIDs:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {
            var _converse = this._converse;
            // Note, these users must first be in your contacts roster!
            _converse.api.chats.open(['buddy1@example.com', 'buddy2@example.com']).then((chats) => {
                // Now you can do something with the chat models
            });
        }
    });


The **chatviews** grouping
--------------------------

.. note:: This is only for private chats.

get
~~~

Returns a `Backbone.View <http://backbonejs.org/#View>`_ of type _converse.ChatBoxView.

The chat should already be open, otherwise `undefined` will be returned.

To return a single view, provide the JID of the contact:

.. code-block:: javascript

    _converse.api.chatviews.get('buddy@example.com')

To return an array of views, provide an array of JIDs:

.. code-block:: javascript

    _converse.api.chatviews.get(['buddy1@example.com', 'buddy2@example.com'])


.. _`listen-grouping`:

The **listen** grouping
-----------------------

Converse emits events to which you can subscribe to.

Concerning events, the following methods are available under the "listen"
grouping:

* **on(eventName, callback, [context])**:

    Calling the ``on`` method allows you to subscribe to an event.
    Every time the event fires, the callback method specified by ``callback`` will be
    called.

    Parameters:

    * ``eventName`` is the event name as a string.
    * ``callback`` is the callback method to be called when the event is emitted.
    * ``context`` (optional), the value of the `this` parameter for the callback.

    For example:

.. code-block:: javascript

        _converse.api.listen.on('message', function (messageXML) { ... });

* **once(eventName, callback, [context])**:

    Calling the ``once`` method allows you to listen to an event
    exactly once.

    Parameters:

    * ``eventName`` is the event name as a string.
    * ``callback`` is the callback method to be called when the event is emitted.
    * ``context`` (optional), the value of the `this` parameter for the callback.

    For example:

.. code-block:: javascript

        _converse.api.listen.once('message', function (messageXML) { ... });

* **not(eventName, callback)**

    To stop listening to an event, you can use the ``not`` method.

    Parameters:

    * ``eventName`` is the event name as a string.
    * ``callback`` refers to the function that is to be no longer executed.

    For example:

.. code-block:: javascript

        _converse.api.listen.not('message', function (messageXML) { ... });


The **rooms** grouping
----------------------

get
~~~

Returns an object representing a multi user chat (room).
It takes 3 parameters:

* the room JID (if not specified, all rooms will be returned).
* a map (object) containing any extra room attributes For example, if you want
  to specify the nickname, use ``{'nick': 'bloodninja'}``. Previously (before
  version 1.0.7, the second parameter only accepted the nickname (as a string
  value). This is currently still accepted, but then you can't pass in any
  other room attributes. If the nickname is not specified then the node part of
  the user's JID will be used.
* a boolean, indicating whether the room should be created if not found (default: `false`)

.. code-block:: javascript

    converse.plugins.add('myplugin', {

        initialize: function () {
            var _converse = this._converse;
            _converse.api.waitUntil('roomsAutoJoined').then(function () {
                var create_if_not_found = true;
                this._converse.api.rooms.get(
                    'group@muc.example.com',
                    {'nick': 'dread-pirate-roberts'},
                    create_if_not_found
                )
            });
        }
    });

open
~~~~

Opens a multi user chat and returns an object representing it.
Similar to the ``chats.get`` API.

It takes 2 parameters:

* The room JID or JIDs (if not specified, all currently open rooms will be returned).
* A map (object) containing any extra room attributes. For example, if you want
  to specify the nickname, use ``{'nick': 'bloodninja'}``.

To open a single multi user chat, provide the JID of the room:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            this._converse.api.rooms.open('group@muc.example.com')

        }
    });

To return an array of rooms, provide an array of room JIDs:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            this._converse.api.rooms.open(['group1@muc.example.com', 'group2@muc.example.com'])

        }
    });

To setup a custom nickname when joining the room, provide the optional nick argument:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            this._converse.api.rooms.open('group@muc.example.com', {'nick': 'mycustomnick'})

        }
    });

Room attributes that may be passed in:

* *nick*: The nickname to be used
* *auto_configure*: A boolean, indicating whether the room should be configured
  automatically or not. If set to ``true``, then it makes sense to pass in
  configuration settings.
* *roomconfig*: A map of configuration settings to be used when the room gets
  configured automatically. Currently it doesn't make sense to specify
  ``roomconfig`` values if ``auto_configure`` is set to ``false``.
  For a list of configuration values that can be passed in, refer to these values
  in the `XEP-0045 MUC specification <https://xmpp.org/extensions/xep-0045.html#registrar-formtype-owner>`_.
  The values should be named without the ``muc#roomconfig_`` prefix.
* *maximize*: A boolean, indicating whether minimized rooms should also be
  maximized, when opened. Set to ``false`` by default.
* *bring_to_foreground*: A boolean indicating whether the room should be
  brought to the foreground and therefore replace the currently shown chat.
  If there is no chat currently open, then this option is ineffective.

For example, opening a room with a specific default configuration:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            this._converse.api.rooms.open(
                'myroom@conference.example.org',
                { 'nick': 'coolguy69',
                  'auto_configure': true,
                  'roomconfig': {
                      'changesubject': false,
                      'membersonly': true,
                      'persistentroom': true,
                      'publicroom': true,
                      'roomdesc': 'Comfy room for hanging out',
                      'whois': 'anyone'
                  }
                },
                true
            );

        }
    });


.. note:: `multi-list` configuration values are not yet supported.

close
~~~~~

Lets you close open chatrooms. You can call this method without any arguments
to close all open chatrooms, or you can specify a single JID or an array of
JIDs.

.. _`promises-grouping`:

The **promises** grouping
-------------------------

Converse and its plugins emit various events which you can listen to via the
:ref:`listen-grouping`.

Some of these events are also available as `ES2015 Promises <http://es6-features.org/#PromiseUsage>`_,
although not all of them could logically act as promises, since some events
might be fired multpile times whereas promises are to be resolved (or
rejected) only once.

The core events, which are also promises are:

* :ref:`cachedRoster`
* :ref:`chatBoxesFetched`
* :ref:`pluginsInitialized`
* :ref:`roster`
* :ref:`rosterContactsFetched`
* :ref:`rosterGroupsFetched`
* :ref:`rosterInitialized`
* :ref:`statusInitialized`
* :ref:`roomsPanelRendered` (only via the `converse-muc` plugin)

The various plugins might also provide promises, and they do this by using the
``promises.add`` api method.

add(promises)
~~~~~~~~~~~~~

By calling ``promises.add``, a new promise is made available for other code or
plugins to depend on via the ``_converse.api.waitUntil`` method.

This method accepts either a string or list of strings which specify the
promise(s) to be added.

For example:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {
            this._converse.api.promises.add('foo-completed');
        }
    });

Generally, it's the responsibility of the plugin which adds the promise to
also resolve it.

This is done by calling ``_converse.api.emit``, which not only resolve the
promise, but also emit an event with the same name (which can be listened to
via ``_converse.api.listen``).

For example:

.. code-block:: javascript

    _converse.api.emit('foo-completed');


The **settings** grouping
-------------------------

This grouping allows access to the configuration settings of Converse.

.. _`settings-update`:

update(settings)
~~~~~~~~~~~~~~~~

Allows new configuration settings to be specified, or new default values for
existing configuration settings to be specified.

For example:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {
            this._converse.api.settings.update({
                'enable_foo': true
            });
        }
    });

The user can then override the default value of the configuration setting when
calling `converse.initialize`.

For example:

.. code-block:: javascript

    converse.initialize({
        'enable_foo': false
    });


get(key)
~~~~~~~~

Returns the value of the particular configuration setting. For example:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            // default value would be false;
            alert(this._converse.api.settings.get("play_sounds"));

        }
    });

set(key, value) or set(object)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Set one or many configuration settings. For example:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            this._converse.api.settings.set("play_sounds", true);

        }
    });

or :

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            this._converse.api.settings.set({
                "play_sounds", true,
                "hide_offline_users" true
            });

        }
    });

Note, this is not an alternative to calling ``converse.initialize``, which still needs
to be called. Generally, you'd use this method after Converse is already
running and you want to change the configuration on-the-fly.

The **tokens** grouping
-----------------------

get
~~~

Returns a token, either the RID or SID token depending on what's asked for.

Example:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            alert(this._converse.api.tokens.get('rid'));

        }
    });


The **vcard** grouping
-----------------------

get
~~~

Parameters:

* ``model`` either a `Backbone.Model` instance, or a string JID.
* ``force`` (optional), a boolean indicating whether the vcard should be
  fetched even if it's been fetched before.

Returns a Promise which results with the VCard data for a particular JID or for
a `Backbone.Model` instance which represents an entity with a JID (such as a roster contact,
chat or chatroom occupant).

If a `Backbone.Model` instance is passed in, then it must have either a `jid`
attribute or a `muc_jid` attribute.

Example:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            _converse.api.waitUntil('rosterContactsFetched').then(() => {
                this._converse.api.vcard.get('someone@example.org').then(
                    (vcard) => {
                        // Do something with the vcard...
                    }
                );
            });

        }
    });

set
~~~

Parameters:

* ``data`` a map of VCard keys and values

Enables setting new values for a VCard.

Example:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            _converse.api.waitUntil('rosterContactsFetched').then(() => {
                this._converse.api.vcard.set({
                    'jid': 'someone@example.org',
                    'fn': 'Someone Somewhere',
                    'nickname': 'someone'
                }).then(() => {
                    // Succes
                }).catch(() => {
                    // Failure
                }).
            });

        }
    });

update
~~~~~~

Parameters:

* ``model`` a `Backbone.Model` instance
* ``force`` (optional), a boolean indicating whether the vcard should be
  fetched again even if it's been fetched before.

Fetches the VCard associated with a particular `Backbone.Model` instance
(by using its `jid` or `muc_jid` attribute) and then updates the model with the
returned VCard data.

Returns a promise;

Example:

.. code-block:: javascript

    converse.plugins.add('myplugin', {
        initialize: function () {

            _converse.api.waitUntil('rosterContactsFetched').then(() => {
                const chatbox = _converse.chatboxes.getChatBox('someone@example.org');
                _converse.api.vcard.update(chatbox);
            });
        }
    });
