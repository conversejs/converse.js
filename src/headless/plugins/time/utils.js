import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import i18n from '../../shared/i18n.js';
import u from '../../utils/index.js';

const { Stanza, Strophe, stx } = converse.env;

/**
 * Whether we're willing to disclose our local time to the entity that asked.
 *
 * XEP-0202 § 5 notes that an offset leaks something about where you are, but
 * gives no guidance on who may ask. The `send_entity_time` setting decides:
 * 'public' answers anyone, anything else truthy answers only entities
 * subscribed to our presence (the rule XEP-0012 § 7 imposes on the comparable
 * Last Activity data), and anything falsy answers nobody.
 *
 * Treating unrecognised truthy values as 'presence' means a stale or mistyped
 * setting errs towards disclosing less.
 * @param {string|null} from - The 'from' attribute of the incoming IQ
 * @returns {Promise<boolean>}
 */
async function mayShareTimeWith(from) {
    const setting = api.settings.get('send_entity_time');
    if (!setting) return false;
    if (setting === 'public') return true;

    // An IQ without a 'from' was sent by our own server on our behalf.
    if (!from) return true;

    // Roster contacts are stored under a lowercased bare JID, and not every
    // server hands us a normalised localpart.
    const bare_jid = Strophe.getBareJidFromJid(from).toLowerCase();
    // Our own other resources are us, and always get an answer.
    if (bare_jid === _converse.session?.get('bare_jid')) return true;

    // A contact's client can ask as soon as it sees our presence, which is
    // before we've fetched the roster. Reading an empty roster then would deny
    // someone who is in fact subscribed, and their client is entitled to take
    // that error for a lack of support (it's how we read it ourselves, see
    // api.time.get) and stop asking for the rest of the session.
    await api.waitUntil('rosterContactsFetched');

    // 'from' and 'both' are the two states in which they receive our presence.
    const contact = _converse.state.roster?.get(bare_jid);
    return ['from', 'both'].includes(contact?.get('subscription'));
}

/**
 * Responds to an incoming XEP-0202 time request.
 *
 * `send_entity_time` is read per request rather than at registration time, so
 * that turning it off stops us disclosing our timezone straight away instead of
 * on the next reconnection. Note that our disco#info features are settled when
 * the session starts, so a mid-session change is only reflected there after
 * reconnecting.
 * @param {Element} iq - The incoming IQ stanza
 */
async function respondToTimeRequest(iq) {
    const from = iq.getAttribute('from');
    const id = iq.getAttribute('id');

    // A request that arrived without a 'from' came from our own server, and
    // the answer goes back the same way. An empty 'to' is not a valid JID
    // (RFC 6120 § 8.1.1.1), so leave the attribute off entirely rather than
    // send one.
    const to = from ? Stanza.unsafeXML(`to="${Strophe.xmlescape(from)}"`) : '';

    const may_share = await mayShareTimeWith(from);
    // Deciding can mean waiting for the roster, by which time the session may
    // be gone.
    if (!api.connection.connected()) return;

    if (!may_share) {
        api.sendIQ(stx`
            <iq type="error" ${to} id="${id}" xmlns="jabber:client">
                <error type="cancel">
                    <service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                </error>
            </iq>`);
        return;
    }

    // Both values must describe the same instant, so they come from one Date.
    const now = new Date();
    api.sendIQ(stx`
        <iq type="result" ${to} id="${id}" xmlns="jabber:client">
            <time xmlns="${Strophe.NS.TIME}">
                <tzo>${formatTZO(-now.getTimezoneOffset())}</tzo>
                <utc>${now.toISOString().replace(/\.\d{3}Z$/, 'Z')}</utc>
            </time>
        </iq>`);
}

/**
 * Strophe wants to know synchronously whether the handler stays registered,
 * while deciding whether we may answer can mean waiting for the roster, so the
 * answering happens on its own.
 * @param {Element} iq - The incoming IQ stanza
 * @returns {boolean}
 */
