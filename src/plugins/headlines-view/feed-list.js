import tpl_feeds_list from './templates/feeds-list.js';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from '@converse/headless/core';

/**
 * Custom element which renders a list of headline feeds
 * @class
 * @namespace _converse.HeadlinesFeedsList
 * @memberOf _converse
 */
export class HeadlinesFeedsList extends CustomElement {

    initialize () {
        this.model = _converse.chatboxes;
        this.listenTo(this.model, 'add', (m) => this.renderIfHeadline(m));
        this.listenTo(this.model, 'remove', (m) => this.renderIfHeadline(m));
        this.listenTo(this.model, 'destroy', (m) => this.renderIfHeadline(m));
        this.requestUpdate();
    }

    render () {
        return tpl_feeds_list(this);
    }

    renderIfHeadline (model) {
        return model?.get('type') === _converse.HEADLINES_TYPE && this.requestUpdate();
    }

    async openHeadline (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
        const jid = ev.target.getAttribute('data-headline-jid');
        const feed = await api.headlines.get(jid);
        feed.maybeShow(true);
    }
}

api.elements.define('converse-headlines-feeds-list', HeadlinesFeedsList);
