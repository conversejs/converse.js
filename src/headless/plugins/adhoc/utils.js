/**
 * @typedef {import('lit').TemplateResult} TemplateResult
 */
import sizzle from 'sizzle';
import converse from '../../shared/api/public.js';

const { Strophe, u } = converse.env;

/**
 * @typedef {Object} AdHocCommand
 * @property {string} action
 * @property {string} node
 * @property {string} sessionid
 * @property {string} status
 */

/**
 * Given a "result" IQ stanza that contains a list of ad-hoc commands, parse it
 * and return the list of commands as JSON objects.
 * @param {Element} stanza
 * @returns {AdHocCommand[]}
 */
export function parseForCommands(stanza) {
    const items = sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"][node="${Strophe.NS.ADHOC}"] item`, stanza);
    return items.map(u.getAttributes);
}

/**
 * @typedef {Object} AdHocCommandResultNote
 * @property {string} text
 * @property {'info'|'warn'|'error'} type
 *
 * @typedef {Object} AdHocCommandResult
 * @property {string} sessionid
 * @property {string} [instructions]
 * @property {TemplateResult[]} [fields]
 * @property {string[]} [actions]
 * @property {AdHocCommandResultNote} [note]
 */

/**
 * Given a "result" IQ stanza containing the outcome of an Ad-hoc command that
 * was executed, parse it and return the values as a JSON object.
 * @param {Element} iq
 * @param {string} [jid]
 * @returns {AdHocCommandResult}
 */
export function parseCommandResult(iq, jid) {
    const cmd_el = sizzle(`command[xmlns="${Strophe.NS.ADHOC}"]`, iq).pop();
    const note = cmd_el.querySelector('note');

    const data = {
        sessionid: cmd_el.getAttribute('sessionid'),
        instructions: sizzle('x[type="form"][xmlns="jabber:x:data"] instructions', cmd_el).pop()?.textContent,
        fields: sizzle('x[type="form"][xmlns="jabber:x:data"] field', cmd_el).map(
            /** @param {Element} f */ (f) => u.xForm2TemplateResult(f, cmd_el, { domain: jid })
        ),
        actions: Array.from(cmd_el.querySelector('actions')?.children ?? []).map((a) => a.nodeName.toLowerCase()),
        note: note
            ? {
                  text: note.textContent,
                  type: note.getAttribute('type'),
              }
            : null,
    };
    return data;
}
