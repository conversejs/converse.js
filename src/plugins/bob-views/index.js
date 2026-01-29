/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @module plugins-bob-views
 * @description
 * View plugin for XEP-0231 Bits of Binary
 * Handles rendering BOB images in message bodies
 */
import { api, converse, log } from '@converse/headless';
import tplImage from 'shared/texture/templates/image.js';

/**
 * Handle BOB images in message body after transformation
 * @param {import('shared/texture/texture.js').Texture} texture
 */
async function handleBOBImages(texture) {
    if (!api.bob) return;

    const text = texture.toString();

    if (!text.includes('cid:')) return;

    const regex = /cid:([^\s]+)/g;
    const matches = [...text.matchAll(regex)];

    for (const m of matches) {
        const cid = m[0];

        try {
            const blob_url = await api.bob.get(cid);
            if (blob_url) {
                const template = tplImage({
                    src: blob_url,
                    href: null,
                    onClick: texture.onImgClick,
                    onLoad: texture.onImgLoad
                });
                texture.addTemplateResult(
                    m.index + texture.offset,
                    m.index + m[0].length + texture.offset,
                    template
                );
            }
        } catch (e) {
            log.debug(`Could not render BOB image ${cid}:`, e);
        }
    }
}

converse.plugins.add('converse-bob-views', {
    dependencies: ['converse-bob'],

    initialize() {
        api.listen.on('afterMessageBodyTransformed', handleBOBImages);

        log.info('BOB Views plugin initialized');
    }
});
