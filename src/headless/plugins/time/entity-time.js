/**
 * Per-chat tracking of a contact's XEP-0202 entity time.
 *
 * This is the half of the feature that has nothing to do with drawing: which
 * full JID to ask, when to ask it, and what the answer means. It holds no DOM
 * and starts no repaint timers, so a TUI or any other non-browser consumer gets
 * the same behaviour a browser does by calling `api.time.contact.get`.
 *
 * @copyright 2026, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { getFullJID } from '../../utils/jid.js';
import { formatRemoteTime, getRemoteHour, getTimezoneDiffMinutes, isOffHours } from './utils.js';

// Presence can flap, and each change is a reason to re-ask. Collapse a burst
// of them into one query.
const FETCH_DEBOUNCE = 300;

// How long an answer is trusted before reading it asks for it again. Every
// other trigger is an event (the chat opening, their presence changing, a
// message arriving), and a chat can sit open through all of them and through
// the contact's DST transition, warning at hours that stopped being theirs.
const TZO_TTL = 60 * 60 * 1000;

// What we last heard, per contact. Deliberately not an attribute on any model:
// every model we could hang it on is persisted, and `save()` writes every
// attribute a model holds, so it would reach storage the next time anything
// else saved (the composer saves a draft as you type) and be rehydrated on a
// later page load. That matters less for its age than for what we could not
// then do about it: a contact who is offline can't be re-asked, so a stored
// answer from a previous session would be shown with no way to correct it.
// Nothing is shown instead, and we ask again when we can. The chat is kept
// alongside the offset because it, not the contact, is what a re-query is sent
// on behalf of.
/** @type {WeakMap<any, {tzo: string, chatbox: any}>} */
const tzo_by_contact = new WeakMap();

// Per-chat bookkeeping for the querying itself, which is tied to the chat being
// open rather than to the contact.
/**
 * @type {WeakMap<any, {
 *   timeout: ReturnType<typeof setTimeout>|null,
 *   loading: boolean,
 *   pending: boolean,
 *   last_attempt: number,
 * }>}
 */
const fetch_state = new WeakMap();

/**
 * @param {any} chatbox
 */
function getFetchState(chatbox) {
    let state = fetch_state.get(chatbox);
    if (!state) {
        state = { timeout: null, loading: false, pending: false, last_attempt: 0 };
        fetch_state.set(chatbox, state);
    }
    return state;
}

/**
 * Resolves the full JID to query for a given chat.
 *
 * Their highest-priority resource is the best answer. Failing that (they're
 * offline, or we have no presence subscription), the most recent message they
 * sent us carries a full JID, which is stale but better than asking their
 * server a question only their client can answer.
 * @param {any} chatbox
 * @returns {string|null}
 */
export function getFullJIDForChat(chatbox) {
    const full_jid = getFullJID(chatbox.get('jid'));
    if (full_jid) return full_jid;

    const messages = chatbox.messages;
    if (messages?.length) {
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages.at(i);
            const from = msg.get('from');
            if (from?.includes('/') && msg.get('sender') === 'them') {
                return from;
            }
        }
    }
    return null;
}

/**
 * Queries the contact and records their offset against the contact.
 * @param {any} chatbox
 */
async function doFetch(chatbox) {
    // Not only the paths that go through `change:closed`: a message arriving in
    // a chat the user has shut, or that contact's presence flapping, is no
    // reason to tell them we're here.
    if (chatbox.get('closed') || !api.settings.get('show_entity_time')) return;

    const state = getFetchState(chatbox);
    if (state.loading) {
        // Whatever prompted this happened after the answer in flight was asked
        // for, so it's a reason to ask again rather than to drop the question.
        state.pending = true;
        return;
    }

    // Before the early return below, so that a contact we can't currently
    // address doesn't have every read of their (stale) offset schedule another
    // attempt.
    state.last_attempt = Date.now();

    const full_jid = getFullJIDForChat(chatbox);
    if (!full_jid) return;

    state.loading = true;
    try {
        const result = await api.time.get(full_jid);
        const contact = chatbox.contact;
        if (result && contact) {
            tzo_by_contact.set(contact, { tzo: result.tzo, chatbox });
            // No attribute to fire a `change:` event, so say so ourselves.
            contact.trigger('entity_time:change');
        }
    } catch (e) {
        log.error(`Error fetching entity time for ${full_jid}: ${e}`);
    } finally {
        state.loading = false;
        if (state.pending) {
            state.pending = false;
            fetchEntityTime(chatbox);
        }
    }
}

