import tpl_bookmarks_list from './templates/list.js';
import { ElementView } from '@converse/skeletor/src/element.js';
import { _converse, api, converse } from '@converse/headless/core';

const { Strophe } = converse.env;
const u = converse.env.utils;

export default class BookmarksView extends ElementView {

    async initialize () {
        await api.waitUntil('bookmarksInitialized');
        this.model = _converse.bookmarks;

        this.listenTo(this.model, 'add', this.render);
        this.listenTo(this.model, 'remove', this.render);

        this.listenTo(_converse.chatboxes, 'add', this.render);
        this.listenTo(_converse.chatboxes, 'remove', this.render);

        const id = `converse.room-bookmarks${_converse.bare_jid}-list-model`;
        this.list_model = new _converse.BookmarksList({ id });
        this.list_model.browserStorage = _converse.createStore(id);

        const render = () => {
            this.render();
            this.insertIntoControlBox();
        };
        this.list_model.fetch({ 'success': render, 'error': render });
    }

    toHTML () {
        const is_hidden = b => !!(api.settings.get('hide_open_bookmarks') && _converse.chatboxes.get(b.get('jid')));
        return tpl_bookmarks_list({
            '_converse': _converse,
            'bookmarks': this.model,
            'hidden': this.model.getUnopenedBookmarks().length && true,
            'is_hidden': is_hidden,
            'openRoom': ev => this.openRoom(ev),
            'removeBookmark': ev => this.removeBookmark(ev),
            'toggleBookmarksList': ev => this.toggleBookmarksList(ev),
            'toggle_state': this.list_model.get('toggle-state')
        });
    }

    insertIntoControlBox () {
        const controlboxview = _converse.chatboxviews.get('controlbox');
        if (controlboxview !== undefined && !u.rootContains(_converse.root, this.el)) {
            const el = controlboxview.querySelector('.list-container--bookmarks');
            el && el.parentNode.replaceChild(this.el, el);
        }
    }

    openRoom (ev) { // eslint-disable-line class-methods-use-this
        ev.preventDefault();
        const name = ev.target.textContent;
        const jid = ev.target.getAttribute('data-room-jid');
        const data = {
            'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)) || jid
        };
        api.rooms.open(jid, data, true);
    }

    removeBookmark (ev) { // eslint-disable-line class-methods-use-this
        _converse.removeBookmarkViaEvent(ev);
    }

    toggleBookmarksList (ev) {
        if (ev && ev.preventDefault) {
            ev.preventDefault();
        }
        const icon_el = ev.target.matches('.fa') ? ev.target : ev.target.querySelector('.fa');
        if (u.hasClass('fa-caret-down', icon_el)) {
            u.slideIn(this.el.querySelector('.bookmarks'));
            this.list_model.save({ 'toggle-state': _converse.CLOSED });
            icon_el.classList.remove('fa-caret-down');
            icon_el.classList.add('fa-caret-right');
        } else {
            icon_el.classList.remove('fa-caret-right');
            icon_el.classList.add('fa-caret-down');
            u.slideOut(this.el.querySelector('.bookmarks'));
            this.list_model.save({ 'toggle-state': _converse.OPENED });
        }
    }
}

api.elements.define('converse-bookmarks', BookmarksView);
