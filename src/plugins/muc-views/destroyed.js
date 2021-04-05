import tpl_muc_destroyed from './templates/muc-destroyed.js';
import { CustomElement } from 'shared/components/element';
import { _converse, api } from "@converse/headless/core";


class MUCDestroyed extends CustomElement {

    static get properties () {
        return {
            'jid': { type: String }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.model = _converse.chatboxes.get(this.jid);
    }

    render () {
        const reason = this.model.get('destroyed_reason');
        const moved_jid = this.model.get('moved_jid');
        return tpl_muc_destroyed({
            moved_jid,
            reason,
            'onSwitch': ev => this.onSwitch(ev)
        });
    }

    async onSwitch (ev) {
        ev.preventDefault();
        const moved_jid = this.model.get('moved_jid');
        const room = await api.rooms.get(moved_jid, {}, true);
        room.maybeShow(true);
        this.model.destroy();
    }
}

api.elements.define('converse-muc-destroyed', MUCDestroyed);
