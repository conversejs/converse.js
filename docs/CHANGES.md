# Changelog

## 3.1.0 (Unreleased)

- New non-core plugin `converse-singleton` which ensures that no more than
  one chat is visible at any given time. Used in the mobile build:
  `converse-mobile.js` and makes the unread messages counter possible there.
  [jcbrand]
- Show unread messages next to roster contacts. [jcbrand]
- API change: the `message` event now returns a data object with `stanza` and
  `chatbox` attributes, instead of just the stanza. [jcbrand]
- #567 Unreaded message count reset on page load [novokrest]

## 3.0.2 (2017-04-23)

*Dependency updates*:
- Jasmine 2.5.3
- Phantomjs 2.1.14
- moment 2.18.1
- sinon 2.1.0
- eslint 3.19.0

- Don't rerender the text input when filtering contacts. [jcbrand]
- Show the MUC server in a bookmarked room's info view (in the bookmarks list). [jcbrand]
- Enable creation of `dist/converse-muc-embedded.js` build file for the
  embedded MUC room demo. [jcbrand]
- Use `noConflict` to avoid polluting globale namespace with lodash and Backbone. [jcbrand]
- Bugfix: MUC user's nickname wasn't being shown in HTML5 notification messages. [jcbrand]
- Bugfix: OTR meta-messages were being shown in HTML5 notifications. [jcbrand]
- CSS fix: Icon lock wasn't showing. [jcbrand]
- #626 Open chat minimised [novokrest]
- #842 Persistent muc room creation not working [jcbrand]
- #848 OTR doesn't start when `cache_otr_key` is set to `true`. [jcbrand]
- #849 `TypeError: _converse.i18n.locale_data is undefined` when reconnecting. [jcbrand]
- #850 Roster not loading when group names are numbers. [jcbrand]

## 3.0.1 (2017-04-04)

