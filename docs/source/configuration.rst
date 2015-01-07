
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

Please refer to the `Configuration variables`_ section below for info on
all the available configuration settings.

After you have configured *Converse.js*, you'll have to regenerate the minified
JS file so that it will include the new settings. Please refer to the
:ref:`minification` section for more info on how to do this.

.. _`configuration-variables`:

Configuration variables
=======================

allow_contact_requests
----------------------

Default:  ``true``

Allow users to add one another as contacts. If this is set to false, the
**Add a contact** widget, **Contact Requests** and **Pending Contacts** roster
sections will all not appear. Additionally, all incoming contact requests will be
ignored.

allow_muc
---------

Default:  ``true``

Allow multi-user chat (muc) in chatrooms. Setting this to ``false`` will remove
the ``Chatrooms`` tab from the control box.

allow_otr
---------

Default:  ``true``

Allow Off-the-record encryption of single-user chat messages.

allow_registration
---------

Default:  ``true``

Support for `XEP-0077: In band registration <http://xmpp.org/extensions/xep-0077.html>`_

Allow XMPP account registration showing the corresponding UI register form interface.

animate
-------

Default:  ``true``

Show animations, for example when opening and closing chat boxes.

auto_list_rooms
---------------

Default:  ``false``

If true, and the XMPP server on which the current user is logged in supports
multi-user chat, then a list of rooms on that server will be fetched.

Not recommended for servers with lots of chat rooms.

For each room on the server a query is made to fetch further details (e.g.
features, number of occupants etc.), so on servers with many rooms this
option will create lots of extra connection traffic.

auto_reconnect
--------------

Default:  ``true``

Automatically reconnect to the XMPP server if the connection drops
unexpectedly.

auto_subscribe
--------------

Default:  ``false``

If true, the user will automatically subscribe back to any contact requests.

.. _`bosh-service-url`:

bosh_service_url
----------------

Connections to an XMPP server depend on a BOSH connection manager which acts as
a middle man between HTTP and XMPP.

For more information, read this blog post: `Which BOSH server do you need? <http://metajack.im/2008/09/08/which-bosh-server-do-you-need>`_

cache_otr_key
-------------

Default:  ``false``

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

debug
-----

Default:  ``false``

If set to true, debugging output will be logged to the browser console.

domain_placeholder
------------------

Default: ``e.g. conversejs.org``

The placeholder text shown in the domain input on the registration form.

keepalive
---------

Default:    ``true``

Determines whether Converse.js will maintain the chat session across page
loads.

See also:

* :ref:`session-support`
* `Using prebind in connection with keepalive`_

message_carbons
---------------

Default:  ``false``

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

expose_rid_and_sid
------------------

Default:  ``false``

Allow the prebind tokens, RID (request ID) and SID (session ID), to be exposed
globally via the API. This allows other scripts served on the same page to use
these values.

*Beware*: a malicious script could use these tokens to assume your identity
and inject fake chat messages.

forward_messages
----------------

Default:  ``false``

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

hide_muc_server
---------------

Default:  ``false``

Hide the ``server`` input field of the form inside the ``Room`` panel of the
controlbox. Useful if you want to restrict users to a specific XMPP server of
your choosing.

hide_offline_users
------------------

Default:  ``false``

If set to ``true``, then don't show offline users.

i18n
----

Specify the locale/language. The language must be in the ``locales`` object. Refer to
``./locale/locales.js`` to see which locales are supported.

.. _`play-sounds`:

play_sounds
-----------

Default:  ``false``

Plays a notification sound when you receive a personal message or when your
nickname is mentioned in a chat room.

Inside the ``./sounds`` directory of the Converse.js repo, you'll see MP3 and Ogg
formatted sound files. We need both, because neither format is supported by all browsers.

For now, sound files are looked up by convention, not configuration. So to have
a sound play when a message is received, make sure that your webserver serves
it in both formats as ``http://yoursite.com/sounds/msg_received.mp3`` and
``http://yoursite.com/sounds/msg_received.ogg``.

``http://yoursite.com`` should of course be your site's URL.

prebind
--------

Default:  ``false``

See also: :ref:`session-support`

Use this option when you want to attach to an existing XMPP connection that was
already authenticated (usually on the backend before page load).

This is useful when you don't want to render the login form on the chat control
box with each page load.

For prebinding to work, you must set up a pre-authenticated BOSH session,
for which you will receive a JID (jabber ID), SID (session ID) and RID
(Request ID).

These values (``rid``, ``sid`` and ``jid``) need to be passed into
``converse.initialize`` (with the exception of ``keepalive``, see below).

Additionally, you also have to specify a ``bosh_service_url``.

Using prebind in connection with keepalive
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The ``prebind`` and `keepalive`_ options can be used together.

The ``keepalive`` option caches the ``rid``, ``sid`` and ``jid`` values
(henceforth referred to as *session tokens*) one receives from a prebinded
BOSH session, in order to re-use them when the page reloads.

However, if besides setting ``keepalive`` to ``true``, you also set ``prebind``
to ``true``, and you pass in valid session tokens to ``converse.initialize``,
then those passed in session tokens will be used instead of any tokens cached by
``keepalive``.

If you set ``prebind`` to ``true``  and don't pass in the session tokens to
``converse.initialize``, then converse.js will look for tokens cached by
``keepalive``.

If you've set ``keepalive`` and ``prebind`` to ``true``, don't pass in session
tokens and converse.js doesn't find any cached session tokens, then
converse.js will emit an event ``noResumeableSession`` and exit.