function handleTimeRequest(iq) {
    respondToTimeRequest(iq);
    return true;
}

/**
 * Advertises XEP-0202 support in our own disco#info, which XEP-0202 § 3
 * requires of any entity that answers time queries.
 *
 * Both sharing modes advertise: under 'presence' we do support the protocol,
 * and who gets an answer is a matter of authorization rather than support.
 * Nothing is advertised when sharing is off, since we then answer nobody.
 */
export function addClientFeatures() {
    if (api.settings.get('send_entity_time')) {
        api.disco.own.features.add(Strophe.NS.TIME);
    }
}

/**
 * Registers the XEP-0202 time handler. Strophe drops its handlers when the
 * connection is re-established, so this runs again on every reconnection.
 */
export function registerTimeHandler() {
    return api.connection.get().addHandler(handleTimeRequest, Strophe.NS.TIME, 'iq', 'get');
}

/**
 * Formats an offset in minutes as the ±HH:MM string XEP-0202 uses.
 * The inverse of {@link parseTZO}.
 * @param {number} minutes - Offset in minutes (positive = ahead of UTC)
 * @returns {string} Timezone offset string like "+05:30"
 */
export function formatTZO(minutes) {
    const sign = minutes < 0 ? '-' : '+';
    const abs = Math.abs(minutes);
    const hours = String(Math.floor(abs / 60)).padStart(2, '0');
    const mins = String(abs % 60).padStart(2, '0');
    return `${sign}${hours}:${mins}`;
}

/**
 * Canonicalises an offset that came off the wire, or rejects it.
 *
 * XEP-0202 § 4 defers to XEP-0082, whose TZD is either "Z" or ±HH:MM, so a peer
 * in UTC may legitimately answer "Z". Anything else we can't read, and taking
 * it anyway would be worse than having no offset at all: {@link parseTZO}
 * answers 0 for what it can't parse, which would put the contact in our own
 * timezone and warn (or fail to warn) on hours that aren't theirs.
 * @param {string} tzo - An offset as received, e.g. "+05:30" or "Z"
 * @returns {string|null} The offset as ±HH:MM, or null if it isn't one
 */
export function normalizeTZO(tzo) {
    if (tzo === 'Z') return '+00:00';

    const match = tzo?.match(/^[+-](\d{2}):(\d{2})$/);
    if (!match) return null;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    // The real range is -12:00 to +14:00, so anything past that is a bug at the
    // other end rather than a timezone.
    return minutes < 60 && hours * 60 + minutes <= 14 * 60 ? tzo : null;
}

/**
 * Parses timezone offset string (±HH:MM) to minutes
 * @param {string} tzo - Timezone offset string like "+05:30" or "-08:00"
 * @returns {number} Offset in minutes
 */
export function parseTZO(tzo) {
    const match = tzo.match(/^([+-])(\d{2}):(\d{2})$/);
    if (!match) return 0;
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const mins = parseInt(match[3], 10);
    return sign * (hours * 60 + mins);
}

/**
 * Checks if the given hour falls within "off-hours" (e.g., nighttime)
 * @param {number} hour - Hour in 24h format (0-23)
 * @param {number} warning_start - Start hour of warning period (default 22)
 * @param {number} warning_end - End hour of warning period (default 7)
 * @returns {boolean}
 */
export function isOffHours(hour, warning_start = 22, warning_end = 7) {
    if (warning_start > warning_end) {
        // Range spans midnight (e.g., 22:00 - 07:00)
        return hour >= warning_start || hour < warning_end;
    } else {
        // Range within same day
        return hour >= warning_start && hour < warning_end;
    }
}

/**
 * Gets the current hour in the remote entity's timezone
 * @param {Date} now - The current time (e.g., new Date())
 * @param {string} tzo - Timezone offset string like "+05:30"
 * @returns {number} Hour in remote timezone (0-23)
 */
export function getRemoteHour(now, tzo) {
    const offset_mins = parseTZO(tzo);
    const remote_time = new Date(now.getTime() + offset_mins * 60 * 1000);
    return remote_time.getUTCHours();
}

