/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "modals/chat-status.js";
import "modals/profile.js";
import "../modal.js";
import "@converse/headless/plugins/status";
import "@converse/headless/plugins/vcard";
import XMPPStatusView from './statusview.js';
import { _converse, api, converse } from "@converse/headless/core";


converse.plugins.add('converse-profile', {

    dependencies: ["converse-status", "converse-modal", "converse-vcard", "converse-chatboxviews"],

    initialize () {
        api.settings.extend({
            'allow_adhoc_commands': true,
            'show_client_info': true
        });

        _converse.XMPPStatusView = XMPPStatusView;
    }
});
