import 'shared/autocomplete/index.js';
import tplMUCSidebar from "./templates/muc-sidebar.js";
import { CustomElement } from 'shared/components/element.js';
import { _converse, api, converse } from "@converse/headless";
import { RosterFilter } from 'headless/plugins/roster/filter.js';
import { initStorage } from "headless/utils/storage";
import debounce from 'lodash-es/debounce.js';

import 'shared/styles/status.scss';
import './styles/muc-occupants.scss';

const { u } = converse.env;

export default class MUCSidebar extends CustomElement {

    static get properties () {
        return {
            jid: { type: String }
        }
    }

    initialize() {
        const filter_id = `_converse.occupants-filter-${this.jid}`;
        this.filter = new RosterFilter();
        this.filter.id = filter_id;
        initStorage(this.filter, filter_id);
        this.filter.fetch();

        this.model = _converse.chatboxes.get(this.jid);

        // To avoid rendering continuously the participant list in case of massive joins/leaves:
        const debouncedRequestUpdate = debounce(() => this.requestUpdate(), 200, {
            maxWait: 1000
        });

        this.listenTo(this.model.occupants, 'add', debouncedRequestUpdate);
        this.listenTo(this.model.occupants, 'remove', debouncedRequestUpdate);
        this.listenTo(this.model.occupants, 'change', debouncedRequestUpdate);
        this.listenTo(this.model.occupants, 'sort', debouncedRequestUpdate);
        this.listenTo(this.model.occupants, 'vcard:change', debouncedRequestUpdate);
        this.listenTo(this.model.occupants, 'vcard:add', debouncedRequestUpdate);

        this.model.initialized.then(() => this.requestUpdate());
    }

    render () {
        const tpl = tplMUCSidebar(this, Object.assign(
            this.model.toJSON(), {
                'occupants': [...this.model.occupants.models],
                'onOccupantClicked': ev => this.onOccupantClicked(ev),
            }
        ));
        return tpl;
    }

    closeSidebar(ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        u.safeSave(this.model, { 'hidden_occupants': true });
    }

    onOccupantClicked (ev) {
        ev?.preventDefault?.();
        const view = _converse.chatboxviews.get(this.getAttribute('jid'));
        view?.getMessageForm().insertIntoTextArea(`@${ev.target.textContent}`);
    }
}

api.elements.define('converse-muc-sidebar', MUCSidebar);
