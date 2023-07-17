import log from "@converse/headless/log";
import { _converse, api, converse } from "../../index.js";
import { initStorage } from '@converse/headless/utils/storage.js';
import { shouldClearCache } from '@converse/headless/utils/core.js';

const { Strophe, $iq, u } = converse.env;


async function onVCardData (jid, iq) {
    const vcard = iq.querySelector('vCard');
    let result = {};
    if (vcard !== null) {
        result = {
            'stanza': iq,
            'fullname': vcard.querySelector('FN')?.textContent,
            'nickname': vcard.querySelector('NICKNAME')?.textContent,
            'image': vcard.querySelector('PHOTO BINVAL')?.textContent,
            'image_type': vcard.querySelector('PHOTO TYPE')?.textContent,
            'url': vcard.querySelector('URL')?.textContent,
            'role': vcard.querySelector('ROLE')?.textContent,
            'email': vcard.querySelector('EMAIL USERID')?.textContent,
            'vcard_updated': (new Date()).toISOString(),
            'vcard_error': undefined
        };
    }
    if (result.image) {
        const buffer = u.base64ToArrayBuffer(result['image']);
        const ab = await crypto.subtle.digest('SHA-1', buffer);
        result['image_hash'] = u.arrayBufferToHex(ab);
    }
    return result;
}


export function createStanza (type, jid, vcard_el) {
    const iq = $iq(jid ? {'type': type, 'to': jid} : {'type': type});
    if (!vcard_el) {
        iq.c("vCard", {'xmlns': Strophe.NS.VCARD});
    } else {
        iq.cnode(vcard_el);
    }
    return iq;
}


export function onOccupantAvatarChanged (occupant) {
    const hash = occupant.get('image_hash');
    const vcards = [];
    if (occupant.get('jid')) {
        vcards.push(_converse.vcards.get(occupant.get('jid')));
    }
    vcards.push(_converse.vcards.get(occupant.get('from')));
    vcards.forEach(v => (hash && v?.get('image_hash') !== hash) && api.vcard.update(v, true));
}


export async function setVCardOnModel (model) {
    let jid;
    if (model instanceof _converse.Message) {
        if (['error', 'info'].includes(model.get('type'))) {
            return;
        }
        jid = model.get('from');
    } else {
        jid = model.get('jid');
    }

    if (!jid) {
        log.warn(`Could not set VCard on model because no JID found!`);
        return;
    }

    await api.waitUntil('VCardsInitialized');
    model.vcard = _converse.vcards.get(jid) || _converse.vcards.create({ jid });
    model.vcard.on('change', () => model.trigger('vcard:change'));
    model.trigger('vcard:add');
}


function getVCardForOccupant (occupant) {
    const muc = occupant?.collection?.chatroom;
    const nick = occupant.get('nick');

    if (nick && muc?.get('nick') === nick) {
        return _converse.xmppstatus.vcard;
    } else {
        const jid = occupant.get('jid') || occupant.get('from');
        if (jid) {
            return _converse.vcards.get(jid) || _converse.vcards.create({ jid });
        } else {
            log.warn(`Could not get VCard for occupant because no JID found!`);
            return;
        }
    }
}

export async function setVCardOnOccupant (occupant) {
    await api.waitUntil('VCardsInitialized');
    occupant.vcard = getVCardForOccupant(occupant);
    if (occupant.vcard) {
        occupant.vcard.on('change', () => occupant.trigger('vcard:change'));
        occupant.trigger('vcard:add');
    }
}


function getVCardForMUCMessage (message) {
    const muc = message?.collection?.chatbox;
    const nick = Strophe.getResourceFromJid(message.get('from'));

    if (nick && muc?.get('nick') === nick) {
        return _converse.xmppstatus.vcard;
    } else {
        const jid = message.occupant?.get('jid') || message.get('from');
        if (jid) {
            return _converse.vcards.get(jid) || _converse.vcards.create({ jid });
        } else {
            log.warn(`Could not get VCard for message because no JID found! msgid: ${message.get('msgid')}`);
            return;
        }
    }
}

export async function setVCardOnMUCMessage (message) {
    if (['error', 'info'].includes(message.get('type'))) {
        return;
    } else {
        await api.waitUntil('VCardsInitialized');
        message.vcard = getVCardForMUCMessage(message);
        if (message.vcard) {
            message.vcard.on('change', () => message.trigger('vcard:change'));
            message.trigger('vcard:add');
        }
    }
}


export async function initVCardCollection () {
    _converse.vcards = new _converse.VCards();
    const id = `${_converse.bare_jid}-converse.vcards`;
    initStorage(_converse.vcards, id);
    await new Promise(resolve => {
        _converse.vcards.fetch({
            'success': resolve,
            'error': resolve
        }, {'silent': true});
    });
    const vcards = _converse.vcards;
    if (_converse.session) {
        const jid = _converse.session.get('bare_jid');
        const status = _converse.xmppstatus;
        status.vcard = vcards.get(jid) || vcards.create({'jid': jid});
        if (status.vcard) {
            status.vcard.on('change', () => status.trigger('vcard:change'));
            status.trigger('vcard:add');
        }
    }
    /**
     * Triggered as soon as the `_converse.vcards` collection has been initialized and populated from cache.
     * @event _converse#VCardsInitialized
     */
    api.trigger('VCardsInitialized');
}


export function clearVCardsSession () {
    if (shouldClearCache()) {
        api.promises.add('VCardsInitialized');
        if (_converse.vcards) {
            _converse.vcards.clearStore();
            delete _converse.vcards;
        }
    }
}

export async function getVCard (jid) {
    const to = Strophe.getBareJidFromJid(jid) === _converse.bare_jid ? null : jid;
    let iq;
    try {
        iq = await api.sendIQ(createStanza("get", to))
    } catch (iq) {
        return {
            jid,
            'stanza': iq,
            'vcard_error': (new Date()).toISOString()
        }
    }
    return onVCardData(jid, iq);
}
