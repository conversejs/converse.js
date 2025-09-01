import converse from '../../shared/api/public.js';

const { u } = converse.env;

/**
 * @param {Element} iq
 * @returns {Promise<import("./types").VCardResult>}
 */
export async function parseVCardResultStanza(iq) {
    const result = {
        email: iq.querySelector(':scope > vCard EMAIL USERID')?.textContent,
        fullname: iq.querySelector(':scope > vCard FN')?.textContent,
        nickname: iq.querySelector(':scope > vCard NICKNAME')?.textContent,
        role: iq.querySelector(':scope > vCard ROLE')?.textContent,
        stanza: iq, // TODO: remove?
        url: iq.querySelector(':scope > vCard URL')?.textContent,
        vcard_updated: new Date().toISOString(),
        error: undefined,
        vcard_error: undefined,
    };

    const image = iq.querySelector(':scope > vCard PHOTO BINVAL')?.textContent;
    const image_type = iq.querySelector(':scope > vCard PHOTO TYPE')?.textContent;
    const image_url = iq.querySelector(':scope > vCard PHOTO EXTVAL')?.textContent;

    if (image) {
        const buffer = u.base64ToArrayBuffer(image);
        const ab = await crypto.subtle.digest('SHA-1', buffer);

        Object.assign(result, {
            image,
            image_type,
            image_hash: u.arrayBufferToHex(ab),
        });
    } else if (image_url) {
        Object.assign(result, {
            image_url,
        });
    }
    return result;
}
