import log from "@converse/headless/log";
import tpl_controlbox_toggle from "./templates/toggle.js";
import { View } from "@converse/skeletor/src/view";
import { _converse, api, converse } from "@converse/headless/core";
import { addControlBox } from './utils.js';
import { render } from 'lit-html';

const u = converse.env.utils;


const ControlBoxToggle = View.extend({
    tagName: 'a',
    className: 'toggle-controlbox hidden',
    id: 'toggle-controlbox',
    events: {
        'click': 'onClick'
    },
    attributes: {
        'href': "#"
    },

    initialize () {
        _converse.chatboxviews.insertRowColumn(this.render().el);
        api.waitUntil('initialized')
            .then(this.render.bind(this))
            .catch(e => log.fatal(e));
    },

    render () {
        // We let the render method of ControlBoxView decide whether
        // the ControlBox or the Toggle must be shown. This prevents
        // artifacts (i.e. on page load the toggle is shown only to then
        // seconds later be hidden in favor of the controlbox).
        render(tpl_controlbox_toggle(), this.el);
        return this;
    },

    hide (callback) {
        if (u.isVisible(this.el)) {
            u.hideElement(this.el);
            callback();
        }
    },

    show (callback) {
        if (!u.isVisible(this.el)) {
            u.fadeIn(this.el, callback);
        }
    },

    showControlBox () {
        let controlbox = _converse.chatboxes.get('controlbox');
        if (!controlbox) {
            controlbox = addControlBox();
        }
        if (api.connection.connected()) {
            controlbox.save({'closed': false});
        } else {
            controlbox.trigger('show');
        }
    },

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
});

export default ControlBoxToggle;
