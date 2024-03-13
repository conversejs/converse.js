import tplControlboxToggle from "./templates/toggle.js";
import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from "@converse/headless";
import { showControlBox } from './utils.js';


class ControlBoxToggle extends CustomElement {

    async connectedCallback () {
        super.connectedCallback();
        await api.waitUntil('initialized')

        const { chatboxes } = _converse.state;
        this.model = chatboxes.get('controlbox');
        this.listenTo(this.model, 'change:closed', () => this.requestUpdate());
        this.requestUpdate();
    }

    render () {
        return tplControlboxToggle({
            'onClick': showControlBox,
            'hide': !this.model?.get('closed')
        });
    }
}

api.elements.define('converse-controlbox-toggle', ControlBoxToggle);

export default ControlBoxToggle;
