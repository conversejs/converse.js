export default class OccupantBottomPanel extends BottomPanel {
    static get properties(): {
        model: {
            type: ObjectConstructor;
            noAccessor: boolean;
        };
        muc: {
            type: ObjectConstructor;
        };
    };
    muc: any;
    canPostMessages(): boolean;
    openChat(): any;
    invite(): any;
}
import BottomPanel from 'plugins/chatview/bottom-panel.js';
//# sourceMappingURL=occupant-bottom-panel.d.ts.map