export default MUCOccupant;
declare const MUCOccupant_base: (new (attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions) => Model<import("@converse/skeletor").ModelAttributes>) & import("../../shared/types").Constructor<import("../../shared/types").ColorAware> & import("../../shared/types").Constructor<import("../../shared/types").MessagesAware> & import("../../shared/types").Constructor<import("../../shared/types").VCardAware>;
/**
 * Represents a participant in a MUC
 */
declare class MUCOccupant extends MUCOccupant_base {
    /**
     * @typedef {import('../../shared/types').MessageAttributes} MessageAttributes
     * @typedef {import('../../shared/errors').StanzaParseError} StanzaParseError
     * @typedef {import('./message.js').default} MUCMessage
     */
    initialize(): Promise<void>;
    defaults(): {
        hats: any[];
        presence: string;
        show: any;
        states: any[];
        hidden: boolean;
        num_unread: number;
        message_type: string;
    };
    save(key: any, val: any, options: any): any;
    getMessagesCollection(): MUCMessages;
    /**
     * Handler for all MUC private messages sent to this occupant.
     * This method houldn't be called directly, instead {@link MUC#queueMessage} should be called.
     * @param {MessageAttributes|StanzaParseError} attrs_or_error
     */
    onMessage(attrs_or_error: import("../../shared/types").MessageAttributes | import("../../shared/errors").StanzaParseError): Promise<void>;
    /**
     * Return roles which may be assigned to this occupant
     * @returns {typeof ROLES} - An array of assignable roles
     */
    getAssignableRoles(): typeof ROLES;
    /**
     * Return affiliations which may be assigned by this occupant
     * @returns {typeof AFFILIATIONS} An array of assignable affiliations
     */
    getAssignableAffiliations(): typeof AFFILIATIONS;
    isMember(): boolean;
    isModerator(): boolean;
    isSelf(): any;
    /**
     * @param {import('../chat/message').default} message - The message object
     */
    createMessageStanza(message: import("../chat/message").default): Promise<any>;
}
import { Model } from '@converse/skeletor';
import MUCMessages from './messages.js';
import { ROLES } from './constants.js';
import { AFFILIATIONS } from './constants.js';
//# sourceMappingURL=occupant.d.ts.map