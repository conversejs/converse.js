import { _converse, api, constants, u } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { MOBILE_CUTOFF } from 'shared/constants.js';
import tplControlbox from './templates/controlbox.js';
import './navbar.js';

const { LOGOUT } = constants;

/**
 * The ControlBox is the section of the chat that contains the open groupchats,
 * bookmarks and roster.
 *
 * In `overlayed` `view_mode` it's a box like the chat boxes, in `fullscreen`
 * `view_mode` it's a left-aligned sidebar.
 */
class ControlBoxView extends CustomElement {
    initialize() {
        this.setModel();
        const { chatboxviews } = _converse.state;
        chatboxviews.add('controlbox', this);
        if (this.model.get('connected') && this.model.get('closed') === undefined) {
            this.model.set('closed', !api.settings.get('show_controlbox_by_default'));
        }
        this.viewportMediaQuery = window.matchMedia(`(max-width: ${MOBILE_CUTOFF}px)`);
        this.renderOnViewportChange = () => this.requestUpdate();
        /**
         * Triggered when the _converse.ControlBoxView has been initialized and therefore
         * exists. The controlbox contains the login and register forms when the user is
         * logged out and a list of the user's contacts and group chats when logged in.
         * @event _converse#controlBoxInitialized
         * @type {ControlBoxView}
         * @example _converse.api.listen.on('controlBoxInitialized', view => { ... });
         */
        api.trigger('controlBoxInitialized', this);
    }

    connectedCallback() {
        super.connectedCallback();
        this.viewportMediaQuery.addEventListener('change', this.renderOnViewportChange);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        _converse.state.chatboxviews.remove('controlbox', this);
        this.viewportMediaQuery.removeEventListener('change', this.renderOnViewportChange);
    }

    setModel() {
        this.model = _converse.state.chatboxes.get('controlbox');
        this.listenTo(_converse.state.connfeedback, 'change:connection_status', () => this.requestUpdate());
        this.listenTo(this.model, 'change:active-form', () => this.requestUpdate());
        this.listenTo(this.model, 'change:connected', () => this.requestUpdate());
        this.requestUpdate();
    }

    render() {
        if (api.settings.get('view_mode') === 'overlayed') {
            return this.model && !this.model.get('closed') ? tplControlbox(this) : '';
        }
        return tplControlbox(this);
    }

    close(ev) {
        ev?.preventDefault?.();
        const connection = api.connection.get();
        if (
            ev?.name === 'closeAllChatBoxes' &&
            (connection.disconnection_cause !== LOGOUT || api.settings.get('show_controlbox_by_default'))
        ) {
            return;
        }
        if (api.settings.get('sticky_controlbox') || api.settings.get('view_mode') !== 'overlayed') {
            return;
        }
        u.safeSave(this.model, { closed: true });
        api.trigger('controlBoxClosed', this);
        return this;
    }
}

api.elements.define('converse-controlbox', ControlBoxView);

export default ControlBoxView;
