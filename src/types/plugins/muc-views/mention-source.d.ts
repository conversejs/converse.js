/**
 * Build the mention source for one MUC composer.
 * @param {() => import('@converse/headless').MUC} getMUC
 * @param {() => boolean} canComplete - Whether completion applies right now (the room has
 *      been entered, and we are not a visitor in a moderated room).
 * @returns {import('shared/rich-composer/types').TypeaheadSource}
 */
export function makeMentionSource(getMUC: () => import("@converse/headless").MUC, canComplete: () => boolean): import("shared/rich-composer/types").TypeaheadSource;
//# sourceMappingURL=mention-source.d.ts.map