export function routeToChat(event: any): any;
export function onClearSession(): Promise<void>;
/**
 * Given a stanza, determine whether it's a new
 * message, i.e. not a MAM archived one.
 * @param {Element|Model|object} message
 */
export function isNewMessage(message: Element | Model | object): boolean;
export function autoJoinChats(): void;
export function registerMessageHandlers(): void;
/**
 * Handler method for all incoming single-user chat "message" stanzas.
 * @param {Element|Builder} stanza
 */
export function handleMessageStanza(stanza: Element | Builder): Promise<any>;
/**
 * Ask the XMPP server to enable Message Carbons
 * See [XEP-0280](https://xmpp.org/extensions/xep-0280.html#enabling)
 */
export function enableCarbons(): Promise<void>;
export type ChatBox = import("./model.js").default;
export type MessageAttributes = import("../../shared/types.ts").MessageAttributes;
export type StanzaParseError = import("../../shared/errors").StanzaParseError;
export type Builder = import("strophe.js").Builder;
import { Model } from '@converse/skeletor';
//# sourceMappingURL=utils.d.ts.map