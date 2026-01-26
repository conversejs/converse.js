import { api } from '@converse/headless';
import tplImage from 'shared/texture/templates/image.js';

/**
 * Handle BOB images in message body after transformation
 * @param {import('shared/texture/texture.js').Texture} texture
 */
export async function handleBOBImages(texture) {
    if (!api.bob) return;

    const text = texture.toString();

    if (!text.includes('cid:')) return;

    const regex = /cid:([^\s]+)/g;
    const matches = [...text.matchAll(regex)];

    for (const m of matches) {
        const cid = m[0];
        const cid_key = cid.startsWith('cid:') ? cid.slice(4) : cid;

        const blob_url = await api.bob.get(cid_key);
        if (blob_url) {
            const template = tplImage({
                src: blob_url,
                href: null,
                onClick: texture.onImgClick,
                onLoad: texture.onImgLoad,
            });
            texture.addTemplateResult(m.index + texture.offset, m.index + m[0].length + texture.offset, template);
        }
    }
}