/**
 * Schedules a (debounced) entity time query for this chat.
 * @param {any} chatbox
 */
export function fetchEntityTime(chatbox) {
    const state = getFetchState(chatbox);
    if (state.timeout) clearTimeout(state.timeout);
    state.timeout = setTimeout(() => {
        state.timeout = null;
        doFetch(chatbox);
    }, FETCH_DEBOUNCE);
}

/**
 * Asks again for an offset we've been holding for a while.
 *
 * Reading it is the moment to check: an offset nobody is looking at doesn't
 * need to be right, and this way only the contacts on screen are asked again.
 * @param {any} chatbox
 */
function maybeRefresh(chatbox) {
    if (!chatbox) return;

    const state = getFetchState(chatbox);
    if (state.loading || state.timeout) return;
    if (Date.now() - state.last_attempt < TZO_TTL) return;

    fetchEntityTime(chatbox);
}

/**
 * @param {any} chatbox
 */
function listenToPresence(chatbox) {
    const presence = chatbox.contact?.presence;
    if (!presence) return;

    // They may have switched device, and so timezone.
    chatbox.listenTo(presence, 'change', () => fetchEntityTime(chatbox));
    if (presence.resources) {
        chatbox.listenTo(presence.resources, 'add change', () => fetchEntityTime(chatbox));
    }
}

/**
 * Starts tracking entity time for a private chat.
 *
 * Queries are deliberately tied to the chat being open. Asking on behalf of
 * every chat restored from storage at login would put a burst of queries on the
 * wire and tell a pile of contacts we're back, for chats the user isn't looking
 * at.
 * @param {any} chatbox
 */
export function onChatBoxInitialized(chatbox) {
    // A chat with ourselves resolves to one of our own resources, so this would
    // be us asking us what time it is.
    if (chatbox.get('jid') === _converse.session?.get('bare_jid')) return;

    // Every time the chat is opened, not only the first: an offset we already
    // have is the one thing that stops us noticing that they have travelled or
    // crossed a DST boundary. The debounce and the in-flight guard in doFetch
    // keep that to one query.
    chatbox.listenTo(chatbox, 'change:closed', () => fetchEntityTime(chatbox));

    // A message from them is the other way we learn a full JID.
    if (chatbox.messages) {
        chatbox.listenTo(chatbox.messages, 'add', (/** @type {any} */ msg) => {
            if (!tzo_by_contact.has(chatbox.contact) && msg.get('sender') === 'them') fetchEntityTime(chatbox);
        });
    }

    chatbox.rosterContactAdded?.then(() => {
        listenToPresence(chatbox);
        fetchEntityTime(chatbox);
    });

    fetchEntityTime(chatbox);
}

/**
 * What we know about the contact's local time, right now.
 * @param {any} contact - A roster contact
 * @returns {import('./types').ContactTime|null}
 */
export function getContactTime(contact) {
    if (!api.settings.get('show_entity_time')) return null;

    const known = contact ? tzo_by_contact.get(contact) : null;
    if (!known) return null;

    // Reading an offset is also when it gets checked for age.
    maybeRefresh(known.chatbox);
    const { tzo } = known;

    // Our own clock is the authority on the current instant; the contact only
    // told us how far from UTC they are. XEP-0202 § 5 warns that a peer's idea
    // of UTC is exactly what you shouldn't trust.
    const now = new Date();
    const hour = getRemoteHour(now, tzo);
    const differs_by_minutes = getTimezoneDiffMinutes(tzo);
    const off_hours = isOffHours(
        hour,
        api.settings.get('entity_time_warning_start'),
        api.settings.get('entity_time_warning_end'),
    );

    // A contact in our own timezone tells us nothing our own clock doesn't, so
    // that never warrants a warning. Above that, the user's threshold decides.
    const min_diff_minutes = api.settings.get('entity_time_min_diff_hours') * 60;
    const differs_enough = differs_by_minutes !== 0 && differs_by_minutes >= min_diff_minutes;

    return {
        tzo,
        time: formatRemoteTime(now, tzo),
        hour,
        differs_by_minutes,
        differs_enough,
        is_off_hours: off_hours,
        should_warn: differs_enough && off_hours,
    };
}
