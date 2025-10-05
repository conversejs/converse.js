/**
 * Ejemplo de integración del plugin de mensajes de voz
 * 
 * Este archivo muestra cómo integrar el componente de grabación
 * en la interfaz de chat y el reproductor en los mensajes.
 */

// =============================================================================
// 1. AGREGAR BOTÓN DE GRABACIÓN AL TOOLBAR
// =============================================================================

/**
 * En src/plugins/chatview/templates/toolbar.js o similar
 * Agregar el botón de micrófono junto a los otros botones del toolbar
 */

import { html } from 'lit';
import { __ } from 'i18n';

export const tplVoiceMessageButton = (o) => {
    // Solo mostrar si está habilitado y soportado
    if (!o.enable_voice_messages || !o.voice_messages_supported) {
        return '';
    }

    return html`
        <button
            type="button"
            class="btn btn-toolbar voice-message-button"
            title="${__('Grabar mensaje de voz')} (Alt+Shift+V)"
            aria-label="${__('Grabar mensaje de voz')}"
            @click=${o.startVoiceRecording}
        >
            <converse-icon
                class="fa fa-microphone"
                size="1em"
            ></converse-icon>
        </button>
    `;
};

// En el template del toolbar principal, agregar:
export const tplToolbar = (o) => html`
    <div class="chat-toolbar" role="toolbar" aria-label="${__('Barra de herramientas del chat')}">
        <!-- ... otros botones ... -->
        
        ${o.show_send_button ? tplSendButton(o) : ''}
        ${o.show_emoji_button ? tplEmojiButton(o) : ''}
        ${tplVoiceMessageButton(o)}  <!-- NUEVO -->
        
        <!-- ... más botones ... -->
    </div>
`;


// =============================================================================
// 2. AGREGAR EL GRABADOR EN LA VISTA DEL CHAT
// =============================================================================

/**
 * En el ChatView o ChatBoxView
 * Mostrar el grabador cuando el usuario presiona el botón
 */

import AudioRecorder from '../voice-messages/audio-recorder.js';

class ChatBoxView extends ElementView {
    
    initialize () {
        super.initialize();
        this.listenTo(this.model, 'startVoiceRecording', this.showVoiceRecorder);
    }
    
    /**
     * Muestra el componente de grabación
     */
    showVoiceRecorder () {
        // Crear el grabador si no existe
        if (!this.voice_recorder) {
            this.voice_recorder = document.createElement('converse-audio-recorder');
            this.voice_recorder.maxDuration = api.settings.get('max_voice_message_duration');
            this.voice_recorder.bitrate = api.settings.get('voice_message_bitrate');
            
            // Escuchar el evento de grabación completada
            this.voice_recorder.addEventListener('recording-stopped', (e) => {
                this.handleRecordingCompleted(e.detail);
            });
            
            // Escuchar cancelación
            this.voice_recorder.addEventListener('recording-cancelled', () => {
                this.hideVoiceRecorder();
            });
            
            // Agregar al DOM (por ejemplo, en el área de mensajes)
            const messagesArea = this.querySelector('.chat-content');
            if (messagesArea) {
                messagesArea.insertBefore(
                    this.voice_recorder,
                    messagesArea.firstChild
                );
            }
        }
        
        // Hacer visible y dar foco
        this.voice_recorder.style.display = 'block';
        this.voice_recorder.focus();
    }
    
    /**
     * Oculta el grabador
     */
    hideVoiceRecorder () {
        if (this.voice_recorder) {
            this.voice_recorder.style.display = 'none';
        }
    }
    
