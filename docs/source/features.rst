.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/features.rst">Edit me on GitHub</a></div>

========
Features
========

Open chats via URL
==================

From version 3.3.0, converse.js now has the ability to open chats (private or
groupchat) based on the URL fragment.

A room (aka groupchat) can be opened with a URL fragment such as `#converse/room?jid=room@domain`
and a private chat with a URL fragment such as
`#converse/chat?jid=user@domain`.

Off-the-record encryption
=========================

Converse supports `Off-the-record (OTR) <https://otr.cypherpunks.ca/>`_
encrypted messaging.

The OTR protocol not only **encrypts your messages**, it provides ways to
**verify the identity** of the person you are talking to,
**plausible deniability** and **perfect forward secrecy** by generating
new encryption keys for each conversation.

In its current state, JavaScript cryptography is fraught with dangers and
challenges that make it impossible to reach the same standard of security that
is available with native "desktop" software.

This is due to its runtime malleability, the way it is "installed" (e.g.
served) and the browser's lack of cryptographic primitives needed to implement
secure crypto.

For harsh but fairly valid criticism of JavaScript cryptography, read:
`JavaScript Cryptography Considered Harmful <http://www.matasano.com/articles/javascript-cryptography/>`_.

To get an idea on how this applies to OTR support in Converse, please read
`my thoughts on it <https://opkode.com/media/blog/2013/11/11/conversejs-otr-support>`_.

For now, suffice to say that although its useful to have OTR support in
Converse in order to avoid most eavesdroppers, if you need serious
communications privacy, then you're much better off using native software.

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
