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
 * @typedef {Object} AdHocCommandAttrs
 * @property {string} sessionid
 * @property {string[]} [actions]
 * @property {AdHocCommandResultNote} [note]
 *
 * @typedef {XForm & AdHocCommandAttrs} AdHocCommandResult
 */
/**
 * Given a "result" IQ stanza containing the outcome of an Ad-hoc command that
 * was executed, parse it and return the values as a JSON object.
 * @param {Element} iq
 * @returns {AdHocCommandResult}
 */
export function parseCommandResult(iq: Element): AdHocCommandResult;
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
export type AdHocCommandAttrs = {
    sessionid: string;
    actions?: string[];
    note?: AdHocCommandResultNote;
};
export type AdHocCommandResult = XForm & AdHocCommandAttrs;
export type TemplateResult = import('lit').TemplateResult;
export type XForm = import('../../shared/parsers').XForm;
//# sourceMappingURL=utils.d.ts.map