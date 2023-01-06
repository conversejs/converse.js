export function initSessionData(): void;
export function sendEnableStanza(): Promise<void>;
export function enableStreamManagement(): Promise<void>;
export function onStanzaSent(stanza: any): void;
