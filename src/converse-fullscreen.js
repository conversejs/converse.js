// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) JC Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/**
 * @module converse-fullscreen
 */
import "@converse/headless/converse-muc";
import "converse-chatview";
import "converse-controlbox";
import "converse-singleton";
import converse from "@converse/headless/converse-core";
import tpl_brand_heading from "templates/inverse_brand_heading.html";


converse.plugins.add('converse-fullscreen', {

    enabled (_converse) {
        return _converse.isUniView();
    },

    overrides: {
        // overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        //
        // new functions which don't exist yet can also be added.

        ControlBoxView: {
            createBrandHeadingHTML() {
                const { _converse } = this.__super__;
                return tpl_brand_heading({
                    'version_name': _converse.VERSION_NAME
                });
            },

            insertBrandHeading () {
                const { _converse } = this.__super__;
                const el = _converse.root.getElementById('converse-login-panel');
                el.parentNode.insertAdjacentHTML(
                    'afterbegin',
                    this.createBrandHeadingHTML()
                );
            }
        }
    },

    initialize () {
        this._converse.api.settings.update({
            chatview_avatar_height: 50,
            chatview_avatar_width: 50,
            hide_open_bookmarks: true,
            show_controlbox_by_default: true,
            sticky_controlbox: true
        });
    }
});
