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

## Reporting problems

Please report accessibility problems on the
[GitHub issue tracker](https://github.com/conversejs/converse.js/issues),
mentioning your browser and the assistive technology you use.
