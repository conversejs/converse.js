/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, converse } from "@converse/headless";
import modal_api from "./api.js";
import BaseModal from "./modal.js";
import Popover from "./popover.js";
import Toast from './toast.js';
import './modals.js';
import './toasts.js';

converse.plugins.add("converse-modal", {
    initialize() {
        api.listen.on("clearSession", () => api.modal.removeAll());
        Object.assign(_converse.exports, { BaseModal, Popover, Toast });
        Object.assign(_converse.api, modal_api);
    },
});
