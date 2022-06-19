import tpl_chat_head from './templates/chat-head.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core.js";


export default class HeadlinesHeading extends CustomElement {

    static get properties () {
        return {
            'jid': { type: String },
        }
    }

    async initialize () {
        this.model = _converse.chatboxes.get(this.jid);
        await this.model.initialized;
        this.requestUpdate();
    }

    render () {
        return tpl_chat_head({
            ...this.model.toJSON(),
            ...{
                'display_name': this.model.getDisplayName(),
                'heading_buttons_promise': this.getHeadingButtons()
            }
        });
    }

    /**
     * Returns a list of objects which represent buttons for the headlines header.
     * @async
     * @emits _converse#getHeadingButtons
     * @method HeadlinesHeading#getHeadingButtons
     */
    getHeadingButtons () {
        const buttons = [];
        if (!api.settings.get('singleton')) {
            buttons.push({
                'a_class': 'close-chatbox-button',
                'handler': ev => this.close(ev),
                'i18n_text': __('Close'),
                'i18n_title': __('Close these announcements'),
                'icon_class': 'fa-times',
                'name': 'close',
                'standalone': api.settings.get('view_mode') === 'overlayed'
            });
        }
        return _converse.api.hook('getHeadingButtons', this, buttons);
    }

    close (ev) {
        ev.preventDefault();
        this.model.close();
    }
}

api.elements.define('converse-headlines-heading', HeadlinesHeading);
