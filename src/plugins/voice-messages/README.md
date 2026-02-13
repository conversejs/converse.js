# Voice Messages Plugin for Converse.js

Fully accessible plugin that allows recording, sending and playing audio messages in Converse.js with complete support for screen readers and keyboard navigation.

## Features

### 🎤 Audio Recording
- **Accessible recorder** with clear controls and voice announcements
- **Recording states**: idle, requesting permission, recording, paused, processing
- **Controls**: start/stop, pause/resume, cancel
- **Visual indicator** of elapsed time and animated waveform
- **Configurable duration limit** (default: 5 minutes)
- **Automatic detection** of best supported audio format

### 🔊 Audio Playback
- **Accessible player** with complete controls
- **Progress bar** with ARIA and keyboard navigation
- **Speed control**: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x
- **Temporal navigation**: skip forward/backward 5/10 seconds
- **Display** of current time and total duration
- **Download button** to save the file

### ♿ Accessibility
- **Complete ARIA**: roles, labels, states and live regions
- **Keyboard navigation**: 15+ specific shortcuts
- **Screen readers**: announcements of all states and actions
- **High contrast**: optimized styles
- **Reduced animations**: respects prefers-reduced-motion

## Installation

### 1. Register the Plugin

In your Converse.js configuration file:

```javascript
converse.plugins.add('converse-voice-messages', {
    dependencies: ['converse-chatview', 'converse-accessibility']
});
```

### 2. Configuration

```javascript
converse.initialize({
    // ... other options ...
    
    // Enable voice messages
    enable_voice_messages: true,
    
    // Maximum duration in seconds (5 minutes)
    max_voice_message_duration: 300,
    
    // Audio quality (bits per second)
    voice_message_bitrate: 128000,
    
    // Preferred format
    voice_message_mime_type: 'audio/webm;codecs=opus',
    
    // Keyboard shortcuts
    voice_message_shortcuts: {
        start_recording: 'Alt+Shift+V',
        stop_recording: 'Escape',
        pause_resume: 'Space',
        toggle_playback: 'k',
        skip_forward: 'l',
        skip_backward: 'j'
    }
});
```

### 3. Import Styles (if needed)

Styles are automatically imported from the plugin, but if you need to customize them:

```scss
@import 'src/plugins/voice-messages/styles/audio-recorder.scss';
@import 'src/plugins/voice-messages/styles/audio-player.scss';
```

## Usage

### Recording a Voice Message

#### By Interface
1. In any chat, press the microphone button 🎤 in the toolbar
2. Grant microphone permissions when requested
3. Speak your message
4. Press the stop button ⏹️ to finish
5. The message will be sent automatically

#### By Keyboard
1. Press `Alt+Shift+V` to start recording
2. Press `Space` to pause/resume
3. Press `Escape` or `Enter` to stop and send

### Playing a Voice Message

Received voice messages are displayed with the player automatically.

#### Mouse Controls
- Click on **play/pause** ▶️/⏸️
- Drag the **progress bar** to seek
- Click on **speed** selector to change
- Click on **⏮️/⏭️** to skip 10 seconds

#### Keyboard Controls
- `Space` or `k`: play/pause
- `←/→`: rewind/forward 5 seconds
- `j/l`: rewind/forward 10 seconds
- `Home/End`: go to start/end
- `↑/↓`: increase/decrease speed

## API

### Check Support

```javascript
if (converse.api.voice_messages.isSupported()) {
    console.log('Your browser supports voice messages');
}
```

### Get Supported Formats

```javascript
const formats = converse.api.voice_messages.getSupportedMimeTypes();
console.log('Available formats:', formats);
```

### Get Best Format

```javascript
const bestFormat = converse.api.voice_messages.getBestMimeType();
console.log('Use format:', bestFormat);
```

### Send a Voice Message Programmatically

```javascript
const chatbox = converse.chatboxes.get('user@example.com');

// audioBlob is a Blob of the recorded audio
// duration is the duration in seconds
await converse.api.voice_messages.send(chatbox, audioBlob, duration);
```

### Detect if a Message is Voice

```javascript
const message = chatbox.messages.at(0);
const isVoice = converse.api.voice_messages.isVoiceMessage(message);
```

### Format Duration

```javascript
const formatted = converse.api.voice_messages.formatDuration(125);
console.log(formatted); // "2:05"
```

## Web Components

### `<converse-audio-recorder>`

Component for recording audio.

**Properties:**
- `maxDuration` (number): Maximum duration in seconds (default: 300)
- `bitrate` (number): Bits per second (default: 128000)

**Events:**
- `recording-started`: Recording started
- `recording-paused`: Recording paused
- `recording-resumed`: Recording resumed
- `recording-stopped`: Recording stopped with audio available
- `recording-cancelled`: Recording cancelled without audio
- `recording-error`: Error during recording

**Example:**
```javascript
const recorder = document.createElement('converse-audio-recorder');
recorder.maxDuration = 180; // 3 minutes

recorder.addEventListener('recording-stopped', (e) => {
    const { audioBlob, duration } = e.detail;
    console.log('Recorded audio:', audioBlob, 'Duration:', duration);
});

document.body.appendChild(recorder);
```

### `<converse-audio-player>`

Component for playing audio.

**Properties:**
- `src` (string): Audio file URL
- `title` (string): Descriptive title (for ARIA)

