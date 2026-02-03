/**
 * @typedef {import('../../plugins/muc/message').default} MUCMessage
 * @typedef {import('../../plugins/status/profile').default} Profile
 * @typedef {import('../../plugins/vcard/vcards').default} VCards
 * @typedef {import('../../plugins/vcard/vcard').default} VCard
 * @typedef {import('../../shared/model-with-contact.js').default} ModelWithContact
 * @typedef {import('../muc/occupant.js').default} MUCOccupant
 * @typedef {import('@converse/skeletor').Model} Model
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '@converse/log';
import { shouldClearCache } from '../../utils/session.js';
import { isElement } from '../../utils/html.js';
import { parseErrorStanza } from '../../shared/parsers.js';
import {parseVCardResultStanza} from './parsers.js';

const { Strophe, $iq, sizzle, stx } = converse.env;

Strophe.addNamespace('VCARD_UPDATE', 'vcard-temp:x:update');

/**
 * @param {"get"|"set"|"result"} type
 * @param {string} jid
 * @param {Element} [vcard_el]
 */
export function createStanza(type, jid, vcard_el) {
    const iq = $iq(jid ? { 'type': type, 'to': jid } : { 'type': type });
    if (!vcard_el) {
        iq.c('vCard', { 'xmlns': Strophe.NS.VCARD });
    } else {
        iq.cnode(vcard_el);
    }
    return iq;
}

/**
 * @param {MUCOccupant} occupant
 */
export function onOccupantAvatarChanged(occupant) {
    const hash = occupant.get('image_hash');
    const vcards = [];
    if (occupant.get('jid')) {
        vcards.push(_converse.state.vcards.get(occupant.get('jid')));
    }
    vcards.push(_converse.state.vcards.get(occupant.get('from')));
    vcards.forEach((v) => hash && v && v?.get('image_hash') !== hash && api.vcard.update(v, true));
}

/**
 * @param {Model|MUCOccupant|MUCMessage} model
 * @param {boolean} [lazy_load=false]
 * @returns {Promise<VCard|null>}
 */
export async function getVCardForModel(model, lazy_load = false) {
    await api.waitUntil('VCardsInitialized');

    let vcard;
    if (model instanceof _converse.exports.MUCOccupant) {
        vcard = await getVCardForOccupant(/** @type {MUCOccupant} */ (model), lazy_load);
    } else if (model instanceof _converse.exports.MUCMessage) {
        vcard = await getVCardForMUCMessage(/** @type {MUCMessage} */ (model), lazy_load);
    } else {
        let jid;
        if (model instanceof _converse.exports.Message) {
            if (['error', 'info'].includes(model.get('type'))) {
                return;
            }
            jid = Strophe.getBareJidFromJid(model.get('from'));
        } else {
            jid = model.get('jid');
        }

        if (!jid) {
            log.warn(`Could not set VCard on model because no JID found!`);
            return null;
        }
        const { vcards } = _converse.state;
        vcard = vcards.get(jid) || vcards.create({ jid }, { lazy_load });
    }

    if (vcard) {
        vcard.on('change', () => model.trigger('vcard:change'));
    }
    return vcard;
}

/**
 * @param {MUCOccupant} occupant
 * @param {boolean} [lazy_load=false]
 * @returns {Promise<VCard|null>}
 */
export async function getVCardForOccupant(occupant, lazy_load = true) {
    await api.waitUntil('VCardsInitialized');

    const { vcards, profile } = _converse.state;
    const muc = occupant?.collection?.chatroom;
    const nick = occupant.get('nick');

    if (nick && muc?.get('nick') === nick) {
        return profile.vcard;
    } else {
        const jid = occupant.get('jid') || occupant.get('from');
        if (jid) {
            return vcards.get(jid) || vcards.create({ jid }, { lazy_load });
        } else {
            log.debug(`Could not get VCard for occupant because no JID found!`);
            return null;
        }
    }
}

/**
 * @param {MUCMessage} message
 * @param {boolean} [lazy_load=true]
 * @returns {Promise<VCard|null>}
 */
async function getVCardForMUCMessage(message, lazy_load = true) {
    if (['error', 'info'].includes(message.get('type'))) return;

    await api.waitUntil('VCardsInitialized');
    const { vcards, profile } = _converse.state;
    const muc = message?.collection?.chatbox;
    const nick = Strophe.getResourceFromJid(message.get('from'));

    if (nick && muc?.get('nick') === nick) {
        return profile.vcard;
    } else {
        const jid = message.occupant?.get('jid') || message.get('from');
        if (jid) {
            return vcards.get(jid) || vcards.create({ jid }, { lazy_load });
        } else {
            log.warn(`Could not get VCard for message because no JID found! msgid: ${message.get('msgid')}`);
            return null;
        }
    }
}

export function clearVCardsSession() {
    if (shouldClearCache(_converse)) {
        api.promises.add('VCardsInitialized');
        if (_converse.state.vcards) {
            _converse.state.vcards.clearStore();
            Object.assign(_converse, { vcards: undefined }); // XXX DEPRECATED
            delete _converse.state.vcards;
        }
    }
}

/**
 * @param {string} jid
 */
export async function fetchVCard(jid) {
    const bare_jid = _converse.session.get('bare_jid');
    const to = Strophe.getBareJidFromJid(jid) === bare_jid ? null : jid;
    let iq;
    try {
        iq = await api.sendIQ(createStanza('get', to));
    } catch (error) {
        const parsed_error = isElement(error) ? await parseErrorStanza(error) : error;
        const error_msg = parsed_error?.message;
        return {
            jid,
            stanza: isElement(error) ? error : null, // TODO: remove?
            error: error_msg,
            vcard_error: new Date().toISOString(),
        };
    }
    return parseVCardResultStanza(iq);
}

/**
 * @param {Element} pres
 */
async function handleVCardUpdatePresence(pres) {
    await api.waitUntil('VCardsInitialized');
    const photo = sizzle(`x[xmlns="${Strophe.NS.VCARD_UPDATE}"] photo`, pres).pop();
    if (photo) {
        const avatar_hash = photo.textContent;
        const from_jid = Strophe.getBareJidFromJid(pres.getAttribute('from'));
        const vcard = await _converse.state.vcards.get(from_jid);
        if (vcard?.get('image_hash') !== avatar_hash) {
            api.vcard.update(from_jid, true).catch((e) => log.error(e));
        }
    }
}

let presence_ref;

export function unregisterPresenceHandler() {
    if (presence_ref) {
        const connection = api.connection.get();
        connection.deleteHandler(presence_ref);
        presence_ref = null;
    }
}

export function registerPresenceHandler() {
    // unregisterPresenceHandler();
    const connection = api.connection.get();
    presence_ref = connection.addHandler(
        /** @param {Element} pres */
        (pres) => {
            try {
                handleVCardUpdatePresence(pres);
            } catch (e) {
                log.error(e);
            }
            return true;
        },
        null,
        'presence',
        null
    );
}

/**
 * @param {import('strophe.js').Builder} stanza
 */
export function updatePresence(stanza) {
    if (sizzle(`x[xmlns=${Strophe.NS.VCARD_UPDATE}"]`, stanza.root()).length === 0) {
        const node = stx`<x xmlns="${Strophe.NS.VCARD_UPDATE}"></x>`;
        stanza.root().cnode(node).up();
    }
    return stanza;
}
