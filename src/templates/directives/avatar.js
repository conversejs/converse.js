import tpl_avatar from "templates/avatar.svg";
import { directive, html } from "lit-html";
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';


export const renderAvatar = directive(o => part => {
    if (o.type === 'headline' || o.is_me_message) {
        part.setValue('');
        return;
    }

    if (o.model.vcard) {
        const data = {
            'classes': 'avatar chat-msg__avatar',
            'width': 36,
            'height': 36,
        }
        const image_type = o.model.vcard.get('image_type');
        const image = o.model.vcard.get('image');
        data['image'] = "data:" + image_type + ";base64," + image;

        // TODO: XSS
        part.setValue(html`${unsafeHTML(tpl_avatar(data))}`);
    }
});
