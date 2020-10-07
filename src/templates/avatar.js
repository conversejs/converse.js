import { html } from "lit-html";

const getImgHref = (image, image_type) => {
    return image.startsWith('data:') ? image : `data:${image_type};base64,${image}`;
}

export default  (o) => html`
    <svg xmlns="http://www.w3.org/2000/svg" class="avatar ${o.classes}" width="${o.width}" height="${o.height}">
        <image width="${o.width}" height="${o.height}" preserveAspectRatio="xMidYMid meet" href="${getImgHref(o.image, o.image_type)}"/>
    </svg>`;
