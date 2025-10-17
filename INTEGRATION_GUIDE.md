# Build and Integration Guide - Accessibility and Voice Messages

## 🚀 Build

### 1. Install Dependencies

```bash
cd /home/ale/projects/converse/converse.js
npm install
```

### 2. Build the Project

```bash
# Development build (with watch)
npm run dev

# Or production build
npm run build
```

### 3. Serve Locally (for testing)

```bash
npm run serve
```

Then open `http://localhost:8080` in your browser.

## ✅ Verify It Works

### 1. Open Browser Console

After Converse.js has initialized, run:

```javascript
// Verify accessibility is enabled
console.log('Accessibility:', converse.api.settings.get('enable_accessibility'));
// → true

// Verify voice messages are enabled
console.log('Voice messages:', converse.api.settings.get('enable_voice_messages'));
// → true

// Verify accessibility API is available
console.log('Accessibility API:', typeof converse.api.accessibility);
// → "object"

// Verify voice messages API is available
console.log('Voice messages API:', typeof converse.api.voice_messages);
// → "object"

// Verify browser support for voice messages
console.log('Recording support:', converse.api.voice_messages.isSupported());
// → true (if your browser supports MediaRecorder)
```

### 2. Look for the Microphone Button

In any open chat, you should see:
- 📎 Attach files button
- 🎤 **Microphone button** (new) ← This is for voice messages
- 😀 Emoji button
- Other buttons depending on configuration

### 3. Test Recording

1. Click the 🎤 button or press `Alt+Shift+V`
2. Grant microphone permissions if requested
3. Speak your message
4. Press the red ⏹️ button to stop and send
5. Or press `Escape` to cancel

### 4. Test Keyboard Shortcuts

Press `Alt+Shift+?` to see the modal with all available shortcuts.

**Main shortcuts:**
- `Alt+Shift+V` - Record voice message
- `Alt+Shift+M` - Go to messages
- `Alt+Shift+C` - Go to contacts
- `Alt+Shift+?` - Show shortcuts help

## 🔧 Custom Configuration (Optional)

If you need to customize the configuration, you can do so in your initialization file:

```javascript
converse.initialize({
    // ... your other options ...
    
    // Accessibility (already enabled by default)
    enable_accessibility: true,
    enable_keyboard_shortcuts: true,
    enable_screen_reader_announcements: true,
    announce_new_messages: true,
    high_contrast_mode: false,
    
    // Voice messages (already enabled by default)
    enable_voice_messages: true,
    max_voice_message_duration: 300,  // 5 minutes
    voice_message_bitrate: 128000,    // 128 kbps
    voice_message_mime_type: 'audio/webm;codecs=opus',
    
    // Button visibility in toolbar
    visible_toolbar_buttons: {
        'emoji': true,
        'call': false,
        'spoiler': false,
        'voice_message': true  // ← Voice messages button
    }
});
```

## 📱 Using the Interface

### Recording a Voice Message

