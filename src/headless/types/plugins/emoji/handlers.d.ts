export function registerPEPPushHandler(): void;
/**
 * Given a message, extract emojis from it and use them to update the list of
 * popular emojis.
 * @param {import('../../plugins/reactions/utils').BaseMessage} message
 */
export function updatePopularEmojis(message: import("../../plugins/reactions/utils").BaseMessage): Promise<void>;
/**
 * @param {import('../../shared/types').MessageAttributes} attrs
 * @param {String} text
 * @returns {Promise<import('../../shared/types').MessageAttributes & { is_only_emojis: boolean }>}
 */
export function parseMessage(attrs: import("../../shared/types").MessageAttributes, text: string): Promise<import("../../shared/types").MessageAttributes & {
    is_only_emojis: boolean;
}>;
//# sourceMappingURL=handlers.d.ts.map