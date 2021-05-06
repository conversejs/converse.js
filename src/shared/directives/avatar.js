import tpl_avatar from 'shared/templates/avatar.js';
import { Directive, directive } from "lit/directive.js";


class AvatarDirective extends Directive {

    render (o) { // eslint-disable-line class-methods-use-this
        const data = {
            'classes': o.classes ? `${o.classes} avatar` : 'avatar',
            'height': o.width || 36,
            'image': o.image,
            'image_type': o.image_type,
            'width': o.height || 36,
        }
        return tpl_avatar(data);
    }
}

export const renderAvatar = directive(AvatarDirective);
