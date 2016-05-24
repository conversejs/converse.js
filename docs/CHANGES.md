# Changelog

## 1.0.2 (2016-05-24)

- Bugfix. Bind `sendPresence` to the right context. Bug that slipped in during
  the release of `1.0.1`. [jcbrand]

## 1.0.1 (2016-05-24)

- Bugfix. Roster filter sometimes gets hidden when it shouldn't. [jcbrand]
- Chat boxes weren't being initialized due to typo. [jcbrand]
- Flush request queue just after connection. Solves a problem with PubSub and
  Prosody, whereby BOSH HTTP responses weren't being received. [jcbrand]

## 1.0.0 (2016-05-03)

- Add catalan language [JoseMariaRubioMoral]
- Split converse.js up into different plugin modules. [jcbrand]
- Better Sass/CSS for responsive/mobile views. New mobile-only build. [jcbrand]
- Roster contacts can now be filtered by chat state and roster filters are
  remembered across page loads. [jcbrand]
- Add support for messages with type `headline`, often used for notifications
  from the server. [jcbrand]
- Add stanza-specific event listener `converse.listen.stanza`.
  As a result `converse.listen.on('message');` has been deprecated, use
  `converse.stanza.on('message');` instead. [jcbrand]
- Emit an event `chatBoxInitialized` once a chat box's initialize method has been called. [jcbrand]
- Emit an event `statusInitialized` once the user's own status has been initialized upon startup. [jcbrand]
- New config option [chatstate_notification_blacklist](https://conversejs.org/docs/html/configuration.html#chatstate_notification_blacklist) [jcbrand]
- New config option [sticky_controlbox](https://conversejs.org/docs/html/configuration.html#sticky_controlbox) [jcbrand]
- New config option [credentials_url](https://conversejs.org/docs/html/configuration.html#credentials_url) [jcbrand]
- Don't play sound notifications for OTR messages which are setting up an
  encrypted session. [jcbrand]
- Bugfix: RID, SID and JID tokens ignored when `keepalive` set to `true`. [jcbrand]
- Removed the `account.logout` API, instead use `user.logout`. [jcbrand]
- Use `rel=noopener` with links that contain `target=_blank` to prevent potential
  phishing attacks. [More info here](https://mathiasbynens.github.io/rel-noopener/)
  [jcbrand]
- #156 Add the option `auto_join_rooms` which allows you to automatically
  connect to certain rooms once logged in. [jcbrand]
- #261 `show_controlbox_by_default` config not working [diditopher]
- #443 HTML5 notifications of received messages [jcbrand]
- #534 Updated Russian translation [badfiles]
- #566 Do not steal the focus when the chatbox opens automatically [rlanvin]
- #573 xgettext build error: `'javascript' unknown` [jcbrand]
- #577 New config variable [message_archiving_timeout](https://conversejs.org/docs/html/configuration.html#message_archiving_timeout) [jcbrand]
- #587 Fix issue when logging out with `auto_logout=true` [davec82]
- #589 Save scroll position on minimize and restore it on maximize [rlanvin]
- #592 Add random resource for `auto_login`, add method generateResource to
  generate random resource [davec82]
- #598 Add option `synchronize_availability` [davec82]
- #600 Fix change xmpp status also on icon-status click [davec82]
- #616 converse-otr should depend on converse-minimize  [jcbrand]
- #609 Remove split of fullname [lixmal]

## 0.10.1 (2016-02-06)

- #352 When the user has manually scrolled up in a chat window, don't scroll
  down on chat event notifications. [jcbrand]
- #524 Added [auto_join_on_invite](https://conversejs.org/docs/html/configuration.html#auto_join_on_invite)
  parameter for automatically joining chatrooms. [ben]
- #520 Set specific domain. Two new options [default_domain](https://conversejs.org/docs/html/configuration.html#default_domain)
  and [locked_domain](https://conversejs.org/docs/html/configuration.html#locked_domain). [jcbrand]
- #521 Not sending presence when connecting after disconnection. [jcbrand]
- #535 Messages not received when room with mixed-case JID is used. [jcbrand]
- #536 Presence not sent out (in cases where it should) after page refresh. [jcbrand]
- #540 `bind is not a function` error for plugins without `initialize` method. [jcbrand]
- #547 By default the `offline` state is no longer choosable.
  See [include_offline_state](https://conversejs.org/docs/html/configuration.html#include_offline_state) for details. [jcbrand]
- A chatroom invite might come from someone not in your roster list. [ben]
- #487 Empty the resources array when the resource is null [rlanvin]
- #534 Updated Russian translation [LaconicTranslator]
- #555 The status restored from sessionStorage is never updated [jcbrand]
- #559 Remove reconnection timer once connected succesfully [m0cs]

## 0.10.0 (2015-11-05)

**Note:**
*This release drops CSS support for IE8 and IE9.*

- #459 Wrong datatype passed to converse.chatboxes.getChatBox. [hobblegobber, jcbrand]
- #493 Roster push fix [jcbrand]
- #403 emit an event `rosterPush` when a roster push happens [teseo]
- #502. Chat room not opened in non_amd version. [rjanbiah]
- #505 Typo caused [object Object] in room info [gromiak]
- #508 "Is typing" doesn't automatically disappear [jcbrand]
- #509 Updated Polish translations [ser]
- #510 MUC room memberlist is being cleared with page reload when keepalive option is set. [jcbrand]
- Add the ability to also drag-resize chat boxes horizontally. [jcbrand]
- Updated Sass files and created a new style. [jcbrand]


## 0.9.6 (2015-10-12)

- Bugfix. Spinner doesn't disappear when scrolling up (when server doesn't support XEP-0313). [jcbrand]
- #462 Fix MUC rooms with names containing special characters not working [1st8]
- #467 Fix outgoing chat messages not having a msgid when being put into sessionStorage [1st8]
- #468 Fix [object Object] being sometimes shown as status [1st8]
- #472 Fix "Cannot read property 'splitOnce' of undefined" when typing /clear in a chat room. [jcbrand]
- #493 Roster wasn't being updated after a Roster push update [teseo, jcbrand]
- #496 Bugfix. Pings weren't being sent out. [teseo, jcbrand]
- #499 Message not received due to non-unique message ids. [jcbrand]

## 0.9.5 (2015-08-24)

- #306 XEP-0313: Message Archive Management [jcbrand]
- #439 auto_login and keepalive not working [jcbrand]
- #440 null added as resource to contact [jcbrand]
- Add new event serviceDiscovered [jcbrand]
- Add a new configuration setting [muc_history_max_stanzas](https://conversejs.org/docs/html/configuration.html#muc_history_max_stanzas>). [jcbrand]

## 0.9.4 (2015-07-04)

- #144 Add Ping functionality and Pong handler [thierrytiti]
- #234, #431 Messages aren't received when the user logs in with a mixed-case JID. [jcbrand]
- #367 API methods for changing chat status (online, busy, away etc.) and status message [jcbrand]
- #389 Allow login panel placeholders and roster item 'Name' translations. [gbonvehi]
- #394 Option to allow chatting with pending contacts [thierrytiti]
- #396 Add automatic Away mode and XEP-0352 support [thierrytiti]
- #400, #410 Allow offline pretty status and placeholder for "Insert a smiley" to be translated [thierrytiti]
- #401 Updated French translation [thierrytiti]
- #404 CSS fix: position and width of the div #conversejs [thierrytiti]
- #407 CSS: Fonts Path: editabable $font-path via sass/variables.scss [thierrytiti]
- #408 MUC: missing toggle call handler and updated documentation about call [thierrytiti]
- #413 Auto-detect user's locale to show date and time in the right format [thierrytiti]
- #415 closeAllChatBoxes is giving ReferenceError when 2 chats are open [nevcos, jcbrand]
- #416 Add icon for XA status [thierrytiti]
- #418 Logging out with `auto_reconnect=true` causes reconnection retries [jcbrand]
- #420 Updated German translation [1st8]
- #427 Converse.js does not subscribe back to a contact not in the roster. [emmanuel-florent]
- Add offline pretty status to enable translation [thierrytiti]
- Bugfix. ClearSessions during unload event would throw an error when not logged in. [gbonvehi]
- Bugfix. Manual login doesn't work when only websocket_url is set and not bosh_service_url. [jcbrand]
- Bugfix. Wrong callback argument mapping in XmppStatus initialize: fullname is null [thierrytiti]
- CSS fix: room-info bug on hover after room description loaded [thierrytiti]
- CSS: Fonts Path: editabable $font-path via sass/variables.scss [thierrytiti]
- Chat boxes returned by the API now have an `is_chatroom` attribute [jcbrand]
- Decouple automatic away and XEP-0352 support. [jcbrand]
- Don't carbon copy OTR messages. [jcbrand]
- I18N: Autodetection of User Locale if no i18n setting is set. [thierrytiti]
- Refactored in order to remove the strophe.roster.js dependency. [jcbrand]
- Refactored the plugin architecture. Add `overrides` convention for
  automatically overriding converse.js's methods and Backbone views and models. [jcbrand]
- With keepalive, don't send out a presence stanza on each page load [jcbrand]

## 0.9.3 (2015-05-01)

- Add the ability to log in automatically. [jcbrand]
- Remove `type=email` from JID field in login form. Resulting validation error confuses people. [jcbrand]
- Add Ukranian translations [Andriy Kopystyansky]
- #244 Add the ability to log in anonymously. [jcbrand]
- #344 Enable the path to the sound files to be configured [thierrytiti and jcbrand]
- #370 Unable to register a new user to ejabberd 2.1.11. [gbonvehi]
- #372 Some offline users have a visible empty `<dd>` in the roster. [floriancargoet]
- #374 Fix collapsed group visibility on page load. [floriancargoet]
- #378 Expect full JIDs to be returned via XHR user search [thierrytiti]
- #379 Updated French translations [thierrytiti]
- #379 Fix for bower not finding crypto-js-evanvosberg#3.1.2-5 any more. [jcbrand]

## 0.9.2 (2015-04-09)

- Bugfix. Prevent attaching twice during initialization. [jcbrand]
- API method chats.get can now also return chat boxes which haven't been opened yet. [jcbrand]
- Add API method contacts.add. [pzia]
- #356 Fix the plugin extend function. [floriancargoet]
- #357 Fix the known bug where a state notification reopens a chat box. [floriancargoet]
- #358 Bugfix. Chat rooms show the same occupants bug. [floriancargoet]
- #359 Fix a timeout bug in chat state notifications. [floriancargoet]
- #360 Incorrect roster height when `allow_contact_requests=true`. [floriancargoet, jcbrand]
- #362 Add API for retrieving and opening rooms. [pzia]
- #364 Text selection in chat boxes not shown in Firefox. [jcbrand]

## 0.9.1 (2015-03-26)

- Set the JID input field in the login form to `type=email`. [chatme]
- New configuration setting [allow_contact_removal](https://conversejs.org/docs/html/configuration.html#allow-contact-removal) [jcbrand]
- Document that event handlers receive 'event' obj as first arg. [jcbrand]
- Add a test to check that notifications are played in chat rooms. [jcbrand]
- #333 Enable automatic reconnection when `prebind` and `prebind_url` are specified. [jcbrand]
- #339 Require the JID to be specified when using `keepalive` with `prebind`. Also add a logout API method. [jcbrand]
- #349 Indicate visitors in chat rooms. [c143]

## 0.9.0 (2015-03-06)

- #204 Support websocket connections. [jcbrand]
- #252, 253 Add fullname and jid to contact's tooltip in roster. [gbonvehi]
- #292 Better support for XEP-0085 Chat State Notifications. [jcbrand]
- #295 Document "allow_registration". [gbonvehi]
- #304 Added Polish translations. [ser]
- #305 presence/show text in XMPP request isn't allowed by specification. [gbonvehi]
- Add new API method `chats.open` to open chat boxes. [jcbrand]
- Add new API method to set and get configuration settings. [jcbrand]
- Add responsiveness to CSS. We now use Sass preprocessor for generating CSS. [jcbrand]
- Bugfix. Custom status message form doesn't submit/disappear. [jcbrand]
- Calling the API method `contacts.get()` without parameters now returns all contacts. [jcbrand]
- Don't send out the message carbons IQ stanza on each page load. [jcbrand]
- New Makefile.win to build in Windows environments. [gbonvehi]
- Norwegian Bokmål translations. [Andreas Lorentsen]
- Removed deprecated API methods. [jcbrand]
- Strophe.log and Strophe.error now uses converse.log to output messages. [gbonvehi]
- The API method `chats.get` now only returns already opened chat boxes. [jcbrand]
- Updated Afrikaans translations. [jcbrand]
- Add new configuration setting [prebind_url](https://conversejs.org/docs/html/configuration.html#prebind-url) [jcbrand]

## 0.8.6 (2014-12-07)

- Bugfix. Login panel didn't appear under certain conditions. [jcbrand]
- Bugfix. Error when trying to render chat room configuration form. [jcbrand]
- Text on the registration form was not configurable or i18n aware. [jcbrand]
- #285 With prebind the jid, rid and sid settings were ignored. [jcbrand]

## 0.8.5 (2014-12-01)

- #117 JIDs or nicknames not shown in chat rooms. [jcbrand]
- #282 XEP-0077 In-band registration. [jcbrand]

## 0.8.4 (2014-11-15)

**note:**
*Certain API methods have been deprecated in favor of a new API and will be removed in the 0.9.0 release.*

- Bugfix. Error when trying to use prebind and keepalive together. [heban and jcbrand]
- Bugfix. Cannot read property "top" of undefined. [jcbrand]
- Add new event, noResumeableSession, for when keepalive=true and there aren't
  any prebind session tokens. [jcbrand]
- #46 Refactor the API and add new methods. [jcbrand]
- #151 Browser locks/freezes with many roster users. [jcbrand]
- #177 Setting status to offline does nothing. [jcbrand]
- #232 Always get full name from model. [jcbrand]
- #237 Unable to create room when `hide_muc_server` is `true`. [jcbrand]
- #238 Rooms are not shown when `hide_offline_users` is `true`. [jcbrand]
- #251 Non-minified builds for debugging. [jcbrand]
- #260 Sent message carbons are not displayed. [jcbrand]
- #262 Contact requests are not shown if page is reloaded. [jcbrand]
- #264 Remove unnecessary commas for ie8 compatibility. [Deuteu]
- #267 Unread messages counter wrongly gets incremented by chat state notifications. [Deuteu]
- #274 Roster filtering results change with presence changes. [jcbrand]
- #275 Custom status message doesn't reset. [jcbrand]
- #278 Unread messages counter doesn't unbind it's events. [Deuteu]
- #279 Handle more field types for MUC config forms. [gbonvehi]
- #280 New config option, `hide_offline_users` [gbonvehi]

## 0.8.3 (2014-09-22)

- The Javascript build files in the 0.8.2 release weren't updated due to a
  unnoticed build error. [jcbrand]

## 0.8.2 (2014-09-22)

- Converse.js now has the ability to maintain sessions across page loads.
  Previously, the session tokens had to be handled externally and passed in.
  See the [keepalive](https://conversejs.org/docs/html/configuration.html#keepalive) configuration setting. [jcbrand]
- Allow changing of nickname in a chat room via /nick command. [jcbrand]
- Allow a chat room user to be muted or unmuted with the /mute and /voice commands. [jcbrand]
- Add a chat room toolbar button for toggling the list of occupants. [jcbrand]
- Converse.js now responds to XEP-0030: Service Discovery requests. [jcbrand]
- Bugfix. Roster groups all appear offline after page reload (with prebind).
  See http://librelist.com/browser//conversejs/2014/8/26/problem-with-contact-list-everyone-is-offline/ [heban and jcbrand]
- Bugfix concerning trimmed chats. Chats were being trimmed even though there was enough room. [jcbrand]
- #62 Sound notifications will now also play when you are mentioned in a chat room. [jcbrand]
- #212 Bugfix. Groups weren't being show again after the live filter was cleared. [jcbrand]
- #215 (and also #75) XEP-0249: Direct MUC Invitations. [jcbrand]
- #216 Contacts tab empty when using xhr_user_search. [hcderaad and jcbrand]
- #219 New contacts added need page refresh to be accepted and become visible. [hcderaad and jcbrand]
- #220 Non-AMD example page was not working. [xavier83ar and jcbrand]
- #222 Control box state not remembered. [priyadi and jcbrand]
- #223 Provide API to query buddy status. [priyadi and jcbrand]
- #227 Updated Hebrew translations [GreenLunar]

## 0.8.1 (2014-08-23)

- Bugfix: Roster contacts' cache key too vague. [jcbrand]
- Bugfix: Roster contacts weren't properly sorted according to chat status. [jcbrand]
- #63 Support for sound notification when message is received. [jcbrand]
- #212 Provide a live filter of the roster contacts. [jcbrand]

## 0.8.0 (2014-08-04)

**note**:
    1. Converse.js is now relicensed under the [Mozilla Public License](http://www.mozilla.org/MPL/2.0/).
    2. Configuration options for the chat toolbar have changed. Please refer to the [relevant documentation](http://devbox:8890/docs/html/configuration.html#visible-toolbar-buttons).
    3. This release has reduced support for IE8 (some features won't work).
    4. Events have been renamed to remove "on" prefix (sorry for any inconvenience).

- No initial HTML markup is now needed in the document body for converse.js to work. [jcbrand]
- All date handling is now done with moment.js. [jcbrand]
- Add a new toolbar button for clearing chat messages. [jcbrand]
- Chat boxes and rooms can now be resized vertically. [jcbrand]
- Upgraded dependencies to their latest versions. [jcbrand]
- Add new configuration setting [forwarded_messages](https://conversejs.org/docs/html/configuration.html#forwarded-messages).
  Message forwarding was before a default behavior but is now optional (and disabled by default). [jcbrand]
- Newly opened chat boxes always appear immediately left of the controlbox. [jcbrand]
- #71 Chat boxes and rooms can be minimized. [jcbrand]
- #83 Roster contacts can be shown according to their groups. [jcbrand]
    Note: Converse.js can show users under groups if you have assigned them
    already via another client or server configuration. There is not yet a way
    to assign contacts to groups from within converse.js itself.
- #123 Show converse.js in the resource assigned to a user. [jcbrand]
- #130 Fixed bootstrap conflicts. [jcbrand]
- #132 Support for [XEP-0280: Message Carbons](https://xmpp.org/extensions/xep-0280.html).
    Configured via [message_carbons](https://conversejs.org/docs/html/configuration.html#message-carbons) [hejazee]
- #176 Add support for caching in sessionStorage as opposed to localStorage. [jcbrand]
- #180 RID and SID undefined [g8g3]
- #191 No messages history [heban]
- #192 Error: xhr_user_search_url is not defined. [jcbrand]
- #195 Chinese translations. [lancelothuxi]
- #196 [Safari v7.0.5] TypeError: Attempted to assign to readonly property. [g8g3]
- #199 Improved Spanish translations [chilicuil]
- #201 Add zh-locale to fix build task [schoetty]

## 0.7.4 (2014-03-05)

**note:** 
*This release contains an important security fix. Thanks to Renaud Dubourguais from [Synacktiv](http://synacktiv.com) for reporting the vulnerability.*

- #125 Bugfix: crypto dependencies loaded in wrong order [jcbrand]
- Bugfix: action messages (i.e. /me) didn't work in OTR mode. [jcbrand]
- Security fix: Ensure that message URLs are properly encoded. [jcbrand]

## 0.7.3 (2014-02-23)

- #93 Add API methods exposing the RID and SID values. Can be disabled. [jcbrand]
- #102 Option to enable OTR by default. [Aupajo]
- #103 Option to display a call button in the chatbox toolbar, to allow third-party libraries to provide a calling feature. [Aupajo]
- #108 Japanese Translations [mako09]
- #111 OTR not working when using converse.js with prebinding. [jseidl, jcbrand]
- #114, #124 Hewbrew Translations [GreenLunar]
- #115 Indonesian Translations [priyadi]

## 0.7.2 (2013-12-18)

**note**
*This release contains an important security fix. Thanks to hejsan for reporting the vulnerability.*

- #48 Add event emitter support and emit events. [jcbrand]
- #97 Wrong number of online contacts shown with config option `show_only_online_users`. [jcbrand]
- #100 Make the fetching of vCards optional (enabled by default). [jcbrand]
- Sanitize message text to avoid Javascript injection attacks.  [jcbrand]

## 0.7.1 (2013-11-17)

- Don't load OTR crypto if the browser doesn't have a CSRNG [jcbrand]
- Don't break when crypto libraries aren't defined. [jcbrand]
- Check if canvas is supported before trying to render the user avatar [jcbrand]
- Use newest strophe.muc plugin. Fixes #85 [jcbrand]

**note:**
If you are using the development libraries, you'll need to run ``bower update``
to fetch the newest strophe.muc.plugin (for bugfix of #85).

This release contains 3 different builds:
- converse.min.js
- converse-no-otr.min.js (Without OTR encryption)
- converse-no-locales-no-otr.min.js (Without OTR encryption or any translations)

## 0.7.0 (2013-11-13)

### Important:

This release includes support for [Off-the-record encryption](https://otr.cypherpunks.ca).
For this to work, your browser needs a CSPRNG (Cryptographically secure pseudorandom number generator).

Internet Explorer of all versions doesn't have one at all, neither does older versions of Firefox.

If you need to support older browsers, please download the latest release from the 0.6 bran

#### Features:

- Add a toolbar to the chat boxes [jcbrand]
- Add support for OTR (off-the-record) encryption [jcbrand]
- Add support for smileys [jcbrand]
- Simplified boilerplate markup [jcbrand]
- New configuration settings, `xhr_custom_status_url` and `xhr_user_search_url` [jcbrand]

**note:**
*This release introduces a backward incompatible change. The boilerplate
HTML needed in your webpage for converse.js to work has been reduced to a
single div: `<div id="conversejs"></div>`*

#### Bugfixes:

- #58 Contact's name gets replaced with their JID [jcbrand]
- #81 Requesting contacts appear as pending contacts [jcbrand]

## 0.6.6 (2013-10-16)

- Bugfix: Presence stanza must be sent out after roster has been initialized [jcbrand]
- Bugfix: Don't reconnect while still disconnecting, causes endless authentication loops. [jcbrand]
- Dutch translation [maartenkling]

## 0.6.5 (2013-10-08)

- Fetch vCards asynchronously once a roster contact is added [jcbrand]
- Hungarian translation [w3host]
- Russian translation [bkocherov]
- Update CSS to avoid clash with bootstrap [seocam]
- New config option `allow_muc` toggles multi-user chat (MUC) [jcbrand]
- New config option `allow_contact_requests` toggles user adding [jcbrand]
- New config option `show_only_online_users` [jcbrand]

## 0.6.4 (2013-09-15)

- Add icon for the unavailable chat state. [jcbrand]
- Chat state descriptions weren't translation aware. [jcbrand]
- Clear messages from localStorage when user types "/clear". [jcbrand]
- The 'xa' chat state wasn't being handled properly. [jcbrand]
- Updated pt-BR translations [seocam]
- Updated af and de translations [jcbrand]

## 0.6.3 (2013-09-12)

*NB: This release contains an important security fix. Please don't use older
versions of the 0.6 branch.*

- French translations. [tdesvenain]
- Bugfix: Messages were stored against buddy JID and not own JID. [jcbrand]

## 0.6.2 (2013-08-29)

- Bugfix. The remove icon wasn't appearing in the contacts roster. [jcbrand]
- Bugfix. With auto_subscribe=True, the "Pending Contacts" header didn't disappear
  after a new user was accepted. [jcbrand]

## 0.6.1 (2013-08-28)

- IE9 and IE8 CSS fixes. [jcbrand]
- Bugfix: Pencil icon not visible (for setting status update). [jcbrand]
- Bugfix: RID, JID and SID initialization values were being ignored. [jcbrand]
- Bugfix: Fall back to English if a non-existing locale was specified. [jcbrand]

## 0.6.0 (2013-08-26)

- #39 Documentation for minifying JS is wrong. [jcbrand]
- #41 prebind and show_controlbox_by_default true fails. [jcbrand]
- With prebinding, attaching to the connection now happens inside Converse and
  not as a separate step after initialization. [jcbrand]
- Register presence and message handlers before fetching the roster. Otherwise
  some presence notifications might be missed. [jcbrand]
- Add a debug option (logs to the browser console). [jcbrand]
- Use font icons from http://icomoon.io [jcbrand]
- Added a static mockup to aid CSS/design process. [jcbrand]
- Save language codes with hyphens. Thanks to @seocam. [jcbrand]
- The combined and minified JS file now uses almond and not require.js. [jcbrand]

## 0.5.2 (2013-08-05)

- Important security update. Don't expose the Strophe connection object globally. [jcbrand]

## 0.5.1 (2013-08-04)

- #13, #14: Messages sent between to GTalk accounts weren't being received. [jcbrand]
- #32: Default status was offline when user didn't have contacts. [jcbrand]
- Attach panels to the DOM upon initialize. [jcbrand]

## 0.5.0 (2013-07-30)

- #09 Remove dependency on AMD/require.js [jcbrand]
- #22 Fixed compare operator in strophe.muc [sonata82]
- #23 Add Italian translations [ctrlaltca]
- #24 Add Spanish translations [macagua]
- #25 Using span with css instead of img [matheus-morfi]
- #26 Only the first minute digit shown in chatbox. [jcbrand]
- #28 Add Brazilian Portuguese translations [matheus-morfi]
- Use Bower to manage 3rd party dependencies. [jcbrand]

## 0.4.0 (2013-06-03)

- CSS tweaks: fixed overflowing text in status message and chatrooms list. [jcbrand]
- Bugfix: Couldn't join chatroom when clicking from a list of rooms. [jcbrand]
- Add better support for kicking or banning users from chatrooms. [jcbrand]
- Fixed alignment of chat messages in Firefox. [jcbrand]
- More intelligent fetching of vCards. [jcbrand]
- Fixed a race condition bug. Make sure that the roster is populated before sending initial presence. [jcbrand]
- Reconnect automatically when the connection drops. [jcbrand]
- Add support for internationalization. [jcbrand]

## 0.3.0 (2013-05-21)

- Add vCard support [jcbrand]
- Remember custom status messages upon reload. [jcbrand]
- Remove jquery-ui dependency. [jcbrand]
- Use backbone.localStorage to store the contacts roster, open chatboxes and chat messages. [jcbrand]
- Fixed user status handling, which wasn't 100% according to the spec. [jcbrand]
- Separate messages according to day in chats. [jcbrand]
- Add support for specifying the BOSH bind URL as configuration setting. [jcbrand]
- #8 Improve the message counter to only increment when the window is not focused [witekdev]
- Make fetching of list of chatrooms on a server a configuration option. [jcbrand]
- Use service discovery to show all available features on a room. [jcbrand]
- Multi-user chatrooms are now configurable. [jcbrand]

## 0.2.0 (2013-03-28)

- Performance enhancements and general script cleanup [ichim-david]
- Add "Connecting to chat..." info [alecghica]
- Various smaller improvements and bugfixes [jcbrand]

## 0.1.0 (2012-06-12)

- Created [jcbrand]
