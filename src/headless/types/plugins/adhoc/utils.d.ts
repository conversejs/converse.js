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
export function parseForCommands(stanza: Element): AdHocCommand[];
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
export function parseCommandResult(iq: Element, jid?: string): AdHocCommandResult;
export type AdHocCommand = {
    action: string;
    node: string;
    sessionid: string;
    status: string;
};
export type AdHocCommandResultNote = {
    text: string;
    type: 'info' | 'warn' | 'error';
};
export type AdHocCommandResult = {
    sessionid: string;
    instructions?: string;
    fields?: TemplateResult[];
    actions?: string[];
    note?: AdHocCommandResultNote;
};
export type TemplateResult = import('lit').TemplateResult;
//# sourceMappingURL=utils.d.ts.map