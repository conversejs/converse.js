import { ElementView } from "@converse/skeletor/src/element";
import tpl_avatar from 'templates/avatar.js';
import { View } from '@converse/skeletor/src/view';
import { converse } from '@converse/headless/core';

const u = converse.env.utils;

const AvatarMixin = {

    renderAvatar (el) {
        el = el || (this?.el ?? this);
        const avatar_el = el.querySelector('canvas.avatar, svg.avatar');
        if (avatar_el === null) {
            return;
        }
        if (this.model.vcard) {
            const data = {
                'classes': avatar_el.getAttribute('class'),
                'width': avatar_el.getAttribute('width'),
                'height': avatar_el.getAttribute('height'),
                'image_type': this.model.vcard.get('image_type'),
                'image': this.model.vcard.get('image')
            };
            avatar_el.outerHTML = u.getElementFromTemplateResult(tpl_avatar(data)).outerHTML;
        }
    }
}


export const ViewWithAvatar = View.extend(AvatarMixin);


export class ElementViewWithAvatar extends ElementView {

    renderAvatar (el) {
        AvatarMixin.renderAvatar.call(this, el);
    }
}
