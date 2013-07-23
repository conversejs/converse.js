Changelog
=========

0.4 (Unreleased)
----------------

- Add Spanish translations. [macagua]
- CSS tweaks: fixed overflowing text in status message and chatrooms list. [jcbrand]
- Bugfix: Couldn't join chatroom when clicking from a list of rooms. [jcbrand]
- Add better support for kicking or banning users from chatrooms. [jcbrand]
- Fixed alignment of chat messages in Firefox. [jcbrand]
- More intelligent fetching of vCards. [jcbrand]
- Fixed a race condition bug. Make sure that the roster is populated before sending initial presence. [jcbrand]
- Reconnect automatically when the connection drops. [jcbrand]
- Add support for internationalization. [jcbrand]

0.3 (2013-05-21)
----------------

- Add vCard support [jcbrand]
- Remember custom status messages upon reload. [jcbrand]
- Remove jquery-ui dependency. [jcbrand]
- Use backbone.localStorage to store the contacts roster, open chatboxes and chat messages. [jcbrand]
- Fixed user status handling, which wasn't 100% according to the spec. [jcbrand]
- Separate messages according to day in chats. [jcbrand]
- Add support for specifying the BOSH bind URL as configuration setting. [jcbrand]
- Improve the message counter to only increment when the window is not focused [witekdev]
- Make fetching of list of chatrooms on a server a configuration option. [jcbrand]
- Use service discovery to show all available features on a room. [jcbrand]
- Multi-user chatrooms are now configurable. [jcbrand]


0.2 (2013-03-28)
----------------

- Performance enhancements and general script cleanup [ichim-david]
- Add "Connecting to chat..." info [alecghica]
- Various smaller improvements and bugfixes [jcbrand]


0.1 (2012-06-12)
----------------

- Created [jcbrand]
