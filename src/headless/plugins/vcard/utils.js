/**
 * @typedef {import('../../plugins/chat/message').default} Message
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
import { parseVCardResultStanza } from './parsers.js';

const { Stanza, Strophe, sizzle, stx } = converse.env;

Strophe.addNamespace('VCARD_UPDATE', 'vcard-temp:x:update');

/**
 * @param {"get"|"set"|"result"} type
 * @param {string} jid
 * @param {Element} [vcard_el]
 */
export function createStanza(type, jid, vcard_el) {
    const iq = stx`
        <iq type="${type}"
            ${jid ? Stanza.unsafeXML(`to="${jid}"`) : ''}
            xmlns="jabber:client">
            ${vcard_el ? '' : stx`<vCard xmlns="${Strophe.NS.VCARD}"></vCard>`}
        </iq>`;

    if (vcard_el) iq.cnode(vcard_el);

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
            const message = /** @type {Message} */ (model);
            if (['error', 'info'].includes(message.get('type'))) {
                return;
            }
            jid = Strophe.getBareJidFromJid(message.get('from'));
        } else if (typeof (/** @type {Model} */ (model).getVCardJID) === 'function') {
            // A model can name the JID whose vCard represents it.
            jid = /** @type {Model} */ (model).getVCardJID();
        } else {
            jid = /** @type {Model} */ (model).get('jid');
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

// Bare JIDs whose XEP-0172 nick node we've already retrieved this session, so we
// fetch it at most once per contact (see maybeFetchPublishedNick).
const nick_fetched = new Set();

/**
 * Best-effort XEP-0172 active retrieval (XEP-0060 § 6.5): fetch a contact's
 * published nickname from their PEP node and apply it, once per session and only
 * for our own JID and roster contacts (the XEP-0172 audience), so it doesn't fan
 * out to MUC occupants or arbitrary social-feed authors. Runs fire-and-forget so
 * it never blocks the vcard-temp result; a missing/unreadable node leaves any
 * existing `pep_nickname` untouched.
 * @param {string} jid
 */
function maybeFetchPublishedNick(jid) {
    if (!api.pubsub?.items) return;
    const bare = Strophe.getBareJidFromJid(jid);
    const is_target = bare === _converse.session.get('bare_jid') || !!_converse.state.roster?.get(bare);
    if (!is_target || nick_fetched.has(bare)) return;
    nick_fetched.add(bare);

    api.pubsub.items
        .get(jid, Strophe.NS.NICK, { max_items: 1 })
        .then(({ items }) => {
            const item = items?.[0];
            const nick = item ? sizzle(`nick[xmlns="${Strophe.NS.NICK}"]`, item).pop()?.textContent?.trim() : undefined;
            if (nick) setNickForJID(bare, nick);
        })
        .catch(() => {
            // Node absent, access denied, or unsupported: nothing to apply.
        });
}

/**
 * @param {string} jid
 */
export async function fetchVCard(jid) {
    const bare_jid = _converse.session.get('bare_jid');
    const to = Strophe.getBareJidFromJid(jid) === bare_jid ? null : jid;
    maybeFetchPublishedNick(jid);
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
 * Apply an XEP-0172 nickname to a JID's VCard model, storing it under
 * `pep_nickname` (never `nickname`, which vcard-temp owns and would clobber on
 * refetch). The VCard is created if we don't have one yet. An empty/undefined
 * nick clears the value, so the display name falls back to the vCard name and
 * then the JID.
 * @param {string} jid - The bare JID asserting the nickname.
 * @param {string} [nick]
 */
function setNickForJID(jid, nick) {
    const { vcards } = _converse.state;
    const vcard = vcards.get(jid) || vcards.create({ jid }, { lazy_load: true });
    // Idempotent: saving an unchanged value fires no `change`.
    vcard?.save({ pep_nickname: nick || undefined });
}

/**
 * @param {Element} pres
 */
async function handleVCardUpdatePresence(pres) {
    await api.waitUntil('VCardsInitialized');
    const from_jid = Strophe.getBareJidFromJid(pres.getAttribute('from'));

    // XEP-0153: refetch the vCard when the advertised avatar hash changed.
    const photo = sizzle(`x[xmlns="${Strophe.NS.VCARD_UPDATE}"] photo`, pres).pop();
    if (photo) {
        const avatar_hash = photo.textContent;
        const vcard = await _converse.state.vcards.get(from_jid);
        if (vcard?.get('image_hash') !== avatar_hash) {
            api.vcard.update(from_jid, true).catch((e) => log.error(e));
        }
    }

    // XEP-0172: apply a nickname hint carried directly in the presence. Skipped
    // for MUC occupant presence, whose bare `from` is the room, not a person.
    const is_muc = sizzle(`x[xmlns="http://jabber.org/protocol/muc#user"]`, pres).length > 0;
    const nick_el = is_muc ? null : sizzle(`nick[xmlns="${Strophe.NS.NICK}"]`, pres).pop();
    if (nick_el) {
        setNickForJID(from_jid, nick_el.textContent?.trim());
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
    unregisterPresenceHandler();
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
        null,
    );
}

/**
 * Handle an inbound XEP-0172 User Nickname update delivered as a PEP event
 * (node `http://jabber.org/protocol/nick`), so a contact's display name
 * re-renders when they change it.
 * @param {Element} message
 */
async function handleNickUpdate(message) {
    const items = sizzle(`event[xmlns="${Strophe.NS.PUBSUB}#event"] items[node="${Strophe.NS.NICK}"]`, message).pop();
    if (!items) return;

    const from_jid = Strophe.getBareJidFromJid(message.getAttribute('from'));
    if (!from_jid) return;

    await api.waitUntil('VCardsInitialized');

    const nick = sizzle(`item nick[xmlns="${Strophe.NS.NICK}"]`, items).pop()?.textContent?.trim();
    setNickForJID(from_jid, nick);
}

let nick_ref;

export function unregisterNickHandler() {
    if (nick_ref) {
        const connection = api.connection.get();
        connection.deleteHandler(nick_ref);
        nick_ref = null;
    }
}

export function registerNickHandler() {
    unregisterNickHandler();
    const connection = api.connection.get();
    nick_ref = connection.addHandler(
        /** @param {Element} message */
        (message) => {
            handleNickUpdate(message).catch((e) => log.error(e));
            return true;
        },
        `${Strophe.NS.PUBSUB}#event`,
        'message',
    );
}

let last_published_nick;

/**
 * Reset the module-level XEP-0172 session state (own published nick and the
 * once-per-contact retrieval guard), so a fresh session republishes and refetches.
 */
export function resetNickState() {
    last_published_nick = undefined;
    nick_fetched.clear();
}

/**
 * Publish our own nickname to our PEP node (XEP-0172 § 3), so contacts
 * are notified when it changes.
 * @returns {Promise<void>}
 */
export async function publishOwnNickname() {
    if (!api.pubsub?.publish) return;

    const { profile } = _converse.state;
    if (!profile) return;

    const nick = profile.getNickname() || '';
    if (nick === (last_published_nick ?? '')) return; // unchanged since last publish
    if (last_published_nick === undefined && !nick) return; // nothing published yet, nothing to clear

    const item = stx`<item id="current"><nick xmlns="${Strophe.NS.NICK}">${nick}</nick></item>`;
    try {
        await api.pubsub.publish(null, Strophe.NS.NICK, item, { persist_items: true, max_items: 1 }, false);
        last_published_nick = nick;
    } catch (e) {
        log.error(e);
    }
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
