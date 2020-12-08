import tpl_background_logo from '../../templates/background_logo.js';
import tpl_converse from '../../templates/converse.js';
import { Overview } from '@converse/skeletor/src/overview';
import { render } from 'lit-html';
import { result } from 'lodash-es';
import { _converse, api, converse } from '@converse/headless/core';

const u = converse.env.utils;


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
        this.listenTo(this.model, 'destroy', this.removeChat);
        const bg = document.getElementById('conversejs-bg');
        if (bg && !bg.innerHTML.trim()) {
            render(tpl_background_logo(), bg);
        }
        const body = document.querySelector('body');
        body.classList.add(`converse-${api.settings.get('view_mode')}`);
        this.el.classList.add(`converse-${api.settings.get('view_mode')}`);
        if (api.settings.get('singleton')) {
            this.el.classList.add(`converse-singleton`);
        }
        this.render();
    },

    render () {
        this._ensureElement();
        render(tpl_converse(), this.el);
        this.row_el = this.el.querySelector('.row');
    },

    /**
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
        return Promise.all(this.map(v => v.close({ 'name': 'closeAllChatBoxes' })));
    }
});

export default ChatBoxViews;
