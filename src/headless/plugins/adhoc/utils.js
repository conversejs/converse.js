import sizzle from '#sizzle';
import converse from '../../shared/api/public.js';
import { parseXForm } from '../../shared/parsers.js';

const { Strophe, u } = converse.env;

/**
 * Given a "result" IQ stanza that contains a list of ad-hoc commands, parse it
 * and return the list of commands as JSON objects.
 * @param {Element} stanza
 * @returns {import('./types').AdHocCommand[]}
 */
export function parseForCommands(stanza) {
    const items = sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"][node="${Strophe.NS.ADHOC}"] item`, stanza);
    return items.map(u.getAttributes);
}

/**
 * @param {Element} [cmd_el] - The `<command>` element of an ad-hoc command response
 * @returns {import('./types').AdHocCommandResultNote|null}
 */
export function parseCommandNote(cmd_el) {
    const note = cmd_el?.querySelector('note');
    return note
        ? {
              text: note.textContent,
              type: /** @type {import('./types').AdHocCommandNoteType} */ (note.getAttribute('type')),
          }
        : null;
}

/**
 * Given a "result" IQ stanza containing the outcome of an Ad-hoc command that
 * was executed, parse it and return the values as a JSON object.
 * @param {Element} iq
 * @returns {import('./types').AdHocCommandResult}
 */
export function parseCommandResult(iq) {
    const cmd_el = sizzle(`command[xmlns="${Strophe.NS.ADHOC}"]`, iq).pop();

    return {
        ...parseXForm(iq),
        sessionid: cmd_el.getAttribute('sessionid'),
        note: parseCommandNote(cmd_el),
        actions: Array.from(cmd_el.querySelector('actions')?.children ?? []).map((a) => a.nodeName.toLowerCase()),
    };
}
