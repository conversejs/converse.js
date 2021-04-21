import invokeMap from 'lodash-es/invokeMap';
import { Model } from '@converse/skeletor/src/model.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';

const { u } = converse.env;

export const bookmarkableChatRoomView = {
    /**
     * Set whether the groupchat is bookmarked or not.
     * @private
     */
    setBookmarkState () {
        if (_converse.bookmarks !== undefined) {
            const models = _converse.bookmarks.where({ 'jid': this.model.get('jid') });
            if (!models.length) {
                this.model.save('bookmarked', false);
            } else {
                this.model.save('bookmarked', true);
            }
        }
    },

    renderBookmarkForm () {
        if (!this.bookmark_form) {
            this.bookmark_form = new _converse.MUCBookmarkForm({
                'model': this.model,
                'chatroomview': this
            });
            const container_el = this.querySelector('.chatroom-body');
            container_el.insertAdjacentElement('beforeend', this.bookmark_form.el);
        }
        u.showElement(this.bookmark_form.el);
    },

    toggleBookmark (ev) {
        ev?.preventDefault();
        const models = _converse.bookmarks.where({ 'jid': this.model.get('jid') });
        if (!models.length) {
            this.model.session.set('view', converse.MUC.VIEWS.BOOKMARK);
        } else {
            models.forEach(model => model.destroy());
        }
    }
};


export const eventMethods = {

    removeBookmarkViaEvent (ev) {
        /* Remove a bookmark as determined by the passed in
         * event.
         */
        ev.preventDefault();
        const name = ev.target.getAttribute('data-bookmark-name');
        const jid = ev.target.getAttribute('data-room-jid');
        if (confirm(__('Are you sure you want to remove the bookmark "%1$s"?', name))) {
            invokeMap(_converse.bookmarks.where({ 'jid': jid }), Model.prototype.destroy);
        }
    },

    async addBookmarkViaEvent (ev) {
        /* Add a bookmark as determined by the passed in
         * event.
         */
        ev.preventDefault();
        const jid = ev.target.getAttribute('data-room-jid');
        const room = await api.rooms.open(jid, { 'bring_to_foreground': true });
        room.session.save('view', converse.MUC.VIEWS.BOOKMARK);
    }
}
