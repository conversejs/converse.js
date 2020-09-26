import tpl_avatar from '../avatar.js';
import { directive } from "lit-html";


export const renderAvatar = directive(o => part => {
    const data = {
        'classes': o.classes ? `${o.classes} avatar` : 'avatar',
        'height': o.width || 36,
        'image': o.image,
        'image_type': o.image_type,
        'width': o.height || 36,
    }
    part.setValue(tpl_avatar(data));
});
