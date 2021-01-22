import tpl_controlbox_toggle from "./templates/toggle.js";
import { ElementView } from '@converse/skeletor/src/element.js';
import { _converse, api, converse } from "@converse/headless/core";
import { addControlBox } from './utils.js';
import { render } from 'lit-html';

const u = converse.env.utils;


class ControlBoxToggle extends ElementView {

    async initialize () {
        await api.waitUntil('initialized');
        this.render();
    }

    render () {
        const controlbox = _converse.chatboxes.get('controlbox');
        render(tpl_controlbox_toggle({
            'onClick': (ev) => this.onClick(ev),
            'hide': !controlbox.get('closed')
        }), this);
    }

    showControlBox () { // eslint-disable-line class-methods-use-this
        let controlbox = _converse.chatboxes.get('controlbox');
        if (!controlbox) {
            controlbox = addControlBox();
        }
        if (api.connection.connected()) {
            controlbox.save({'closed': false});
        } else {
            controlbox.trigger('show');
        }
    }

    onClick (e) {
        e.preventDefault();
        if (u.isVisible(_converse.root.querySelector("#controlbox"))) {
            const controlbox = _converse.chatboxes.get('controlbox');
            if (api.connection.connected) {
                controlbox.save({closed: true});
            } else {
                controlbox.trigger('hide');
            }
        } else {
            this.showControlBox();
        }
    }
}

api.elements.define('converse-controlbox-toggle', ControlBoxToggle);

export default ControlBoxToggle;
