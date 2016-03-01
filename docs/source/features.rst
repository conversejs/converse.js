.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/features.rst">Edit me on GitHub</a></div>

========
Features
========

.. contents:: Table of Contents
   :depth: 2
   :local:

Off-the-record encryption
=========================

Converse.js supports `Off-the-record (OTR) <https://otr.cypherpunks.ca/>`_
encrypted messaging.

The OTR protocol not only **encrypts your messages**, it provides ways to
**verify the identity** of the person you are talking to,
**plausible deniability** and **perfect forward secrecy** by generating
new encryption keys for each conversation.

In its current state, Javascript cryptography is fraught with dangers and
challenges that make it impossible to reach the same standard of security that
is available with native "desktop" software.

This is due to its runtime malleability, the way it is "installed" (e.g.
served) and the browser's lack of cryptographic primitives needed to implement
secure crypto.

For harsh but fairly valid criticism of Javascript cryptography, read:
`Javascript Cryptography Considered Harmful <http://www.matasano.com/articles/javascript-cryptography/>`_.

To get an idea on how this applies to OTR support in Converse.js, please read
`my thoughts on it <https://opkode.com/media/blog/2013/11/11/conversejs-otr-support>`_.

For now, suffice to say that although its useful to have OTR support in
Converse.js in order to avoid most eavesdroppers, if you need serious
communications privacy, then you're much better off using native software.

Notifications
=============

From version 0.8.1 Converse.js can play a sound notification when you receive a
message.

For more info, refer to the :ref:`play-sounds` configuration setting.

It can also show `desktop notification messages <https://developer.mozilla.org/en-US/docs/Web/API/notification>`_
when the browser is not currently visible.

For more info, refer to the :ref:`show-desktop-notifications` configuration setting.

Multilingual Support
====================

Converse.js is translated into multiple languages. The default build,
``converse.min.js``, includes all languages.

Languages increase the size of the Converse.js significantly.

If you only need one, or a subset of the available languages, it's better to
make a custom build which includes only those languages that you need.

Chat Rooms
==========

Commands
--------

Here are the different commands that may be used in a chat room:

+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| Event Type | When is it triggered?                                                                        | Example (substitue $nickname with an actual user's nickname)  |
+============+==============================================================================================+===============================================================+
| **ban**    | Ban a user from the chat room. They will not be able to join again.                          | /ban $nickname                                                |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| **clear**  | Clear the messages shown in the chat room.                                                   | /clear                                                        |
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
| **topic**  | Set the topic of the chat room.                                                              | /topic ${topic text}                                          |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
| **voice**  | Allow a muted user to post messages to the room.                                             | /voice $nickname [$reason]                                    |
+------------+----------------------------------------------------------------------------------------------+---------------------------------------------------------------+
