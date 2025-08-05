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
        image: iq.querySelector(':scope > vCard PHOTO BINVAL')?.textContent,
        image_type: iq.querySelector(':scope > vCard PHOTO TYPE')?.textContent,
        image_url: iq.querySelector(':scope > vCard PHOTO EXTVAL')?.textContent,
        nickname: iq.querySelector(':scope > vCard NICKNAME')?.textContent,
        role: iq.querySelector(':scope > vCard ROLE')?.textContent,
        stanza: iq, // TODO: remove?
        url: iq.querySelector(':scope > vCard URL')?.textContent,
        vcard_updated: new Date().toISOString(),
        error: undefined,
        vcard_error: undefined,
        image_hash: undefined,
    };
    if (result.image_url) {
        result['image_url'] = result.image_url;
    }
    else if (result.image) {
        const buffer = u.base64ToArrayBuffer(result.image);
        const ab = await crypto.subtle.digest('SHA-1', buffer);
        result['image_hash'] = u.arrayBufferToHex(ab);
    }
    return result;
}
