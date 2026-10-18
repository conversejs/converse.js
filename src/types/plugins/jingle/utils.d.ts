/**
 * The peer's name for the call UI. The roster contact resolves asynchronously,
 * so we fall back to the nickname and then the JID node while it's still null.
 * @param {import('@converse/headless').Call} call
 * @returns {string}
 */
export function getCallName(call: import("@converse/headless").Call): string;
/**
 * The summary line shown in the call card once it's over.
 * @param {import('@converse/headless').Call} call
 * @returns {string}
 */
export function endedSummary(call: import("@converse/headless").Call): string;
/**
 * `getToolbarButtons` handler: an audio call button in 1:1 chats.
 * @param {import('shared/chat/toolbar').ChatToolbar} toolbar_el
 * @param {import('lit').TemplateResult[]} buttons
 * @returns {import('lit').TemplateResult[]}
 */
export function getCallButton(toolbar_el: import("shared/chat/toolbar").ChatToolbar, buttons: import("lit").TemplateResult[]): import("lit").TemplateResult[];
//# sourceMappingURL=utils.d.ts.map