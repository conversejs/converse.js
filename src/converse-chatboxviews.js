/**
 * @module converse-chatboxviews
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "@converse/headless/converse-chatboxes";
import { Overview } from "skeletor.js/src/overview";
import { View } from "skeletor.js/src/view";
import { result } from "lodash";
import converse from "@converse/headless/converse-core";
import tpl_avatar from "templates/avatar.svg";
import tpl_background_logo from "templates/background_logo.html";
import tpl_chatboxes from "templates/chatboxes.html";

const u = converse.env.utils;


const AvatarMixin = {

    renderAvatar (el) {
        el = el || this.el;
        const avatar_el = el.querySelector('canvas.avatar, svg.avatar');
        if (avatar_el === null) {
            return;
        }
        if (this.model.vcard) {
            const data = {
                'classes': avatar_el.getAttribute('class'),
                'width': avatar_el.getAttribute('width'),
                'height': avatar_el.getAttribute('height'),
            }
            const image_type = this.model.vcard.get('image_type');
            const image = this.model.vcard.get('image');
            data['image'] = "data:" + image_type + ";base64," + image;
            avatar_el.outerHTML = tpl_avatar(data);
        }
    },
};


converse.plugins.add('converse-chatboxviews', {

    dependencies: ["converse-chatboxes", "converse-vcard"],


    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;

        _converse.api.promises.add(['chatBoxViewsInitialized']);

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        _converse.api.settings.update({
            'animate': true,
            'theme': 'default'
        });


        _converse.ViewWithAvatar = View.extend(AvatarMixin);


        _converse.ChatBoxViews = Overview.extend({

            _ensureElement () {
                /* Override method from backbone.js
                 * If the #conversejs element doesn't exist, create it.
                 */
                if (!this.el) {
                    let el = _converse.root.querySelector('#conversejs');
                    if (el === null) {
                        el = document.createElement('div');
                        el.setAttribute('id', 'conversejs');
                        u.addClass(`theme-${_converse.theme}`, el);
                        const body = _converse.root.querySelector('body');
                        if (body) {
                            body.appendChild(el);
                        } else {
                            // Perhaps inside a web component?
                            _converse.root.appendChild(el);
                        }
                    }
                    el.innerHTML = '';
                    this.setElement(el, false);
                } else {
                    this.setElement(result(this, 'el'), false);
                }
            },

            initialize () {
                this.listenTo(this.model, "destroy", this.removeChat)
                const bg = document.getElementById('conversejs-bg');
                if (bg && !bg.innerHTML.trim()) {
                    bg.innerHTML = tpl_background_logo();
                }
                const body = document.querySelector('body');
                body.classList.add(`converse-${_converse.view_mode}`);
                this.el.classList.add(`converse-${_converse.view_mode}`);
                if (_converse.singleton) {
                    this.el.classList.add(`converse-singleton`);
                }
                this.render();
            },

            render () {
                try {
                    this.el.innerHTML = tpl_chatboxes();
                } catch (e) {
                    this._ensureElement();
                    this.el.innerHTML = tpl_chatboxes();
                }
                this.row_el = this.el.querySelector('.row');
            },

            insertRowColumn (el) {
                /* Add a new DOM element (likely a chat box) into the
                 * the row managed by this overview.
                 */
                this.row_el.insertAdjacentElement('afterBegin', el);
            },

            removeChat (item) {
                this.remove(item.get('id'));
            },

            closeAllChatBoxes () {
                return Promise.all(this.map(v => v.close({'name': 'closeAllChatBoxes'})));
            }
        });


        /************************ BEGIN Event Handlers ************************/
        _converse.api.listen.on('chatBoxesInitialized', () => {
            _converse.chatboxviews = new _converse.ChatBoxViews({'model': _converse.chatboxes});
            /**
             * Triggered once the _converse.ChatBoxViews view-colleciton has been initialized
             * @event _converse#chatBoxViewsInitialized
             * @example _converse.api.listen.on('chatBoxViewsInitialized', () => { ... });
             */
            _converse.api.trigger('chatBoxViewsInitialized');
        });

        _converse.api.listen.on('clearSession', () => _converse.chatboxviews.closeAllChatBoxes());


        function calculateViewportHeightUnit () {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        }
        _converse.api.listen.on('chatBoxViewsInitialized', () => calculateViewportHeightUnit());
        window.addEventListener('resize', () => calculateViewportHeightUnit());
        /************************ END Event Handlers ************************/
    }
});
