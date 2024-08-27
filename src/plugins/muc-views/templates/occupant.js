/**
 * @typedef {import('@converse/headless').MUCOccupant} MUCOccupant
 */
import { api } from '@converse/headless';
import { PRETTY_CHAT_STATUS } from '../constants.js';
import { __ } from 'i18n';
import { html } from "lit";
import { until } from 'lit/directives/until.js';
import { showOccupantModal } from '../utils.js';
import { getAuthorStyle } from 'utils/color.js';

const i18n_occupant_hint = /** @param {MUCOccupant} o */(o) => {
    return __('Click to mention %1$s in your message.', o.get('nick'));
}

const occupant_title = /** @param {MUCOccupant} o */(o) => {
    const role = o.get('role');
    const hint_occupant = i18n_occupant_hint(o);
    const i18n_moderator_hint = __('This user is a moderator.');
    const i18n_participant_hint = __('This user can send messages in this groupchat.');
    const i18n_visitor_hint = __('This user can NOT send messages in this groupchat.')
    const spaced_jid = o.get('jid') ? `${o.get('jid')} ` : '';
    if (role === "moderator") {
        return `${spaced_jid}${i18n_moderator_hint} ${hint_occupant}`;
    } else if (role === "participant") {
        return `${spaced_jid}${i18n_participant_hint} ${hint_occupant}`;
    } else if (role === "visitor") {
        return `${spaced_jid}${i18n_visitor_hint} ${hint_occupant}`;
    } else if (!["visitor", "participant", "moderator"].includes(role)) {
        return `${spaced_jid}${hint_occupant}`;
    }
}

/**
 * @param {MUCOccupant} o
 */
async function tplActionButtons (o) {
    const buttons = await api.hook('getOccupantActionButtons', o, []);
    if (!buttons?.length) { return '' }

    const items = buttons.map(b => {
        return html`
        <button class="dropdown-item ${b.button_class}" @click=${b.handler}>
            <converse-icon
                class="${b.icon_class}"
                color="var(--inverse-link-color)"
                size="1em"
            ></converse-icon>&nbsp;${b.i18n_text}
        </button>`
    });

    if (!items.length) {
        return ''
    }

    return html`<converse-dropdown
        class="occupant-actions chatbox-btn"
        .items=${items}
    ></converse-dropdown>`;
}

/**
 * @param {MUCOccupant} o
 * @param {Object} chat
 */
export default (o, chat) => {
    const affiliation = o.get('affiliation');
    const hint_show = PRETTY_CHAT_STATUS[o.get('show')];
    const i18n_admin = __('Admin');
    const i18n_member = __('Member');
    const i18n_moderator = __('Moderator');
    const i18n_owner = __('Owner');
    const i18n_visitor = __('Visitor');
    const role = o.get('role');

    const show = o.get('show');
    let classes, color;
    if (show === 'online') {
        [classes, color] = ['fa fa-circle', 'chat-status-online'];
    } else if (show === 'dnd') {
        [classes, color] =  ['fa fa-minus-circle', 'chat-status-busy'];
    } else if (show === 'away') {
        [classes, color] =  ['fa fa-circle', 'chat-status-away'];
    } else {
        [classes, color] = ['fa fa-circle', 'subdued-color'];
    }

    return html`
        <li class="occupant" id="${o.id}">
            <div class="row g-0">
                <div class="col-auto">
                    <a class="show-msg-author-modal" @click=${(ev) => showOccupantModal(ev, o)}>
                        <converse-avatar
                            .model=${o}
                            class="avatar chat-msg__avatar"
                            name="${o.getDisplayName()}"
                            nonce=${o.vcard?.get('vcard_updated')}
                            height="30" width="30"></converse-avatar>
                        <converse-icon
                           title="${hint_show}"
                           color="var(--${color})"
                           style="margin-top: -0.1em"
                           size="0.82em"
                           class="${classes} chat-status chat-status--avatar"></converse-icon>
                    </a>
                </div>
                <div class="col occupant-nick-badge">
                    <span class="occupant-nick"
                          title="${occupant_title(o)}"
                          @click=${chat.onOccupantClicked}
                          style="${getAuthorStyle(o)}">${o.getDisplayName()}</span>
                    <span class="occupant-badges">
                        ${ (affiliation === "owner") ? html`<span class="badge badge-groupchat">${i18n_owner}</span>` : '' }
                        ${ (affiliation === "admin") ? html`<span class="badge badge-info">${i18n_admin}</span>` : '' }
                        ${ (affiliation === "member") ? html`<span class="badge badge-info">${i18n_member}</span>` : '' }
                        ${ (role === "moderator") ? html`<span class="badge badge-info">${i18n_moderator}</span>` : '' }
                        ${ (role === "visitor") ? html`<span class="badge badge-secondary">${i18n_visitor}</span>`  : '' }
                    </span>
                    ${
                        until(tplActionButtons(o))
                    }
                </div>
            </div>
        </li>
    `;
}
