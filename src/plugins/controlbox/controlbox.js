import tpl_controlbox from './templates/controlbox.js';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api, converse } from '@converse/headless/core.js';

const u = converse.env.utils;

/**
 * The ControlBox is the section of the chat that contains the open groupchats,
 * bookmarks and roster.
 *
 * In `overlayed` `view_mode` it's a box like the chat boxes, in `fullscreen`
 * `view_mode` it's a left-aligned sidebar.
 */
class ControlBox extends CustomElement {

    initialize () {
        this.setModel();
        _converse.chatboxviews.add('controlbox', this);
        if (this.model.get('connected') && this.model.get('closed') === undefined) {
            this.model.set('closed', !api.settings.get('show_controlbox_by_default'));
        }
        this.requestUpdate();

        /**
         * Triggered when the _converse.ControlBoxView has been initialized and therefore
         * exists. The controlbox contains the login and register forms when the user is
         * logged out and a list of the user's contacts and group chats when logged in.
         * @event _converse#controlBoxInitialized
         * @type { _converse.ControlBoxView }
         * @example _converse.api.listen.on('controlBoxInitialized', view => { ... });
         */
        api.trigger('controlBoxInitialized', this);
    }

    setModel () {
        this.model = _converse.chatboxes.get('controlbox');
        this.listenTo(_converse.connfeedback, 'change:connection_status', () => this.requestUpdate());
        this.listenTo(this.model, 'change:active-form', () => this.requestUpdate());
        this.listenTo(this.model, 'change:connected', () => this.requestUpdate());
        this.listenTo(this.model, 'change:closed', () => !this.model.get('closed') && this.afterShown());
        this.requestUpdate();
    }

    render () {
        return this.model ? tpl_controlbox(this) : '';
    }

    close (ev) {
        ev?.preventDefault?.();
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
        u.safeSave(this.model, { 'closed': true });
        api.trigger('controlBoxClosed', this);
        return this;
    }

    afterShown () {
        /**
         * Triggered once the controlbox has been opened
         * @event _converse#controlBoxOpened
         * @type {_converse.ControlBox}
         */
        api.trigger('controlBoxOpened', this);
        return this;
    }
}

api.elements.define('converse-controlbox', ControlBox);

export default ControlBox;
