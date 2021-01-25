import { _converse, api, converse } from "@converse/headless/core";

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
         * @returns { Promise<_converse.ControlBox> }
         */
        async open () {
            await api.waitUntil('chatBoxesFetched');
            const model = await api.chatboxes.get('controlbox') ||
              api.chatboxes.create('controlbox', {}, _converse.Controlbox);
            u.safeSave(model, {'closed': false});
            return model;
        },

        /**
         * Returns the controlbox view.
         * @method _converse.api.controlbox.get
         * @returns { View } View representing the controlbox
         * @example const view = _converse.api.controlbox.get();
         */
        get () {
            return _converse.chatboxviews.get('controlbox');
        }
    }
}
