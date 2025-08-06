import debounce from 'lodash-es/debounce';
import { _converse, api, u, Model } from '@converse/headless';
import tplBookmarksList from './templates/list.js';
import tplSpinner from 'templates/spinner.js';
import { CustomElement } from 'shared/components/element.js';

import '../styles/bookmarks.scss';

const { initStorage } = u;

export default class BookmarksView extends CustomElement {
    async initialize() {
        await api.waitUntil('bookmarksInitialized');
        const { bookmarks, chatboxes } = _converse.state;

        this.liveFilter = debounce((ev) => this.model.set({ text: ev.target.value }), 100);

        this.listenTo(bookmarks, 'add', () => this.requestUpdate());
        this.listenTo(bookmarks, 'remove', () => this.requestUpdate());

        this.listenTo(chatboxes, 'add', () => this.requestUpdate());
        this.listenTo(chatboxes, 'remove', () => this.requestUpdate());

        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.bookmarks-list-model-${bare_jid}`;
        this.model = new Model({ id });
        initStorage(this.model, id);

        this.listenTo(this.model, 'change', () => this.requestUpdate());

        this.model.fetch({
            'success': () => this.requestUpdate(),
            'error': () => this.requestUpdate(),
        });
    }

    render() {
        return _converse.state.bookmarks && this.model ? tplBookmarksList(this) : tplSpinner();
    }

    /**
     * @param {Event} ev
     */
    clearFilter(ev) {
        ev?.stopPropagation?.();
        this.model.set('text', '');
    }
}

api.elements.define('converse-bookmarks', BookmarksView);
