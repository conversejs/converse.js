import { _converse, api, converse } from "@converse/headless";
import ControlBox from "./model.js";

const { u } = converse.env;

export default {
    /**
     * The "controlbox" namespace groups methods pertaining to the
     * controlbox view
     *
     * @namespace _converse.api.controlbox
     * @memberOf _converse.api
     */
    controlbox: {
        /**
         * Opens the controlbox
         * @method _converse.api.controlbox.open
         * @returns { Promise<ControlBox> }
         */
        async open () {
            await api.waitUntil('chatBoxesFetched');
            let model = await api.chatboxes.get('controlbox');
            if (!model) {
              model = await api.chatboxes.create('controlbox', {}, ControlBox);
            }
            u.safeSave(model, {'closed': false});
            return model;
        },

        /**
         * Returns the controlbox view.
         * @method _converse.api.controlbox.get
         * @returns {ControlBox} View representing the controlbox
         * @example const view = _converse.api.controlbox.get();
         */
        get () {
            return _converse.state.chatboxviews.get('controlbox');
        }
    }
}
