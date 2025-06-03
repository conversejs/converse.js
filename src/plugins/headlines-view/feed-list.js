import { _converse, api, constants } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplFeedsList from './templates/feeds-list.js';

const { HEADLINES_TYPE } = constants;

export class HeadlinesFeedsList extends CustomElement {
    initialize() {
        this.model = _converse.state.chatboxes;
        this.listenTo(this.model, 'add', (m) => this.renderIfHeadline(m));
        this.listenTo(this.model, 'remove', (m) => this.renderIfHeadline(m));
        this.listenTo(this.model, 'destroy', (m) => this.renderIfHeadline(m));
        this.requestUpdate();
    }

    render() {
        return tplFeedsList(this);
    }

    renderIfHeadline(model) {
        return model?.get('type') === HEADLINES_TYPE && this.requestUpdate();
    }

    async openHeadline(ev) {
        ev.preventDefault();
        const jid = ev.target.getAttribute('data-headline-jid');
        const feed = await api.headlines.get(jid);
        feed.maybeShow(true);
    }
}

api.elements.define('converse-headlines-feeds-list', HeadlinesFeedsList);
