import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';


const i18n_moderator_hint = __('This user is a moderator.');
const i18n_participant_hint = __('This user can send messages in this groupchat.');
const i18n_visitor_hint = __('This user can NOT send messages in this groupchat.')
const i18n_owner = __('Owner');
const i18n_admin = __('Admin');
const i18n_member = __('Member');
const i18n_moderator = __('Moderator');
const i18n_visitor = __('Visitor');

const occupant_title = (o) => {
    if (o.role === "moderator") {
        return `${o.jid} ${i18n_moderator_hint} ${o.hint_occupant}`;
    } else if (o.role === "participant") {
        return `${o.jid} ${i18n_participant_hint} ${o.hint_occupant}`;
    } else if (o.role === "visitor") {
        return `${o.jid} ${i18n_visitor_hint} ${o.hint_occupant}`;
    } else if (!["visitor", "participant", "moderator"].includes(o.role)) {
        return `${o.jid} ${o.hint_occupant}`;
    }
}


export default (o) => html`
    <li class="occupant" id="${o.id}" title="${occupant_title(o)}">
        <div class="row no-gutters">
            <div class="col-auto">
                <div class="occupant-status occupant-${o.show} circle" title="${o.hint_show}"></div>
            </div>
            <div class="col occupant-nick-badge">
                <span class="occupant-nick">${o.nick || o.jid}</span>
                <span class="occupant-badges">
                    ${ (o.affiliation === "owner") ? html`<span class="badge badge-groupchat">${i18n_owner}</span>` : '' }
                    ${ (o.affiliation === "admin") ? html`<span class="badge badge-info">${i18n_admin}</span>` : '' }
                    ${ (o.affiliation === "member") ? html`<span class="badge badge-info">${i18n_member}</span>` : '' }
                    ${ (o.role === "moderator") ? html`<span class="badge badge-info">${i18n_moderator}</span>` : '' }
                    ${ (o.role === "visitor") ? html`<span class="badge badge-secondary">${i18n_visitor}</span>`  : '' }
                </span>
            </div>
        </div>
    </li>
`;
