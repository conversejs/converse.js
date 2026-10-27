/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description The built-in attachment menu items: file, image and location.
 */
import { _converse, api, converse } from '@converse/headless';
import { __ } from 'i18n';
import { alertSendError } from 'shared/chat/send-errors.js';

const { Strophe } = converse.env;

// The built-in items' places in the menu, smallest first, with gaps for plugins.
export const FILE_ORDER = 100;
export const IMAGE_ORDER = 200;
export const LOCATION_ORDER = 300;

/**
 * @typedef {import('@converse/headless').ChatBox|import('@converse/headless').MUC} ChatModel
 */

/**
 * `getAttachmentMenuItems` handler: the built-in items, listed only where they
 * work. The `visible_toolbar_buttons` keys that used to show or hide the
 * toolbar buttons now show or hide the matching items.
 * @param {import('shared/chat/attachment-menu').default} menu
 * @param {import('shared/chat/types').AttachmentMenuItem[]} items
 */
export async function getAttachmentMenuItems(menu, items) {
    const buttons = api.settings.get('visible_toolbar_buttons') ?? {};
    // An absent `fileupload` key counts as on, as it always has.
    if ((buttons.fileupload ?? true) && (await isHTTPUploadSupported())) {
        items.push({
            name: 'file',
            order: FILE_ORDER,
            icon: 'fa-paperclip',
            label: __('Send a file'),
            handler: () => menu.pickFiles(),
        });
        items.push({
            name: 'image',
            order: IMAGE_ORDER,
            icon: 'fa-image',
            label: __('Send an image'),
            // Only images, which on a phone opens the photo gallery. No capture
            // hint: taking a picture is for a separate item.
            handler: () => menu.pickFiles({ accept: 'image/*' }),
        });
    }
    if (buttons.location) {
        items.push({
            name: 'location',
            order: LOCATION_ORDER,
            icon: 'fa-globe',
            label: __('Share your location'),
            handler: () => shareLocation(menu.model),
        });
    }
    return items;
}

/**
 * Resolves once the server has said whether it offers HTTP File Upload.
 * @returns {Promise<boolean>}
 */
async function isHTTPUploadSupported() {
    return !!(await api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.session.get('domain')));
}

// The chats whose position is being fetched. The menu closes as soon as an item
// is picked, so nothing stops the user from picking "Share your location" again
// while the first request, which may take up to ten seconds, is still running.
// A second pick in that time is ignored rather than sending a second geo URI.
/** @type {WeakSet<ChatModel>} */
const pending = new WeakSet();

/**
 * Ask for confirmation, then send the device's position to the chat as a geo
 * URI, or say why that couldn't be done. Does nothing while an earlier call
 * for the same chat is still pending.
 * @param {ChatModel} model
 * @returns {Promise<void>} Resolves once the message is sent or the attempt given up.
 */
export async function shareLocation(model) {
    if (!navigator.geolocation) {
        api.alert('error', __('Location Error'), [__('Your browser or device does not support sharing your location.')]);
        return;
    }
    if (pending.has(model)) return;

    pending.add(model);
    try {
        const confirmed = await api.confirm(__('Confirm'), [
            __("Are you sure you'd like to share your location in the chat?"),
        ]);
        if (!confirmed) return;

        await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    model
                        .sendMessage({ body: `geo:${latitude.toFixed(6)},${longitude.toFixed(6)}` })
                        .catch(alertSendError);
                    resolve();
                },
                (error) => {
                    api.alert('error', __('Location Error'), [getLocationErrorMessage(error)]);
                    resolve();
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
            );
        });
    } finally {
        pending.delete(model);
    }
}

/**
 * @param {GeolocationPositionError} error
 * @returns {string}
 */
function getLocationErrorMessage(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return __(
                'Location access was denied. Please allow location permissions in your browser settings and try again.',
            );
        case error.POSITION_UNAVAILABLE:
            return __(
                "Your current location could not be determined. Please check your device's location services and try again.",
            );
        case error.TIMEOUT:
            return __('The request to get your location timed out. Please check your connection and try again.');
        default:
            return __('An unexpected error occurred while trying to retrieve your location. Please try again.');
    }
}
