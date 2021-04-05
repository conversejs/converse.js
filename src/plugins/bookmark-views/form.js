import tpl_muc_bookmark_form from './templates/form.js';
import { CustomElement } from 'shared/components/element';
import { _converse, api } from "@converse/headless/core";


class MUCBookmarkForm extends CustomElement {

    static get properties () {
        return {
            'jid': { type: String }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.model = _converse.chatboxes.get(this.jid);
    }

    render () {
        return tpl_muc_bookmark_form(
            Object.assign(this.model.toJSON(), {
                'onCancel': ev => this.closeBookmarkForm(ev),
                'onSubmit': ev => this.onBookmarkFormSubmitted(ev)
            })
        );
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

    closeBookmarkForm (ev) {
        ev.preventDefault();
        this.model.session.save('view', null);
    }
}

api.elements.define('converse-muc-bookmark-form', MUCBookmarkForm);

export default MUCBookmarkForm;
