import { html } from 'lit';
import { __ } from 'i18n';

/**
 * @param {import('../modals/profile').default} el
 */
export default (el) => {
    const i18n_away = __('Away');
    const i18n_busy = __('Busy');
    const i18n_online = __('Online');
    const i18n_save = __('Set status');
    const i18n_xa = __('Away for long');
    const placeholder_status_message = __('Personal status message');
    const status = el.model.get('show') || el.model.get('presence');
    const status_message = el.model.get('status_message');

    return html`<form
        class="converse-form set-xmpp-status"
        id="set-xmpp-status"
        @submit=${(ev) => el.onStatusFormSubmitted(ev)}
    >
        <div class="mb-3">
            <div class="form-check">
                <input
                    ?checked="${status === 'online'}"
                    type="radio"
                    id="radio-online"
                    value="online"
                    name="chat_status"
                    class="form-check-input"
                />
                <label class="form-check-label" for="radio-online">
                    <converse-icon size="1em" class="fa fa-circle chat-status chat-status--online"></converse-icon
                    >${i18n_online}
                </label>
            </div>
            <div class="form-check">
                <input
                    ?checked="${status === 'busy'}"
                    type="radio"
                    id="radio-busy"
                    value="dnd"
                    name="chat_status"
                    class="form-check-input"
                />
                <label class="form-check-label" for="radio-busy">
                    <converse-icon size="1em" class="fa fa-minus-circle chat-status chat-status--busy"></converse-icon
                    >${i18n_busy}
                </label>
            </div>
            <div class="form-check">
                <input
                    ?checked="${status === 'away'}"
                    type="radio"
                    id="radio-away"
                    value="away"
                    name="chat_status"
                    class="form-check-input"
                />
                <label class="form-check-label" for="radio-away">
                    <converse-icon size="1em" class="fa fa-circle chat-status chat-status--away"></converse-icon
                    >${i18n_away}
                </label>
            </div>
            <div class="form-check">
                <input
                    ?checked="${status === 'xa'}"
                    type="radio"
                    id="radio-xa"
                    value="xa"
                    name="chat_status"
                    class="form-check-input"
                />
                <label class="form-check-label" for="radio-xa">
                    <converse-icon size="1em" class="far fa-circle chat-status chat-status--xa"></converse-icon
                    >${i18n_xa}
                </label>
            </div>
        </div>
        <div class="mb-3">
            <div class="${el._show_clear_button ? 'input-group' : ''}">
                <input
                    name="status_message"
                    type="text"
                    class="form-control"
                    autofocus
                    value="${status_message || ''}"
                    placeholder="${placeholder_status_message}"
                    @input=${(ev) => (el._show_clear_button = !!ev.target.value)}
                />
                <button
                    type="button"
                    class="btn btn-outline-secondary"
                    @click=${(ev) => el.clearStatusMessage(ev)}
                    title="${__('Clear status message')}"
                    ?hidden="${!el._show_clear_button}"
                >
                    <converse-icon size="1em" class="fa fa-times"></converse-icon>
                </button>
            </div>
        </div>
        <button type="submit" class="btn btn-primary">${i18n_save}</button>
    </form>`;
};
