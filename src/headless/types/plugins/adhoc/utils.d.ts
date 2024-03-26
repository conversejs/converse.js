/**
 * @param {Element} stanza
 */
export function parseForCommands(stanza: Element): any;
/**
 * @param {Element} iq
 * @param {string} [jid]
 */
export function getCommandFields(iq: Element, jid?: string): {
    sessionid: any;
    instructions: any;
    fields: any;
    actions: any[];
};
//# sourceMappingURL=utils.d.ts.map