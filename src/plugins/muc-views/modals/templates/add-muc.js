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
        <div>
            <label for="nickname" class="form-label">${i18n_nickname}:</label>
            <input
                type="text"
                title="${i18n_required_field}"
                required="required"
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
    const muc_domain = el.model.get('muc_domain') || api.settings.get('muc_domain');

    let placeholder = '';
    if (!api.settings.get('locked_muc_domain')) {
        placeholder = muc_domain ? `name@${muc_domain}` : __('name@conference.example.org');
    }

    const label_room_address = muc_domain ? __('Groupchat name') : __('Groupchat address');
    const muc_roomid_policy_error_msg = el.muc_roomid_policy_error_msg;
    const muc_roomid_policy_hint = api.settings.get('muc_roomid_policy_hint');
    const muc_search_service = api.settings.get('muc_search_service');
    return html`
        <form class="converse-form add-chatroom" @submit=${(ev) => el.openChatRoom(ev)}>
            <div>
                <label for="chatroom" class="form-label">${label_room_address}:</label>
                ${muc_roomid_policy_error_msg
                    ? html`<label class="form-label roomid-policy-error">${muc_roomid_policy_error_msg}</label>`
                    : ''}
                ${muc_search_service
                    ? html` <converse-autocomplete
                          .getAutoCompleteList=${getAutoCompleteList}
                          ?autofocus=${true}
                          min_chars="3"
                          position="below"
                          placeholder="${placeholder}"
                          class="add-muc-autocomplete"
                          name="chatroom"
                      >
                      </converse-autocomplete>`
                    : ''}
            </div>
            ${muc_roomid_policy_hint
                ? html`<div>
                      ${unsafeHTML(DOMPurify.sanitize(muc_roomid_policy_hint, { 'ALLOWED_TAGS': ['b', 'br', 'em'] }))}
                  </div>`
                : ''}
            ${!api.settings.get('locked_muc_nickname') ? nickname_input() : ''}
            <input
                type="submit"
                class="btn btn-primary"
                name="join"
                value="${i18n_join || ''}"
                ?disabled="${muc_roomid_policy_error_msg}"
            />
        </form>
    `;
};
