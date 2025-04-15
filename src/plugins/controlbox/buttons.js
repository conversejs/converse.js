import { _converse, api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplButtons from './templates/buttons.js';

import './styles/buttons.scss';

class ControlboxButtons extends CustomElement {
    initialize() {
        const { chatboxes } = _converse.state;
        this.model = chatboxes.get('controlbox');
    }

    render() {
        return tplButtons(this);
    }

    /**
     * @param {MouseEvent} ev
     */
    showUserSettingsModal(ev) {
        ev?.preventDefault();
        api.modal.show('converse-user-settings-modal', { model: _converse.state.xmppstatus, _converse }, ev);
    }

    /**
     * @param {MouseEvent} ev
     */
    closeControlBox(ev) {
        ev?.preventDefault();
        const view = _converse.state.chatboxviews.get('controlbox');
        view?.close();
    }
}

api.elements.define('converse-controlbox-buttons', ControlboxButtons);

export default ControlboxButtons;
