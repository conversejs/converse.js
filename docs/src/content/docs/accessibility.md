---
title: Accessibility
description: Keyboard shortcuts and screen reader support in Converse.
---

Converse aims to be usable by everyone, including people who rely on a screen
reader or who navigate with the keyboard only.

## Keyboard shortcuts

The following shortcuts work anywhere on the page:

| Shortcut      | Description                                  |
| ------------- | -------------------------------------------- |
| `Alt+Shift+H` | Show the keyboard shortcuts                  |
| `Alt+Shift+C` | Focus the message composer of the open chat  |
| `Alt+Shift+N` | Open the next chat with unread messages      |

On macOS, `Alt` is the `Option` key.

Dialogs close with `Escape`.

## Screen readers

The message history of the open chat is a live region, so screen readers
read out new messages as they arrive.

Messages in chats that are not open are announced as well, for example
"Romeo: Are you there?" or "Romeo in Balcony: Are you there?". Converse
announces the same messages it would show a desktop notification for: direct
messages, and groupchat messages that mention you (see
[notify_all_room_messages](/docs/configuration/#notify_all_room_messages)).

## Configuration

Pass these settings to `converse.initialize()` like any other
[configuration setting](/docs/configuration/).

### enable_keyboard_shortcuts

- **Type**: Boolean
- **Default**: `true`

Enables the keyboard shortcuts listed above.

### enable_screen_reader_announcements

- **Type**: Boolean
- **Default**: `true`

Enables the announcements for messages in chats that are not open. The live
region of the open chat is not affected.

## Reporting problems

Please report accessibility problems on the
[GitHub issue tracker](https://github.com/conversejs/converse.js/issues),
mentioning your browser and the assistive technology you use.