**Events:**
- `play`: Playback started
- `pause`: Playback paused
- `ended`: Playback finished
- `timeupdate`: Time update (native event)
- `error`: Error loading or playing

**Example:**
```javascript
const player = document.createElement('converse-audio-player');
player.src = 'https://example.com/audio.webm';
player.title = 'Message from John';

player.addEventListener('ended', () => {
    console.log('Playback finished');
});

document.body.appendChild(player);
```

## Keyboard Shortcuts

### Global (in any chat)
- `Alt+Shift+V`: Start voice message recording

### During Recording
- `Space`: Pause/resume recording
- `Enter`: Stop and send
- `Escape`: Cancel recording

### During Playback
- `Space` or `k`: Play/pause
- `←` (left arrow): Rewind 5 seconds
- `→` (right arrow): Forward 5 seconds
- `j`: Rewind 10 seconds
- `l`: Forward 10 seconds
- `Home`: Go to start
- `End`: Go to end
- `↑` (up arrow): Increase speed
- `↓` (down arrow): Decrease speed

## Compatibility

### Supported Browsers

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 49+ | Full support |
| Firefox | 25+ | Full support |
| Safari | 14.1+ | Requires webkit prefix |
| Edge | 79+ | Full support |
| Opera | 36+ | Full support |

### Audio Formats

The plugin automatically detects supported formats in order of preference:

1. **audio/webm;codecs=opus** (preferred - best compression)
2. **audio/ogg;codecs=opus**
3. **audio/webm**
4. **audio/ogg**
5. **audio/mp4**
6. **audio/mpeg**

### Required APIs

- **MediaDevices API**: To access the microphone
- **MediaRecorder API**: To record audio
- **Web Audio API**: For analysis and processing (optional)

### Check Requirements

```javascript
const isSupported = !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.MediaRecorder
);

if (!isSupported) {
    console.error('Your browser does not support audio recording');
}
```

## Permissions

The plugin automatically requests microphone permission when the user attempts to record. It is recommended to inform users about this in your privacy policy.

### Handling Denied Permissions

```javascript
recorder.addEventListener('recording-error', (e) => {
    const { error } = e.detail;
    
    if (error.name === 'NotAllowedError') {
        alert('You need to grant microphone access to record voice messages');
    }
});
```

## Customization

### CSS Styles

All CSS classes are available for customization:

```scss
// Change recording indicator color
.recording-indicator {
    background-color: #ff0000 !important;
}

// Customize buttons
.btn-player {
    border-radius: 8px !important;
    background-color: var(--my-primary-color) !important;
}

// Change waveform
.waveform-bar {
    background: linear-gradient(to top, #667eea, #764ba2) !important;
}
```

### CSS Variables

```css
:root {
    --focus-outline-color: #0066cc;
    --primary-color: #0066cc;
    --primary-color-light: #4d9fff;
    --danger-color: #dc3545;
    --warning-color: #ffc107;
    --success-color: #28a745;
}
```

## Detailed Accessibility

### ARIA

The plugin implements:
- **Roles**: `region`, `toolbar`, `button`, `slider`
- **Labels**: Descriptive for all controls
- **States**: `aria-pressed`, `aria-disabled`, `aria-valuenow`
- **Live Regions**: To announce dynamic changes

### Screen Readers

All states are clearly announced:
- "Recording started"
- "Recording paused"
- "Recording: 1 minute 30 seconds"
- "Voice message sent"
- "Playing at 50%"
- "Playback speed: 1.5x"

### Keyboard Navigation

- All controls are accessible by Tab
- Visible focus indicators
- Intuitive keyboard shortcuts
- Escape key to cancel

### High Contrast

Special styles for high contrast mode:
```scss
body.converse-high-contrast {
    .audio-player {
        border-width: 3px;
        border-color: #000;
    }
}
```

## Troubleshooting

### Microphone doesn't work

1. Verify the site uses HTTPS (required)
2. Check browser permissions
3. Make sure the microphone is connected
4. Try another browser

### Audio doesn't play

1. Verify the format is supported
2. Check the file URL
3. Review console for CORS errors
4. Try another audio file

### Poor audio quality

1. Increase bitrate in configuration
2. Use a better microphone
3. Record in a quiet environment
4. Consider using a lossless format (if available)

### Console errors

```javascript
// Enable debugging logs
console.debug('Voice messages plugin state:', {
    supported: converse.api.voice_messages.isSupported(),
    formats: converse.api.voice_messages.getSupportedMimeTypes(),
    config: {
        enabled: converse.api.settings.get('enable_voice_messages'),
        maxDuration: converse.api.settings.get('max_voice_message_duration')
    }
});
```

## Contributing

To contribute to the plugin:

1. Fork the repository
2. Create a branch for your feature
3. Make sure tests pass
4. Follow style guides
5. Create a Pull Request

### Run Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## License

Mozilla Public License (MPLv2)

## Credits

Developed with ❤️ for the Converse.js community with a focus on universal accessibility.

## Support

- **Documentation**: https://conversejs.org
- **Issues**: https://github.com/conversejs/converse.js/issues
- **Chat**: converse@conference.conversejs.org

## Changelog

### v1.0.0 (2024)
- ✨ Initial release
- 🎤 Voice message recording
- 🔊 Player with complete controls
- ♿ Full accessibility support
- ⌨️ 15+ keyboard shortcuts
- 🎨 Themes and customization
- 🌍 Internationalization