#### Method 1: With Mouse
1. Open a chat with any contact
2. Click on the **microphone** 🎤 button in the toolbar
3. Grant permissions if requested
4. The recorder will appear above the text field
5. Speak your message (you'll see the timer and waveform)
6. Click **Stop** ⏹️ when finished
7. The message will be sent automatically

#### Method 2: With Keyboard
1. Open a chat (or press `Alt+Shift+M` to go to messages)
2. Press `Alt+Shift+V`
3. The recorder will open automatically
4. Speak your message
5. Press `Enter` to send or `Escape` to cancel

### Controls During Recording

- **Pause/Resume**: Click on ⏸️/▶️ or press `Space`
- **Stop and Send**: Click on ⏹️ or press `Enter`
- **Cancel**: Click on ✖️ or press `Escape`

### Playing Received Voice Messages

Voice messages are automatically displayed with a player:

- **Play/Pause**: Click on ▶️/⏸️ or press `k` or `Space`
- **Forward**: Click on ⏭️ or press `l` (10 sec) or `→` (5 sec)
- **Backward**: Click on ⏮️ or press `j` (10 sec) or `←` (5 sec)
- **Speed**: Click on selector (0.5x - 2x)
- **Download**: Click on 📥 button

## ♿ Accessibility

### Screen Readers

All controls have:
- Descriptive ARIA labels
- Automatic state announcements
- Logical keyboard navigation

**Supported readers:**
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (macOS, iOS)
- TalkBack (Android)
- Orca (Linux)

### Complete Keyboard Shortcuts

#### Global
- `Alt+Shift+M` - Go to messages
- `Alt+Shift+C` - Go to contacts  
- `Alt+Shift+R` - Go to rooms (MUC)
- `Alt+Shift+S` - Change status
- `Alt+Shift+?` - Show help

#### In Chat
- `Alt+Shift+V` - Record voice message
- `Escape` - Close chat/cancel action
- `Ctrl+↑` - Edit last message
- `Tab` - Navigate between controls

#### During Recording
- `Space` - Pause/resume
- `Enter` - Stop and send
- `Escape` - Cancel recording

#### During Playback
- `Space` or `k` - Play/pause
- `j` - Rewind 10 seconds
- `l` - Forward 10 seconds
- `←` - Rewind 5 seconds
- `→` - Forward 5 seconds
- `Home` - Go to start
- `End` - Go to end
- `↑/↓` - Change speed

## 🐛 Troubleshooting

### Microphone Button Doesn't Appear

**Possible causes:**
1. Browser doesn't support MediaRecorder API
2. Not using HTTPS (required for microphone)
3. Plugin didn't load correctly

**Solution:**
```javascript
// In browser console:
console.log('Support:', converse.api.voice_messages?.isSupported());
console.log('Enabled:', converse.api.settings.get('enable_voice_messages'));
console.log('Toolbar:', converse.api.settings.get('visible_toolbar_buttons'));
```

### Microphone Doesn't Work

**Possible causes:**
1. Haven't granted permissions
2. Another program is using the microphone
3. Microphone is disconnected

**Solution:**
1. Check permissions in your browser (lock icon in address bar)
2. Close other applications using the microphone
3. Try another microphone
4. Try in incognito mode

### Voice Messages Don't Send

**Possible causes:**
1. Server doesn't support HTTP File Upload (XEP-0363)
2. Connection problems
3. File is too large

**Solution:**
```javascript
// Check server support:
const domain = converse.session.get('domain');
converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, domain).then(
    supported => console.log('HTTP Upload supported:', supported)
);

// Reduce maximum duration if necessary:
converse.initialize({
    max_voice_message_duration: 60  // 1 minute instead of 5
});
```

### Keyboard Shortcuts Don't Work

**Possible causes:**
1. Conflict with browser extensions
2. Focus is on another element
3. Shortcuts are disabled

**Solution:**
```javascript
// Check status:
console.log('Shortcuts enabled:', 
    converse.api.settings.get('enable_keyboard_shortcuts'));

// Check for conflicts:
// Press Alt+Shift+? to see full list
```

## 📚 Additional Documentation

- **Complete accessibility**: `/docs/source/accessibility.rst`
- **Voice messages - Manual**: `/src/plugins/voice-messages/README.md`
- **Voice messages - Implementation**: `/src/plugins/voice-messages/IMPLEMENTATION.md`
- **Code examples**: `/src/plugins/voice-messages/INTEGRATION_EXAMPLE.js`

## 🎯 Modified Files

### Created Files:
- `src/plugins/accessibility/` (complete)
- `src/plugins/voice-messages/` (complete)
- `src/utils/accessibility.js`
- `src/shared/components/screen-reader-announcer.js`

### Modified Files:
- `src/index.js` - Added imports
- `src/shared/constants.js` - Added plugins to VIEW_PLUGINS
- `src/plugins/chatview/index.js` - Added voice_message to visible_toolbar_buttons
- `src/plugins/chatview/templates/message-form.js` - Added show_voice_message_button
- `src/plugins/chatview/bottom-panel.js` - Added recorder handling
- `src/plugins/chatview/templates/bottom-panel.js` - Added recorder component
- `src/shared/chat/toolbar.js` - Added microphone button and method

## ✨ Implemented Features

✅ Complete accessibility plugin with WCAG 2.1 AA  
✅ 13+ global and contextual keyboard shortcuts  
✅ Screen reader announcements  
✅ Complete voice messages plugin  
✅ Audio recorder with MediaRecorder API  
✅ Accessible player with complete controls  
✅ Microphone button in toolbar  
✅ Integration with XEP-0363 file system  
✅ Multi-format support (webm, ogg, mp3, etc.)  
✅ High contrast mode  
✅ Responsive and mobile-friendly  
✅ Enabled by default in build  

## 🎉 Ready to Use!

After building, everything will work automatically. Users will be able to:
- Use keyboard shortcuts immediately
- Record voice messages by clicking 🎤
- Navigate completely with keyboard
- Use screen readers without problems

**No additional configuration required!** 🚀♿🎤
