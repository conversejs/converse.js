import converse from '../../shared/api/public.js';

const { u } = converse.env;

/**
 * @param {Element} iq
 * @returns {Promise<import("./types").VCardResult>}
 */

export async function parseVCardResultStanza(iq) {
    const image = iq.querySelector(':scope > vCard PHOTO BINVAL')?.textContent;
    const image_hash = image
        ? u.arrayBufferToHex(await crypto.subtle.digest('SHA-1', u.base64ToArrayBuffer(image)))
        : undefined;

    return {
        email: iq.querySelector(':scope > vCard EMAIL USERID')?.textContent,
        error: undefined,
        fullname: iq.querySelector(':scope > vCard FN')?.textContent,
        image,
        image_hash,
        image_type: iq.querySelector(':scope > vCard PHOTO TYPE')?.textContent,
        nickname: iq.querySelector(':scope > vCard NICKNAME')?.textContent,
        role: iq.querySelector(':scope > vCard ROLE')?.textContent,
        stanza: iq, // TODO: remove?
        url: iq.querySelector(':scope > vCard URL')?.textContent,
        vcard_error: undefined,
        vcard_updated: new Date().toISOString(),
    };
}
