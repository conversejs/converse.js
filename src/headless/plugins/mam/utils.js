/**
 * @typedef {import('../muc/muc').default} MUC
 * @typedef {import('../chat/model').default} ChatBox
 * @typedef {import('@converse/skeletor/src/types/helpers.js').Model} Model
 */
import sizzle from "sizzle";
import { Strophe, $iq } from "strophe.js";
import _converse from "../../shared/_converse.js";
import api from "../../shared/api/index.js";
import converse from "../../shared/api/public.js";
import log from "@converse/log";
import { parseMUCMessage } from "../../plugins/muc/parsers.js";
import { parseMessage } from "../../plugins/chat/parsers.js";
import { CHATROOMS_TYPE } from "../../shared/constants.js";
import { TimeoutError } from "../../shared/errors.js";
import MAMPlaceholderMessage from "./placeholder.js";
import { parseErrorStanza } from "../../shared/parsers.js";

const { NS } = Strophe;
const u = converse.env.utils;

/**
 * @param {Element|Error} e
 * @param {Element} iq
 */
export async function onMAMError(e, iq) {
    if (u.isElement(e)) {
        const err = await parseErrorStanza(e);
        if (err?.name === "feature-not-implemented") {
            log.warn(`Message Archive Management (XEP-0313) not supported by ${iq.getAttribute("to")}`);
            return;
        }
    }
    log.error(`Error while trying to set archiving preferences for ${iq.getAttribute("to")}.`);
    log.error(iq);
}

/**
 * Handle returned IQ stanza containing Message Archive
 * Management (XEP-0313) preferences.
 *
 * XXX: For now we only handle the global default preference.
 * The XEP also provides for per-JID preferences, which is
 * currently not supported in converse.js.
 *
 * Per JID preferences will be set in chat boxes, so it'll
 * probably be handled elsewhere in any case.
 *
 * @param {Element} iq
 * @param {Model} feature
 */
export function onMAMPreferences(iq, feature) {
    const preference = sizzle(`prefs[xmlns="${NS.MAM}"]`, iq).pop();
    const default_pref = preference.getAttribute("default");
    if (default_pref !== api.settings.get("message_archiving")) {
        const stanza = $iq({ "type": "set" }).c("prefs", {
            "xmlns": NS.MAM,
            "default": api.settings.get("message_archiving"),
        });
        Array.from(preference.children).forEach((child) => stanza.cnode(child).up());

        // XXX: Strictly speaking, the server should respond with the updated prefs
        // (see example 18: https://xmpp.org/extensions/xep-0313.html#config)
        // but Prosody doesn't do this, so we don't rely on it.
        api.sendIQ(stanza)
            .then(() => feature.save({ "preferences": { "default": api.settings.get("message_archiving") } }))
            .catch(/** @param {Error|Element} e */ (e) => _converse.exports.onMAMError(e, stanza.tree()));
    } else {
        feature.save({ "preferences": { "default": api.settings.get("message_archiving") } });
    }
}

/**
 * @param {Model} feature
 */
export function getMAMPrefsFromFeature(feature) {
    const prefs = feature.get("preferences") || {};
    if (feature.get("var") !== NS.MAM || api.settings.get("message_archiving") === undefined) {
        return;
    }
    if (prefs["default"] !== api.settings.get("message_archiving")) {
        const stanza = $iq({ "type": "get" }).c("prefs", { "xmlns": NS.MAM });
        api.sendIQ(stanza)
            .then(/** @param {Element} iq */ (iq) => _converse.exports.onMAMPreferences(iq, feature))
            .catch(/** @param {Error|Element} e */ (e) => _converse.exports.onMAMError(e, stanza.tree()));
    }
}

/**
 * @param {MUC} muc
 */
export function preMUCJoinMAMFetch(muc) {
    if (
        !api.settings.get("muc_show_logs_before_join") ||
        !muc.features.get("mam_enabled") ||
        muc.get("prejoin_mam_fetched")
    ) {
        return;
    }
    fetchNewestMessages(muc);
    muc.save({ prejoin_mam_fetched: true });
}

/**
 * @param {ChatBox|MUC} model
 * @param {Error|string} error
 */
async function createMessageFromError(model, error) {
    if (error instanceof TimeoutError) {
        const msg = await model.createMessage({
            type: "error",
            message: error.message,
            retry_event_id: error.retry_event_id,
            is_ephemeral: 20000,
        });
        msg.error = error;
    }
}

/**
 * @param {ChatBox|MUC} model
 * @param {Object} result
 * @param {Object} query
 * @param {Object} options
 * @param {('forwards'|'backwards'|false)} [should_page=false]
 */
