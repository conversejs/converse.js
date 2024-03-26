export function isChatRoom(model: any): boolean;
export function shouldCreateGroupchatMessage(attrs: any): any;
export function occupantsComparator(occupant1: any, occupant2: any): 1 | 0 | -1;
export function registerDirectInvitationHandler(): void;
export function disconnectChatRooms(): any;
export function onWindowStateChanged(): Promise<void>;
/**
 * @param {Event} [event]
 */
export function routeToRoom(event?: Event): Promise<void>;
export function openChatRoom(jid: any, settings: any): Promise<any>;
/**
 * A direct MUC invitation to join a groupchat has been received
 * See XEP-0249: Direct MUC invitations.
 * @private
 * @method _converse.ChatRoom#onDirectMUCInvitation
 * @param { Element } message - The message stanza containing the invitation.
 */
export function onDirectMUCInvitation(message: Element): Promise<void>;
export function getDefaultMUCNickname(): any;
/**
 * Determines info message visibility based on
 * muc_show_info_messages configuration setting
 * @param {*} code
 * @memberOf _converse
 */
export function isInfoVisible(code: any): boolean;
/**
 * Automatically join groupchats, based on the
 * "auto_join_rooms" configuration setting, which is an array
 * of strings (groupchat JIDs) or objects (with groupchat JID and other settings).
 */
export function autoJoinRooms(): Promise<void>;
export function onAddClientFeatures(): void;
export function onBeforeTearDown(): void;
export function onStatusInitialized(): void;
export function onBeforeResourceBinding(): void;
export type Model = import('@converse/skeletor').Model;
//# sourceMappingURL=utils.d.ts.map