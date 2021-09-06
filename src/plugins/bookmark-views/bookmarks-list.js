import log from '@converse/headless/log';
import tpl_bookmarks_list from './templates/list.js';
import { ElementView } from '@converse/skeletor/src/element.js';
import { _converse, api, converse } from '@converse/headless/core';
import { initStorage } from '@converse/headless/utils/storage.js';
import { render } from 'lit';

const u = converse.env.utils;

export default class BookmarksView extends ElementView {

    async initialize () {
        await api.waitUntil('bookmarksInitialized');

        this.listenTo(_converse.bookmarks, 'add', this.render);
        this.listenTo(_converse.bookmarks, 'remove', this.render);

        this.listenTo(_converse.chatboxes, 'add', this.render);
        this.listenTo(_converse.chatboxes, 'remove', this.render);

        const id = `converse.bookmarks-list-model-${_converse.bare_jid}`;
        this.model = new _converse.BookmarksList({ id });
        initStorage(this.model, id);

        this.model.fetch({
            'success': () => this.render(),
            'error': (model, err) => {
                log.error(err);
                this.render();
            }
        });
    }

    render () {
        render(tpl_bookmarks_list({
            'toggleBookmarksList': ev => this.toggleBookmarksList(ev),
            'toggle_state': this.model.get('toggle-state')
        }), this);
    }

    toggleBookmarksList (ev) {
        ev?.preventDefault?.();
        const icon_el = ev.target.matches('.fa') ? ev.target : ev.target.querySelector('.fa');
        if (u.hasClass('fa-caret-down', icon_el)) {
            u.slideIn(this.querySelector('.bookmarks'));
            this.model.save({ 'toggle-state': _converse.CLOSED });
            icon_el.classList.remove('fa-caret-down');
            icon_el.classList.add('fa-caret-right');
        } else {
            icon_el.classList.remove('fa-caret-right');
            icon_el.classList.add('fa-caret-down');
            u.slideOut(this.querySelector('.bookmarks'));
            this.model.save({ 'toggle-state': _converse.OPENED });
        }
    }
}

api.elements.define('converse-bookmarks', BookmarksView);
