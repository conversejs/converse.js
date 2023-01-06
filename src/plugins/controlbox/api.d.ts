declare namespace _default {
    namespace controlbox {
        /**
         * Opens the controlbox
         * @method _converse.api.controlbox.open
         * @returns { Promise<_converse.ControlBox> }
         */
        function open(): Promise<_converse.ControlBox>;
        /**
         * Returns the controlbox view.
         * @method _converse.api.controlbox.get
         * @returns { View } View representing the controlbox
         * @example const view = _converse.api.controlbox.get();
         */
        function get(): View;
    }
}
export default _default;
