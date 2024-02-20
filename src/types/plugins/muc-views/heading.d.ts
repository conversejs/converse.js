export default class MUCHeading extends CustomElement {
    initialize(): Promise<void>;
    model: any;
    user_settings: any;
    render(): import("lit-html").TemplateResult<1> | "";
    onOccupantAdded(occupant: any): void;
    onOccupantAffiliationChanged(occupant: any): void;
    showRoomDetailsModal(ev: any): void;
    showInviteModal(ev: any): void;
    toggleTopic(ev: any): void;
    getAndRenderConfigurationForm(): void;
    close(ev: any): void;
    destroy(ev: any): void;
    /**
     * Returns a list of objects which represent buttons for the groupchat header.
     * @emits _converse#getHeadingButtons
     */
    getHeadingButtons(subject_hidden: any): any;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=heading.d.ts.map