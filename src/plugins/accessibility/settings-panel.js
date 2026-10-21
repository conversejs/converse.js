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
            settings: { type: Object },
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
            enable_voice_messages: api.settings.get('enable_voice_messages'),
        };
        this.requestUpdate();
    }

    render() {
        return html`
            <div class="accessibility-settings">
                <div class="settings-header">
                    <h3>${__('Accessibility Settings')}</h3>
                    <p class="text-muted">${__('Customize the accessibility options to improve your experience')}</p>
                </div>

                <div class="settings-section">
                    <h4>${__('General features')}</h4>

                    <div class="form-check">
                        <input
                            type="checkbox"
                            class="form-check-input"
                            id="enable_accessibility"
                            ?checked=${this.settings.enable_accessibility}
                            @change=${(e) => this.updateSetting('enable_accessibility', e.target.checked)}
                        />
                        <label class="form-check-label" for="enable_accessibility">
                            <strong>${__('Enable accessibility')}</strong>
                            <small class="form-text text-muted"> ${__('Turns on all accessibility features')} </small>
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
                            <strong>${__('High contrast mode')}</strong>
                            <small class="form-text text-muted">
                                ${__('Improves visibility with high contrast colors')}
                            </small>
                        </label>
                    </div>
                </div>

                <div class="settings-section">
                    <h4>${__('Keyboard shortcuts')}</h4>

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
                            <strong>${__('Enable keyboard shortcuts')}</strong>
                            <small class="form-text text-muted">
                                ${__('Navigate quickly using the keyboard (Alt+Shift+M, Alt+Shift+C, etc.)')}
                            </small>
                        </label>
                    </div>

                    ${
                        this.settings.enable_keyboard_shortcuts
                            ? html`
                                  <div class="keyboard-shortcuts-info">
                                      <button
                                          type="button"
                                          class="btn btn-sm btn-outline-primary"
                                          @click=${() => this.showShortcutsModal()}
                                      >
                                          ${__('View all shortcuts')} (Alt+Shift+H)
                                      </button>
                                  </div>
                              `
                            : ''
                    }
                </div>

                <div class="settings-section">
                    <h4>${__('Screen readers')}</h4>

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
                            <strong>${__('Enable screen reader announcements')}</strong>
                            <small class="form-text text-muted">
                                ${__('Announces important events (NVDA, JAWS, VoiceOver, etc.)')}
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
                            <strong>${__('Announce new messages')}</strong>
                            <small class="form-text text-muted"> ${__('Reads incoming messages aloud')} </small>
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
                            <strong>${__('Announce status changes')}</strong>
                            <small class="form-text text-muted">
                                ${__('Announces when contacts change their status (online, offline, etc.)')}
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
                            <strong>${__('Focus new messages')}</strong>
                            <small class="form-text text-muted">
                                ${__('Automatically move focus to new messages')}
                            </small>
                        </label>
                    </div>
                </div>

                <div class="settings-section">
                    <h4>${__('Voice messages')}</h4>

                    <div class="form-check">
                        <input
                            type="checkbox"
                            class="form-check-input"
                            id="enable_voice_messages"
                            ?checked=${this.settings.enable_voice_messages}
                            @change=${(e) => this.updateSetting('enable_voice_messages', e.target.checked)}
                        />
                        <label class="form-check-label" for="enable_voice_messages">
                            <strong>${__('Enable voice messages')}</strong>
                            <small class="form-text text-muted">
                                ${__('Lets you record and send audio messages (Alt+Shift+V)')}
                            </small>
                        </label>
                    </div>

                    ${
                        this.settings.enable_voice_messages
                            ? html`
                                  <div class="voice-messages-info">
                                      <small class="form-text text-muted">
                                          <strong>${__('Shortcuts during recording:')}</strong><br />
                                          • Space: ${__('Pause/resume')}<br />
                                          • Enter: ${__('Stop and send')}<br />
                                          • Escape: ${__('Cancel')}<br /><br />
                                          <strong>${__('Shortcuts during playback:')}</strong><br />
                                          • Space/Enter: ${__('Play/pause')}<br />
                                          • ←/→: ${__('Skip back/forward')}<br />
                                          • Home/End: ${__('Jump to start/end')}
                                      </small>
                                  </div>
                              `
                            : ''
                    }
                </div>

                <div class="settings-footer">
                    <div class="alert alert-info" role="alert">
                        <strong>${__('💡 Tip:')}</strong>
                        ${__('Press Alt+Shift+H at any time to see all available shortcuts')}
                    </div>
                </div>
            </div>
        `;
    }

    updateSetting(key, value) {
        try {
            // Update the setting
            api.settings.set(key, value);

            // Update the local state
            this.settings[key] = value;
            this.requestUpdate();

            // Apply specific changes
            if (key === 'high_contrast_mode') {
                this.toggleHighContrast(value);
            }

            // Announce the change
            if (api.accessibility) {
                const setting_name = this.getSettingName(key);
                const status = value ? __('enabled') : __('disabled');
                api.accessibility.announce(__('%1$s %2$s', setting_name, status), 'polite');
            }

            // Save to localStorage for persistence
            localStorage.setItem(`converse-${key}`, JSON.stringify(value));
        } catch (error) {
            console.error('Error updating configuration:', error);
        }
    }

    getSettingName(key) {
        const names = {
            'enable_accessibility': __('Accessibility'),
            'enable_keyboard_shortcuts': __('Keyboard shortcuts'),
            'enable_screen_reader_announcements': __('Screen reader announcements'),
            'announce_new_messages': __('Announce new messages'),
            'announce_status_changes': __('Announce status changes'),
            'focus_on_new_message': __('Focus new messages'),
            'high_contrast_mode': __('High contrast mode'),
            'enable_voice_messages': __('Voice messages'),
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
