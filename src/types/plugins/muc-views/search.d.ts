export function clearRoomsCache(): void;
/**
 * @param {string} query
 */
export function getAutoCompleteList(query: string): Promise<import("./types").RoomData[]>;
/**
 * Renders a groupchat found by searching, together with its number of participants.
 * @param {import('shared/autocomplete/suggestion').default<import('@converse/headless/types/plugins/muc/types').ChannelSearchItem>} suggestion
 * @param {string} query
 */
export function tplRoomSuggestion(suggestion: import("shared/autocomplete/suggestion").default<import("@converse/headless/types/plugins/muc/types").ChannelSearchItem>, query: string): import("lit-html").TemplateResult<1>;
//# sourceMappingURL=search.d.ts.map