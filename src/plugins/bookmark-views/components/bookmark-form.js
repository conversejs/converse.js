import tplMUCBookmarkForm from './templates/form.js';
import { CustomElement } from 'shared/components/element';
import { _converse, api } from "@converse/headless/core";


class MUCBookmarkForm extends CustomElement {

    static get properties () {
        return {
            'jid': { type: String }
        }
    }

    willUpdate (changed_properties) {
        if (changed_properties.has('jid')) {
            this.model = _converse.chatboxes.get(this.jid);
            this.bookmark  = _converse.bookmarks.get(this.jid);
        }
    }

    render () {
        return tplMUCBookmarkForm(this)
    }

    onBookmarkFormSubmitted (ev) {
        ev.preventDefault();
        _converse.bookmarks.createBookmark({
            'jid': this.model.get('jid'),
            'autojoin': ev.target.querySelector('input[name="autojoin"]')?.checked || false,
            'name': ev.target.querySelector('input[name=name]')?.value,
            'nick': ev.target.querySelector('input[name=nick]')?.value
        });
        this.closeBookmarkForm(ev);
    }

    removeBookmark (ev) {
        this.bookmark?.destroy();
        this.closeBookmarkForm(ev);
    }

    closeBookmarkForm (ev) {
        ev.preventDefault();
        const evt = document.createEvent('Event');
        evt.initEvent('hide.bs.modal', true, true);
        this.dispatchEvent(evt);
    }
}

api.elements.define('converse-muc-bookmark-form', MUCBookmarkForm);

export default MUCBookmarkForm;