    /**
     * Maneja el audio grabado
     */
    async handleRecordingCompleted ({ audioBlob, duration }) {
        try {
            // Enviar el mensaje de voz
            await this.model.sendVoiceMessage(audioBlob, duration);
            
            // Ocultar el grabador
            this.hideVoiceRecorder();
            
            // Anunciar éxito
            if (api.accessibility) {
                api.accessibility.announce(
                    __('Mensaje de voz enviado correctamente'),
                    'assertive'
                );
            }
        } catch (error) {
            console.error('Error al enviar mensaje de voz:', error);
            
            // Anunciar error
            if (api.accessibility) {
                api.accessibility.announce(
                    __('Error al enviar mensaje de voz'),
                    'assertive'
                );
            }
        }
    }
    
    /**
     * Template helpers para el toolbar
     */
    getToolbarOptions () {
        return {
            // ... opciones existentes ...
            enable_voice_messages: api.settings.get('enable_voice_messages'),
            voice_messages_supported: api.voice_messages?.isSupported(),
            startVoiceRecording: () => this.model.startVoiceRecording()
        };
    }
}


// =============================================================================
// 3. RENDERIZAR EL REPRODUCTOR EN MENSAJES
// =============================================================================

/**
 * En src/shared/chat/templates/message.js
 * Detectar mensajes de voz y usar el reproductor
 */

import { html } from 'lit';
import { __ } from 'i18n';

/**
 * Template para mensaje de voz
 */
export const tplVoiceMessage = (o) => {
    const oob_url = o.model.get('oob_url');
    const duration = o.model.get('voice_message_duration');
    const sender = o.model.get('sender') === 'me' ? __('Tú') : o.model.getDisplayName();
    
    return html`
        <div class="message-voice">
            <converse-audio-player
                src="${oob_url}"
                title="${__('Mensaje de voz de %1$s', sender)}"
            ></converse-audio-player>
            
            ${duration ? html`
                <div class="voice-message-meta">
                    <span class="voice-duration">
                        ${__('Duración')}: ${api.voice_messages.formatDuration(duration)}
                    </span>
                </div>
            ` : ''}
        </div>
    `;
};

/**
 * En el template principal del mensaje, agregar condición
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
                
                <!-- Contenido del mensaje -->
                <div class="message-content">
                    ${is_voice ? tplVoiceMessage(o) : tplMessageText(o)}
                </div>
                
                <!-- Timestamp, acciones, etc. -->
                ${tplMessageFooter(o)}
            </div>
        </article>
    `;
};


// =============================================================================
// 4. AGREGAR METADATA A MENSAJES DE VOZ
// =============================================================================

/**
 * En el modelo del ChatBox
 * Marcar mensajes de voz cuando se envíen
 */

class ChatBox extends Model {
    
    /**
     * Envía un mensaje de voz
     */
    async sendVoiceMessage (audioBlob, duration) {
        try {
            // Crear archivo
            const file = api.voice_messages.createAudioFile(audioBlob);
            
            // Crear mensaje stub para mostrar inmediatamente
            const message = this.messages.create({
                'from': _converse.bare_jid,
                'fullname': _converse.xmppstatus.get('fullname'),
                'sender': 'me',
                'time': (new Date()).toISOString(),
                'message': __('Enviando mensaje de voz...'),
                'is_voice_message': true,
                'voice_message_duration': duration,
                'type': 'chat'
            });
            
            // Enviar archivo
            await this.sendFiles([file]);
            
            // Actualizar mensaje con la URL una vez subido
            // (esto lo maneja el handler de XEP-0363)
            
            return message;
        } catch (error) {
            console.error('Error al enviar mensaje de voz:', error);
            throw error;
        }
    }
}


// =============================================================================
// 5. CONFIGURACIÓN EN CONVERSE.INITIALIZE
// =============================================================================

/**
 * Configuración recomendada al inicializar Converse
 */