- Bugfix. Endless spinner when trying to log in after rendering the registration form. [jcbrand]
- #585 Duplicate contact created due to JID case sensivity [saganshul]
- #628 Fixes the bug in displaying chat status during private chat. [saganshul]
- #628 Changes the message displayed while typing from a different resource of the same user. [smitbose]
- #675 Time format made configurable.
   See [time_format](https://conversejs.org/docs/html/configurations.html#time-format)
   [smitbose]
- #682 Add "Send" button to input box in chat dialog window.
   See [show_send_button](https://conversejs.org/docs/html/configurations.html#show-send-button)
   [saganshul]
- #704 Automatic fetching of registration form when
   [registration_domain](https://conversejs.org/docs/html/configurations.html#registration-domain)
   is set. [smitbose]
- #806 The `_converse.listen` API event listeners aren't triggered. [jcbrand]
- #807 Error: Plugin "converse-dragresize" tried to override HeadlinesBoxView but it's not found. [jcbrand]
- #811 jQuery wasn't being closured in builds. [jcbrand]
- #814 Images from URLs with query strings aren't being rendered. [novokrest]
- #820 Inconsistency in displaying room features. [jcbrand]

## 3.0.0 (2017-03-05)

- **Breaking changes**:
    * Plugins must now be whitelisted.
      See the [whitelisted_plugins](https://conversejs.org/docs/html/configuration.html#whitelisted-plugins) setting.
    * Callbacks for `converse.on` now no longer receive an event object as first parameter.
    * The API has been split into public and private parts.
      The private API methods are now only available to plugins.
      For more info, read [developer API](https://conversejs.org/docs/html/developer_api.html)
      and the [plugin_development](https://conversejs.org/docs/html/plugin_development.html)
      documentation.
    * To prevent confusion the private, closured object, only
      available to plugins, has been renamed from `converse` to `_converse`.
      The public API is accessible via a global `converse` object.
    * The `keepalive` and `roster_groups` options are now set to `true` by default.
    * Templates are no longer stored as attributes on the `_converse` object.
      If you need a particular template, use `require` to load it.

- Bugfix. After bookmarking a room for which a nickname is required, return to
  the nickname form. [jcbrand]
- Show the chat states of room occupants. [jcbrand]
- The no-jQuery build has been renamed from `converse.nojquery.js` to
  `converse-no-jquery.js` to fit the convention used for other build names.
  [jcbrand]
- 50 is the new default [archived_messages_page_size](https://conversejs.org/docs/html/configuration.html#archived-messages-page-size)
  [jcbrand]
- Better support for delayed delivery of presence stanzas (XEP-0203). [jcbrand]
- The chat room `description` is now shown in the heading, not the `subject`.
  [jcbrand]
- Chat room features are shown in the sidebar. [jcbrand]
- Hide the chat room invite widget if the room is not open or if the room is members-only
  and the user is not the owner. [jcbrand]
- Created a new non-core plugin `converse-muc-embedded` which embeds a single
  chat room into a page. An example can be found at https://conversejs.org/demo/embedded.html
  [jcbrand]
- Use lodash instead of underscore.js [jcbrand]
- Case insensitive matching of moderation commands. [jcbrand]
- Add `/subject` as alias to `/topic` [jcbrand]
- `message_carbons`, `play_sounds` and `allow_chat_pending_contacts` now default to `true` [jcbrand]
- Improved roster filter UX. [jcbrand]
- Render the login form again upon authfail. [jcbrand]
- New promises API: [waitUntil](https://conversejs.org/docs/html/developer_api.html#waituntil)
  [jcbrand]
- New configuration setting:
  [show_chatstate_notifications](https://conversejs.org/docs/html/configuration.html#show-chatstate-notifications)
  [jcbrand]
- New configuration setting:
  [whitelisted_plugins](https://conversejs.org/docs/html/configuration.html#whitelisted-plugins)
  [jcbrand]
- New configuration setting:
  [blacklisted_plugins](https://conversejs.org/docs/html/configuration.html#blacklisted-plugins)
  [jcbrand]
- The API now no longer returns wrapped chatboxes (or rooms) but instead a
  Backbone.View object. This means the API of the returned object has changed.
  You're still able to do everything from before but now also much more.
  [jcbrand]
- Allow JIDs not on the roster to be invited to a chat room. [jcbrand]
- Bugfix. `TypeError: this.sendConfiguration(...).then is not a function` when
  an instant room is created. [jcbrand]
- Ensure consistent behavior from `show_controlbox_by_default` [jcbrand]
- #365 Show join/leave messages for chat rooms.
  New configuration setting:
  [muc_show_join_leave](https://conversejs.org/docs/html/configuration.html#muc-show-join-leave)
- #366 Show the chat room occupant's JID in the tooltip (if you're allowed to see it). [jcbrand]
- #610, #785 Add presence priority handling [w3host, jcbrand]
- #620 `auto_away` shouldn't change the user's status if it's set to `dnd`. [jcbrand]
- #694 The `notification_option` wasn't being used consistently. [jcbrand]
- #745 New config option [priority](https://conversejs.org/docs/html/configuration.html#priority) [jcbrand]
- #770 Allow setting contact attrs on chats.open [Ape]
- #790 MAM retrieval broken [jcbrand]

## 2.0.6 (2017-02-13)
- Escape user-generated input to prevent JS-injection attacks. (Thanks to SamWhited) [jcbrand]
- #486 Honor existing mam user configuration [throwaway42]
- #749 /me will show your contact's name in the sent field [jcbrand]
- #774 Browser language (fr-fr or fr) is not detected by default [jcbrand]
- #775 Anonymous login form is a text field instead of a push button [jcbrand]

## 2.0.5 (2017-02-01)
- #743, #751, #753 Update to Strophe 1.2.12. SASL-EXTERNAL now has reduced priority, so it won't
  be prioritized above other auth mechanisms. [jcbrand]
- #755: create composer.json to add this project in packagist.org [fabiomontefuscolo]
- #758: Bugfix. Render all resize drag handles for ChatRoomView. [LeoYReyes]
- #762 Allow chatting with users not in your roster. [Ape, jcbrand]
- Bugfix. Cancel button shown while registration form is being fetched wasn't working
  properly. [jcbrand]
- Bugfix. Login form wasn't rendered after logging out (when `auto_reconnect` is `true`). [jcbrand]
- Bugfix. Properly disconnect upon "host-unknown" error. [jcbrand]
- Bugfix. Minimized chats weren't removed when logging out. [jcbrand]
- Security fix: Prevent message forging via carbons. (Thanks to ge0rg) [jcbrand]

## 2.0.4 (2016-12-13)
- #737: Bugfix. Translations weren't being applied. [jcbrand]
- Fetch room info and store it on the room model.
  For context, see: http://xmpp.org/extensions/xep-0045.html#disco-roominfo [jcbrand]
- Bugfix. Switching from bookmarks form to config form shows only the spinner. [jcbrand]
- Bugfix. Other room occupants sometimes not shown when reloading the page. [jcbrand]
- Bugfix. Due to changes in `converse-core` the controlbox wasn't aware anymore of
  disconnection or reconnection events. [jcbrand]
- Optimize fetching of MAM messages (in some cases happened on each page load). [jcbrand]
- Fix empty controlbox toggle after disconnect. [jcbrand]
- When inviting someone to a members-only room, first add them to the member
  list. [jcbrand]
- New configuration setting [muc_disable_moderator_commands](https://conversejs.org/docs/html/configuration.html#muc-disable-moderator-commands) [jcbrand]

## 2.0.3 (2016-11-30)
- #735 Room configuration button not visible. [jcbrand]
- CSS fix for fadeIn animation. [jcbrand]

## 2.0.2 (2016-11-30)
- #721 keepalive not working with anonymous authentication [jcbrand]
- #723 Bugfix: Arrays in configuration settings were ignored. [jcbrand]
- #734 Bugfix. `converse.rooms.open` ignored the `muc_nickname_from_jid` setting. [jcbrand]
- Enable new rooms to be configured automatically, with a default config, via `rooms.open`.
  For details, refer to the [relevant documentation](https://conversejs.org/docs/html/developer_api.html#the-rooms-grouping) [jcbrand]
- Bugfix: Chatboxes aren't closed when logging out. [jcbrand]
- Bugfix: Trying to save data on the `ControlBox` model before `ChatBoxes`
  collection has its `browserStorage` configured.
  Causes `Error: A "url" property or function must be specified`. [jcbrand]
- Don't open the controlbox on contact requests. [jcbrand]
- Bugfix: Reconnection fails when original connection was never established. [jcbrand]
- If a `credentials_url` is provided, then keep on attempting to reconnect when connection is down.  [jcbrand]
- Remove (undocumented) `callback` config parameter for `converse.initialize`.
  Instead, `converse.initialize` returns a promise which will resolve once
  initialization is complete. [jcbrand]
- New event ['reconnecting'](https://conversejs.org/docs/html/development.html#reconnecting) [jcbrand]
- New configuration setting [allow_bookmarks](https://conversejs.org/docs/html/configuration.html#allow-bookmarks) [jcbrand]
- The `rooms.open` API method will no longer maximize rooms that are minimized (unless `maximize: true` is passed in). [jcbrand]

## 2.0.1 (2016-11-07)
- #203 New configuration setting [muc_domain](https://conversejs.org/docs/html/configuration.html#muc-domain) [jcbrand]
- #705 White content after submitting password on chat rooms [jcbrand]
- #712 Controlbox clicks stop responding after auto-reconnect [jcbrand]
- Removed shared state between tests. All tests are now isolated. [jcbrand]
- Allow the context (i.e. `this` value) to be passed in when registering event
  listeners with `converse.listen.on` and `converse.listen.once`. [jcbrand]
- New event ['rosterContactsFetched'](https://conversejs.org/docs/html/development.html#rosterContactsFetched) [jcbrand]
- New event ['rosterGroupsFetched'](https://conversejs.org/docs/html/development.html#rosterGroupsFetched) [jcbrand]
- HTML templates are now loaded in the respective modules/plugins. [jcbrand]
- Start improving Content-Security-Policy compatibility by removing inline CSS. [mathiasertl]
- Add support for XEP-0048, chat room bookmarks [jcbrand]
- New configuration setting [connection_options](https://conversejs.org/docs/html/configuration.html#connection-options) [jcbrand]

## 2.0.0 (2016-09-16)
- #656 Online users count not shown initially [amanzur]
- #674 Polish translation updated [ser]
- Backwards incompatible change: the `_super` attribute in plugins is now named `__super__`. [jcbrand]
- Continuously attempt to resurrect dead connections when `auto_reconnect` is `true`. [jcbrand]
- Update the 'rooms' API to allow user to pass in room attributes. [jcbrand]
- New configuration setting [message_storage](https://conversejs.org/docs/html/configuration.html#message-storage) [jcbrand]
- Hardcode the storage for roster contacts and chat room occupants to `sessionStorage`. [jcbrand]
- Fixed wrong chat state value, should be `chat`, not `chatty`.
  See [RFC 3921](https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.1.2.2). [jcbrand]
- Adds support for SASL-EXTERNAL. [jcbrand]

## 1.0.6 (2016-08-12)
- #632 Offline and Logout states do not properly update once users start
  chatting. [chrisuehlinger, jcband]
- #674 Polish translation updated to the current master. [ser]
- #677 Chatbox does not open after close. [jcbrand]
- The behavior of `converse.chats.get` has changed. If the chat box is not
  already open, then `undefined` will be returned. [jcbrand]
- Typing (i.e. chat state) notifications are now also sent out from MUC rooms. [jcbrand]
- `ChatRoomView.onChatRoomMessageSubmitted` has been renamed to
  `onMessageSubmitted`, to make it the same as the method on `ChatBoxView`. [jcbrand]
- New configuration setting [muc_nickname_from_jid](https://conversejs.org/docs/html/configuration.html#muc-nickname-from-jid) [jcbrand]
- New configuration setting [muc_instant_rooms](https://conversejs.org/docs/html/configuration.html#muc-instant-rooms) [jcbrand]

## 1.0.5 (2016-07-28)
- In case of nickname conflict when joining a room, allow the user to choose a new one.
  [jcbrand]
- Check whether the user has a reserved nickname before entering a room, and if so,
  use it. [jcbrand]
- Mention someone in your chat room message by clicking on their name in the occupants
  list. [jcbrand]
- #645 When accepting a contact request, the contact didn't appear in the
  pending contacts group. [jcbrand]
- Bugfix: allow multiple MAM queries to be made simultaneously. [jcbrand]

## 1.0.4 (2016-07-26)

- Restrict occupants sidebar to 30% chat room width. [jcbrand]
- Made requesting contacts more visible, by placing them at the top of the roster. [jcbrand]
- `insertIntoPage` method of `ChatBoxView` has been renamed to `insertIntoDOM`,
  to make it the same as the method of `ChatRoomView`. [jcbrand]
- Render error messages received from the server (for undelivered chat messages). [jcbrand]
- Don't hide requesting contacts when filtering by chat state. [jcbrand]
- When logging in anonymously, the server JID can now be passed in via `converse.initialize`
  or via `converse.user.login`. [jcbrand]

## 1.0.3 (2016-06-20)

- Update the plugin architecture to allow plugins to have optional dependencies [jcbrand]
- Bugfix. Login form doesn't render after logging out, when `auto_reconnect = false` [jcbrand]
- Also indicate new day for the first day's messages. [jcbrand]
- Chat bot messages don't appear when they have the same ids as their commands. [jcbrand]
- Updated onDisconnected method to fire disconnected event even if `auto_reconnect = false`. [kamranzafar]
- Bugfix: MAM messages weren't being fetched oldest first. [jcbrand]
- Add processing hints to chat state notifications [jcbrand]
- Don't use sound and desktop notifications for OTR messages (when setting up the session) [jcbrand]
- New config option [default_state](https://conversejs.org/docs/html/configuration.html#default_state) [jcbrand]
- New API method `converse.rooms.close()` [jcbrand]
- New configuration setting [allow_muc_invites](https://conversejs.org/docs/html/configuration.html#allow-muc-invites) [jcbrand]
- Add new event [pluginsInitialized](https://conversejs.org/docs/html/development.html#pluginsInitialized) [jcbrand]
- #553 Add processing hints to OTR messages [jcbrand]
- #650 Don't ignore incoming messages with same JID as current user (might be MAM archived) [jcbrand]
- #656 online users count in minimized chat window on initialization corrected [amanzur]

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
- New config option [chatstate_notification_blacklist](https://conversejs.org/docs/html/configuration.html#chatstate-notification-blacklist) [jcbrand]
- New config option [sticky_controlbox](https://conversejs.org/docs/html/configuration.html#sticky-controlbox) [jcbrand]
- New config option [credentials_url](https://conversejs.org/docs/html/configuration.html#credentials-url) [jcbrand]
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
- #577 New config variable [message_archiving_timeout](https://conversejs.org/docs/html/configuration.html#message-archiving-timeout) [jcbrand]
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
  parameter for automatically joining chat rooms. [ben]
- #520 Set specific domain. Two new options [default_domain](https://conversejs.org/docs/html/configuration.html#default_domain)
  and [locked_domain](https://conversejs.org/docs/html/configuration.html#locked_domain). [jcbrand]
- #521 Not sending presence when connecting after disconnection. [jcbrand]
- #535 Messages not received when room with mixed-case JID is used. [jcbrand]
- #536 Presence not sent out (in cases where it should) after page refresh. [jcbrand]
- #540 `bind is not a function` error for plugins without `initialize` method. [jcbrand]
- #547 By default the `offline` state is no longer choosable.
  See [include_offline_state](https://conversejs.org/docs/html/configuration.html#include-offline-state) for details. [jcbrand]
- A chat room invite might come from someone not in your roster list. [ben]
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
- Add a new configuration setting [muc_history_max_stanzas](https://conversejs.org/docs/html/configuration.html#muc-history-max-stanzas>). [jcbrand]

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

- CSS tweaks: fixed overflowing text in status message and chat rooms list. [jcbrand]
- Bugfix: Couldn't join chat room when clicking from a list of rooms. [jcbrand]
- Add better support for kicking or banning users from chat rooms. [jcbrand]
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
- Make fetching of list of chat rooms on a server a configuration option. [jcbrand]
- Use service discovery to show all available features on a room. [jcbrand]
- Multi-user chat rooms are now configurable. [jcbrand]

## 0.2.0 (2013-03-28)

- Performance enhancements and general script cleanup [ichim-david]
- Add "Connecting to chat..." info [alecghica]
- Various smaller improvements and bugfixes [jcbrand]

## 0.1.0 (2012-06-12)

- Created [jcbrand]
