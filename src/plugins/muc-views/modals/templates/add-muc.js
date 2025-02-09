import DOMPurify from 'dompurify';
import { _converse, api } from '@converse/headless';
import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { getAutoCompleteList } from '../../search.js';
import { __ } from 'i18n';

const nickname_input = () => {
    const i18n_nickname = __('Nickname');
    const i18n_required_field = __('This field is required');
    return html`
        <div class="mb-3">
            <label for="nickname" class="form-label">${i18n_nickname}:</label>
            <input
                type="text"
                title="${i18n_required_field}"
                required
                name="nickname"
                value="${_converse.exports.getDefaultMUCNickname() || ''}"
                class="form-control"
            />
        </div>
    `;
};

/**
 * @param {import('../add-muc.js').default} el
 */
export default (el) => {
    const i18n_join = __('Join');
    const muc_domain = api.settings.get('muc_domain');

    let placeholder = '';
    let label_name;
    if (api.settings.get('locked_muc_domain')) {
        label_name = __('Groupchat name');
    } else {
        placeholder = muc_domain ? `name@${muc_domain}` : __('name@conference.example.org');
        label_name = __('Groupchat name or address');
    }

    const policy_hint = api.settings.get('muc_roomid_policy_hint');
    const muc_search_service = api.settings.get('muc_search_service');

    return html` <form
        class="converse-form add-chatroom needs-validation"
        @submit=${(ev) => el.openChatRoom(ev)}
        novalidate
    >
        <div class="mb-3">
            <label for="chatroom" class="form-label">${label_name}:</label>
            <div class="input-group">
                ${muc_search_service
                    ? html` <converse-autocomplete
                          .getAutoCompleteList="${getAutoCompleteList}"
                          .validate="${/** @param {string} v */ (v) => el.validateMUCJID(v)}"
                          ?autofocus="${true}"
                          class="add-muc-autocomplete"
                          min_chars="3"
                          name="chatroom"
                          placeholder="${placeholder}"
                          position="below"
                          required
                      ></converse-autocomplete>`
                    : ''}
            </div>
            ${policy_hint
                ? html`<div class="mb-3">
                      ${unsafeHTML(DOMPurify.sanitize(policy_hint, { 'ALLOWED_TAGS': ['b', 'br', 'em'] }))}
                  </div>`
                : ''}
        </div>
        ${!api.settings.get('locked_muc_nickname') ? nickname_input() : ''}
        <input type="submit" class="btn btn-primary mt-3" name="join" value="${i18n_join || ''}" />
    </form>`;
};