converse.initialize({
    // ... configuración existente ...
    
    // Habilitar plugin de accesibilidad (requerido)
    enable_accessibility: true,
    
    // Habilitar mensajes de voz
    enable_voice_messages: true,
    
    // Duración máxima: 5 minutos
    max_voice_message_duration: 300,
    
    // Calidad de audio: 128 kbps
    voice_message_bitrate: 128000,
    
    // Formato preferido (se autodetecta el mejor soportado)
    voice_message_mime_type: 'audio/webm;codecs=opus',
    
    // Atajos de teclado
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
// 6. DETECTAR MENSAJES DE VOZ ENTRANTES
// =============================================================================

/**
 * En el handler de mensajes entrantes
 * Detectar y marcar mensajes de voz
 */

api.listen.on('messageAdded', (message) => {
    // Verificar si es un mensaje de voz por el OOB
    if (api.voice_messages.isVoiceMessage(message)) {
        message.set('is_voice_message', true);
        
        // Anunciar a usuarios de lectores de pantalla
        if (api.accessibility) {
            const sender = message.getDisplayName();
            api.accessibility.announce(
                __('Mensaje de voz recibido de %1$s', sender),
                'polite'
            );
        }
    }
});


// =============================================================================
// 7. EJEMPLO DE USO PROGRAMÁTICO
// =============================================================================

/**
 * Grabar y enviar mensaje de voz programáticamente
 */
async function sendProgrammaticVoiceMessage () {
    // Obtener el chatbox actual
    const jid = 'usuario@ejemplo.com';
    const chatbox = await api.chats.get(jid);
    
    // Crear el grabador
    const recorder = document.createElement('converse-audio-recorder');
    recorder.maxDuration = 60; // 1 minuto
    
    // Escuchar el resultado
    recorder.addEventListener('recording-stopped', async (e) => {
        const { audioBlob, duration } = e.detail;
        
        try {
            await chatbox.sendVoiceMessage(audioBlob, duration);
            console.log('Mensaje de voz enviado');
        } catch (error) {
            console.error('Error:', error);
        }
    });
    
    // Agregar al DOM temporalmente
    document.body.appendChild(recorder);
}

/**
 * Reproducir un mensaje de voz programáticamente
 */
function playVoiceMessage (messageModel) {
    const oob_url = messageModel.get('oob_url');
    
    if (!oob_url) {
        console.error('No hay URL de audio en el mensaje');
        return;
    }
    
    // Crear el reproductor
    const player = document.createElement('converse-audio-player');
    player.src = oob_url;
    player.title = 'Mensaje de voz';
    
    // Escuchar eventos
    player.addEventListener('ended', () => {
        console.log('Reproducción finalizada');
    });
    
    // Agregar al DOM
    const container = document.getElementById('audio-container');
    container.appendChild(player);
}

/**
 * Verificar soporte antes de mostrar UI
 */
function checkVoiceMessageSupport () {
    if (!api.voice_messages.isSupported()) {
        console.warn('Mensajes de voz no soportados en este navegador');
        
        // Ocultar botones de grabación
        document.querySelectorAll('.voice-message-button').forEach(btn => {
            btn.style.display = 'none';
        });
        
        // Mostrar mensaje al usuario
        alert(__('Tu navegador no soporta grabación de audio. ' +
                 'Actualiza a una versión más reciente.'));
        
        return false;
    }
    
    // Mostrar formatos soportados en consola
    console.log('Formatos de audio soportados:',
        api.voice_messages.getSupportedMimeTypes());
    
    return true;
}


// =============================================================================
// 8. ESTILOS PERSONALIZADOS (OPCIONAL)
// =============================================================================

/**
 * Personalizar los estilos de los componentes
 * En tu archivo CSS/SCSS principal
 */

/*
.audio-recorder {
    // Cambiar color de fondo
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    
    // Personalizar indicador de grabación
    .recording-indicator {
        background-color: #ff0000;
        box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
    }
}

.audio-player {
    // Estilo compacto
    padding: 0.5rem;
    
    // Personalizar botones
    .btn-player {
        background: #667eea;
        color: white;
        border: none;
        
        &:hover {
            background: #764ba2;
        }
    }
}

// Tema oscuro
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
