import { _converse, api } from "@converse/headless";
import { CustomElement } from 'shared/components/element.js';
import tplControlboxToggle from "./templates/toggle.js";


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
        return tplControlboxToggle(this);
    }
}

api.elements.define('converse-controlbox-toggle', ControlBoxToggle);

export default ControlBoxToggle;