/**
 * The locale to write times in.
 *
 * `getLocale` is only on the i18n namespace once the full build has installed
 * it, so @converse/headless on its own (in Node, say) falls back to the
 * runtime's idea of the locale. Converse spells its locales with an underscore
 * ("pt_BR"), Intl wants the BCP 47 hyphen.
 * @returns {string|undefined}
 */
function getDisplayLocale() {
    const locale = /** @type {{ getLocale?: () => string }} */ (i18n).getLocale?.();
    return locale ? locale.replace('_', '-') : undefined;
}

/** @type {{ locale: string|undefined, formatter: Intl.DateTimeFormat }|null} */
let time_formatter = null;

/**
 * A formatter for the wall-clock time in some other timezone.
 *
 * Constructing one is expensive relative to using it, and every chat showing a
 * time reformats it once a minute, so the last one is kept.
 * @param {string} [locale]
 * @returns {Intl.DateTimeFormat}
 */
function getTimeFormatter(locale) {
    if (!time_formatter || time_formatter.locale !== locale) {
        // timeStyle rather than hour and minute separately, so that each locale
        // pads the way it pads: "04:00" on a 24-hour clock, "4:00 AM" on a
        // 12-hour one.
        const options = /** @type {Intl.DateTimeFormatOptions} */ ({ timeStyle: 'short', timeZone: 'UTC' });
        let formatter;
        try {
            formatter = new Intl.DateTimeFormat(locale, options);
        } catch (e) {
            // An unusable locale tag isn't worth failing a render over.
            log.warn(`Could not format times for locale ${locale}: ${e}`);
            formatter = new Intl.DateTimeFormat(undefined, options);
        }
        time_formatter = { locale, formatter };
    }
    return time_formatter.formatter;
}

/**
 * Formats the current time in a remote timezone the way the user's locale
 * writes times, so that a 12-hour locale gets "11:14 PM" rather than "23:14".
 * @param {Date} now - The current time (e.g., new Date())
 * @param {string} tzo - Timezone offset string like "+05:30"
 * @param {string} [locale] - A BCP 47 tag. Defaults to the UI locale.
 * @returns {string} The remote time, formatted for display
 */
export function formatRemoteTime(now, tzo, locale = getDisplayLocale()) {
    const offset_mins = parseTZO(tzo);
    const remote_time = new Date(now.getTime() + offset_mins * 60 * 1000);
    // The shift has already put their wall-clock time into the Date, which is
    // why the formatter is pinned to UTC. Left to itself it would apply our own
    // timezone on top and move the time a second time.
    return getTimeFormatter(locale).format(remote_time);
}

/**
 * Gets the local (browser) timezone offset in minutes
 * @returns {number} Offset in minutes (positive = ahead of UTC)
 */
export function getLocalTZOMinutes() {
    // getTimezoneOffset returns minutes behind UTC (negative for ahead)
    // Invert it to match the convention used here (positive = ahead of UTC)
    return -new Date().getTimezoneOffset();
}

/**
 * Calculates the absolute difference between a remote timezone and ours.
 *
 * Minutes rather than hours, because plenty of timezones are offset by a
 * fraction of an hour (+05:30 in India, +05:45 in Nepal, -03:30 in
 * Newfoundland) and rounding those to whole hours loses real differences.
 * @param {string} remote_tzo - Remote timezone offset string like "+05:30"
 * @returns {number} Absolute difference in minutes
 */
export function getTimezoneDiffMinutes(remote_tzo) {
    return Math.abs(parseTZO(remote_tzo) - getLocalTZOMinutes());
}

// Export utility functions for use by other plugins
Object.assign(u, {
    time: {
        formatTZO,
        normalizeTZO,
        parseTZO,
        isOffHours,
        getRemoteHour,
        formatRemoteTime,
        getLocalTZOMinutes,
        getTimezoneDiffMinutes,
    },
});
