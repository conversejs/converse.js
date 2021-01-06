import tpl_muc_bookmark_form from './templates/form.js';
import { View } from '@converse/skeletor/src/view.js';
import { _converse } from '@converse/headless/core';


const MUCBookmarkForm = View.extend({
    className: 'muc-bookmark-form chatroom-form-container',

    initialize (attrs) {
        this.chatroomview = attrs.chatroomview;
        this.render();
    },

    toHTML () {
        return tpl_muc_bookmark_form(
            Object.assign(this.model.toJSON(), {
                'onCancel': ev => this.closeBookmarkForm(ev),
                'onSubmit': ev => this.onBookmarkFormSubmitted(ev)
            })
        );
    },

    onBookmarkFormSubmitted (ev) {
        ev.preventDefault();
        _converse.bookmarks.createBookmark({
            'jid': this.model.get('jid'),
            'autojoin': ev.target.querySelector('input[name="autojoin"]')?.checked || false,
            'name': ev.target.querySelector('input[name=name]')?.value,
            'nick': ev.target.querySelector('input[name=nick]')?.value
        });
        this.closeBookmarkForm(ev);
    },

    closeBookmarkForm (ev) {
        ev.preventDefault();
        this.chatroomview.closeForm();
    }
});

export default MUCBookmarkForm;
