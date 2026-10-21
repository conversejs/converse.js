/**
 * @module converse-voice-messages
 * @copyright The Converse.js developers
 * @license Mozilla Public License (MPLv2)
 * @description
 * Plugin for recording and sending voice messages, with
 * full accessibility support for screen reader users.
 */
import './styles/audio-recorder.scss';
import AudioRecorder from './audio-recorder.js';
import { api, converse } from '@converse/headless';
import { __ } from 'i18n';

converse.plugins.add('converse-voice-messages', {
    dependencies: ['converse-chatview', 'converse-accessibility'],

    initialize() {
        const _converse = this._converse;

        // Plugin configuration
        api.settings.extend({
            /**
             * Enables or disables voice messages
             * @type {boolean}
             */
            enable_voice_messages: true,

            /**
             * Maximum recording duration in seconds
             * @type {number}
             */
            max_voice_message_duration: 300, // 5 minutes

            /**
             * Audio quality (bits per second)
             * @type {number}
             */
            voice_message_bitrate: 96000, // 96 kbps

            /**
             * Preferred audio format
             * @type {string}
             */
            voice_message_mime_type: 'audio/webm;codecs=opus',

            /**
             * Keyboard shortcuts for voice messages
             * @type {Object}
             */
            voice_message_shortcuts: {
                start_recording: 'Alt+Shift+V',
                stop_recording: 'Escape',
                pause_resume: 'Space',
            },
        });

        // Register custom elements
        if (!customElements.get('converse-audio-recorder')) {
            customElements.define('converse-audio-recorder', AudioRecorder);
        }

        /**
         * Checks if the browser supports audio recording
         * @returns {boolean}
         */
        api.voice_messages = api.voice_messages || {};

        api.voice_messages.isSupported = function () {
            return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
        };

        /**
         * Gets the MIME types supported by the browser
         * @returns {Array<string>}
         */
        api.voice_messages.getSupportedMimeTypes = function () {
            const types = [
                'audio/webm;codecs=opus',
                'audio/ogg;codecs=opus',
                'audio/webm',
                'audio/ogg',
                'audio/mp4',
                'audio/mpeg',
            ];

            return types.filter((type) => {
                try {
                    return MediaRecorder.isTypeSupported(type);
                } catch (_e) {
                    return false;
                }
            });
        };

        /**
         * Gets the best available MIME type
         * @returns {string}
         */
        api.voice_messages.getBestMimeType = function () {
            const preferred = api.settings.get('voice_message_mime_type');
            const supported = api.voice_messages.getSupportedMimeTypes();

            if (supported.includes(preferred)) {
                return preferred;
            }

            return supported[0] || 'audio/webm';
        };

        /**
         * Creates an audio file from a blob
         * @param {Blob} blob - Audio blob
         * @param {string} filename - File name
         * @returns {File}
         */
        api.voice_messages.createAudioFile = function (blob, filename) {
            const mimeType = blob.type || api.voice_messages.getBestMimeType();
            const extension = mimeType.split('/')[1].split(';')[0];
            const fullFilename = filename || `voice-message-${Date.now()}.${extension}`;

            return new File([blob], fullFilename, {
                type: mimeType,
                lastModified: Date.now(),
            });
        };

        /**
         * Sends a voice message to a chat
         * @param {Object} chatbox - The chatbox model
         * @param {Blob} audioBlob - Recorded audio blob
         * @param {number} duration - Duration in seconds
         */
        api.voice_messages.send = async function (chatbox, audioBlob, duration) {
            if (!chatbox || !audioBlob) {
                throw new Error('chatbox and audioBlob are required');
            }

            try {
                // Create a file with metadata
                const file = api.voice_messages.createAudioFile(audioBlob);

                // Announce to screen readers
                if (api.accessibility) {
                    api.accessibility.announce(
                        __('Sending a %1$s second voice message', Math.round(duration)),
                        'polite',
                    );
                }

                // Send using the existing file upload mechanism
                await chatbox.sendFiles([file]);

                // Confirm send
                if (api.accessibility) {
                    api.accessibility.announce(__('Voice message sent'), 'assertive');
                }

                return true;
            } catch (error) {
                console.error('Error sending voice message:', error);

                if (api.accessibility) {
                    api.accessibility.announce(__('Error sending voice message: %1$s', error.message), 'assertive');
                }

                throw error;
            }
        };

        /**
         * Detects whether a message is a voice message
         * @param {Object} message - The message model
         * @returns {boolean}
         */
        api.voice_messages.isVoiceMessage = function (message) {
            const oob = message.get('oob_url');
            if (!oob) return false;

            const filename = oob.split('/').pop().toLowerCase();
            const isAudio = /\.(mp3|wav|ogg|webm|m4a|aac|opus)$/i.test(filename);
            const isVoiceMessage = /voice-message/i.test(filename);

            return isAudio && (isVoiceMessage || message.get('is_voice_message'));
        };

        /**
         * Formats duration in MM:SS format
         * @param {number} seconds - Seconds
         * @returns {string}
         */
        api.voice_messages.formatDuration = function (seconds) {
            if (!seconds || isNaN(seconds)) return '0:00';

            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        // Extend the message model to support voice metadata
        const Message = _converse.Message;
        if (Message) {
            const originalPrototype = Message.prototype;

            /**
             * Marks the message as a voice message
             */
            originalPrototype.setAsVoiceMessage = function (duration) {
                this.save({
                    'is_voice_message': true,
                    'voice_message_duration': duration,
                });
            };

            /**
             * Gets the voice message duration
             * @returns {number|null}
             */
            originalPrototype.getVoiceMessageDuration = function () {
                return this.get('voice_message_duration') || null;
            };
        }

        // Add a chat command for recording voice messages
        const ChatBox = _converse.ChatBox;
        if (ChatBox) {
            const originalPrototype = ChatBox.prototype;

            /**
             * Starts recording a voice message
             */
            originalPrototype.startVoiceRecording = function () {
                // Emit an event so that the view shows the recorder
                this.trigger('startVoiceRecording');
            };

            /**
             * Sends a recorded voice message
             */
            originalPrototype.sendVoiceMessage = async function (audioBlob, duration) {
                return await api.voice_messages.send(this, audioBlob, duration);
            };
        }

        // Register global keyboard shortcuts
        api.listen.on('accessibilityInitialized', () => {
            if (!api.settings.get('enable_voice_messages')) return;
            if (!api.voice_messages.isSupported()) return;

            const shortcuts = api.settings.get('voice_message_shortcuts');

            // Shortcut to start recording (Alt+Shift+V)
            if (shortcuts.start_recording && api.accessibility && api.accessibility.registerShortcut) {
                api.accessibility.registerShortcut({
                    keys: shortcuts.start_recording,
                    description: __('Start voice message recording'),
                    category: 'chat',
                    handler: () => {
                        const chatview = _converse.chatboxviews.get(_converse.chatboxes.getChatBox());
                        if (chatview && chatview.model) {
                            chatview.model.startVoiceRecording();
                            return true;
                        }
                        return false;
                    },
                });
            }
        });

        // Diagnostic information
        console.info('Voice Messages Plugin initialized', {
            enabled: api.settings.get('enable_voice_messages'),
            supported: api.voice_messages.isSupported(),
            mimeTypes: api.voice_messages.getSupportedMimeTypes(),
            bestMimeType: api.voice_messages.getBestMimeType(),
        });
    },
});
