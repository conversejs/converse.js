===========
Development
===========

.. contents:: Table of Contents
   :depth: 2
   :local:

If you want to work with the non-minified Javascript and CSS files you'll soon
notice that there are references to a missing *components* folder. Please
follow the instructions below to create this folder and fetch Converse's
3rd-party dependencies.

.. note::
    If you have trouble setting up a development environment on Windows,
    please read `this post <http://librelist.com/browser//conversejs/2014/11/5/openfire-converse-and-visual-studio-questions/#b28387e7f8f126693b11598a8acbe810>`_
    in the mailing list.:

Install the development and front-end dependencies
==================================================

We use development tools (`Grunt <http://gruntjs.com>`_ and `Bower <http://bower.io>`_)
which depend on Node.js and npm (the Node package manager).

If you don't have Node.js installed, you can download and install the latest
version `here <https://nodejs.org/download>`_.

Also make sure you have ``Git`` installed. `Details <http://git-scm.com/book/en/Getting-Started-Installing-Git>`_.

Once you have *Node.js* and *git* installed, run the following command inside the Converse.js
directory:

::

    make dev

Or alternatively, if you don't have GNU Make:

::

    npm install
    bower update

This will first install the Node.js development tools (like Grunt and Bower)
and then use Bower to install all of Converse.js's front-end dependencies.

The front-end dependencies are those javascript files on which
Converse.js directly depends and which will be loaded in the browser.

If you are curious to know what the different dependencies are:

* Development dependencies:
    Take a look at whats under the *devDependencies* key in
    `package.json <https://github.com/jcbrand/converse.js/blob/master/package.json>`_.

* Front-end dependencies:
    See *dependencies* in
    `bower.json <https://github.com/jcbrand/converse.js/blob/master/bower.json>`_.

.. note::
    After running ```make dev```, you should now have a new directory *components*,
    which contains all the front-end dependencies of Converse.js.
    If this directory does NOT exist, something must have gone wrong.
    Double-check the output of ```make dev``` to see if there are any errors
    listed. For support, you can write to the mailing list: conversejs@librelist.com


With AMD and require.js (recommended)
=====================================

Converse.js uses `require.js <http://requirejs.org>`_ to asynchronously load dependencies.

If you want to develop or customize converse.js, you'll want to load the
non-minified javascript files.

Add the following two lines to the *<head>* section of your webpage:

.. code-block:: html

    <link rel="stylesheet" type="text/css" media="screen" href="converse.css">
    <script data-main="main" src="components/requirejs/require.js"></script>

require.js will then let the main.js file be parsed (because of the *data-main*
attribute on the *script* tag), which will in turn cause converse.js to be
parsed.

Without AMD and require.js
==========================

Converse.js can also be used without require.js. If you for some reason prefer
to use it this way, please refer to
`non_amd.html <https://github.com/jcbrand/converse.js/blob/master/non_amd.html>`_
for an example of how and in what order all the Javascript files that converse.js
depends on need to be loaded.


Before submitting a pull request
================================

Add tests for your bugfix or feature
------------------------------------

Add a test for any bug fixed or feature added. We use Jasmine
for testing.

Take a look at ``tests.html`` and ``spec/MainSpec.js`` to see how
the tests are implemented.

If you are unsure how to write tests, please
`contact me <http://opkode.com/contact>`_ and I'll be happy to help.

Check that the tests pass
-------------------------

Check that the Jasmine tests complete sucessfully. Open
`tests.html <https://github.com/jcbrand/converse.js/blob/master/tests.html>`_
in your browser, and the tests will run automatically.

On the command line you can run:

::

    grunt test

Check your code for errors or bad habits by running JSHint
----------------------------------------------------------

`JSHint <http://jshint.com>`_ will do a static analysis of your code and hightlight potential errors
and/or bad habits.

::

    grunt jshint


You can run both the tests and jshint in one go by calling:

::

    grunt check


Developer API
=============

.. note:: The API documented here is available in Converse.js 0.8.4 and higher.
        Earlier versions of Converse.js might have different API methods or none at all.

