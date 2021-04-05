import tpl_controlbox_toggle from "./templates/toggle.js";
import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from "@converse/headless/core";
import { showControlBox } from './utils.js';


class ControlBoxToggle extends CustomElement {

    async connectedCallback () {
        super.connectedCallback();
        await api.waitUntil('initialized')
        this.model = _converse.chatboxes.get('controlbox');
        this.listenTo(this.model, 'change:closed', () => this.requestUpdate());
        this.requestUpdate();
    }

    render () {
        return tpl_controlbox_toggle({
            'onClick': showControlBox,
            'hide': !this.model?.get('closed')
        });
    }
}

api.elements.define('converse-controlbox-toggle', ControlBoxToggle);

export default ControlBoxToggle;
