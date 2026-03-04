import { _converse, api } from '@converse/headless';
import { CustomElement } from "shared/components/element"
import tplBookmarksPinList from './templates/pin-list';
import BookmarksPinListModel from './model';

export class BookmarksPinView extends CustomElement {
    initialize() {
        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.bookmarks-pin-list-model-${bare_jid}`;
        this.model = new BookmarksPinListModel({ id });
        _converse.state.bookmarksPinList = this.model;
    }

    /** @returns {import('@converse/headless').MUC[]} */
    getRoomsToShow() {
        const { chatboxes } = _converse.state;
        const rooms = chatboxes.filter((m) => m.get('pinned'));
        rooms.sort((a, b) => (a.getDisplayName().toLowerCase() <= b.getDisplayName().toLowerCase() ? -1 : 1));
        return rooms;
    }

    render() {
        return tplBookmarksPinList(this);
    }
}

api.elements.define('converse-bookmarks-pin', BookmarksPinView);
