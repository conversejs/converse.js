import tpl_new_day from "./templates/new-day.js";
import { _converse, api, converse } from '@converse/headless/core';

const { dayjs } = converse.env;

export function onScrolledDown (model) {
    if (!model.isHidden()) {
        if (api.settings.get('allow_url_history_change')) {
            // Clear location hash if set to one of the messages in our history
            const hash = window.location.hash;
            hash && model.messages.get(hash.slice(1)) && _converse.router.history.navigate();
        }
    }
}

/**
 * Given a message object, returns a TemplateResult indicating a new day if
 * the passed in message is more than a day later than its predecessor.
 * @param { _converse.Message }
 */
export function getDayIndicator (message) {
    const messages = message.collection?.models;
    if (!messages) {
        return;
    }
    const idx = messages.indexOf(message);
    const prev_message =  messages[idx-1];
    if (!prev_message || dayjs(message.get('time')).isAfter(dayjs(prev_message.get('time')), 'day')) {
        const day_date = dayjs(message.get('time')).startOf('day');
        return tpl_new_day({
            'type': 'date',
            'time': day_date.toISOString(),
            'datestring': day_date.format("dddd MMM Do YYYY")
        });
    }
}

export function getHats (message) {
    if (message.get('type') === 'groupchat') {
        const allowed_hats = api.settings.get('muc_hats').filter(hat => hat).map((hat) => (hat.toLowerCase()));
        let vcard_roles = []
        if (allowed_hats.includes('vcard_roles')) {
            vcard_roles = message.vcard ? message.vcard.get('role') : null;
            vcard_roles = vcard_roles ? vcard_roles.split(',').filter(hat => hat).map((hat) => ({title: hat})) : [];
        }
        const muc_role = message.occupant ? [message.occupant.get('role')] : [];
        const muc_affiliation = message.occupant ? [message.occupant.get('affiliation')] : [];

        const affiliation_role_hats = [...muc_role, ...muc_affiliation]
            .filter(hat => hat).filter((hat) => (allowed_hats.includes(hat.toLowerCase())))
            .map((hat) => ({title: hat}));
        const hats = allowed_hats.includes('xep317') ? message.occupant?.get('hats') || [] : [];
        return [...hats, ...vcard_roles, ...affiliation_role_hats];
    }
    return [];
}
