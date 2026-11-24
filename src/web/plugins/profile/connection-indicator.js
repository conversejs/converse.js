import { html, nothing } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import { ConnectionStateController } from 'shared/connection-state.js';
import { announce } from 'utils/accessibility.js';

import './styles/connection-indicator.scss';

/**
 * What was last announced. It's kept across indicators, so that one that's
 * mounted again, for example when the control box is opened again, doesn't
 * repeat it.
 * @type {import('shared/types').ConnectionState}
 */
let announced = 'connected';

/**
 * A new session starts out connected.
 */
export function resetAnnounced() {
    announced = 'connected';
}

/**
 * @returns {boolean} Whether this session has been connected before.
 */
function hasConnected() {
    return !!api.connection.get()?.has_connected;
}

/**
 * Shows that Converse is offline or reconnecting, and nothing once connected.
 */
class ConnectionIndicator extends CustomElement {
    constructor() {
        super();
        this.connection_state = new ConnectionStateController(this);
    }

    /**
     * @param {import('shared/types').ConnectionState} state
     * @returns {string}
     */
    getLabel(state) {
        if (state === 'offline') return __('Offline');
        if (state === 'connecting') return hasConnected() ? __('Reconnecting…') : __('Connecting…');
        return __('Connected');
    }

    updated() {
        const { state } = this.connection_state;
        if (state === announced) return;

        announced = state;
        announce(this.getLabel(state));
    }

    render() {
        const { state } = this.connection_state;
        if (state === 'connected') return nothing;

        const title =
            state === 'offline'
                ? __('There is no connection. New messages will arrive once you are connected again.')
                : hasConnected()
                  ? __('Trying to connect again')
                  : __('Trying to connect');
        return html`<span class="connection-indicator connection-indicator--${state}" title="${title}">
            <converse-icon
                class="fa ${state === 'offline' ? 'fa-times-circle' : 'fa-sync'}"
                color="var(--subdued-color)"
                css="margin-top: -0.1em"
                size="0.82em"
            ></converse-icon>
            <span class="connection-indicator__label">${this.getLabel(state)}</span>
        </span>`;
    }
}

api.elements.define('converse-connection-indicator', ConnectionIndicator);
