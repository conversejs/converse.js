---
title: Accessibility
description: Keyboard navigation, screen reader support and accessibility settings in Converse.
---

Converse aims to be usable by everyone, including people who rely on assistive
technologies such as screen readers or who navigate with the keyboard only.

## Accessibility features

### Keyboard navigation

Every feature of Converse can be used without a mouse.

#### Global keyboard shortcuts

The following shortcuts are available throughout the application:

| Shortcut      | Description                                |
| ------------- | ------------------------------------------ |
| `Alt+Shift+H` | Show or hide the keyboard shortcuts help   |
| `Alt+Shift+C` | Focus the message composition area         |
| `Alt+Shift+L` | Focus the chats list                       |
| `Alt+Shift+M` | Go to the last message in the current chat |
| `Alt+Shift+N` | Go to the next chat with unread messages   |
| `Alt+Shift+P` | Go to the previous chat in the list        |
| `Alt+Shift+S` | Focus the contacts search field            |
| `Escape`      | Close the open modal or dialog             |

#### Message composer shortcuts

When the message composition area has focus:

| Shortcut      | Description                           |
| ------------- | ------------------------------------- |
| `Ctrl+Enter`  | Send the current message              |
| `Alt+Shift+E` | Open the emoji picker                 |
| `Alt+Shift+F` | Open the file picker to attach a file |

#### Message navigation shortcuts

To move between messages:

| Shortcut      | Description                  |
| ------------- | ---------------------------- |
| `Alt+↑`       | Go to the previous message   |
| `Alt+↓`       | Go to the next message       |
| `Alt+Shift+R` | Reply to the focused message |

### Screen readers

Converse supports screen readers through:

- **ARIA labels**: every interactive element has a descriptive label.
- **Semantic ARIA roles**: components use the appropriate roles (`region`, `log`, `toolbar` and so on).
- **Live announcements**: important events are announced automatically.
- **Logical navigation**: the tab order follows a predictable flow.

#### Automatic announcements

The screen reader automatically announces:

- New incoming messages, with the sender's name
- Contact status changes
- Users joining and leaving group chats
- Errors and important notifications
- Dialogs opening and closing

## Configuration

The following settings control the accessibility features. Pass them to
`converse.initialize()` like any other [configuration setting](/docs/configuration/).

### enable_accessibility

- **Type**: Boolean
- **Default**: `true`

Enables or disables all of the enhanced accessibility features.

```javascript
converse.initialize({
    enable_accessibility: true,
});
```

### enable_keyboard_shortcuts

- **Type**: Boolean
- **Default**: `true`

Enables or disables the keyboard shortcuts.

```javascript
converse.initialize({
    enable_keyboard_shortcuts: true,
});
```

### enable_screen_reader_announcements

- **Type**: Boolean
- **Default**: `true`

Enables or disables announcements for screen readers.

```javascript
converse.initialize({
    enable_screen_reader_announcements: true,
});
```

### announce_new_messages

- **Type**: Boolean
- **Default**: `true`

Automatically announces new incoming messages.

```javascript
converse.initialize({
    announce_new_messages: true,
});
```

### announce_status_changes

- **Type**: Boolean
- **Default**: `true`

Announces changes to your contacts' status.

```javascript
converse.initialize({
    announce_status_changes: true,
});
```

### high_contrast_mode

- **Type**: Boolean or `'auto'`
- **Default**: `'auto'`

Turns on high contrast mode. With `'auto'`, Converse follows the operating
system's preference.

```javascript
converse.initialize({
    high_contrast_mode: 'auto', // or true/false
});
```

## Accessibility API

Converse exposes an API under `api.accessibility` so that plugins can make use
of the same accessibility features.

### Announcing messages

To announce a message to screen readers:

```javascript
api.accessibility.announce(
    'Message to announce',
    'polite', // or 'assertive' for higher priority
);
```

### Managing focus

To move focus to a specific element:

```javascript
const element = document.querySelector('.chat-textarea');
api.accessibility.moveFocus(element, {
    preventScroll: false,
    announce: 'Text area focused',
});
```

### Getting focusable elements

```javascript
const container = document.querySelector('.chat-content');
const focusable_elements = api.accessibility.getFocusableElements(container);
```

### Trapping focus

Useful for modals and dialogs:

```javascript
const modal = document.querySelector('.modal');
const releaseTrap = api.accessibility.trapFocus(modal);

// When the modal closes
releaseTrap();
```

### Registering custom shortcuts

```javascript
api.accessibility.registerShortcuts({
    'Ctrl+Alt+X': (event) => {
        // Handle the shortcut
    },
});
```

## Best practices

### For developers

If you develop plugins or customizations for Converse, follow these practices:

1. **Always include ARIA labels**

    ```html
    <button aria-label="Close chat">×</button>
    ```

2. **Use the appropriate semantic roles**

    ```html
    <div role="log" aria-live="polite">
        <!-- Chat messages -->
    </div>
    ```

3. **Keep the tab order logical**

    Use `tabindex` appropriately:

    - `tabindex="0"` for elements that belong in the natural tab order
    - `tabindex="-1"` for elements that should only be focusable programmatically
    - Avoid positive `tabindex` values

4. **Provide text alternatives**

    ```html
    <img src="emoji.png" alt="smiling emoji" /> <converse-icon aria-label="User online"></converse-icon>
    ```

5. **Announce dynamic changes**

    ```javascript
    api.accessibility.announce('A new contact was added');
    ```

6. **Test with screen readers**

    - NVDA (Windows), free
    - JAWS (Windows), commercial
    - VoiceOver (macOS and iOS), built in
    - TalkBack (Android), built in
    - Orca (Linux), free

### For users

Tips for a better experience:

1. **Learn the keyboard shortcuts**: press `Alt+Shift+H` to see all available shortcuts.
2. **Configure your screen reader**: make sure it is set to announce ARIA live regions.
3. **Use the right browsing mode**: in browsers, use forms or focus mode when interacting with the chat fields.
4. **Adjust the settings**: turn off any announcements you find distracting with the configuration settings above.

## Further resources

- [Web Content Accessibility Guidelines (WCAG)](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM: web accessibility resources](https://webaim.org/)

## Reporting problems

If you find an accessibility problem or have a suggestion for improvement:

1. Report it on the [GitHub issue tracker](https://github.com/conversejs/converse.js/issues).
2. Label the issue `accessibility`.
3. Include:
    - A detailed description of the problem
    - Your browser and its version
    - The assistive technology you use, if any
    - Steps to reproduce

We keep working to improve the accessibility of Converse and welcome your feedback.
