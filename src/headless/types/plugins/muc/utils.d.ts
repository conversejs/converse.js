/**
 * @returns {Promise<string|undefined>}
 */
export function getDefaultMUCService(): Promise<string | undefined>;
/**
 * @param {import('@converse/skeletor').Model} model
 */
export function isChatRoom(model: import("@converse/skeletor").Model): boolean;
export function shouldCreateGroupchatMessage(attrs: any): any;
/**
 * @param {import('./occupant').default} occupant1
 * @param {import('./occupant').default} occupant2
 */
export function occupantsComparator(occupant1: import("./occupant").default, occupant2: import("./occupant").default): 0 | 1 | -1;
export function registerDirectInvitationHandler(): void;
export function disconnectChatRooms(): any;
export function onWindowStateChanged(): Promise<void>;
/**
 * @param {Event} [event]
 */
export function routeToRoom(event?: Event): Promise<any>;
/**
 * Opens a groupchat, making sure that certain attributes
 * are correct, for example that the "type" is set to
 * "chatroom".
 * @param {string} jid
 * @param {Object} settings
 */
export function openChatRoom(jid: string, settings: any): Promise<any>;
/**
 * A direct MUC invitation to join a groupchat has been received
 * See XEP-0249: Direct MUC invitations.
 * @private
 * @method _converse.ChatRoom#onDirectMUCInvitation
 * @param {Element} message - The message stanza containing the invitation.
 */
export function onDirectMUCInvitation(message: Element): Promise<void>;
export function getDefaultMUCNickname(): any;
/**
 * Determines info message visibility based on
 * muc_show_info_messages configuration setting
 * @param {import('./types').MUCStatusCode} code
 * @memberOf _converse
 */
export function isInfoVisible(code: import("./types").MUCStatusCode): boolean;
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
//# sourceMappingURL=utils.d.ts.map