import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';
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

const i18n_occupant_hint = (occupant) => __('Click to mention %1$s in your message.', occupant.get('nick'))
const i18n_participants = __('Participants');


export default (o) => html`
    <div class="occupants-header">
        <i class="hide-occupants fa fa-times"></i>
        <div class="occupants-header--title">
            <span class="occupants-heading">${i18n_participants}</span>
        </div>
    </div>
    <div class="dragresize dragresize-occupants-left"></div>
    <ul class="occupant-list">
        ${ o.occupants.map(occupant => {
            return tpl_occupant(
                    Object.assign({
                        'jid': '',
                        'hint_show': PRETTY_CHAT_STATUS[occupant.get('show')],
                        'hint_occupant': i18n_occupant_hint(occupant)
                    }, occupant.toJSON())
                );
        }) }
    </ul>
`;
