import ChatHeading from 'plugins/chatview/heading.js';
import tpl_chat_head from './templates/chat-head.js';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";
import { getHeadingDropdownItem, getHeadingStandaloneButton } from 'plugins/chatview/utils.js';


export default class HeadlinesHeading extends ChatHeading {

    async connectedCallback () {
        super.connectedCallback();
        this.model = _converse.chatboxes.get(this.getAttribute('jid'));
        await this.model.initialized;
        this.render();
    }

    async generateHeadingTemplate () {
        const heading_btns = await this.getHeadingButtons();
        const standalone_btns = heading_btns.filter(b => b.standalone);
        const dropdown_btns = heading_btns.filter(b => !b.standalone);
        return tpl_chat_head(
            Object.assign(this.model.toJSON(), {
                'display_name': this.model.getDisplayName(),
                'dropdown_btns': dropdown_btns.map(b => getHeadingDropdownItem(b)),
                'standalone_btns': standalone_btns.map(b => getHeadingStandaloneButton(b))
            })
        );
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

}

api.elements.define('converse-headlines-heading', HeadlinesHeading);
