---
title: Accessibility
description: Keyboard shortcuts and screen reader support in Converse.
---

Converse aims to be usable by everyone, including people who rely on a screen
reader or who navigate with the keyboard only.

## Keyboard shortcuts

`Ctrl+/` shows the keyboard shortcuts that are available:

| Shortcut      | Description                                  |
| ------------- | -------------------------------------------- |
| `Ctrl+/`      | Show the keyboard shortcuts                  |
| `Alt+Shift+↓` | Open the next chat with unread messages      |
| `Alt+Shift+↑` | Open the previous chat with unread messages  |
| `Home`        | Jump to the newest post (Social app)         |
| `End`         | Jump to the oldest post (Social app)         |

These follow the conventions of other chat clients. On macOS, use `Cmd+/`
instead of `Ctrl+/`, and `Alt` is the `Option` key. `Home` and `End` don't
apply while you're typing in a text field.

Dialogs close with `Escape`.

## Screen readers

The message history of the open chat is a live region, so screen readers
read out new messages as they arrive.

For messages in other chats, Converse shows a desktop notification (see
[show_desktop_notifications](/docs/configuration/#show_desktop_notifications)),
which screen readers read out as well.

## Configuration

Pass these settings to `converse.initialize()` like any other
[configuration setting](/docs/configuration/).

### enable_keyboard_shortcuts

- **Type**: Boolean
- **Default**: `true`

Enables the keyboard shortcuts listed above.

Plugins can add their own shortcuts with `api.shortcuts.add()`, which also
lists them in the keyboard shortcuts help.

## Reporting problems

Please report accessibility problems on the
[GitHub issue tracker](https://github.com/conversejs/converse.js/issues),
mentioning your browser and the assistive technology you use.