In the Converse.js API, you traverse towards a logical grouping, from
which you can then call certain standardised accessors and mutators, like::

    .get
    .set
    .add
    .all
    .remove

This is done to increase readability and to allow intuitive method chaining.

For example, to get a contact, you would do the following::

    converse.contacts.get('jid@example.com');

To get multiple contacts, just pass in an array of jids::

    converse.contacts.get(['jid1@example.com', 'jid2@example.com']);


**Here follows now a breakdown of all API groupings and methods**:


initialize
----------

.. note:: This method is the one exception of a method which is not logically grouped
    as explained above.

Initializes converse.js. This method must always be called when using
converse.js.

The `initialize` method takes a map (also called a hash or dictionary) of
:ref:`configuration-variables`.

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


"contacts" grouping
-------------------

get
~~~

Returns a map of attributes for a given buddy (i.e. roster contact), specified
by JID (Jabber ID).

Example::

    converse.contacts.get('buddy@example.com')

The map of attributes:

+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| Attribute      |                                                                                                                                      |
+================+======================================================================================================================================+
| ask            | If ask === 'subscribe', then we have asked this person to be our chat buddy.                                                         |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| fullname       | The person's full name.                                                                                                              |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| jid            | The person's Jabber/XMPP username.                                                                                                   |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| requesting     | If true, then this person is asking to be our chat buddy.                                                                            |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| subscription   | The subscription state between the current user and this chat buddy. Can be `none`, `to`, `from` or `both`.                          |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| id             | A unique id, same as the jid.                                                                                                        |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| chat_status    | The person's chat status. Can be `online`, `offline`, `busy`, `xa` (extended away) or `away`.                                        |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| user_id        | The user id part of the JID (the part before the `@`).                                                                               |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| resources      | The known resources for this chat buddy. Each resource denotes a separate and connected chat client.                                 |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| groups         | The roster groups in which this chat buddy was placed.                                                                               |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| status         | Their human readable custom status message.                                                                                          |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| image_type     | The image's file type.                                                                                                               |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| image          | The Base64 encoded image data.                                                                                                       |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| url            | The buddy's website URL, as specified in their VCard data.                                                                           |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+
| vcard_updated  | When last the buddy's VCard was updated.                                                                                             |
+----------------+--------------------------------------------------------------------------------------------------------------------------------------+

"chats" grouping
----------------

get
~~~

Returns an object/map representing a chat box (without opening or affecting that chat box). 

Example::

    converse.chats.get('buddy@example.com')

*The returned chat box contains the following methods:*

+-------------+------------------------------------------+
| Method      | Description                              |
+=============+==========================================+
| endOTR      | End an OTR (Off-the-record) session.     |
+-------------+------------------------------------------+
| get         | Get an attribute (i.e. accessor).        |
+-------------+------------------------------------------+
| initiateOTR | Start an OTR (off-the-record) session.   |
+-------------+------------------------------------------+
| maximize    | Minimize the chat box.                   |
+-------------+------------------------------------------+
| minimize    | Maximize the chat box.                   |
+-------------+------------------------------------------+
| set         | Set an attribute (i.e. mutator).         |
+-------------+------------------------------------------+

*The get and set methods can be used to retrieve and change the following attributes:*

+-------------+-----------------------------------------------------+
| Attribute   | Description                                         |
+=============+=====================================================+
| height      | The height of the chat box.                         |
+-------------+-----------------------------------------------------+
| url         | The URL of the chat box heading.                    |
+-------------+-----------------------------------------------------+

"tokens" grouping
-----------------

get
~~~

Returns a token, either the RID or SID token depending on what's asked for.

Example::

    converse.tokens.get('rid')

"listen" grouping
-----------------

Converse.js emits events to which you can subscribe from your own Javascript.

Concerning events, the following methods are available under the "listen"
grouping:

