export function initSessionData(): void;
export function sendEnableStanza(): Promise<void>;
export function enableStreamManagement(): Promise<void>;
/**
 * @param {Element} stanza
 */
export function onStanzaSent(stanza: Element): void;
export function onWillReconnect(): void;
//# sourceMappingURL=utils.d.ts.map