This allows you to start a prebinded session with valid tokens, and then fall
back to ``keepalive`` for maintaining that session across page reloads. When
for some reason ``keepalive`` doesn't have cached session tokens anymore, you
can listen for the ``noResumeableSession`` event and take that as a cue that
you should again prebind in order to get valid session tokens.

Here is a code example:

.. code-block:: javascript

        converse.on('noResumeableSession', function () {
            $.getJSON('/prebind', function (data) {
                converse.initialize({
                    prebind: true,
                    keepalive: true,
                    bosh_service_url: 'https://bind.example.com',
                    jid: data.jid,
                    sid: data.sid,
                    rid: data.rid
                });
            });
        });
        converse.initialize({
            prebind: true,
            keepalive: true,
            bosh_service_url: 'https://bind.example.com'
        }));


providers_link
--------------

Default:  ``https://xmpp.net/directory.php``

The hyperlink on the registration form which points to a directory of public
XMPP servers.


roster_groups
-------------

Default:  ``false``

If set to ``true``, converse.js will show any roster groups you might have
configured.

.. note::
    It's currently not possible to use converse.js to assign contacts to groups.
    Converse.js can only show users and groups that were previously configured
    elsewhere.

show_controlbox_by_default
--------------------------

Default:  ``false``

The "controlbox" refers to the special chatbox containing your contacts roster,
status widget, chatrooms and other controls.

By default this box is hidden and can be toggled by clicking on any element in
the page with class *toggle-controlbox*.

If this options is set to true, the controlbox will by default be shown upon
page load.

show_only_online_users
----------------------

Default:  ``false``

If set to ``true``, only online users will be shown in the contacts roster.
Users with any other status (e.g. away, busy etc.) will not be shown.

storage
-------

Default: ``session``

Valid options: ``session``, ``local``.

This option determines the type of `storage <https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Storage>`_
(``localStorage`` or ``sessionStorage``) used by converse.js to cache user data.

Originally converse.js used only localStorage, however sessionStorage is from a
privacy perspective a better choice.

The main difference between the two is that sessionStorage only persists while
the current tab or window containing a converse.js instance is open. As soon as
it's closed, the data is cleared.

Data in localStorage on the other hand is kept indefinitely.

.. note::
    Since version 0.8.0, the use of local storage is not recommended. The
    statuses (online, away, busy etc.) of your roster contacts are cached in
    the browser storage. If you use local storage, these values are stored for
    multiple sessions, and they will likely become out of sync with your contacts'
    actual statuses. The session storage doesn't have this problem, because
    roster contact statuses will not become out of sync in a single session,
    only across more than one session.


use_otr_by_default
------------------

Default:  ``false``

If set to ``true``, Converse.js will automatically try to initiate an OTR (off-the-record)
encrypted chat session every time you open a chat box.

use_vcards
----------

Default:  ``true``

Determines whether the XMPP server will be queried for roster contacts' VCards
or not. VCards contain extra personal information such as your fullname and
avatar image.

visible_toolbar_buttons
-----------------------

Default:

.. code-block:: javascript

    {
        call: false,
        clear: true,
        emoticons: true,
        toggle_participants: true
    }

Allows you to show or hide buttons on the chat boxes' toolbars.

* *call*:
    Provides a button with a picture of a telephone on it.
    When the call button is pressed, it will emit an event that can be used by a third-party library to initiate a call.::

        converse.on('callButtonClicked', function(event, data) {
            console.log('Strophe connection is', data.connection);
            console.log('Bare buddy JID is', data.model.get('jid'));
            // ... Third-party library code ...
        });
* *clear*:
    Provides a button for clearing messages from a chat box.
* *emoticons*:
    Enables rendering of emoticons and provides a toolbar button for choosing them.
* toggle_participants:
    Shows a button for toggling (i.e. showing/hiding) the list of participants in a chat room.

xhr_custom_status
-----------------

Default:  ``false``

.. note::
    XHR stands for XMLHTTPRequest, and is meant here in the AJAX sense (Asynchronous Javascript and XML).

This option will let converse.js make an AJAX POST with your changed custom chat status to a
remote server.

xhr_custom_status_url
---------------------

.. note::
    XHR stands for XMLHTTPRequest, and is meant here in the AJAX sense (Asynchronous Javascript and XML).

Default:  Empty string

Used only in conjunction with ``xhr_custom_status``.

This is the URL to which the AJAX POST request to set the user's custom status
message will be made.

The message itself is sent in the request under the key ``msg``.

xhr_user_search
---------------

Default:  ``false``

.. note::
    XHR stands for XMLHTTPRequest, and is meant here in the AJAX sense (Asynchronous Javascript and XML).

There are two ways to add users.

* The user inputs a valid JID (Jabber ID), and the user is added as a pending contact.
* The user inputs some text (for example part of a firstname or lastname), an XHR (Ajax Request) will be made to a remote server, and a list of matches are returned. The user can then choose one of the matches to add as a contact.

This setting enables the second mechanism, otherwise by default the first will be used.

*What is expected from the remote server?*

A default JSON encoded list of objects must be returned. Each object
corresponds to a matched user and needs the keys ``id`` and ``fullname``.

xhr_user_search_url
-------------------

.. note::
    XHR stands for XMLHTTPRequest, and is meant here in the AJAX sense (Asynchronous Javascript and XML).

Default:  Empty string

Used only in conjunction with ``xhr_user_search``.

This is the URL to which an AJAX GET request will be made to fetch user data from your remote server.
The query string will be included in the request with ``q`` as its key.

The calendar can be configured through a `data-pat-calendar` attribute.
The available options are:
