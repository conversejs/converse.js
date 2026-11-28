/**
 * A room's configuration, as its owner sees it: the owner form (XEP-0045
 * §10.2), which the server sends with each field's type, current value and,
 * for a list, the values it takes. Asked for settings are checked against
 * that form before anything is sent, so a setting the server doesn't have,
 * or a value it doesn't take, is refused rather than silently dropped: a room
 * meant to be members-only mustn't end up open because the server names the
 * field differently.
 *
 * Settings are named as the fields are, without the "muc#roomconfig_" prefix
 * ("membersonly", "whois"). A field outside that namespace keeps its full name.
 * @module @converse/daemon/room-config
 */
import { api, converse } from '@converse/headless';
import { ERRORS, RPCError } from './protocol.js';

const { Strophe, stx, sizzle } = converse.env;

/**
 * An XML element, as headless parses stanzas. The daemon's types have no DOM.
 * @typedef {{
 *   getAttribute(name: string): string|null,
 *   children: ArrayLike<any>,
 *   localName: string,
 *   tagName: string,
 *   textContent: string|null,
 * }} XMLElement
 */

const PREFIX = 'muc#roomconfig_';
/** The affiliations a room keeps a list of. */
export const AFFILIATION_LISTS = ['owner', 'admin', 'member', 'outcast'];
/** How long the room may take to answer an owner or admin request. */
const IQ_TIMEOUT = 10000;

/**
 * @typedef {Object} FormField
 * @property {string} var - The field's full name
 * @property {string} name - Its name without the "muc#roomconfig_" prefix
 * @property {string} type - Its XEP-0004 type, "text-single" when the form gives none
 * @property {string|null} label
 * @property {string[]} values - What it's set to
 * @property {string[]|null} options - The values a list field takes, if it says
 */

/**
 * @param {XMLElement} el
 * @param {string} name
 * @returns {XMLElement[]}
 */
const children = (el, name) => Array.from(el.children).filter((child) => child.localName === name);

/**
 * The fields of an owner form, as the server sent them.
 * @param {XMLElement} stanza - The IQ result holding the form
 * @returns {FormField[]}
 */
export function parseForm(stanza) {
    const form = sizzle(`query[xmlns="${Strophe.NS.MUC_OWNER}"] > x[xmlns="${Strophe.NS.XFORM}"]`, stanza).pop();
    if (!form) return [];
    return children(form, 'field').filter((field) => field.getAttribute('var')).map((field) => {
        const type = field.getAttribute('type') || 'text-single';
        const options = children(field, 'option').flatMap((o) => children(o, 'value').map((v) => v.textContent ?? ''));
        return {
            var: field.getAttribute('var'),
            name: field.getAttribute('var').replace(PREFIX, ''),
            type,
            label: field.getAttribute('label'),
            values: children(field, 'value').map((v) => v.textContent ?? ''),
            options: type.startsWith('list-') ? options : null,
        };
    });
}

/**
 * A field's value, as JSON shows it: a boolean for a yes/no field, an array
 * for one that takes several values, else a string, or null if it's unset.
 * A password is never shown.
 * @param {FormField} field
 * @param {string[]} [values]
 * @returns {boolean|string|string[]|null}
 */
export function displayValue(field, values = field.values) {
    if (field.type === 'text-private') return values.some(Boolean) ? '(hidden)' : null;
    if (field.type === 'boolean') return values[0] === '1' || values[0] === 'true';
    if (field.type.endsWith('-multi')) return [...values];
    return values[0] ?? null;
}

/** Fields that only describe the form, and can't be set. */
const isSettable = (field) => field.type !== 'fixed' && field.type !== 'hidden';

/**
 * A room's settings by name, as {@link displayValue} shows them, but for its password.
 * @param {FormField[]} fields
 * @returns {Record<string, boolean|string|string[]|null>}
 */
export function settingsOf(fields) {
    // A password is left out, so that settings read back from a room can be given to another as they are.
    const shown = fields.filter((f) => isSettable(f) && f.type !== 'text-private');
    return Object.fromEntries(shown.map((f) => [f.name, displayValue(f)]));
}

/**
 * The values a setting gives a field, as the form sends them, or why it can't.
 * @param {FormField} field
 * @param {unknown} value - From JSON, or a string from the command line
 * @returns {string[]|string} The values, or what's wrong
 */
function valuesFor(field, value) {
    const { type, options } = field;
    const scalar = typeof value === 'string' || typeof value === 'number';

    if (type === 'boolean') {
        if (value === true || value === 1 || value === '1' || value === 'true') return ['1'];
        if (value === false || value === 0 || value === '0' || value === 'false') return ['0'];
        return 'must be true or false';
    }
    let values;
    if (type.endsWith('-multi')) {
        if (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number')) {
            values = value.map(String);
        } else if (typeof value === 'string') {
            // From the command line: a text field takes lines, a list or JIDs commas.
            const separator = type === 'text-multi' ? /\n/ : /\s*,\s*/;
            values = value === '' ? [] : value.split(separator);
        } else {
            return 'must be a list of values';
        }
    } else if (scalar) {
        values = [String(value)];
    } else {
        return 'must be a single value';
    }
    if (options?.length) {
        const wrong = values.filter((v) => !options.includes(v));
        if (wrong.length) return `takes ${options.map((o) => `"${o}"`).join(', ')}, not "${wrong.join('", "')}"`;
    }
    return values;
}

/** @param {string[]} a @param {string[]} b */
const sameValues = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

/**
 * Fills in the form with the settings asked for, and says what that changes.
 * Every setting is checked first, and all that are wrong are refused together.
 * @param {FormField[]} fields - The form, with the room's current values
 * @param {Record<string, unknown>} settings - By name, with or without the prefix
 * @returns {{ fields: FormField[], changes: import('./types').SettingChange[] }}
 *  Every field, with its new value where a setting gives it one
 */
export function fillForm(fields, settings) {
    const problems = [];
    const wanted = new Map();
    for (const [name, value] of Object.entries(settings)) {
        const field = fields.find((f) => f.var === name || f.var === `${PREFIX}${name}`);
        if (!field) {
            problems.push(`"${name}" isn't one of this room's settings`);
        } else if (!isSettable(field)) {
            problems.push(`"${name}" can't be set`);
        } else {
            const values = valuesFor(field, value);
            if (typeof values === 'string') problems.push(`"${name}" ${values}`);
            else wanted.set(field.var, values);
        }
    }
    if (problems.length) {
        const names = fields.filter(isSettable).map((f) => f.name);
        throw new RPCError(
            ERRORS.INVALID_PARAMS,
            `Nothing was changed: ${problems.join('; ')}. This room's settings are: ${names.join(', ')}.`,
            { problems, settings: names },
        );
    }
    const changes = [];
    const filled = fields.map((field) => {
        const values = wanted.get(field.var);
        if (!values || sameValues(values, field.values)) return field;
        changes.push({ name: field.name, from: displayValue(field), to: displayValue(field, values) });
        return { ...field, values };
    });
    return { fields: filled, changes };
}

/**
 * Why the room turned a request down, as an RPCError.
 * @param {XMLElement|null} error - The error IQ, or null if it timed out
 * @param {string} jid - The room
 * @param {string} doing - What we asked for, such as "configure it"
 */
export function roomError(error, jid, doing) {
    if (!error) {
        return new RPCError(ERRORS.NOT_CONNECTED, `${jid} didn't answer within ${IQ_TIMEOUT / 1000} seconds.`);
    }
    // Anything but a stanza, such as the error headless throws while offline, is passed on.
    if (typeof error.getAttribute !== 'function') return /** @type {any} */ (error);
    const condition = sizzle(`error > [xmlns="${Strophe.NS.STANZAS}"]`, error)[0]?.tagName ?? 'unknown';
    const text = sizzle(`error > text[xmlns="${Strophe.NS.STANZAS}"]`, error)[0]?.textContent;
    const said = text ? ` It said: "${text}".` : '';
    if (condition === 'item-not-found') {
        return new RPCError(ERRORS.NOT_FOUND, `There's no room ${jid}.${said}`);
    }
    if (condition === 'forbidden' || condition === 'not-allowed' || condition === 'not-authorized') {
        return new RPCError(
            ERRORS.FORBIDDEN,
            `${jid} wouldn't let us ${doing} (${condition}): that takes an owner of the room.${said}`,
            { condition },
        );
    }
    return new RPCError(ERRORS.INTERNAL_ERROR, `${jid} wouldn't let us ${doing} (${condition}).${said}`, {
        condition,
    });
}

/**
 * @param {import('strophe.js').Builder} iq
 * @param {string} jid
 * @param {string} doing
 * @returns {Promise<XMLElement>}
 */
async function send(iq, jid, doing) {
    try {
        return await api.sendIQ(iq, IQ_TIMEOUT);
    } catch (e) {
        throw roomError(/** @type {XMLElement|null} */ (e), jid, doing);
    }
}

/**
 * The room's owner form, with its current settings.
 * @param {string} jid
 * @returns {Promise<FormField[]>}
 */
export async function fetchForm(jid) {
    const result = await send(
        stx`<iq to="${jid}" type="get" xmlns="jabber:client"><query xmlns="${Strophe.NS.MUC_OWNER}"/></iq>`,
        jid,
        'read its settings',
    );
    return parseForm(result);
}

/**
 * Submits the form, with every field the form has, as XEP-0045 has it.
 * @param {string} jid
 * @param {FormField[]} fields
 */
export function submitForm(jid, fields) {
    return send(
        stx`<iq to="${jid}" type="set" xmlns="jabber:client">
            <query xmlns="${Strophe.NS.MUC_OWNER}">
                <x xmlns="${Strophe.NS.XFORM}" type="submit">
                    ${fields
                        .filter((f) => f.type !== 'fixed')
                        .map((f) => stx`<field var="${f.var}">${f.values.map((v) => stx`<value>${v}</value>`)}</field>`)}
                </x>
            </query>
        </iq>`,
        jid,
        'configure it',
    );
}

/**
 * Cancels the configuration of a room we just created, which has the server
 * destroy it (XEP-0045 §10.1.3).
 * @param {string} jid
 */
export function cancelForm(jid) {
    return send(
        stx`<iq to="${jid}" type="set" xmlns="jabber:client">
            <query xmlns="${Strophe.NS.MUC_OWNER}"><x xmlns="${Strophe.NS.XFORM}" type="cancel"/></query>
        </iq>`,
        jid,
        'cancel its configuration',
    );
}

/**
 * Whether a room exists. A members-only room may hide from non-members, so a
 * room that says it doesn't exist may only be hidden from us.
 * @param {string} jid
 * @returns {Promise<boolean>}
 */
export async function roomExists(jid) {
    try {
        await api.sendIQ(
            stx`<iq to="${jid}" type="get" xmlns="jabber:client"><query xmlns="${Strophe.NS.DISCO_INFO}"/></iq>`,
            IQ_TIMEOUT,
        );
        return true;
    } catch (e) {
        const error = roomError(/** @type {XMLElement|null} */ (e), jid, 'look it up');
        if (error.code === ERRORS.NOT_FOUND) return false;
        // Any other answer comes from a room that's there.
        if (e) return true;
        throw error;
    }
}

/**
 * Checks the affiliations asked for: JIDs by affiliation.
 * @param {unknown} raw
 * @returns {Record<string, string[]>}
 */
export function parseAffiliations(raw) {
    if (raw === undefined) return {};
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new RPCError(
            ERRORS.INVALID_PARAMS,
            `"affiliations" must map affiliations (${AFFILIATION_LISTS.join(', ')}) to lists of JIDs.`,
        );
    }
    /** @type {Record<string, string[]>} */
    const lists = {};
    const seen = new Map();
    for (const [affiliation, jids] of Object.entries(raw)) {
        if (!AFFILIATION_LISTS.includes(affiliation)) {
            throw new RPCError(
                ERRORS.INVALID_PARAMS,
                `"affiliations" can have ${AFFILIATION_LISTS.join(', ')}, not "${affiliation}".`,
            );
        }
        if (!Array.isArray(jids)) {
            throw new RPCError(ERRORS.INVALID_PARAMS, `"affiliations.${affiliation}" must be a list of JIDs.`);
        }
        lists[affiliation] = jids.map((value) => {
            const jid = typeof value === 'string' ? Strophe.getBareJidFromJid(value.trim()).toLowerCase() : '';
            if (!jid || !jid.includes('@') || /\s/.test(jid)) {
                throw new RPCError(
                    ERRORS.INVALID_PARAMS,
                    `"affiliations.${affiliation}" must list JIDs such as "juliet@capulet.lit", not ${JSON.stringify(value)}.`,
                );
            }
            if (seen.has(jid) && seen.get(jid) !== affiliation) {
                throw new RPCError(
                    ERRORS.INVALID_PARAMS,
                    `${jid} is listed as both ${seen.get(jid)} and ${affiliation}.`,
                );
            }
            seen.set(jid, affiliation);
            return jid;
        });
    }
    return lists;
}

/**
 * The room's affiliation lists that we may see: an admin sees the members and
 * outcasts, an owner the owners and admins too. A list we may not see is left out.
 * @param {string} jid
 * @returns {Promise<Record<string, string[]>>}
 */
export async function fetchAffiliations(jid) {
    const lists = await Promise.all(
        AFFILIATION_LISTS.map(async (affiliation) => {
            try {
                const result = await send(
                    stx`<iq to="${jid}" type="get" xmlns="jabber:client">
                        <query xmlns="${Strophe.NS.MUC_ADMIN}"><item affiliation="${affiliation}"/></query>
                    </iq>`,
                    jid,
                    `list its ${affiliation}s`,
                );
                const jids = sizzle(`query[xmlns="${Strophe.NS.MUC_ADMIN}"] > item[jid]`, result).map((item) =>
                    Strophe.getBareJidFromJid(item.getAttribute('jid')).toLowerCase(),
                );
                return [affiliation, jids.sort()];
            } catch (e) {
                if (/** @type {RPCError} */ (e).code === ERRORS.FORBIDDEN) return null;
                throw e;
            }
        }),
    );
    return Object.fromEntries(lists.filter(Boolean));
}

/**
 * Gives each JID listed the affiliation it's listed under, where it doesn't
 * have it yet. Nobody is taken off a list: a JID that isn't listed keeps the
 * affiliation it has.
 * @param {string} jid - The room
 * @param {Record<string, string[]>} wanted - JIDs by affiliation
 * @param {Record<string, string[]>} current - The room's lists, as {@link fetchAffiliations} gives them
 * @param {boolean} [dry_run] - Say what would change, and change nothing
 * @returns {Promise<{ jid: string, affiliation: string }[]>} What changed
 */
export async function grantAffiliations(jid, wanted, current, dry_run = false) {
    const changes = Object.entries(wanted).flatMap(([affiliation, jids]) =>
        jids.filter((j) => !current[affiliation]?.includes(j)).map((j) => ({ jid: j, affiliation })),
    );
    if (dry_run || !changes.length) return changes;
    await send(
        stx`<iq to="${jid}" type="set" xmlns="jabber:client">
            <query xmlns="${Strophe.NS.MUC_ADMIN}">
                ${changes.map((c) => stx`<item jid="${c.jid}" affiliation="${c.affiliation}"/>`)}
            </query>
        </iq>`,
        jid,
        'change its affiliations',
    );
    return changes;
}
