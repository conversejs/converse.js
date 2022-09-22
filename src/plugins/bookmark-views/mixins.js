import './modal.js';
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

    showBookmarkModal(ev) {
        ev?.preventDefault();
        const jid = this.model.get('jid');
        api.modal.show('converse-bookmark-form-modal', { jid }, ev);
    }
};
