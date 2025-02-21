/**
 * @typedef {import('../../plugins/muc/message').default} MUCMessage
 * @typedef {import('../../plugins/status/status').default} XMPPStatus
 * @typedef {import('../../plugins/vcard/vcards').default} VCards
 * @typedef {import('../../plugins/vcard/vcard').default} VCard
 * @typedef {import('../../shared/model-with-contact.js').default} ModelWithContact
 * @typedef {import('../muc/occupant.js').default} MUCOccupant
 * @typedef {import('@converse/skeletor/src/types/helpers.js').Model} Model
 */
import _converse from "../../shared/_converse.js";
import api from "../../shared/api/index.js";
import converse from "../../shared/api/public.js";
import log from "../../log.js";
import { initStorage } from "../../utils/storage.js";
import { shouldClearCache } from "../../utils/session.js";
import { isElement } from "../../utils/html.js";

const { Strophe, $iq, u } = converse.env;

/**
 * @param {Element} iq
 */
async function onVCardData(iq) {
    const vcard = iq.querySelector("vCard");
    let result = {};
    if (vcard !== null) {
        result = {
            "stanza": iq,
            "fullname": vcard.querySelector("FN")?.textContent,
            "nickname": vcard.querySelector("NICKNAME")?.textContent,
            "image": vcard.querySelector("PHOTO BINVAL")?.textContent,
            "image_type": vcard.querySelector("PHOTO TYPE")?.textContent,
            "url": vcard.querySelector("URL")?.textContent,
            "role": vcard.querySelector("ROLE")?.textContent,
            "email": vcard.querySelector("EMAIL USERID")?.textContent,
            "vcard_updated": new Date().toISOString(),
            "vcard_error": undefined,
            image_hash: undefined,
        };
    }
    if (result.image) {
        const buffer = u.base64ToArrayBuffer(result["image"]);
        const ab = await crypto.subtle.digest("SHA-1", buffer);
        result["image_hash"] = u.arrayBufferToHex(ab);
    }
    return result;
}

/**
 * @param {"get"|"set"|"result"} type
 * @param {string} jid
 * @param {Element} [vcard_el]
 */
export function createStanza(type, jid, vcard_el) {
    const iq = $iq(jid ? { "type": type, "to": jid } : { "type": type });
    if (!vcard_el) {
        iq.c("vCard", { "xmlns": Strophe.NS.VCARD });
    } else {
        iq.cnode(vcard_el);
    }
    return iq;
}

/**
 * @param {MUCOccupant} occupant
 */
export function onOccupantAvatarChanged(occupant) {
    const hash = occupant.get("image_hash");
    const vcards = [];
    if (occupant.get("jid")) {
        vcards.push(_converse.state.vcards.get(occupant.get("jid")));
    }
    vcards.push(_converse.state.vcards.get(occupant.get("from")));
    vcards.forEach((v) => hash && v && v?.get("image_hash") !== hash && api.vcard.update(v, true));
}

/**
 * @param {Model|MUCOccupant|MUCMessage} model
 * @param {boolean} [create=true]
 * @returns {Promise<VCard|null>}
 */
export async function getVCardForModel(model, create = true) {
    await initVCardCollection();

    let vcard;
    if (model instanceof _converse.exports.MUCOccupant) {
        vcard = await getVCardForOccupant(/** @type {MUCOccupant} */ (model), create);
    } else if (model instanceof _converse.exports.MUCMessage) {
        vcard = await getVCardForMUCMessage(/** @type {MUCMessage} */ (model), create);
    } else {
        let jid;
        if (model instanceof _converse.exports.Message) {
            if (["error", "info"].includes(model.get("type"))) {
                return;
            }
            jid = Strophe.getBareJidFromJid(model.get("from"));
        } else {
            jid = model.get("jid");
        }

        if (!jid) {
            log.warn(`Could not set VCard on model because no JID found!`);
            return null;
        }
        const { vcards } = _converse.state;
        vcard = vcards.get(jid) || (create ? vcards.create({ jid }) : null);
    }

    if (vcard) {
        vcard.on("change", () => model.trigger("vcard:change"));
    }
    return vcard;
}

/**
 * @param {MUCOccupant} occupant
 * @param {boolean} [create=true]
 * @returns {Promise<VCard|null>}
 */
export async function getVCardForOccupant(occupant, create = true) {
    await api.waitUntil("VCardsInitialized");

    const { vcards, xmppstatus } = _converse.state;
    const muc = occupant?.collection?.chatroom;
    const nick = occupant.get("nick");

    if (nick && muc?.get("nick") === nick) {
        return xmppstatus.vcard;
    } else {
        const jid = occupant.get("jid") || occupant.get("from");
        if (jid) {
            return vcards.get(jid) || (create ? vcards.create({ jid }) : null);
        } else {
            log.debug(`Could not get VCard for occupant because no JID found!`);
            return null;
        }
    }
}

/**
 * @param {MUCMessage} message
 * @param {boolean} [create=true]
 * @returns {Promise<VCard|null>}
 */
async function getVCardForMUCMessage(message, create = true) {
    if (["error", "info"].includes(message.get("type"))) return;

    await api.waitUntil("VCardsInitialized");
    const { vcards, xmppstatus } = _converse.state;
    const muc = message?.collection?.chatbox;
    const nick = Strophe.getResourceFromJid(message.get("from"));

    if (nick && muc?.get("nick") === nick) {
        return xmppstatus.vcard;
    } else {
        const jid = message.occupant?.get("jid") || message.get("from");
        if (jid) {
            return vcards.get(jid) || (create ? vcards.create({ jid }) : null);
        } else {
            log.warn(`Could not get VCard for message because no JID found! msgid: ${message.get("msgid")}`);
            return null;
        }
    }
}

async function initVCardCollection() {
    if (_converse.state.vcards) return _converse.state.vcards;

    const vcards = new _converse.exports.VCards();
    _converse.state.vcards = vcards;
    Object.assign(_converse, { vcards }); // XXX DEPRECATED

    const bare_jid = _converse.session.get("bare_jid");
    const id = `${bare_jid}-converse.vcards`;
    initStorage(vcards, id);
    await new Promise((resolve) => {
        vcards.fetch(
            {
                success: resolve,
                error: resolve,
            },
            { "silent": true }
        );
    });
    /**
     * Triggered as soon as the `_converse.vcards` collection has been initialized and populated from cache.
     * @event _converse#VCardsInitialized
     */
    api.trigger("VCardsInitialized");
}

export function clearVCardsSession() {
    if (shouldClearCache(_converse)) {
        api.promises.add("VCardsInitialized");
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
export async function getVCard(jid) {
    const bare_jid = _converse.session.get("bare_jid");
    const to = Strophe.getBareJidFromJid(jid) === bare_jid ? null : jid;
    let iq;
    try {
        iq = await api.sendIQ(createStanza("get", to));
    } catch (error) {
        return {
            jid,
            stanza: isElement(error) ? error : null,
            error: isElement(error) ? null : error,
            vcard_error: new Date().toISOString(),
        };
    }
    return onVCardData(iq);
}