export async function handleMAMResult(model, result, query, options, should_page = false) {
    const is_muc = model.get("type") === CHATROOMS_TYPE;
    const doParseMessage = /** @param {Element} s*/ (s) =>
        is_muc ? parseMUCMessage(s, /** @type {MUC} */ (model)) : parseMessage(s);

    const messages = await Promise.all(result.messages.map(doParseMessage));
    result.messages = messages;

    /**
     * Synchronous event which allows listeners to first do some
     * work based on the MAM result before calling the handlers here.
     * @event _converse#MAMResult
     */
    const data = { query, "chatbox": model, messages };
    await api.trigger("MAMResult", data, { "synchronous": true });

    messages.forEach((m) => model.queueMessage(m));
    if (result.error) {
        const event_id = (result.error.retry_event_id = u.getUniqueId());
        api.listen.once(event_id, () => fetchArchivedMessages(model, options, should_page));
        createMessageFromError(model, result.error);
    }
}

/**
 * Fetch XEP-0313 archived messages based on the passed in criteria.
 * @param {ChatBox|MUC} model
 * @param {import('./types').FetchArchivedMessagesOptions} [options]
 * @param {('forwards'|'backwards'|false)} [should_page=false] - Determines whether
 *  this function should recursively page through the entire result set if a limited
 *  number of results were returned.
 */
export async function fetchArchivedMessages(model, options = {}, should_page = false) {
    if (model.disable_mam) return;

    const is_muc = model.get("type") === CHATROOMS_TYPE;
    const bare_jid = _converse.session.get("bare_jid");
    const mam_jid = is_muc ? model.get("jid") : bare_jid;

    const supported = await api.disco.supports(NS.MAM, mam_jid);
    if (!supported) return;

    const max = api.settings.get("archived_messages_page_size");
    const query = /** @type {import('./types').ArchiveQueryOptions} */ {
        is_groupchat: is_muc,
        rsm: {
            max,
            ...options.rsm,
        },
        mam: {
            with: model.get("jid"),
            ...options.mam,
        },
    };

    const result = await api.archive.query(query);
    await handleMAMResult(model, result, query, options, should_page);

    if (result.rsm && !result.complete) {
        if (should_page) {
            if (should_page === "forwards") {
                options = result.rsm.next(max, options.rsm.before).query;
            } else if (should_page === "backwards") {
                options = result.rsm.previous(max, options.rsm.after).query;
            }
            return fetchArchivedMessages(model, options, should_page);
        } else {
            createGapPlaceholder(model, options, result);
        }
    }
}

/**
 * Creates a placeholder to fill gaps in the history.
 * @param {ChatBox|MUC} model
 * @param {import('./types').ArchiveQueryOptions} [options]
 * @param {import('./types').MAMQueryResult} [result]
 */
async function createGapPlaceholder(model, options, result) {
    const msgs = await Promise.all(result.messages);

    const is_muc = model.get("type") === CHATROOMS_TYPE;
    const mam_jid = is_muc ? model.get("jid") : _converse.session.get("bare_jid");

    const { rsm } = result;
    const key = `stanza_id ${mam_jid}`;
    const adjacent_message = msgs.find((m) => m[key] === rsm.result.first);
    const adjacent_message_date = new Date(adjacent_message["time"]);

    const msg_data = {
        before: rsm.result.first,
        start: options.mam?.start,
        template_hook: "getMessageTemplate",
        time: new Date(adjacent_message_date.getTime() - 1).toISOString(),
    };

    if (model.messages.findWhere(msg_data)) {
        log.debug("Gap placeholder already exists, not recreating.");
        return;
    }

    model.messages.add(new MAMPlaceholderMessage(msg_data));
}

/**
 * Creates a placeholder to fetch messages at the top of the chat history.
 * @param {ChatBox|MUC} model
 */
export function createScrollupPlaceholder(model) {
    if (model.messages.length) {
        const is_muc = model.get("type") === CHATROOMS_TYPE;
        const mam_jid = is_muc ? model.get("jid") : _converse.session.get("bare_jid");
        const key = `stanza_id ${mam_jid}`;
        const oldest_message = model.getOldestMessage();
        if (!oldest_message) return;

        const msg_data = {
            before: oldest_message.get(key),
            template_hook: "getMessageTemplate",
            time: new Date((new Date(oldest_message.get('time'))).getTime() - 1).toISOString(),
        };

        if (model.messages.findWhere(msg_data)) {
            log.debug("Gap placeholder already exists, not recreating.");
            return;
        }
        model.messages.add(new MAMPlaceholderMessage(msg_data));
    }
}

/**
 * Fetches messages that might have been archived *after*
 * the last archived message in our local cache.
 * @param {ChatBox|MUC} model
 */
export function fetchNewestMessages(model) {
    if (model.disable_mam) return;

    // XXX: It's important to first get the most recent message, before making any
    // async calls, like `api.disco.supports`, so that we can avoid a race
    // condition with possible new incoming messages.
    // We want the most recent cached message, otherwise we would query with
    // the wrong `start` value. This function used to call
    // `api.disco.supports`, but it's also called in `fetchArchivedMessages`,
    // so it's not necessary here.
    const most_recent_msg = model.getMostRecentMessage();
    const should_page = api.settings.get("mam_request_all_pages") ? "backwards" : false;

    if (most_recent_msg) {
        return fetchArchivedMessages(model, { mam: { start: most_recent_msg.get("time") }, rsm: { before: "" } }, should_page);
    } else {
        return fetchArchivedMessages(model, { rsm: { before: "" } }, should_page);
    }
}
