import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';
import { pick } from "lodash";
import converse from "@converse/headless/converse-core";
import tpl_occupant from "./occupant.js";

const PRETTY_CHAT_STATUS = {
    'offline':      'Offline',
    'unavailable':  'Unavailable',
    'xa':           'Extended Away',
    'away':         'Away',
    'dnd':          'Do not disturb',
    'chat':         'Chattty',
    'online':       'Online'
};

const occupant_hint = (occupant) => __('Click to mention %1$s in your message.', occupant.get('nick'))

const i18n_archived = __('Message archiving');
const i18n_archived_hint = __('Messages are archived on the server');
const i18n_features = __('Features');
const i18n_hidden = __('Hidden');
const i18n_members_only = __('Members only');
const i18n_members_only_hint = __('this groupchat is restricted to members only');
const i18n_moderated = __('Moderated');
const i18n_moderated_hint = __('Participants entering this groupchat need to request permission to write');
const i18n_no_password = __('No password');
const i18n_no_password_hint = __('This groupchat does not require a password upon entry');
const i18n_non_anon_hint = __('All other groupchat participants can see your XMPP address');
const i18n_not_anon = __('Not anonymous');
const i18n_not_moderated = __('Not moderated');
const i18n_not_searchable_hint = __('This groupchat is not publicly searchable');
const i18n_open = __('Open');
const i18n_open_hint = __('Anyone can join this groupchat');
const i18n_password = __('Password protected')
const i18n_password_hint = __('This groupchat requires a password before entry');
const i18n_persistent = __('Persistent');
const i18n_persistent_hint = __('This groupchat persists even if it\'s unoccupied');
const i18n_public =  __('Public');
const i18n_searchable_hint = __('This groupchat is publicly searchable');
const i18n_semi_anon = __('Semi-anonymous');
const i18n_semi_anon_hint = __('Only moderators can see your XMPP address');
const i18n_temporary = __('Temporary');
const i18n_temporary_hint = __('This groupchat will disappear once the last person leaves');
const i18n_unmoderated_hint = __('Participants entering this groupchat can write right away');


function renderFeatures (o) {
    const picks = pick(o.features.attributes, converse.ROOM_FEATURES);
    const iteratee = (a, v) => a || v;
    if (Object.values(picks).reduce(iteratee)) {
        return tpl_features(o.features.toJSON());
    } else {
        return '';
    }
}


const tpl_features = (o) => html`
    <div class="chatroom-features">
        <p class="occupants-heading">${i18n_features}</p>
        <ul class="features-list">
            ${ (o.passwordprotected) ? html`<li class="feature" title="${ i18n_password_hint }"><span class="fa fa-lock"></span>${ i18n_password }</li>` : '' }
            ${ (o.unsecured) ? html`<li class="feature" title="${ i18n_no_password_hint }"><span class="fa fa-unlock"></span>${ i18n_no_password }</li>` : '' }
            ${ (o.hidden) ? html`<li class="feature" title="${ i18n_not_searchable_hint }"><span class="fa fa-eye-slash"></span>${ i18n_hidden }</li>` : '' }
            ${ (o.public_room) ? html`<li class="feature" title="${ i18n_searchable_hint }"><span class="fa fa-eye"></span>${ i18n_public }</li>` : '' }
            ${ (o.membersonly) ? html`<li class="feature" title="${ i18n_members_only_hint }"><span class="fa fa-address-book"></span>${ i18n_members_only }</li>` : '' }
            ${ (o.open) ? html`<li class="feature" title="${ i18n_open_hint }"><span class="fa fa-globe"></span>${ i18n_open }</li>` : '' }
            ${ (o.persistent) ? html`<li class="feature" title="${ i18n_persistent_hint }"><span class="fa fa-save"></span>${ i18n_persistent }</li>` : '' }
            ${ (o.temporary) ? html`<li class="feature" title="${ i18n_temporary_hint }"><span class="fa fa-snowflake"></span>${ i18n_temporary }</li>` : '' }
            ${ (o.nonanonymous) ? html`<li class="feature" title="${ i18n_non_anon_hint }"><span class="fa fa-id-card"></span>${ i18n_not_anon }</li>` : '' }
            ${ (o.semianonymous) ? html`<li class="feature" title="${ i18n_semi_anon_hint }"><span class="fa fa-user-secret"></span>${ i18n_semi_anon }</li>` : '' }
            ${ (o.moderated) ? html`<li class="feature" title="${ i18n_moderated_hint }"><span class="fa fa-gavel"></span>${ i18n_moderated }</li>` : '' }
            ${ (o.unmoderated) ? html`<li class="feature" title="${ i18n_unmoderated_hint }"><span class="fa fa-info-circle"></span>${ i18n_not_moderated }</li>` : '' }
            ${ (o.mam_enabled) ? html`<li class="feature" title="${ i18n_archived_hint }"><span class="fa fa-database"></span>${ i18n_archived }</li>` : '' }
        </ul>
    </div>
`;


export default (o) => html`
    <div class="occupants-header">
        <i class="hide-occupants fa fa-times"></i>
        <p class="occupants-heading">${o.label_occupants}</p>
    </div>
    <div class="dragresize dragresize-occupants-left"></div>
    <ul class="occupant-list">
        ${ o.occupants.map(occupant => {
            return tpl_occupant(
                    Object.assign({
                        'jid': '',
                        'hint_show': PRETTY_CHAT_STATUS[occupant.get('show')],
                        'hint_occupant': occupant_hint(occupant)
                    }, occupant.toJSON())
                );
        }) }
    </ul>
    ${ renderFeatures(o) }
`;
