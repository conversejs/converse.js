export default class AddMUCModal extends BaseModal {
    renderModal(): import("lit").TemplateResult<1>;
    getModalTitle(): any;
    /**
     * @param {HTMLFormElement} form
     * @returns {{ jid: string, nick: string }}
     */
    parseRoomDataFromEvent(form: HTMLFormElement): {
        jid: string;
        nick: string;
    };
    /**
     * Takes a string and returns a normalized lowercase value representing the node (localpart) of a MUC JID.
     * Replaces all spaces with dashes, replaces diacritics with ASCII, and
     * removes all characters besides letters and numbers and dashes.
     * @param {string} s
     * @returns {string}
     */
    normalizeNode(s: string): string;
    /**
     * @param {Event} ev
     */
    openChatRoom(ev: Event): Promise<void>;
    /**
     * @param {string} jid
     * @return {string}
     */
    validateMUCJID(jid: string): string;
}
import BaseModal from 'plugins/modal/modal.js';
//# sourceMappingURL=add-muc.d.ts.map