export function openChat(jid: any): void;
export function onClearSession(): Promise<void>;
export function autoJoinChats(): void;
export function registerMessageHandlers(): void;
/**
 * Handler method for all incoming single-user chat "message" stanzas.
 * @param { MessageAttributes } attrs - The message attributes
 */
export function handleMessageStanza(stanza: any): Promise<void>;
/**
 * Ask the XMPP server to enable Message Carbons
 * See [XEP-0280](https://xmpp.org/extensions/xep-0280.html#enabling)
 * @param { Boolean } reconnecting
 */
export function enableCarbons(): Promise<void>;
