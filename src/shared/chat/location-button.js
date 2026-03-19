import { html } from 'lit';
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';

export class LocationButton extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
            is_groupchat: { type: Boolean },
            fetching_location: { type: Boolean, state: true },
        };
    }

    constructor() {
        super();
        this.model = null;
        this.is_groupchat = false;
        this.fetching_location = false;
    }

    render() {
        const color = this.is_groupchat ? '--muc-color' : '--chat-color';
        const title = this.fetching_location ? __('Getting location...') : __('Share current location');

        return html` <button
            type="button"
            class="btn toggle-location"
            title="${title}"
            ?disabled=${this.fetching_location}
            @click=${this.shareLocation}
        >
            <converse-icon color="var(${color})" class="fa fa-globe" size="1em"></converse-icon>
        </button>`;
    }

    /** @param {MouseEvent} ev */
    async shareLocation(ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();

        if (!navigator.geolocation) {
            api.alert('error', __('Location Error'), [
                __('Your browser or device does not support sharing your location.'),
            ]);
            return;
        }

        const result = await api.confirm(__('Confirm'), [
            __("Are you sure you'd like to share your location in the chat?"),
        ]);
        if (!result) return;

        this.fetching_location = true;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const geo_uri = `geo:${latitude.toFixed(6)},${longitude.toFixed(6)}`;
                this.model.sendMessage({ body: geo_uri });
                this.fetching_location = false;
            },
            (error) => {
                let error_message;
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        error_message = __(
                            'Location access was denied. Please allow location permissions in your browser settings and try again.'
                        );
                        break;
                    case error.POSITION_UNAVAILABLE:
                        error_message = __(
                            "Your current location could not be determined. Please check your device's location services and try again."
                        );
                        break;
                    case error.TIMEOUT:
                        error_message = __(
                            'The request to get your location timed out. Please check your connection and try again.'
                        );
                        break;
                    default:
                        error_message = __(
                            'An unexpected error occurred while trying to retrieve your location. Please try again.'
                        );
                }
                api.alert('error', __('Location Error'), [error_message]);
                this.fetching_location = false;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }
}

api.elements.define('converse-location-button', LocationButton);
