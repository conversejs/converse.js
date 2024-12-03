export default class MUCOccupants extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    initialize(): void;
    filter: RosterFilter;
    model: any;
    render(): import("lit").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     */
    showInviteModal(ev: MouseEvent): void;
    /** @param {MouseEvent} ev */
    toggleFilter(ev: MouseEvent): void;
    /** @param {MouseEvent} ev */
    closeSidebar(ev: MouseEvent): void;
    /**
     * @param {MouseEvent} ev
     * @param {import('@converse/headless/types/plugins/muc/occupant.js').default} occupant
     */
    onOccupantClicked(ev: MouseEvent, occupant: import("@converse/headless/types/plugins/muc/occupant.js").default): void;
}
import { CustomElement } from 'shared/components/element.js';
import { RosterFilter } from "@converse/headless";
//# sourceMappingURL=occupants.d.ts.map