Changelog
=========

0.8.3 (2014-09-22)
------------------

* The Javascript build files in the 0.8.2 release weren't updated due to a
  unnoticed build error. [jcbrand]

0.8.2 (2014-09-22)
------------------

* Converse.js now has the ability to maintain sessions across page loads.
  Previously, the session tokens had to be handled externally and passed in.
  See the `keepalive <https://conversejs.org/docs/html/index.html#keepalive`_ configuration setting. [jcbrand]
* Allow changing of nickname in a chat room via /nick command. [jcbrand]
* Allow a chat room user to be muted or unmuted with the /mute and /voice commands. [jcbrand]
* Add a chat room toolbar button for toggling the list of participants. [jcbrand]
* Converse.js now responds to XEP-0030: Service Discovery requests. [jcbrand]
* Bugfix. Roster groups all appear offline after page reload (with prebind).
  See http://librelist.com/browser//conversejs/2014/8/26/problem-with-contact-list-everyone-is-offline/ [heban and jcbrand]
* Bugfix concerning trimmed chats. Chats were being trimmed even though there was enough room. [jcbrand]
* #62 Sound notifications will now also play when you are mentioned in a chat room. [jcbrand]
* #212 Bugfix. Groups weren't being show again after the live filter was cleared. [jcbrand]
* #215 (and also #75) XEP-0249: Direct MUC Invitations. [jcbrand]
* #216 Contacts tab empty when using xhr_user_search. [hcderaad and jcbrand]
* #219 New contacts added need page refresh to be accepted and become visible. [hcderaad and jcbrand]
* #220 Non-AMD example page was not working. [xavier83ar and jcbrand]
* #222 Control box state not remembered. [priyadi and jcbrand]
* #223 Provide API to query buddy status. [priyadi and jcbrand]
* #227 Updated Hebrew translations [GreenLunar]

0.8.1 (2014-08-23)
------------------

* Bugfix: Roster contacts' cache key too vague. [jcbrand]
* Bugfix: Roster contacts weren't properly sorted according to chat status. [jcbrand]
* #63 Support for sound notification when message is received. [jcbrand]
* #212 Provide a live filter of the roster contacts. [jcbrand]

0.8.0 (2014-08-04)
------------------

