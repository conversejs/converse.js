import { _converse, api, constants, Model, u } from '@converse/headless';
import tplBookmarksPinList from './templates/pin-list';
import { RoomsList } from 'plugins/roomslist/view';

const { initStorage } = u;

export class PinnedBookmarksView extends RoomsList {
    model = null;

    initialize() {
        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.bookmarks-pin-list-model-${bare_jid}`;
        this.model = new Model({ toggle_state: constants.OPENED });
        _converse.state.bookmarks_pin_list = this.model;

        initStorage(this.model, id);
        this.model.fetch();

        this.addEventListeners();

        this.requestUpdate();
    }

    /** @returns {import('@converse/headless').MUC[]} */
    getRoomsToShow() {
        const { chatboxes } = _converse.state;
        const rooms = chatboxes.filter((m) => m.bookmark?.get('pinned'));
        rooms.sort((a, b) => (a.getDisplayName().toLowerCase() <= b.getDisplayName().toLowerCase() ? -1 : 1));
        return rooms;
    }

    render() {
        return tplBookmarksPinList(this);
    }
}

api.elements.define('converse-pinned-bookmarks', PinnedBookmarksView);
