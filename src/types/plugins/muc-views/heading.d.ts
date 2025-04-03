export default class MUCHeading extends CustomElement {
    /**
     * @typedef {import('@converse/headless/types/plugins/muc/occupant').default} MUCOccupant
     */
    initialize(): Promise<void>;
    model: any;
    user_settings: any;
    render(): "" | import("lit-html").TemplateResult<1>;
    /**
     * @param {MUCOccupant} occupant
     */
    updateIfOwnOccupant(occupant: import("@converse/headless").MUCOccupant): void;
    /**
     * @param {Event} ev
     */
    showRoomDetailsModal(ev: Event): void;
    /**
     * @param {Event} ev
     */
    showNicknameModal(ev: Event): void;
    /**
     * @param {Event} ev
     */
    toggleTopic(ev: Event): void;
    /**
     * @param {Event} ev
     */
    toggleOccupants(ev: Event): void;
    /**
     * @param {Event} ev
     */
    showConfigModal(ev: Event): void;
    /**
     * @param {Event} ev
     */
    close(ev: Event): void;
    /**
     * @param {Event} ev
     */
    destroy(ev: Event): void;
    /**
     * Returns a list of objects which represent buttons for the groupchat header.
     * @emits _converse#getHeadingButtons
     *
     * @param {boolean} subject_hidden
     */
    getHeadingButtons(subject_hidden: boolean): any;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=heading.d.ts.map