import { _converse, api, converse } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplEntityTimeAlert from './templates/entity-time-alert.js';
import log from '@converse/log';

const { u } = converse.env;

/**
 * @typedef {Object} EntityTimeInfo
 * @property {Date} utc - The time when the query was made (as Date object)
 * @property {string} tzo - Timezone offset string (e.g., "+05:30")
 */

export default class EntityTimeAlert extends CustomElement {
    static properties = {
        jid: { type: String },
    };

    constructor() {
        super();
        this.jid = null;
        /** @type {EntityTimeInfo|null} */
        this.time_info = null;
        this.loading = false;
        this.dismissed = false;
        /** @type {ReturnType<typeof setTimeout>|null} */
        this._fetch_timeout = null;
        /** @type {ReturnType<typeof setTimeout>|null} */
        this._sync_timeout = null;
        /** @type {ReturnType<typeof setInterval>|null} */
        this._update_interval = null;
    }

    connectedCallback() {
        super.connectedCallback();
        // Sync to minute boundary so displayed time matches the clock
        const now = new Date();
        const ms_until_next_minute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
        this._sync_timeout = setTimeout(() => {
            this.requestUpdate();
            this._update_interval = setInterval(() => this.requestUpdate(), 60000);
        }, ms_until_next_minute);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._sync_timeout) clearTimeout(this._sync_timeout);
        if (this._update_interval) clearInterval(this._update_interval);
        if (this._fetch_timeout) clearTimeout(this._fetch_timeout);
        this._sync_timeout = null;
        this._update_interval = null;
        this._fetch_timeout = null;
    }

    async initialize() {
        super.initialize();

        const { chatboxes } = _converse.state;
        this.model = chatboxes.get(this.jid);

        if (!this.model) {
            return;
        }

        // Reset dismissed flag each time the chat is opened.
        if (this.model.get('entity_time_dismissed')) {
            this.model.save({ entity_time_dismissed: false }, { silent: true });
        }

        // Listen to dismissed state changes
        this.listenTo(this.model, 'change:entity_time_dismissed', () => {
            this.dismissed = this.model.get('entity_time_dismissed');
            this.requestUpdate();
        });

        // Set up and fetch entity time once ready
        this._setupAndFetch();

        // Listen for new messages to get full JID (for non-roster contacts)
        if (this.model.messages) {
            this.listenTo(this.model.messages, 'add', (msg) => {
                if (!this.time_info && msg.get('sender') === 'them') {
                    this.fetchEntityTime();
                }
            });
        }
    }

    async _setupAndFetch() {
        // Wait for roster contact if applicable
        if (this.model.rosterContactAdded) {
            await this.model.rosterContactAdded;
            if (this.model.contact?.presence) {
                this.setupPresenceListeners();
            }
        }

        // Wait for messages (fallback source for full JID if not in roster)
        if (this.model.messages?.fetched) {
            await this.model.messages.fetched;
        }

        // Use stored timezone if available, otherwise fetch
        const stored = this.model.get('entity_time_info');
        if (stored) {
            this.time_info = stored;
            this.requestUpdate();
        } else {
            this.fetchEntityTime();
        }
    }

    setupPresenceListeners() {
        const presence = this.model.contact.presence;

        // Refetch when presence changes (contact may have switched devices/timezones)
        this.listenTo(presence, 'change', () => this.fetchEntityTime());

        // Also listen for resources being added/changed (e.g., contact comes online)
        if (presence.resources) {
            this.listenTo(presence.resources, 'add change', () => this.fetchEntityTime());
        }
    }

    /**
     * Get full JID (with resource) - needed because bare JID queries go to server.
     * @returns {string|null}
     */
    getFullJid() {
        // Try roster contact's presence first
        const resource = this.model.contact?.presence?.getHighestPriorityResource();
        if (resource) {
            return `${this.jid}/${resource.get('name')}`;
        }

        // Fall back to extracting from recent incoming messages
        const messages = this.model.messages;
        if (messages?.length) {
            for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages.at(i);
                const from = msg.get('from');
                if (from?.includes('/') && msg.get('sender') === 'them') {
                    return from;
                }
            }
        }
        return null;
    }

    /**
     * Fetch entity time with debouncing to prevent rapid re-queries on presence flapping.
     */
    fetchEntityTime() {
        if (this._fetch_timeout) {
            clearTimeout(this._fetch_timeout);
        }
        this._fetch_timeout = setTimeout(() => {
            this._fetch_timeout = null;
            this._doFetch();
        }, 300);
    }

    /**
     * @private
     */
    async _doFetch() {
        if (!api.settings.get('show_entity_time') || this.loading || !this.model) {
            return;
        }

        const full_jid = this.getFullJid();
        if (!full_jid) {
            return;
        }

        // Only show loading state on initial fetch to avoid flicker during refresh
        if (!this.time_info) {
            this.loading = true;
            this.requestUpdate();
        }

        try {
            const result = await api.time.get(full_jid);
            if (result) {
                this.time_info = result;
                this.model.save('entity_time_info', this.time_info, { silent: true });
            }
        } catch (e) {
            log.error('Error fetching entity time:', e);
        } finally {
            this.loading = false;
            this.requestUpdate();
        }
    }

    render() {
        if (!api.settings.get('show_entity_time')) return '';
        if (this.dismissed) return '';
        if (this.loading) return '';
        if (!this.time_info) return '';
        if (!u.time) return '';

        // Use current time + their timezone offset to check if they're in off-hours now
        const remote_hour = u.time.getRemoteHour(new Date(), this.time_info.tzo);

        // Check if timezone difference meets minimum threshold
        // min_diff_hours=0 means "show for any different timezone" (threshold=1)
        // min_diff_hours=3 means "show only if 3+ hours apart"
        const min_diff_hours = api.settings.get('entity_time_min_diff_hours');
        const threshold = min_diff_hours === 0 ? 1 : min_diff_hours;
        const tz_diff = u.time.getTimezoneDiffHours(this.time_info.tzo);
        if (tz_diff < threshold) {
            return '';
        }

        const warning_start = api.settings.get('entity_time_warning_start');
        const warning_end = api.settings.get('entity_time_warning_end');

        if (!u.time.isOffHours(remote_hour, warning_start, warning_end)) {
            return '';
        }

        return tplEntityTimeAlert(this);
    }

    /**
     * @param {MouseEvent} ev
     */
    dismiss(ev) {
        ev?.preventDefault?.();
        this.model.save({ entity_time_dismissed: true });
    }

    /**
     * Gets the display name for the contact
     * @returns {string}
     */
    getDisplayName() {
        return this.model?.contact?.getDisplayName() || this.model?.getDisplayName() || this.jid;
    }

    /**
     * Gets the formatted current time in the remote contact's timezone
     * @returns {string}
     */
    getFormattedTime() {
        if (!this.time_info) return '';
        // Calculate current time in the contact's timezone using their offset
        return u.time.formatRemoteTime(new Date(), this.time_info.tzo);
    }
}

api.elements.define('converse-entity-time-alert', EntityTimeAlert);
