// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) JC Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define(["converse-core",
            "tpl!inverse_brand_heading",
            "converse-chatview",
            "converse-controlbox",
            "converse-muc",
            "converse-singleton"
    ], factory);
}(this, function (converse, tpl_brand_heading) {
    "use strict";
    const { Strophe, _ } = converse.env;

    converse.plugins.add('converse-fullscreen', {

        enabled (_converse) {
            return _.includes(['mobile', 'fullscreen'], _converse.view_mode);
        },

        overrides: {
            // overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // new functions which don't exist yet can also be added.

            ControlBoxView: {
                 createBrandHeadingHTML() {
                    return tpl_brand_heading();
                },

                insertBrandHeading () {
                    const el = document.getElementById('converse-login-panel');
                    el.parentNode.insertAdjacentHTML(
                        'afterbegin',
                        this.createBrandHeadingHTML()
                    );
                }
            },

            ChatRoomView: {
                afterShown (focus) {
                    /* Make sure chat rooms are scrolled down when opened
                     */
                    this.scrollDown();
                    if (focus) {
                        this.focus();
                    }
                    return this.__super__.afterShown.apply(this, arguments);
                }
            }
        },

        initialize () {
            this._converse.api.settings.update({
                chatview_avatar_height: 44,
                chatview_avatar_width: 44,
                hide_open_bookmarks: true,
                show_controlbox_by_default: true,
                sticky_controlbox: true
            });
        }
    });
}));
