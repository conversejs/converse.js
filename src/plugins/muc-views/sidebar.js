import { _converse, api, u } from "@converse/headless";
import { CustomElement } from 'shared/components/element.js';
import tplMUCSidebar from "./templates/muc-sidebar.js";
import './modals/muc-invite.js';
import './occupants.js';
import 'shared/autocomplete/index.js';

import 'shared/styles/status.scss';
import './styles/muc-sidebar.scss';

export default class MUCSidebar extends CustomElement {

    constructor () {
        super();
        this.jid = null;
    }

    static get properties () {
        return {
            jid: { type: String }
        }
    }

    initialize() {
        const { chatboxes } = _converse.state;
        this.model = chatboxes.get(this.jid);

        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.listenTo(this.model.features, 'change:open', () => this.requestUpdate());

        this.model.initialized.then(() => this.requestUpdate());
    }

    render () {
        return tplMUCSidebar(this);
    }

    /** @param {MouseEvent} ev */
    closeSidebar (ev) {
        ev?.preventDefault?.();
        u.safeSave(this.model, { 'hidden_occupants': true });
    }
}

api.elements.define('converse-muc-sidebar', MUCSidebar);
