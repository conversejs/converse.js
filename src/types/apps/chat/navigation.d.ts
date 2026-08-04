/**
 * Open a 1:1 chat or MUC as a user-initiated navigation.
 *
 * Any `attrs` (e.g. a MUC `nick`/`password`) are applied to the model first,
 * without foregrounding, so the subsequent route-driven open honours them; they
 * are deliberately never encoded in the hash (a password in the address
 * bar/history would leak, per XEP-0147 Security Considerations).
 *
 * @param {'chat'|'room'} view
 * @param {string} jid
 * @param {object} [attrs={}]
 * @returns {Promise<void>}
 */
export function openConversationRouted(view: "chat" | "room", jid: string, attrs?: object): Promise<void>;
//# sourceMappingURL=navigation.d.ts.map