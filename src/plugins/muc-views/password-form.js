import tpl_muc_password_form from "./templates/muc-password-form.js";
import { View } from '@converse/skeletor/src/view.js';


const MUCPasswordForm = View.extend({
    className: 'chatroom-form-container muc-password-form',

    initialize (attrs) {
        this.chatroomview = attrs.chatroomview;
        this.listenTo(this.model, 'change:validation_message', this.render);
        this.render();
    },

    toHTML () {
        return tpl_muc_password_form({
            'jid': this.model.get('jid'),
            'submitPassword': ev => this.submitPassword(ev),
            'validation_message':  this.model.get('validation_message')
        });
    },

    submitPassword (ev) {
        ev.preventDefault();
        const password = this.el.querySelector('input[type=password]').value;
        this.chatroomview.model.join(this.chatroomview.model.get('nick'), password);
        this.model.set('validation_message', null);
    }
});

export default MUCPasswordForm;