* **on(eventName, callback)**:

    Calling the ``on`` method allows you to subscribe to an event.
    Every time the event fires, the callback method specified by ``callback`` will be
    called.

    Parameters:

    * ``eventName`` is the event name as a string.
    * ``callback`` is the callback method to be called when the event is emitted.

    For example::

        converse.listen.on('message', function (messageXML) { ... });

* **once(eventName, callback)**:

    Calling the ``once`` method allows you to listen to an event
    exactly once.

    Parameters:

    * ``eventName`` is the event name as a string.
    * ``callback`` is the callback method to be called when the event is emitted.

    For example::

        converse.listen.once('message', function (messageXML) { ... });

* **not(eventName, callback)**

    To stop listening to an event, you can use the ``not`` method.

    Parameters:

    * ``eventName`` is the event name as a string.
    * ``callback`` refers to the function that is to be no longer executed.

    For example::

        converse.listen.not('message', function (messageXML) { ... });

Events
======

.. note:: see also the `"listen" grouping`_ API section above.

Event Types
-----------

Here are the different events that are emitted:

+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| Event Type                     | When is it triggered?                                                                             | Example                                                                                 |
+================================+===================================================================================================+=========================================================================================+
| **initialized**                | Once converse.js has been initialized.                                                            | ``converse.on('initialized', function () { ... });``                                    |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **ready**                      | After connection has been established and converse.js has got all its ducks in a row.             | ``converse.on('ready', function () { ... });``                                          |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **reconnect**                  | After the connection has dropped. Converse.js will attempt to reconnect when not in prebind mode. | ``converse.on('reconnect', function () { ... });``                                      |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **message**                    | When a message is received.                                                                       | ``converse.on('message', function (messageXML) { ... });``                              |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **messageSend**                | When a message will be sent out.                                                                  | ``converse.on('messageSend', function (messageText) { ... });``                         |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **noResumeableSession**        | When keepalive=true but there aren't any stored prebind tokens.                                   | ``converse.on('noResumeableSession', function () { ... });``                            |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **roster**                     | When the roster is updated.                                                                       | ``converse.on('roster', function (items) { ... });``                                    |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **callButtonClicked**          | When a call button (i.e. with class .toggle-call) on a chat box has been clicked.                 | ``converse.on('callButtonClicked', function (connection, model) { ... });``             |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **chatBoxOpened**              | When a chat box has been opened.                                                                  | ``converse.on('chatBoxOpened', function (chatbox) { ... });``                           |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **chatRoomOpened**             | When a chat room has been opened.                                                                 | ``converse.on('chatRoomOpened', function (chatbox) { ... });``                          |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **chatBoxClosed**              | When a chat box has been closed.                                                                  | ``converse.on('chatBoxClosed', function (chatbox) { ... });``                           |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **chatBoxFocused**             | When the focus has been moved to a chat box.                                                      | ``converse.on('chatBoxFocused', function (chatbox) { ... });``                          |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **chatBoxToggled**             | When a chat box has been minimized or maximized.                                                  | ``converse.on('chatBoxToggled', function (chatbox) { ... });``                          |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **roomInviteSent**             | After the user has sent out a direct invitation, to a roster contact, asking them to join a room. | ``converse.on('roomInvite', function (roomview, invitee_jid, reason) { ... });``        |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **roomInviteReceived**         | After the user has sent out a direct invitation, to a roster contact, asking them to join a room. | ``converse.on('roomInvite', function (roomview, invitee_jid, reason) { ... });``        |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **statusChanged**              | When own chat status has changed.                                                                 | ``converse.on('statusChanged', function (status) { ... });``                            |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **statusMessageChanged**       | When own custom status message has changed.                                                       | ``converse.on('statusMessageChanged', function (message) { ... });``                    |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **contactStatusChanged**       | When a chat buddy's chat status has changed.                                                      | ``converse.on('contactStatusChanged', function (buddy, status) { ... });``              |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
| **contactStatusMessageChanged**| When a chat buddy's custom status message has changed.                                            | ``converse.on('contactStatusMessageChanged', function (buddy, messageText) { ... });``  |
+--------------------------------+---------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------+
