/**
 * Voice messages plugin integration example
 * 
 * This file shows how to integrate the recording component
 * in the chat interface and the player in messages.
 */

// =============================================================================
// 1. ADD RECORDING BUTTON TO TOOLBAR
// =============================================================================

/**
 * In src/plugins/chatview/templates/toolbar.js or similar
 * Add the microphone button alongside the other toolbar buttons
 */

import { html } from 'lit';
import { __ } from 'i18n';

export const tplVoiceMessageButton = (o) => {
    // Only show if enabled and supported
    if (!o.enable_voice_messages || !o.voice_messages_supported) {
        return '';
    }

    return html`
        <button
            type="button"
            class="btn btn-toolbar voice-message-button"
            title="${__('Record voice message')} (Alt+Shift+V)"
            aria-label="${__('Record voice message')}"
            @click=${o.startVoiceRecording}
        >
            <converse-icon
                class="fa fa-microphone"
                size="1em"
            ></converse-icon>
        </button>
    `;
};

// In the main toolbar template, add:
export const tplToolbar = (o) => html`
    <div class="chat-toolbar" role="toolbar" aria-label="${__('Chat toolbar')}">
        <!-- ... other buttons ... -->
        
        ${o.show_send_button ? tplSendButton(o) : ''}
        ${o.show_emoji_button ? tplEmojiButton(o) : ''}
        ${tplVoiceMessageButton(o)}  <!-- NEW -->
        
        <!-- ... more buttons ... -->
    </div>
`;


// =============================================================================
// 2. ADD THE RECORDER IN THE CHAT VIEW
// =============================================================================

/**
 * In the ChatView or ChatBoxView
 * Show the recorder when the user presses the button
 */

import AudioRecorder from '../voice-messages/audio-recorder.js';

class ChatBoxView extends ElementView {
    
    initialize () {
        super.initialize();
        this.listenTo(this.model, 'startVoiceRecording', this.showVoiceRecorder);
    }
    
    /**
     * Shows the recording component
     */
    showVoiceRecorder () {
        // Create the recorder if it doesn't exist
        if (!this.voice_recorder) {
            this.voice_recorder = document.createElement('converse-audio-recorder');
            this.voice_recorder.maxDuration = api.settings.get('max_voice_message_duration');
            this.voice_recorder.bitrate = api.settings.get('voice_message_bitrate');
            
            // Listen to recording completed event
            this.voice_recorder.addEventListener('recording-stopped', (e) => {
                this.handleRecordingCompleted(e.detail);
            });
            
            // Listen to cancellation
            this.voice_recorder.addEventListener('recording-cancelled', () => {
                this.hideVoiceRecorder();
            });
            
            // Add to DOM (for example, in the messages area)
            const messagesArea = this.querySelector('.chat-content');
            if (messagesArea) {
                messagesArea.insertBefore(
                    this.voice_recorder,
                    messagesArea.firstChild
                );
            }
        }
        
        // Make visible and focus
        this.voice_recorder.style.display = 'block';
        this.voice_recorder.focus();
    }
    
    /**
     * Hides the recorder
     */
    hideVoiceRecorder () {
        if (this.voice_recorder) {
            this.voice_recorder.style.display = 'none';
        }
    }
    
    /**
     * Handles the recorded audio
     */
    async handleRecordingCompleted ({ audioBlob, duration }) {
        try {
            // Send the voice message
            await this.model.sendVoiceMessage(audioBlob, duration);
            
            // Hide the recorder
            this.hideVoiceRecorder();
            
            // Announce success
            if (api.accessibility) {
                api.accessibility.announce(
                    __('Voice message sent successfully'),
                    'assertive'
                );
            }
        } catch (error) {
            console.error('Error sending voice message:', error);
            
            // Announce error
            if (api.accessibility) {
                api.accessibility.announce(
                    __('Error sending voice message'),
                    'assertive'
                );
            }
        }
    }
    
    /**
     * Template helpers for the toolbar
     */
    getToolbarOptions () {
        return {
            // ... existing options ...
            enable_voice_messages: api.settings.get('enable_voice_messages'),
            voice_messages_supported: api.voice_messages?.isSupported(),
            startVoiceRecording: () => this.model.startVoiceRecording()
        };
    }
}


// =============================================================================
// 3. RENDER THE PLAYER IN MESSAGES
// =============================================================================

/**
 * In src/shared/chat/templates/message.js
 * Detect voice messages and use the player
 */

import { html } from 'lit';
import { __ } from 'i18n';

/**
 * Template for voice message
 */
export const tplVoiceMessage = (o) => {
    const oob_url = o.model.get('oob_url');
    const duration = o.model.get('voice_message_duration');
    const sender = o.model.get('sender') === 'me' ? __('You') : o.model.getDisplayName();
    
    return html`
        <div class="message-voice">
            <converse-audio-player
                src="${oob_url}"
                title="${__('Voice message from %1$s', sender)}"
            ></converse-audio-player>
            
            ${duration ? html`
                <div class="voice-message-meta">
                    <span class="voice-duration">
                        ${__('Duration')}: ${api.voice_messages.formatDuration(duration)}
                    </span>
                </div>
            ` : ''}
        </div>
    `;
};

/**
 * In the main message template, add condition
 */
