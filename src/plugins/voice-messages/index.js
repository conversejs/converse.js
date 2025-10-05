/**
 * @module converse-voice-messages
 * @copyright The Converse.js developers
 * @license Mozilla Public License (MPLv2)
 * @description
 * Plugin que permite grabar, enviar y reproducir mensajes de audio con
 * soporte completo de accesibilidad para usuarios con lectores de pantalla.
 */
import './styles/audio-recorder.scss';
import './styles/audio-player.scss';
import AudioRecorder from './audio-recorder.js';
import AudioPlayer from './audio-player.js';
import { api, converse } from '@converse/headless';
import { __ } from 'i18n';

converse.plugins.add('converse-voice-messages', {
    dependencies: ['converse-chatview', 'converse-accessibility'],

    initialize () {
        const _converse = this._converse;

        // Configuración del plugin
        api.settings.extend({
            /**
             * Habilita o deshabilita los mensajes de voz
             * @type {boolean}
             */
            enable_voice_messages: true,

            /**
             * Duración máxima de grabación en segundos
             * @type {number}
             */
            max_voice_message_duration: 300, // 5 minutos

            /**
             * Calidad de audio (bits por segundo)
             * @type {number}
             */
            voice_message_bitrate: 128000, // 128 kbps

            /**
             * Formato de audio preferido
             * @type {string}
             */
            voice_message_mime_type: 'audio/webm;codecs=opus',

            /**
             * Atajos de teclado para mensajes de voz
             * @type {Object}
             */
            voice_message_shortcuts: {
                start_recording: 'Alt+Shift+V',
                stop_recording: 'Escape',
                pause_resume: 'Space',
                toggle_playback: 'k',
                skip_forward: 'l',
                skip_backward: 'j'
            }
        });

        // Registrar componentes personalizados
        if (!customElements.get('converse-audio-recorder')) {
            customElements.define('converse-audio-recorder', AudioRecorder);
        }
        if (!customElements.get('converse-audio-player')) {
            customElements.define('converse-audio-player', AudioPlayer);
        }

        /**
         * Verifica si el navegador soporta grabación de audio
         * @returns {boolean}
         */
        api.voice_messages = api.voice_messages || {};
        
        api.voice_messages.isSupported = function () {
            return !!(
                navigator.mediaDevices &&
                navigator.mediaDevices.getUserMedia &&
                window.MediaRecorder
            );
        };

        /**
         * Obtiene los formatos MIME soportados por el navegador
         * @returns {Array<string>}
         */
        api.voice_messages.getSupportedMimeTypes = function () {
            const types = [
                'audio/webm;codecs=opus',
                'audio/ogg;codecs=opus',
                'audio/webm',
                'audio/ogg',
                'audio/mp4',
                'audio/mpeg'
            ];
            
            return types.filter(type => {
                try {
                    return MediaRecorder.isTypeSupported(type);
                } catch (_e) {
                    return false;
                }
            });
        };

        /**
         * Obtiene el mejor formato MIME disponible
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
         * Crea un archivo de audio a partir de un blob
         * @param {Blob} blob - Blob de audio
         * @param {string} filename - Nombre del archivo
         * @returns {File}
         */
        api.voice_messages.createAudioFile = function (blob, filename) {
            const mimeType = blob.type || api.voice_messages.getBestMimeType();
            const extension = mimeType.split('/')[1].split(';')[0];
            const fullFilename = filename || `voice-message-${Date.now()}.${extension}`;
            
            return new File([blob], fullFilename, {
                type: mimeType,
                lastModified: Date.now()
            });
        };

        /**
         * Envia un mensaje de voz a un chat
         * @param {Object} chatbox - El modelo del chatbox
         * @param {Blob} audioBlob - Blob de audio grabado
         * @param {number} duration - Duración en segundos
         */
        api.voice_messages.send = async function (chatbox, audioBlob, duration) {
            if (!chatbox || !audioBlob) {
                throw new Error('Se requiere chatbox y audioBlob');
            }

            try {
                // Crear archivo con metadata
                const file = api.voice_messages.createAudioFile(audioBlob);
                
                // Anunciar a lectores de pantalla
                if (api.accessibility) {
                    api.accessibility.announce(
                        __('Enviando mensaje de voz de %1$s segundos', Math.round(duration)),
                        'polite'
                    );
                }

                // Enviar usando el sistema de archivos existente
                await chatbox.sendFiles([file]);

                // Confirmar envío
                if (api.accessibility) {
                    api.accessibility.announce(
                        __('Mensaje de voz enviado correctamente'),
                        'assertive'
                    );
                }

                return true;
            } catch (error) {
                console.error('Error al enviar mensaje de voz:', error);
                
                if (api.accessibility) {
                    api.accessibility.announce(
                        __('Error al enviar mensaje de voz: %1$s', error.message),
                        'assertive'
                    );
                }
                
                throw error;
            }
        };

        /**
         * Detecta si un mensaje es un mensaje de voz
         * @param {Object} message - El modelo del mensaje
         * @returns {boolean}
         */
        api.voice_messages.isVoiceMessage = function (message) {
            const oob = message.get('oob_url');
            if (!oob) return false;

            const filename = oob.split('/').pop().toLowerCase();
            const isAudio = (/\.(mp3|wav|ogg|webm|m4a|aac|opus)$/i).test(filename);
            const isVoiceMessage = (/voice-message/i).test(filename);

            return isAudio && (isVoiceMessage || message.get('is_voice_message'));
        };

        /**
         * Formatea la duración en formato MM:SS
         * @param {number} seconds - Segundos
         * @returns {string}
         */
        api.voice_messages.formatDuration = function (seconds) {
            if (!seconds || isNaN(seconds)) return '0:00';
            
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        // Extender el modelo de mensajes para soportar metadata de voz
        const Message = _converse.Message;
        if (Message) {
            Object.assign(Message.prototype, {
                /**
                 * Marca el mensaje como mensaje de voz
                 */
                setAsVoiceMessage (duration) {
                    this.set({
                        'is_voice_message': true,
                        'voice_message_duration': duration
                    });
                },

                /**
                 * Obtiene la duración del mensaje de voz
                 * @returns {number|null}
                 */
                getVoiceMessageDuration () {
                    return this.get('voice_message_duration') || null;
                }
            });
        }

        // Agregar comando de chat para grabar mensajes de voz
        const ChatBox = _converse.ChatBox;
        if (ChatBox) {
            Object.assign(ChatBox.prototype, {
                /**
                 * Inicia la grabación de un mensaje de voz
                 */
                startVoiceRecording () {
                    // Emitir evento para que la vista muestre el grabador
                    this.trigger('startVoiceRecording');
                },

                /**
                 * Envia un mensaje de voz grabado
                 */
                async sendVoiceMessage (audioBlob, duration) {
                    return await api.voice_messages.send(this, audioBlob, duration);
                }
            });
        }

        // Registrar atajos de teclado globales
        api.listen.on('accessibilityInitialized', () => {
            if (!api.settings.get('enable_voice_messages')) return;
            if (!api.voice_messages.isSupported()) return;

            const shortcuts = api.settings.get('voice_message_shortcuts');

            // Atajo para iniciar grabación (Alt+Shift+V)
            if (shortcuts.start_recording && api.accessibility && api.accessibility.registerShortcut) {
                api.accessibility.registerShortcut({
                    keys: shortcuts.start_recording,
                    description: __('Iniciar grabación de mensaje de voz'),
                    category: 'chat',
                    handler: () => {
                        const chatview = _converse.chatboxviews.get(_converse.chatboxes.getChatBox());
                        if (chatview && chatview.model) {
                            chatview.model.startVoiceRecording();
                            return true;
                        }
                        return false;
                    }
                });
            }
        });

        // Información de diagnóstico
        console.info('Voice Messages Plugin initialized', {
            enabled: api.settings.get('enable_voice_messages'),
            supported: api.voice_messages.isSupported(),
            mimeTypes: api.voice_messages.getSupportedMimeTypes(),
            bestMimeType: api.voice_messages.getBestMimeType()
        });
    }
});
