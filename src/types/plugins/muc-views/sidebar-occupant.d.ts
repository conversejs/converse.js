export default class MUCOccupantListItem extends ObservableElement {
    static get properties(): {
        model: {
            type: typeof Model;
        };
        muc: {
            type: typeof MUC;
        };
        observable: {
            type: StringConstructor;
        };
        intersectionRatio: {
            type: NumberConstructor;
        };
    };
    muc: any;
    initialize(): Promise<void>;
    render(): "" | import("lit").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     * @param {import('@converse/headless/types/plugins/muc/occupant.js').default} occupant
     */
    onOccupantClicked(ev: MouseEvent, occupant: import("@converse/headless/types/plugins/muc/occupant.js").default): void;
}
import { ObservableElement } from "shared/components/observable.js";
import { Model } from "@converse/skeletor";
import { MUC } from "@converse/headless";
//# sourceMappingURL=sidebar-occupant.d.ts.map