/**
 * @typedef {Object} AdHocCommand
 * @property {string} action
 * @property {string} node
 * @property {string} sessionid
 * @property {string} status
 */
/**
 * @param {Element} stanza
 * @returns {AdHocCommand[]}
 */
export function parseForCommands(stanza: Element): AdHocCommand[];
/**
 * @typedef {Object} AdHocCommandFields
 * @property {string} sessionid
 * @property {string} [instructions]
 * @property {TemplateResult[]} [fields]
 * @property {string[]} [actions]
 */
/**
 * @param {Element} iq
 * @param {string} [jid]
 * @returns {AdHocCommandFields}
 */
export function getCommandFields(iq: Element, jid?: string): AdHocCommandFields;
export type AdHocCommand = {
    action: string;
    node: string;
    sessionid: string;
    status: string;
};
export type AdHocCommandFields = {
    sessionid: string;
    instructions?: string;
    fields?: TemplateResult[];
    actions?: string[];
};
export type TemplateResult = import('lit').TemplateResult;
//# sourceMappingURL=utils.d.ts.map