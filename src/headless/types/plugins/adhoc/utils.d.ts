/**
 * Given a "result" IQ stanza that contains a list of ad-hoc commands, parse it
 * and return the list of commands as JSON objects.
 * @param {Element} stanza
 * @returns {import('./types').AdHocCommand[]}
 */
export function parseForCommands(stanza: Element): import("./types").AdHocCommand[];
/**
 * Given a "result" IQ stanza containing the outcome of an Ad-hoc command that
 * was executed, parse it and return the values as a JSON object.
 * @param {Element} iq
 * @returns {import('./types').AdHocCommandResult}
 */
export function parseCommandResult(iq: Element): import("./types").AdHocCommandResult;
//# sourceMappingURL=utils.d.ts.map