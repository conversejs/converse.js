import { _converse, api, converse } from '@converse/headless';

const { u } = converse.env;

export const BookmarkableChatRoomView = {
    renderBookmarkForm() {
        if (!this.bookmark_form) {
            this.bookmark_form = new _converse.state.MUCBookmarkForm({
                'model': this.model,
                'chatroomview': this,
            });
            const container_el = this.querySelector('.chatroom-body');
            container_el.insertAdjacentElement('beforeend', this.bookmark_form.el);
        }
        u.showElement(this.bookmark_form.el);
    },

    showBookmarkModal(/** @type {Event} */ ev) {
        ev?.preventDefault();
        const jid = this.model.get('jid');
        api.modal.show('converse-bookmark-form-modal', { jid }, ev);
    },
};
