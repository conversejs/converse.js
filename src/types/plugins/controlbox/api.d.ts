declare namespace _default {
    namespace controlbox {
        /**
         * Opens the controlbox
         * @method _converse.api.controlbox.open
         * @returns { Promise<ControlBox> }
         */
        function open(): Promise<ControlBox>;
        /**
         * Returns the controlbox view.
         * @method _converse.api.controlbox.get
         * @returns {ControlBox} View representing the controlbox
         * @example const view = _converse.api.controlbox.get();
         */
        function get(): ControlBox;
    }
}
export default _default;
import ControlBox from "./model.js";
//# sourceMappingURL=api.d.ts.map