/**
 * Accessibility configuration panel for the settings modal
 */
import { CustomElement } from 'shared/components/element.js';
import { api } from '@converse/headless';
import { html } from 'lit';
import { __ } from 'i18n';

import './styles/accessibility-settings.scss';

export default class AccessibilitySettings extends CustomElement {
    
    static get properties() {
        return {
            settings: { type: Object }
        };
    }

    constructor() {
        super();
        this.settings = {};
    }

    connectedCallback() {
        super.connectedCallback();
        this.loadSettings();
    }

    loadSettings() {
        this.settings = {
            enable_accessibility: api.settings.get('enable_accessibility'),
            enable_keyboard_shortcuts: api.settings.get('enable_keyboard_shortcuts'),
            enable_screen_reader_announcements: api.settings.get('enable_screen_reader_announcements'),
            announce_new_messages: api.settings.get('announce_new_messages'),
            announce_status_changes: api.settings.get('announce_status_changes'),
            focus_on_new_message: api.settings.get('focus_on_new_message'),
            high_contrast_mode: api.settings.get('high_contrast_mode'),
            enable_voice_messages: api.settings.get('enable_voice_messages')
        };
        this.requestUpdate();
    }

    render() {
        return html`
            <div class="accessibility-settings">
                <div class="settings-header">
                    <h3>${__('Accessibility Settings')}</h3>
                    <p class="text-muted">
                        ${__('Personaliza las opciones de accesibilidad para mejorar tu experiencia')}
                    </p>
                </div>

                <div class="settings-section">
                    <h4>${__('Funciones Generales')}</h4>
                    
                    <div class="form-check">
                        <input 
                            type="checkbox" 
                            class="form-check-input" 
                            id="enable_accessibility"
                            ?checked=${this.settings.enable_accessibility}
                            @change=${(e) => this.updateSetting('enable_accessibility', e.target.checked)}
                        />
                        <label class="form-check-label" for="enable_accessibility">
                            <strong>${__('Habilitar accesibilidad')}</strong>
                            <small class="form-text text-muted">
                                ${__('Activa todas las funciones de accesibilidad')}
                            </small>
                        </label>
                    </div>

                    <div class="form-check">
                        <input 
                            type="checkbox" 
                            class="form-check-input" 
                            id="high_contrast_mode"
                            ?checked=${this.settings.high_contrast_mode}
                            ?disabled=${!this.settings.enable_accessibility}
                            @change=${(e) => this.updateSetting('high_contrast_mode', e.target.checked)}
                        />
                        <label class="form-check-label" for="high_contrast_mode">
                            <strong>${__('Modo de alto contraste')}</strong>
                            <small class="form-text text-muted">
                                ${__('Mejora la visibilidad con colores de alto contraste')}
                            </small>
                        </label>
                    </div>
                </div>

                <div class="settings-section">
                    <h4>${__('Atajos de Teclado')}</h4>
                    
                    <div class="form-check">
                        <input 
                            type="checkbox" 
                            class="form-check-input" 
                            id="enable_keyboard_shortcuts"
                            ?checked=${this.settings.enable_keyboard_shortcuts}
                            ?disabled=${!this.settings.enable_accessibility}
                            @change=${(e) => this.updateSetting('enable_keyboard_shortcuts', e.target.checked)}
                        />
                        <label class="form-check-label" for="enable_keyboard_shortcuts">
                            <strong>${__('Habilitar atajos de teclado')}</strong>
                            <small class="form-text text-muted">
                                ${__('Navigate quickly using the keyboard (Alt+Shift+M, Alt+Shift+C, etc.)')}
                            </small>
                        </label>
                    </div>

                    ${this.settings.enable_keyboard_shortcuts ? html`
                        <div class="keyboard-shortcuts-info">
                            <button 
                                type="button" 
                                class="btn btn-sm btn-outline-primary"
                                @click=${() => this.showShortcutsModal()}
                            >
                                ${__('Ver todos los atajos')} (Alt+Shift+?)
                            </button>
                        </div>
                    ` : ''}
                </div>

                <div class="settings-section">
                    <h4>${__('Lectores de Pantalla')}</h4>
                    
                    <div class="form-check">
                        <input 
                            type="checkbox" 
                            class="form-check-input" 
                            id="enable_screen_reader_announcements"
                            ?checked=${this.settings.enable_screen_reader_announcements}
                            ?disabled=${!this.settings.enable_accessibility}
                            @change=${(e) => this.updateSetting('enable_screen_reader_announcements', e.target.checked)}
                        />
                        <label class="form-check-label" for="enable_screen_reader_announcements">
                            <strong>${__('Habilitar anuncios de lector de pantalla')}</strong>
                            <small class="form-text text-muted">
                                ${__('Anuncia eventos importantes (NVDA, JAWS, VoiceOver, etc.)')}
                            </small>
                        </label>
                    </div>

                    <div class="form-check">
                        <input 
                            type="checkbox" 
                            class="form-check-input" 
                            id="announce_new_messages"
                            ?checked=${this.settings.announce_new_messages}
                            ?disabled=${!this.settings.enable_screen_reader_announcements}
                            @change=${(e) => this.updateSetting('announce_new_messages', e.target.checked)}
                        />
                        <label class="form-check-label" for="announce_new_messages">
                            <strong>${__('Anunciar mensajes nuevos')}</strong>
                            <small class="form-text text-muted">
                                ${__('Lee en voz alta los mensajes entrantes')}
                            </small>
                        </label>
                    </div>

                    <div class="form-check">
                        <input 
                            type="checkbox" 
                            class="form-check-input" 
                            id="announce_status_changes"
                            ?checked=${this.settings.announce_status_changes}
                            ?disabled=${!this.settings.enable_screen_reader_announcements}
                            @change=${(e) => this.updateSetting('announce_status_changes', e.target.checked)}
                        />
                        <label class="form-check-label" for="announce_status_changes">
                            <strong>${__('Anunciar cambios de estado')}</strong>
                            <small class="form-text text-muted">
                                ${__('Anuncia cuando contactos cambian su estado (online, offline, etc.)')}
                            </small>
                        </label>
                    </div>

                    <div class="form-check">
                        <input 
                            type="checkbox" 
                            class="form-check-input" 
                            id="focus_on_new_message"
                            ?checked=${this.settings.focus_on_new_message}
                            ?disabled=${!this.settings.enable_accessibility}
                            @change=${(e) => this.updateSetting('focus_on_new_message', e.target.checked)}
                        />
                        <label class="form-check-label" for="focus_on_new_message">
                            <strong>${__('Enfocar mensajes nuevos')}</strong>
                            <small class="form-text text-muted">
                                ${__('Automatically move focus to new messages')}
                            </small>
                        </label>
                    </div>
                </div>

                <div class="settings-section">
                    <h4>${__('Mensajes de Voz')}</h4>
                    
                    <div class="form-check">
                        <input 
                            type="checkbox" 
                            class="form-check-input" 
                            id="enable_voice_messages"
                            ?checked=${this.settings.enable_voice_messages}
                            @change=${(e) => this.updateSetting('enable_voice_messages', e.target.checked)}
                        />
                        <label class="form-check-label" for="enable_voice_messages">
                            <strong>${__('Habilitar mensajes de voz')}</strong>
                            <small class="form-text text-muted">
                                ${__('Permite grabar y enviar mensajes de audio (Alt+Shift+V)')}
                            </small>
                        </label>
                    </div>

                    ${this.settings.enable_voice_messages ? html`
                        <div class="voice-messages-info">
                            <small class="form-text text-muted">
                                <strong>${__('Shortcuts during recording:')}</strong><br/>
                                • Space: ${__('Pausar/reanudar')}<br/>
                                • Enter: ${__('Detener y enviar')}<br/>
                                • Escape: ${__('Cancelar')}<br/><br/>
                                <strong>${__('Shortcuts during playback:')}</strong><br/>
                                • k: ${__('Play/pause')}<br/>
                                • j/l: ${__('Retroceder/adelantar 10s')}<br/>
                                • ←/→: ${__('Retroceder/adelantar 5s')}
                            </small>
                        </div>
                    ` : ''}
                </div>

                <div class="settings-footer">
                    <div class="alert alert-info" role="alert">
                        <strong>${__('💡 Consejo:')}</strong>
                        ${__('Presiona Alt+Shift+? en cualquier momento para ver todos los atajos disponibles')}
                    </div>
                </div>
            </div>
        `;
    }

