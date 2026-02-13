# Accessibility Plugin for Converse.js

## Description

This plugin significantly improves the accessibility of Converse.js for users with visual and motor disabilities, including:

- **Full support for screen readers** (NVDA, JAWS, VoiceOver, TalkBack, Orca)
- **Complete keyboard navigation** with customizable shortcuts
- **High contrast mode** automatic or manual
- **Live ARIA announcements** for important events
- **Enhanced focus management** for modals and dialogs

## Main Features

### 🎹 Keyboard Shortcuts

The plugin provides intuitive keyboard shortcuts for all main functions:

#### Global
- `Alt+Shift+H` - Show shortcut help
- `Alt+Shift+C` - Focus message composer
- `Alt+Shift+L` - Focus chat list
- `Alt+Shift+M` - Go to last message
- `Alt+Shift+N` - Next unread chat
- `Alt+Shift+S` - Search contacts
- `Escape` - Close current modal

#### In composer
- `Ctrl+Enter` - Send message
- `Alt+Shift+E` - Emoji selector
- `Alt+Shift+F` - Attach file

#### In messages
- `Alt+↑/↓` - Navigate between messages
- `Alt+Shift+R` - Reply to message

### 📢 Screen Reader Announcements

The plugin automatically announces:

- New incoming messages with sender name
- Contact status changes (online, away, etc.)
- Users joining/leaving rooms
- Errors and important notifications
- Opening/closing of dialogs

### ♿ ARIA Improvements

All components include:

- Appropriate semantic ARIA roles
- Descriptive labels (aria-label)
- Live regions for dynamic content
- Correct ARIA states and properties
- Logical tab order

### 🎨 High Contrast Mode

- Automatic detection of system preferences
- Manual activation available
- Improved contrast on all elements
- More visible borders and outlines
- Enhanced focus states

## Installation

The plugin is included by default in Converse.js. To enable it:

```javascript
converse.initialize({
    enable_accessibility: true,
    enable_keyboard_shortcuts: true,
    enable_screen_reader_announcements: true,
    announce_new_messages: true,
    announce_status_changes: true,
    high_contrast_mode: 'auto'
});
```

## Configuration

### Available Options

#### `enable_accessibility`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enables all accessibility features

#### `enable_keyboard_shortcuts`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enables keyboard shortcuts

#### `enable_screen_reader_announcements`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enables screen reader announcements

#### `announce_new_messages`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Announces new messages automatically

#### `announce_status_changes`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Announces contact status changes

#### `high_contrast_mode`
- **Type:** `boolean | 'auto'`
- **Default:** `'auto'`
- **Description:** Activates high contrast mode

## Developer API

### Announce messages

```javascript
converse.api.accessibility.announce(
    'Important message',
    'assertive' // or 'polite'
);
```

### Focus Management

```javascript
const element = document.querySelector('.chat-textarea');
converse.api.accessibility.moveFocus(element, {
    preventScroll: false,
    announce: 'Text field focused'
});
```

### Focus trap (for modals)

```javascript
const modal = document.querySelector('.modal');
const release = converse.api.accessibility.trapFocus(modal);

// When closing the modal
release();
```

### Register custom shortcuts

```javascript
converse.api.accessibility.registerShortcuts({
    'Ctrl+Alt+X': (event) => {
        console.log('Custom shortcut');
    }
});
```

### Get focusable elements

```javascript
const container = document.querySelector('.chat-content');
const focusable = converse.api.accessibility.getFocusableElements(container);
```

## File Structure

```
src/plugins/accessibility/
├── index.js                  # Main plugin
├── keyboard-shortcuts.js     # Shortcut system
├── modal.js                  # Help modal
└── styles/
    └── accessibility.scss    # Accessibility styles

src/utils/
└── accessibility.js          # Shared utilities

src/shared/components/
└── screen-reader-announcer.js # Announcements component
```

## Testing

### Recommended Screen Readers

- **Windows:** NVDA (free), JAWS (commercial)
- **macOS:** VoiceOver (included)
- **Linux:** Orca (free)
- **Android:** TalkBack (included)
- **iOS:** VoiceOver (included)

### Checklist

- [ ] Complete keyboard navigation
- [ ] All interactive elements are focusable
- [ ] Logical tab order
- [ ] Appropriate ARIA labels
- [ ] Announcements work correctly
- [ ] Adequate color contrast (WCAG AA)
- [ ] Visible focus states
- [ ] Works without mouse

## Standards Compliance

This plugin follows:

- **WCAG 2.1 Level AA** - Web Content Accessibility Guidelines
- **ARIA 1.2** - Accessible Rich Internet Applications
- **Section 508** - U.S. accessibility standards
- **EN 301 549** - European accessibility standards

## Contributing

To improve accessibility:

1. Test with real assistive technologies
2. Follow ARIA Authoring Practices guidelines
3. Use accessibility validators (axe, WAVE)
4. Document changes in accessibility.rst
5. Add automated tests when possible

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM](https://webaim.org/)
- [The A11Y Project](https://www.a11yproject.com/)

## License

MPL-2.0 (same as Converse.js)

## Support

To report accessibility issues:

1. Open an issue on GitHub
2. Label it with `accessibility`
3. Include:
   - Browser and version
   - Assistive technology used
   - Steps to reproduce
   - Expected vs actual behavior

---

**Note:** Accessibility is an ongoing process. We welcome any feedback to improve the experience for all users.
