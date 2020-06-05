import xss from "xss/dist/xss";
import { directive, html } from "lit-html";
import { unsafeSVG } from 'lit-html/directives/unsafe-svg.js';


const whitelist_opts = {
    'whiteList': {
        'svg': ['xmlns', 'xmlns:xlink', 'class', 'width', 'height'],
        'image': ['width', 'height', 'preserveAspectRatio', 'xlink:href']
    }
};
const tpl_svg = (o) => xss.filterXSS(`<image width="${o.width}" height="${o.height}" preserveAspectRatio="xMidYMid meet" xlink:href="${o.image}"/>`, whitelist_opts);

const tpl_avatar = (o) => html`
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" class="avatar ${o.classes}" width="${o.width}" height="${o.height}">
        ${ unsafeSVG(tpl_svg(o)) }
    </svg>
`;


export const renderAvatar = directive(o => part => {
    const data = {
        'classes': o.classes || '',
        'height': o.width || 36,
        'image': o.image,
        'width': o.height || 36,
    }
    part.setValue(tpl_avatar(data));
});