    updateSetting(key, value) {
        try {
            // Actualizar el setting
            api.settings.set(key, value);
            
            // Actualizar el estado local
            this.settings[key] = value;
            this.requestUpdate();
            
            // Apply specific changes
            if (key === 'high_contrast_mode') {
                this.toggleHighContrast(value);
            }
            
            // Anunciar el cambio
            if (api.accessibility) {
                const setting_name = this.getSettingName(key);
                const status = value ? __('activado') : __('desactivado');
                api.accessibility.announce(
                    __('%1$s %2$s', setting_name, status),
                    'polite'
                );
            }
            
            // Guardar en localStorage para persistencia
            localStorage.setItem(`converse-${key}`, JSON.stringify(value));
            
        } catch (error) {
            console.error('Error updating configuration:', error);
        }
    }

    getSettingName(key) {
        const names = {
            'enable_accessibility': __('Accesibilidad'),
            'enable_keyboard_shortcuts': __('Atajos de teclado'),
            'enable_screen_reader_announcements': __('Anuncios de lector de pantalla'),
            'announce_new_messages': __('Anunciar mensajes nuevos'),
            'announce_status_changes': __('Anunciar cambios de estado'),
            'focus_on_new_message': __('Enfocar mensajes nuevos'),
            'high_contrast_mode': __('Modo de alto contraste'),
            'enable_voice_messages': __('Mensajes de voz')
        };
        return names[key] || key;
    }

    toggleHighContrast(enabled) {
        if (enabled) {
            document.body.classList.add('converse-high-contrast');
        } else {
            document.body.classList.remove('converse-high-contrast');
        }
    }

    showShortcutsModal() {
        if (api.accessibility && api.accessibility.showShortcutsModal) {
            api.accessibility.showShortcutsModal();
        }
    }
}

api.elements.define('converse-accessibility-settings', AccessibilitySettings);