export const tplMessage = (o) => {
    const is_voice = api.voice_messages?.isVoiceMessage(o.model);
    
    return html`
        <article 
            class="message ${o.type}"
            role="article"
            aria-label="${o.getAriaLabel()}"
            tabindex="0"
        >
            <div class="message-body">
                <!-- Avatar, sender, etc. -->
                ${tplMessageHeader(o)}
                
                <!-- Message content -->
                <div class="message-content">
                    ${is_voice ? tplVoiceMessage(o) : tplMessageText(o)}
                </div>
                
                <!-- Timestamp, actions, etc. -->
                ${tplMessageFooter(o)}
            </div>
        </article>
    `;
};


// =============================================================================
// 4. ADD METADATA TO VOICE MESSAGES
// =============================================================================

/**
 * In the ChatBox model
 * Mark voice messages when sent
 */

class ChatBox extends Model {
    
    /**
     * Sends a voice message
     */
    async sendVoiceMessage (audioBlob, duration) {
        try {
            // Create file
            const file = api.voice_messages.createAudioFile(audioBlob);
            
            // Create stub message to show immediately
            const message = this.messages.create({
                'from': _converse.bare_jid,
                'fullname': _converse.xmppstatus.get('fullname'),
                'sender': 'me',
                'time': (new Date()).toISOString(),
                'message': __('Sending voice message...'),
                'is_voice_message': true,
                'voice_message_duration': duration,
                'type': 'chat'
            });
            
            // Send file
            await this.sendFiles([file]);
            
            // Update message with URL once uploaded
            // (this is handled by XEP-0363 handler)
            
            return message;
        } catch (error) {
            console.error('Error sending voice message:', error);
            throw error;
        }
    }
}


// =============================================================================
// 5. CONFIGURATION IN CONVERSE.INITIALIZE
// =============================================================================

/**
 * Recommended configuration when initializing Converse
 */

converse.initialize({
    // ... existing configuration ...
    
    // Enable accessibility plugin (required)
    enable_accessibility: true,
    
    // Enable voice messages
    enable_voice_messages: true,
    
    // Maximum duration: 5 minutes
    max_voice_message_duration: 300,
    
    // Audio quality: 128 kbps
    voice_message_bitrate: 128000,
    
    // Preferred format (best supported is auto-detected)
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


// =============================================================================
// 6. DETECT INCOMING VOICE MESSAGES
// =============================================================================

/**
 * In the incoming messages handler
 * Detect and mark voice messages
 */

api.listen.on('messageAdded', (message) => {
    // Check if it's a voice message by OOB
    if (api.voice_messages.isVoiceMessage(message)) {
        message.set('is_voice_message', true);
        
        // Announce to screen reader users
        if (api.accessibility) {
            const sender = message.getDisplayName();
            api.accessibility.announce(
                __('Voice message received from %1$s', sender),
                'polite'
            );
        }
    }
});


// =============================================================================
// 7. PROGRAMMATIC USAGE EXAMPLE
// =============================================================================

/**
 * Record and send voice message programmatically
 */
async function sendProgrammaticVoiceMessage () {
    // Get the current chatbox
    const jid = 'user@example.com';
    const chatbox = await api.chats.get(jid);
    
    // Create the recorder
    const recorder = document.createElement('converse-audio-recorder');
    recorder.maxDuration = 60; // 1 minute
    
    // Listen for result
    recorder.addEventListener('recording-stopped', async (e) => {
        const { audioBlob, duration } = e.detail;
        
        try {
            await chatbox.sendVoiceMessage(audioBlob, duration);
            console.log('Voice message sent');
        } catch (error) {
            console.error('Error:', error);
        }
    });
    
    // Add to DOM temporarily
    document.body.appendChild(recorder);
}

/**
 * Play a voice message programmatically
 */
function playVoiceMessage (messageModel) {
    const oob_url = messageModel.get('oob_url');
    
    if (!oob_url) {
        console.error('No audio URL in message');
        return;
    }
    
    // Create the player
    const player = document.createElement('converse-audio-player');
    player.src = oob_url;
    player.title = 'Voice message';
    
    // Listen for events
    player.addEventListener('ended', () => {
        console.log('Playback finished');
    });
    
    // Add to DOM
    const container = document.getElementById('audio-container');
    container.appendChild(player);
}

/**
 * Check support before showing UI
 */
function checkVoiceMessageSupport () {
    if (!api.voice_messages.isSupported()) {
        console.warn('Voice messages not supported in this browser');
        
        // Hide recording buttons
        document.querySelectorAll('.voice-message-button').forEach(btn => {
            btn.style.display = 'none';
        });
        
        // Show message to user
        alert(__('Your browser does not support audio recording. ' +
                 'Please update to a newer version.'));
        
        return false;
    }
    
    // Show supported formats in console
    console.log('Supported audio formats:',
        api.voice_messages.getSupportedMimeTypes());
    
    return true;
}


// =============================================================================
// 8. CUSTOM STYLES (OPTIONAL)
// =============================================================================

/**
 * Customize component styles
 * In your main CSS/SCSS file
 */

/*
.audio-recorder {
    // Change background color
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    
    // Customize recording indicator
    .recording-indicator {
        background-color: #ff0000;
        box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
    }
}

.audio-player {
    // Compact style
    padding: 0.5rem;
    
    // Customize buttons
    .btn-player {
        background: #667eea;
        color: white;
        border: none;
        
        &:hover {
            background: #764ba2;
        }
    }
}

// Dark theme
@media (prefers-color-scheme: dark) {
    .audio-recorder,
    .audio-player {
        background: #1a1a1a;
        border-color: #333;
        color: #fff;
    }
}
*/

export {
    tplVoiceMessageButton,
    tplVoiceMessage,
    sendProgrammaticVoiceMessage,
    playVoiceMessage,
    checkVoiceMessageSupport
};
