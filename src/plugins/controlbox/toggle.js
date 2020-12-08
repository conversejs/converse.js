import tpl_controlbox_toggle from "./templates/toggle.js";
import { ElementView } from '@converse/skeletor/src/element.js';
import { _converse, api, converse } from "@converse/headless/core";
import { addControlBox } from './utils.js';
import { render } from 'lit-html';

const u = converse.env.utils;


class ControlBoxToggle extends ElementView {
    events = {
        'click': 'onClick'
    }

    async initialize () {
        await api.waitUntil('initialized');
        this.render();
    }

    render () {
        // We let the render method of ControlBoxView decide whether
        // the ControlBox or the Toggle must be shown. This prevents
        // artifacts (i.e. on page load the toggle is shown only to then
        // seconds later be hidden in favor of the controlbox).
        render(tpl_controlbox_toggle(), this);
        return this;
    }

    hide (callback) {
        if (u.isVisible(this)) {
            u.hideElement(this);
            callback();
        }
    }

    show (callback) {
        if (!u.isVisible(this)) {
            u.fadeIn(this, callback);
        }
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
