.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/features.rst">Edit me on GitHub</a></div>

.. _`features`:

========
Features
========

File sharing (`XEP-0363 HTTP File Upload <https://xmpp.org/extensions/xep-0363.html>`_)
=======================================================================================

Converse supports file sharing by first uploading the file to a file server and
then sending the file's URL to the recipient.

The file server that is used is configured by the XMPP server admin, and is not
something that Converse has any control over.

Often when people report file sharing not working, it's because the file server
is not configured to allow file uploads from other domains.

The file server needs to be configured for `Cross-Origin resource sharing <https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS>`_
(known by the acronym CORS). Specifically, it needs to add a
``Access-Control-Allow-Origin`` header which includes the domain hosting
Converse.

.. _`feature-omemo`:

End to end message encryption (`XEP-0384 OMEMO <https://xmpp.org/extensions/xep-0363.html>`_)
=============================================================================================

.. note::
    Converse.js (as of version 4.1.2) does NOT support encryption or decryption
    of uploaded files. Files will be uploaded WITHOUT ENCRYPTION, even when
    OMEMO is enabled.

Converse supports OMEMO encryption based on the
`Signal Protocol <https://github.com/signalapp/libsignal-protocol-javascript>`_.

The Signal Protocol is session-oriented. Clients establish a session, which is
then used for all subsequent encrypt/decrypt operations. There is no need to
ever tear down a session once one has been established.

This means that a session needs to be stored permanently after logging out.

Converse stores this session information in the browser's `localStorage <https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage>`_.

If you've checked the "This is not a trusted device" checkbox when logging in,
then `sessionStorage <https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage>`_
is used instead of localStorage and all data is cleared when you log out.

For this reason, OMEMO is disabled when you've indicated that you're using
an untrusted device. You would in any case not be able to decrypt previously
received OMEMO messages, due to the Signal Protocol's forward secrecy and the
fact that you don't have a pre-existing session.

Security considerations for browser-based crypto
------------------------------------------------

Crypto apps deployed via regular web hosting can be described as relying on
"host-based" security.

Host-based security services require you to trust the host every time you access
it, whereas with installable desktop software you trust the host when you
download/install the software (and whenever it gets updated).

The dynamic nature of "host-based" systems makes it impractical for security
researchers to do security audits because the hosted code can change at any
time.

In such a setup you need to fully trust the host that serves you the JavaScript code.

The host that serves the JavaScript code is not necessarily the same host that
stores and procesess your chat messages. So using OMEMO can still protect your
messages from snooping on the XMPP server where they're stored encrypted.

In other words, you do have to trust the webserver that hosts Converse for you,
but you don't necessarily have to trust the XMPP server (if it's on a different host),
because it never gets hold of your private key.

One way to improve this situation is to host Converse yourself, especially if
you host it locally on your own machine. If you're not able to do that, then
at least make sure you use a reputable host that serves files over HTTPS and
that set `CSP <https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy>`_
headers.

Due to these reasons, it's NOT a good idea to use encrypted messaging with a
browser-based solution in life-threatening situations.

Security can be increased by using an installable app (like one based on `Electron <https://electronjs.org/>`_)
with a strict Content Security Policy.

Look out for an Electron based version of Converse coming in the following months.

For further reading on the challenges of web-based crypto, take a look at these
articles:

* `What's wrong with webcrypto? <https://tonyarcieri.com/whats-wrong-with-webcrypto>`_
* `Heartbleed and JavaScript crypto <https://tankredhase.com/2014/04/13/heartbleed-and-javascript-crypto/>`_

OMEMO in Multi-user chats (MUC)
-------------------------------

Converse supports OMEMO encryption in groupchats, but only if the groupchat is
set to `members only` and `non-anonymous`. This is the same criteria used by
the popular Android XMPP client `Conversations <https://conversations.im/>`_.

If the groupchat is configured properly, you'll see the lock icon in the
toolbar.


Open chats via URL
==================

From version 3.3.0, converse.js now has the ability to open chats (private or
groupchat) based on the URL fragment.

A room (aka groupchat) can be opened with a URL fragment such as `#converse/room?jid=room@domain`
and a private chat with a URL fragment such as
`#converse/chat?jid=user@domain`.


Notifications
=============

From version 0.8.1 Converse can play a sound notification when you receive a
message.

For more info, refer to the :ref:`play-sounds` configuration setting.

It can also show `desktop notification messages <https://developer.mozilla.org/en-US/docs/Web/API/notification>`_
when the browser is not currently visible.

For more info, refer to the :ref:`show-desktop-notifications` configuration setting.

Multilingual Support
====================

Converse is translated into multiple languages. Translations are supplied in
JSON format and are loaded on demand. Converse will expect to find the
translations in the ``/locales`` path of your site. This can be changed via the
:ref:`locales-url` configuration setting.

Moderating chatrooms
====================

Here are the different commands that may be used to moderate a chatroom:

+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| Event Type | When is it triggered?                                                                        | Example (substitue $nickname with an actual user's nickname)  |
+============+==============================================================================================+===============================================================+
| **ban**    | Ban a user from the chatroom. They will not be able to join again.                           | /ban $nickname                                                |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| **clear**  | Clear the messages shown in the chatroom.                                                    | /clear                                                        |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| **deop**   | Make a moderator a normal occupant.                                                          | /deop $nickname [$reason]                                     |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| **help**   | Show the list of available commands.                                                         | /help                                                         |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| **kick**   | Kick a user out of a room. They will be able to join again.                                  | /kick $nickname [$reason]                                     |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| **me**     | Speak in the 3rd person.                                                                     | /me $message                                                  |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| **mute**   | Remove a user's ability to post messages to the room. They will still be able to observe.    | /mute $nickname [$reason]                                     |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| **nick**   | Change your nickname.                                                                        | /nick $nickname                                               |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| **op**     | Make a normal occupant a moderator.                                                          | /op $nickname [$reason]                                       |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| **topic**  | Set the topic of the chatroom.                                                               | /topic ${topic text}                                          |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| **voice**  | Allow a muted user to post messages to the room.                                             | /voice $nickname [$reason]                                    |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+

Passwordless login with client certificates
===========================================

Converse supports the SASL-EXTERNAL authentication mechanism, which can be
used together with x509 client certificates to enable passwordless login or
even 2-factor authentication.

For more info, `read this blog post <https://opkode.com/blog/strophe_converse_sasl_external/>`_.
