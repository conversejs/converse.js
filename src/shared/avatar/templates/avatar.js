import { html, nothing } from 'lit';

/**
 * @param {string} image
 * @param {string} image_type
 */
const getImgHref = (image, image_type) => {
    if (image.startsWith('https:') || image.startsWith('data:')) {
        return image;
    }
    else {
        return `data:${image_type};base64,${image}`;
    }
};

export default (o) => {
    if (o.image) {
        return html` <svg
            xmlns="http://www.w3.org/2000/svg"
            class="avatar ${o.classes}"
            width="${o.width}"
            height="${o.height}"
            aria-label="${o.alt_text}"
            role=${o.alt_text ? nothing : 'presentation'}
        >
            <image
                width="${o.width}"
                height="${o.height}"
                preserveAspectRatio="xMidYMid meet"
                href="${getImgHref(o.image, o.image_type)}"
            />
        </svg>`;
    } else {
        return '';
    }
};
