import { _converse, api, u } from '@converse/headless';
import tplBookmarksPinList from './templates/pin-list';
import BookmarksPinListModel from './model';
import { RoomsList } from 'plugins/roomslist/view';

const { initStorage } = u;

export class BookmarksPinView extends RoomsList {
    model = null;

    initialize() {
        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.bookmarks-pin-list-model-${bare_jid}`;
        this.model = new BookmarksPinListModel({ id });
        _converse.state.bookmarksPinList = this.model;

        initStorage(this.model, id);
        this.model.fetch();

        this.handleEvents();

        this.requestUpdate();
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