.. note::
    1. Converse.js is now relicensed under the `Mozilla Public License <http://www.mozilla.org/MPL/2.0/>`_.
    2. Configuration options for the chat toolbar have changed. Please refer to the `relevant documentation <http://devbox:8890/docs/html/index.html#visible-toolbar-buttons>`_.
    3. This release has reduced support for IE8 (some features won't work).
    4. Events have been renamed to remove "on" prefix (sorry for any inconvenience).

* No initial HTML markup is now needed in the document body for converse.js to work. [jcbrand]
* All date handling is now done with moment.js. [jcbrand]
* Add a new toolbar button for clearing chat messages. [jcbrand]
* Chat boxes and rooms can now be resized vertically. [jcbrand]
* Upgraded dependencies to their latest versions. [jcbrand]
* Add new configuration setting `forward_messages <https://conversejs.org/docs/html/index.html#forward_messages>`_
  Message forwarding was before a default behavior but is now optional (and disabled by default). [jcbrand]
* Newly opened chat boxes always appear immediately left of the controlbox. [jcbrand]
* #71 Chat boxes and rooms can be minimized. [jcbrand]
* #83 Roster contacts can be shown according to their groups. [jcbrand]
    Note: Converse.js can show users under groups if you have assigned them
    already via another client or server configuration. There is not yet a way
    to assign contacts to groups from within converse.js itself.
* #123 Show converse.js in the resource assigned to a user. [jcbrand]
* #130 Fixed bootstrap conflicts. [jcbrand]
* #132 Support for `XEP-0280: Message Carbons <https://xmpp.org/extensions/xep-0280.html'>`_.
    Configured via `message_carbons <https://conversejs.org/docs/html/index.html#message_carbons>`_ [hejazee]
* #176 Add support for caching in sessionStorage as opposed to localStorage. [jcbrand]
* #180 RID and SID undefined [g8g3]
* #191 No messages history [heban]
* #192 Error: xhr_user_search_url is not defined. [jcbrand]
* #195 Chinese translations. [lancelothuxi]
* #196 [Safari v7.0.5] TypeError: Attempted to assign to readonly property. [g8g3]
* #199 Improved Spanish translations [chilicuil]
* #201 Add zh-locale to fix build task [schoetty]

0.7.4 (2014-03-05)
------------------

.. note:: This release contains an important security fix.
   Thanks to Renaud Dubourguais from `Synacktiv <http://synacktiv.com>`_ for reporting the vulnerability.

* #125 Bugfix: crypto dependencies loaded in wrong order [jcbrand]
* Bugfix: action messages (i.e. /me) didn't work in OTR mode. [jcbrand]
* Security fix: Ensure that message URLs are properly encoded. [jcbrand]

0.7.3 (2014-02-23)
------------------

* #93 Add API methods exposing the RID and SID values. Can be disabled. [jcbrand]
* #102 Option to enable OTR by default. [Aupajo]
* #103 Option to display a call button in the chatbox toolbar, to allow third-party libraries to provide a calling feature. [Aupajo]
* #108 Japanese Translations [mako09]
* #111 OTR not working when using converse.js with prebinding. [jseidl, jcbrand]
* #114, #124 Hewbrew Translations [GreenLunar]
* #115 Indonesian Translations [priyadi]

0.7.2 (2013-12-18)
------------------

.. note:: This release contains an important security fix.
   Thanks to hejsan for reporting the vulnerability.

* #48 Add event emitter support and emit events. [jcbrand]
* #97 Wrong number of online contacts shown with config option ``show_only_online_users``. [jcbrand]
* #100 Make the fetching of vCards optional (enabled by default). [jcbrand]
* Sanitize message text to avoid Javascript injection attacks.  [jcbrand]

0.7.1 (2013-11-17)
------------------

* Don't load OTR crypto if the browser doesn't have a CSRNG [jcbrand]
* Don't break when crypto libraries aren't defined. [jcbrand]
* Check if canvas is supported before trying to render the user avatar [jcbrand]
* Use newest strophe.muc plugin. Fixes #85 [jcbrand]

.. note ::
    If you are using the development libraries, you'll need to run ```bower update```
    to fetch the newest strophe.muc.plugin (for bugfix of #85).

    This release contains 3 different builds:
    - converse.min.js 
    - converse-no-otr.min.js (Without OTR encryption)
    - converse-no-locales-no-otr.min.js (Without OTR encryption or any translations)

0.7.0 (2013-11-13)
------------------

Important:
**********

This release includes support for [Off-the-record encryption](https://otr.cypherpunks.ca).
For this to work, your browser needs a CSPRNG (Cryptographically secure pseudorandom number generator).

Internet Explorer of all versions doesn't have one at all, neither does older versions of Firefox.

If you need to support older browsers, please download the latest release from the 0.6 bran

Features:
~~~~~~~~~

* Add a toolbar to the chat boxes [jcbrand]
* Add support for OTR (off-the-record) encryption [jcbrand]
* Add support for smileys [jcbrand]
* Simplified boilerplate markup [jcbrand]
* New configuration settings, ``xhr_custom_status_url`` and ``xhr_user_search_url`` [jcbrand]

.. note ::
    This release introduces a backward incompatible change. The boilerplate
    HTML needed in your webpage for converse.js to work has been reduced to a
    single div: <div id="conversejs"></div>

Bugfixes:
~~~~~~~~~

* #58 Contact's name gets replaced with their JID [jcbrand]
* #81 Requesting contacts appear as pending contacts [jcbrand]

0.6.6 (2013-10-16)
------------------

* Bugfix: Presence stanza must be sent out after roster has been initialized [jcbrand]
* Bugfix: Don't reconnect while still disconnecting, causes endless authentication loops. [jcbrand]
* Dutch translation [maartenkling]

0.6.5 (2013-10-08)
------------------

* Fetch vCards asynchronously once a roster contact is added [jcbrand]
* Hungarian translation [w3host]
* Russian translation [bkocherov]
* Update CSS to avoid clash with bootstrap [seocam]
* New config option ``allow_muc`` toggles multi-user chat (MUC) [jcbrand]
* New config option ``allow_contact_requests`` toggles user adding [jcbrand]
* New config option ``show_only_online_users`` [jcbrand]

0.6.4 (2013-09-15)
------------------

* Add icon for the unavailable chat state. [jcbrand]
* Chat state descriptions weren't translation aware. [jcbrand]
* Clear messages from localStorage when user types "/clear". [jcbrand]
* The 'xa' chat state wasn't being handled properly. [jcbrand]
* Updated pt-BR translations [seocam]
* Updated af and de translations [jcbrand]

0.6.3 (2013-09-12)
------------------

NB: This release contains an important security fix. Please don't use older
versions of the 0.6 branch.

* French translations. [tdesvenain]
* Bugfix: Messages were stored against buddy JID and not own JID. [jcbrand]

0.6.2 (2013-08-29)
------------------

* Bugfix. The remove icon wasn't appearing in the contacts roster. [jcbrand]
* Bugfix. With auto_subscribe=True, the "Pending Contacts" header didn't disappear
  after a new user was accepted. [jcbrand]

0.6.1 (2013-08-28)
------------------

* IE9 and IE8 CSS fixes. [jcbrand]
* Bugfix: Pencil icon not visible (for setting status update). [jcbrand]
* Bugfix: RID, JID and SID initialization values were being ignored. [jcbrand]
* Bugfix: Fall back to English if a non-existing locale was specified. [jcbrand]

0.6.0 (2013-08-26)
------------------

* #39 Documentation for minifying JS is wrong. [jcbrand]
* #41 prebind and show_controlbox_by_default true fails. [jcbrand]
* With prebinding, attaching to the connection now happens inside Converse and
  not as a separate step after initialization. [jcbrand]
* Register presence and message handlers before fetching the roster. Otherwise
  some presence notifications might be missed. [jcbrand]
* Add a debug option (logs to the browser console). [jcbrand]
* Use font icons from http://icomoon.io [jcbrand]
* Added a static mockup to aid CSS/design process. [jcbrand]
* Save language codes with hyphens. Thanks to @seocam. [jcbrand]
* The combined and minified JS file now uses almond and not require.js. [jcbrand]

0.5.2 (2013-08-05)
------------------

* Important security update. Don't expose the Strophe connection object globally. [jcbrand]

0.5.1 (2013-08-04)
------------------

* #13, #14: Messages sent between to GTalk accounts weren't being received. [jcbrand]
* #32: Default status was offline when user didn't have contacts. [jcbrand]
* Attach panels to the DOM upon initialize. [jcbrand]

0.5.0 (2013-07-30)
------------------

* #09 Remove dependency on AMD/require.js [jcbrand]
* #22 Fixed compare operator in strophe.muc [sonata82]
* #23 Add Italian translations [ctrlaltca]
* #24 Add Spanish translations [macagua]
* #25 Using span with css instead of img [matheus-morfi]
* #26 Only the first minute digit shown in chatbox. [jcbrand]
* #28 Add Brazilian Portuguese translations [matheus-morfi]
* Use Bower to manage 3rd party dependencies. [jcbrand]

0.4.0 (2013-06-03)
------------------

* CSS tweaks: fixed overflowing text in status message and chatrooms list. [jcbrand]
* Bugfix: Couldn't join chatroom when clicking from a list of rooms. [jcbrand]
* Add better support for kicking or banning users from chatrooms. [jcbrand]
* Fixed alignment of chat messages in Firefox. [jcbrand]
* More intelligent fetching of vCards. [jcbrand]
* Fixed a race condition bug. Make sure that the roster is populated before sending initial presence. [jcbrand]
* Reconnect automatically when the connection drops. [jcbrand]
* Add support for internationalization. [jcbrand]

0.3.0 (2013-05-21)
------------------

* Add vCard support [jcbrand]
* Remember custom status messages upon reload. [jcbrand]
* Remove jquery-ui dependency. [jcbrand]
* Use backbone.localStorage to store the contacts roster, open chatboxes and chat messages. [jcbrand]
* Fixed user status handling, which wasn't 100% according to the spec. [jcbrand]
* Separate messages according to day in chats. [jcbrand]
* Add support for specifying the BOSH bind URL as configuration setting. [jcbrand]
* #8 Improve the message counter to only increment when the window is not focused [witekdev]
* Make fetching of list of chatrooms on a server a configuration option. [jcbrand]
* Use service discovery to show all available features on a room. [jcbrand]
* Multi-user chatrooms are now configurable. [jcbrand]


0.2.0 (2013-03-28)
------------------

* Performance enhancements and general script cleanup [ichim-david]
* Add "Connecting to chat..." info [alecghica]
* Various smaller improvements and bugfixes [jcbrand]


0.1.0 (2012-06-12)
------------------

* Created [jcbrand]
