/**
 * @module converse-chatboxviews
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import './components/converse.js';
import "@converse/headless/converse-chatboxes";
import tpl_avatar from "templates/avatar.js";
import tpl_background_logo from "templates/background_logo.js";
import tpl_converse from "templates/converse.js";
import { Overview } from "@converse/skeletor/src/overview";
import { View } from "@converse/skeletor/src/view";
import { _converse, api, converse } from "@converse/headless/converse-core";
import { render } from "lit-html";
import { result } from "lodash-es";

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
                'image_type':  this.model.vcard.get('image_type'),
                'image':  this.model.vcard.get('image')
            }
            avatar_el.outerHTML = u.getElementFromTemplateResult(tpl_avatar(data)).outerHTML;
        }
    },
};


const ViewWithAvatar = View.extend(AvatarMixin);


const ChatBoxViews = Overview.extend({

    _ensureElement () {
        /* Override method from backbone.js
            * If the #conversejs element doesn't exist, create it.
            */
        if (this.el) {
            this.setElement(result(this, 'el'), false);
        } else {
            let el = _converse.root.querySelector('#conversejs');
            if (el === null) {
                el = document.createElement('div');
                el.setAttribute('id', 'conversejs');
                u.addClass(`theme-${api.settings.get('theme')}`, el);
                const body = _converse.root.querySelector('body');
                if (body) {
                    body.appendChild(el);
                } else {
                    // Perhaps inside a web component?
                    _converse.root.appendChild(el);
                }
            }
            this.setElement(el, false);
        }
    },

    initialize () {
        this.listenTo(this.model, "destroy", this.removeChat)
        const bg = document.getElementById('conversejs-bg');
        if (bg && !bg.innerHTML.trim()) {
            render(tpl_background_logo(), bg);
        }
        const body = document.querySelector('body');
        body.classList.add(`converse-${api.settings.get("view_mode")}`);
        this.el.classList.add(`converse-${api.settings.get("view_mode")}`);
        if (api.settings.get("singleton")) {
            this.el.classList.add(`converse-singleton`);
        }
        this.render();
    },

    render () {
        this._ensureElement();
        render(tpl_converse(), this.el);
        this.row_el = this.el.querySelector('.row');
    },

    /*(
     * Add a new DOM element (likely a chat box) into the
     * the row managed by this overview.
     * @param { HTMLElement } el
     */
    insertRowColumn (el) {
        this.row_el.insertAdjacentElement('afterBegin', el);
    },

    removeChat (item) {
        this.remove(item.get('id'));
    },

    closeAllChatBoxes () {
        return Promise.all(this.map(v => v.close({'name': 'closeAllChatBoxes'})));
    }
});


function onChatBoxViewsInitialized () {
    _converse.chatboxviews = new _converse.ChatBoxViews({
        'model': _converse.chatboxes
    });
    /**
     * Triggered once the _converse.ChatBoxViews view-colleciton has been initialized
     * @event _converse#chatBoxViewsInitialized
     * @example _converse.api.listen.on('chatBoxViewsInitialized', () => { ... });
     */
    api.trigger('chatBoxViewsInitialized');
}


function calculateViewportHeightUnit () {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}


converse.plugins.add('converse-chatboxviews', {

    dependencies: ["converse-chatboxes", "converse-vcard"],


    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        api.elements.register();

        api.promises.add(['chatBoxViewsInitialized']);

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            'animate': true,
            'theme': 'default'
        });

        _converse.ViewWithAvatar = ViewWithAvatar;
        _converse.ChatBoxViews = ChatBoxViews;

        /************************ BEGIN Event Handlers ************************/
        api.listen.on('chatBoxesInitialized', onChatBoxViewsInitialized);
        api.listen.on('cleanup', () => (delete _converse.chatboxviews));
        api.listen.on('clearSession', () => _converse.chatboxviews.closeAllChatBoxes());
        api.listen.on('chatBoxViewsInitialized', calculateViewportHeightUnit);
        window.addEventListener('resize', calculateViewportHeightUnit);
        /************************ END Event Handlers ************************/


        Object.assign(converse, {
            /**
             * Public API method which will ensure that the #conversejs element
             * is inserted into a container element.
             *
             * This method is useful when the #conversejs element has been
             * detached from the DOM somehow.
             * @async
             * @memberOf converse
             * @method insertInto
             * @example
             * converse.insertInto(document.querySelector('#converse-container'));
             */
            insertInto (container) {
                const el = _converse.chatboxviews?.el;
                if (el && !container.contains(el)) {
                    container.insertAdjacentElement('afterBegin', el);
                    api.chatviews.get()
                        .filter(v => v.model.get('id') !== 'controlbox')
                        .forEach(v => v.maintainScrollTop());

                } else if (!el) {
                    throw new Error("Cannot insert non-existing #conversejs element into the DOM");
                }
            }
        });
    }
});
