/**
 * @typedef {import('@converse/headless').MUCOccupant} MUCOccupant
 */
import { api } from '@converse/headless';
import { PRETTY_CHAT_STATUS } from '../constants.js';
import { __ } from 'i18n';
import { html } from "lit";
import { until } from 'lit/directives/until.js';
import { getAuthorStyle } from 'utils/color.js';
import { getUnreadMsgsDisplay } from 'shared/chat/utils.js';

const i18n_occupant_hint = /** @param {MUCOccupant} o */(o) => {
    return __('Click to mention %1$s in your message.', o.get('nick'));
}

let badges_definitions; // will be initialized at first call (to be sure that the __ function is correctly loaded).

/**
 * Inits badges definitions.
 * For short labels, it will use the label first letter. If there is ambigous short labels, it will try to add up to 4 letters.
 * Letters will be uppercase.
 */
function initBadgesDefinitions () {
    badges_definitions = {}
    badges_definitions['owner'] = {
        label: __('Owner'),
        classname: 'badge-groupchat'
    };
    badges_definitions['admin'] = {
        label: __('Admin'),
        classname: 'badge-info'
    };
    badges_definitions['member'] = {
        label: __('Member'),
        classname: 'badge-info'
    };
    badges_definitions['moderator'] = {
        label: __('Moderator'),
        classname: 'badge-info'
    };
    badges_definitions['visitor'] = {
        label: __('Visitor'),
        classname: 'badge-secondary'
    };

    // And now we must compute unique short labels.
    let seen;
    for (
        let current_length = 1;
        current_length < 5 && (!seen || Object.values(seen).find(count => count > 1));
        current_length++
    ) {
        const currently_seen = {}
        for (const definition of Object.values(badges_definitions)) {
            if (!seen || (seen[definition.shortlabel] ?? 0) >= 2) {
                // (first loop, or count >= 2 in the previous loop)
                definition.shortlabel = definition.label.substr(0, current_length).toLocaleUpperCase();
                currently_seen[definition.shortlabel]??= 0;
                currently_seen[definition.shortlabel]++;
            }
        }
        seen = currently_seen;
    }
}

/**
 * Badge template.
 * @param {string} badge_code The badge to use ('owner', 'admin', ...)
 */
function tplBadge (badge_code) {
    if (!badges_definitions) {
        initBadgesDefinitions();
    }
    const definition = badges_definitions[badge_code];
    if (!definition) { return ''; }

    return html`<span title="${definition.label}" aria-label=${definition.label}
        class="badge ${definition.classname ?? 'badge-info'}">${definition.shortlabel}</span>`;
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
    /**
     * *Hook* which allows plugins to add action buttons on occupants
     * @event _converse#getOccupantActionButtons
     * @example
     *  api.listen.on('getOccupantActionButtons', (el, buttons) => {
     *      buttons.push({
     *          'i18n_text': 'Foo',
     *          'handler': ev => alert('Foo!'),
     *          'button_class': 'chat-occupant__action-foo',
     *          'icon_class': 'fa fa-check',
     *          'name': 'foo'
     *      });
     *      return buttons;
     *  });
     */
    const buttons = await api.hook('getOccupantActionButtons', o, []);
    if (!buttons?.length) { return '' }

    const items = buttons.map(b => {
        return html`
        <button class="dropdown-item ${b.button_class}" @click=${b.handler} type="button">
            <converse-icon
                class="${b.icon_class}"
                color="var(--inverse-link-color)"
                size="1em"
                aria-hidden="true"
            ></converse-icon>&nbsp;${b.i18n_text}
        </button>`
    });

    return html`<converse-dropdown
        class="occupant-actions chatbox-btn"
        .items=${items}
    ></converse-dropdown>`;
}

/**
 * @param {import('../occupants').default} el
 * @param {MUCOccupant} o
 */
export default (el, o) => {
    const affiliation = o.get('affiliation');
    const hint_show = PRETTY_CHAT_STATUS[o.get('show')];
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

   const num_unread = getUnreadMsgsDisplay(o);

    return html`
        <li class="occupant" id="${o.id}">
            <div class="row g-0">
                <div class="col-auto">
                    <a @click=${(ev) => el.model.save({'sidebar_view': `occupant:${o.id}`})}>
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
                        ${ num_unread ? html`<span class="msgs-indicator badge">${ num_unread }</span>` : '' }
                    </a>
                </div>
                <div class="col occupant-nick-badge">
                    <span class="occupant-nick"
                          title="${occupant_title(o)}"
                          @click=${(ev) => el.onOccupantClicked(ev)}
                          style="${getAuthorStyle(o)}">${o.getDisplayName()}</span>
                    <span class="occupant-badges">
                        ${ (affiliation === "owner") ? tplBadge('owner') : '' }
                        ${ (affiliation === "admin") ? tplBadge('admin') : '' }
                        ${ (affiliation === "member") ? tplBadge('member') : '' }
                        ${ (role === "moderator") ? tplBadge('moderator') : '' }
                        ${ (role === "visitor") ? tplBadge('visitor')  : '' }
                    </span>
                    ${
                        until(tplActionButtons(o))
                    }
                </div>
            </div>
        </li>
    `;
}
