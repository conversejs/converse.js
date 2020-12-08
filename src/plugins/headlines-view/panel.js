import tpl_headline_panel from './templates/panel.js';
import { ElementView } from '@converse/skeletor/src/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';

const u = converse.env.utils;

/**
 * View which renders headlines section of the control box.
 * @class
 * @namespace _converse.HeadlinesPanel
 * @memberOf _converse
 */
export class HeadlinesPanel extends ElementView {
    tagName = 'div'
    className = 'controlbox-section'
    id = 'headline'
    events = {
        'click .open-headline': 'openHeadline'
    }

    initialize () {
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

/**
 * Mixin for the {@link _converse.ControlBoxView } which add support for
 * rendering a list of headline chats.
 * @mixin
 */
export const HeadlinesPanelMixin = {
    renderHeadlinesPanel () {
        if (this.headlinepanel && u.isInDOM(this.headlinepanel.el)) {
            return this.headlinepanel;
        }
        this.headlinepanel = new _converse.HeadlinesPanel({ 'model': _converse.chatboxes });
        /**
         * Triggered once the section of the { @link _converse.ControlBoxView }
         * which shows announcements has been rendered.
         * @event _converse#headlinesPanelRendered
         * @example _converse.api.listen.on('headlinesPanelRendered', () => { ... });
         */
        api.trigger('headlinesPanelRendered');
        return this.headlinepanel;
    }
};
