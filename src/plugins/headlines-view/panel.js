import tpl_headline_panel from './templates/panel.js';
import { ElementView } from '@converse/skeletor/src/element.js';
import { __ } from 'i18n';
import { _converse, api } from '@converse/headless/core';

/**
 * View which renders headlines section of the control box.
 * @class
 * @namespace _converse.HeadlinesPanel
 * @memberOf _converse
 */
export class HeadlinesPanel extends ElementView {
    events = {
        'click .open-headline': 'openHeadline'
    }

    initialize () {
        this.model = _converse.chatboxes;
        this.listenTo(this.model, 'add', this.renderIfHeadline);
        this.listenTo(this.model, 'remove', this.renderIfHeadline);
        this.listenTo(this.model, 'destroy', this.renderIfHeadline);
        this.render();
    }

    toHTML () {
        return tpl_headline_panel({
            'heading_headline': __('Announcements'),
            'headlineboxes': this.model.filter(m => m.get('type') === _converse.HEADLINES_TYPE),
            'open_title': __('Click to open this server message')
        });
    }

    renderIfHeadline (model) {
        return model && model.get('type') === _converse.HEADLINES_TYPE && this.render();
    }

    openHeadline (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
        const jid = ev.target.getAttribute('data-headline-jid');
        const chat = _converse.chatboxes.get(jid);
        chat.maybeShow(true);
    }
}

api.elements.define('converse-headlines-panel', HeadlinesPanel);
