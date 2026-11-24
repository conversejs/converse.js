import { _converse, api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplAppContainer from './templates/app-container.js';
import './app-switcher.js';

class AppContainer extends CustomElement {
    initialize() {
        api.listen.on('appSwitch', () => this.requestUpdate());
        this.listenTo(_converse.state.connfeedback, 'change:connection_status', () => this.requestUpdate());
        // The session only ends after the status has changed, once the connection is gone.
        this.listenTo(_converse, 'disconnected', () => this.requestUpdate());
    }

    render() {
        return tplAppContainer();
    }
}

api.elements.define('converse-app-container', AppContainer);
