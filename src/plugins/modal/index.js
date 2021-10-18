/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import BootstrapModal from './base.js';
import modal_api from './api.js';
import { _converse, api, converse } from "@converse/headless/core";

converse.env.BootstrapModal = BootstrapModal; // expose to plugins


converse.plugins.add('converse-modal', {

    initialize () {
        api.listen.on('disconnect', () => {
            const container = document.querySelector("#converse-modals");
            if (container) {
                container.innerHTML = '';
            }
        });

        api.listen.on('clearSession', () => api.modal.removeAll());

        Object.assign(_converse.api, modal_api);
    }
});
