import tpl_controlbox from './templates/controlbox.js';
import { render } from 'lit-html';
import { _converse, api, converse } from '@converse/headless/core';

const u = converse.env.utils;

/**
 * Mixin which turns a ChatBoxView into a ControlBoxView.
 *
 * The ControlBox is the section of the chat that contains the open groupchats,
 * bookmarks and roster.
 *
 * In `overlayed` `view_mode` it's a box like the chat boxes, in `fullscreen`
 * `view_mode` it's a left-aligned sidebar.
 * @mixin
 */
const ControlBoxViewMixin = {
    tagName: 'div',
    className: 'chatbox',
    id: 'controlbox',
    events: {
        'click a.close-chatbox-button': 'close'
    },

    initialize () {
        if (_converse.controlboxtoggle === undefined) {
            _converse.controlboxtoggle = new _converse.ControlBoxToggle();
        }
        _converse.controlboxtoggle.el.insertAdjacentElement('afterend', this.el);

        this.listenTo(this.model, 'change:connected', this.onConnected);
        this.listenTo(this.model, 'destroy', this.hide);
        this.listenTo(this.model, 'hide', this.hide);
        this.listenTo(this.model, 'show', this.show);
        this.listenTo(this.model, 'change:closed', this.ensureClosedState);
        this.render();
        /**
         * Triggered when the _converse.ControlBoxView has been initialized and therefore
         * exists. The controlbox contains the login and register forms when the user is
         * logged out and a list of the user's contacts and group chats when logged in.
         * @event _converse#controlBoxInitialized
         * @type { _converse.ControlBoxView }
         * @example _converse.api.listen.on('controlBoxInitialized', view => { ... });
         */
        api.trigger('controlBoxInitialized', this);
    },

    render () {
        if (this.model.get('connected')) {
            if (this.model.get('closed') === undefined) {
                this.model.set('closed', !api.settings.get('show_controlbox_by_default'));
            }
        }

        const tpl_result = tpl_controlbox({
            'sticky_controlbox': api.settings.get('sticky_controlbox'),
            ...this.model.toJSON()
        });
        render(tpl_result, this.el);

        if (!this.model.get('closed')) {
            this.show();
        } else {
            this.hide();
        }

        const connection = _converse?.connection || {};
        if (!connection.connected || !connection.authenticated || connection.disconnecting) {
            this.renderLoginPanel();
        } else if (this.model.get('connected')) {
            this.renderControlBoxPane();
        }
        return this;
    },

    onConnected () {
        if (this.model.get('connected')) {
            this.render();
        }
    },

    renderLoginPanel () {
        this.el.classList.add('logged-out');
        if (this.loginpanel) {
            this.loginpanel.render();
        } else {
            this.loginpanel = new _converse.LoginPanel({
                'model': new _converse.LoginPanelModel()
            });
            const panes = this.el.querySelector('.controlbox-panes');
            panes.innerHTML = '';
            panes.appendChild(this.loginpanel.render().el);
        }
        this.loginpanel.initPopovers();
        return this;
    },

    /**
     * Renders the "Contacts" panel of the controlbox.
     * This will only be called after the user has already been logged in.
     * @private
     * @method _converse.ControlBoxView.renderControlBoxPane
     */
    renderControlBoxPane () {
        if (this.loginpanel) {
            this.loginpanel.remove();
            delete this.loginpanel;
        }
        if (this.controlbox_pane && u.isVisible(this.controlbox_pane.el)) {
            return;
        }
        this.el.classList.remove('logged-out');
        this.controlbox_pane = new _converse.ControlBoxPane();
        this.el
            .querySelector('.controlbox-panes')
            .insertAdjacentElement('afterBegin', this.controlbox_pane.el);
    },

    async close (ev) {
        if (ev && ev.preventDefault) {
            ev.preventDefault();
        }
        if (
            ev?.name === 'closeAllChatBoxes' &&
            (_converse.disconnection_cause !== _converse.LOGOUT ||
                api.settings.get('show_controlbox_by_default'))
        ) {
            return;
        }
        if (api.settings.get('sticky_controlbox')) {
            return;
        }
        const connection = _converse?.connection || {};
        if (connection.connected && !connection.disconnecting) {
            await new Promise((resolve, reject) => {
                return this.model.save(
                    { 'closed': true },
                    { 'success': resolve, 'error': reject, 'wait': true }
                );
            });
        } else {
            this.model.trigger('hide');
        }
        api.trigger('controlBoxClosed', this);
        return this;
    },

    ensureClosedState () {
        if (this.model.get('closed')) {
            this.hide();
        } else {
            this.show();
        }
    },

    hide (callback) {
        if (api.settings.get('sticky_controlbox')) {
            return;
        }
        u.addClass('hidden', this.el);
        api.trigger('chatBoxClosed', this);
        if (!api.connection.connected()) {
            _converse.controlboxtoggle.render();
        }
        _converse.controlboxtoggle.show(callback);
        return this;
    },

    onControlBoxToggleHidden () {
        this.model.set('closed', false);
        this.el.classList.remove('hidden');
        /**
         * Triggered once the controlbox has been opened
         * @event _converse#controlBoxOpened
         * @type {_converse.ControlBox}
         */
        api.trigger('controlBoxOpened', this);
    },

    show () {
        _converse.controlboxtoggle.hide(() => this.onControlBoxToggleHidden());
        return this;
    },

    showHelpMessages () {
        return;
    }
};

export default ControlBoxViewMixin;
