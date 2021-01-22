import log from "@converse/headless/log";
import tpl_pending_contact from "./templates/pending_contact.js";
import tpl_requesting_contact from "./templates/requesting_contact.js";
import tpl_roster_item from "./templates/roster_item.js";
import { ViewWithAvatar } from 'shared/avatar.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { debounce, without } from "lodash-es";
import { render } from 'lit-html';

const u = converse.env.utils;

const STATUSES = {
    'dnd': __('This contact is busy'),
    'online': __('This contact is online'),
    'offline': __('This contact is offline'),
    'unavailable': __('This contact is unavailable'),
    'xa': __('This contact is away for an extended period'),
    'away': __('This contact is away')
};


const RosterContactView = ViewWithAvatar.extend({
    tagName: 'li',
    className: 'list-item d-flex hidden controlbox-padded',

    events: {
        "click .accept-xmpp-request": "acceptRequest",
        "click .decline-xmpp-request": "declineRequest",
        "click .open-chat": "openChat",
        "click .remove-xmpp-contact": "removeContact"
    },

    async initialize () {
        await this.model.initialized;
        this.debouncedRender = debounce(this.render, 50);
        this.listenTo(this.model, "change", this.debouncedRender);
        this.listenTo(this.model, "destroy", this.remove);
        this.listenTo(this.model, "highlight", this.highlight);
        this.listenTo(this.model, "remove", this.remove);
        this.listenTo(this.model, 'vcard:change', this.debouncedRender);
        this.listenTo(this.model.presence, "change:show", this.debouncedRender);
        this.render();
    },

    render () {
        if (!this.mayBeShown()) {
            u.hideElement(this.el);
            return this;
        }
        const ask = this.model.get('ask'),
            show = this.model.presence.get('show'),
            requesting  = this.model.get('requesting'),
            subscription = this.model.get('subscription'),
            jid = this.model.get('jid');

        const classes_to_remove = [
            'current-xmpp-contact',
            'pending-xmpp-contact',
            'requesting-xmpp-contact'
            ].concat(Object.keys(STATUSES));
        classes_to_remove.forEach(c => u.removeClass(c, this.el));

        this.el.classList.add(show);
        this.el.setAttribute('data-status', show);
        this.highlight();

        if (_converse.isUniView()) {
            const chatbox = _converse.chatboxes.get(this.model.get('jid'));
            if (chatbox) {
                if (chatbox.get('hidden')) {
                    this.el.classList.remove('open');
                } else {
                    this.el.classList.add('open');
                }
            }
        }

        if ((ask === 'subscribe') || (subscription === 'from')) {
            /* ask === 'subscribe'
             *      Means we have asked to subscribe to them.
             *
             * subscription === 'from'
             *      They are subscribed to use, but not vice versa.
             *      We assume that there is a pending subscription
             *      from us to them (otherwise we're in a state not
             *      supported by converse.js).
             *
             *  So in both cases the user is a "pending" contact.
             */
            const display_name = this.model.getDisplayName();
            this.el.classList.add('pending-xmpp-contact');
            render(tpl_pending_contact(Object.assign(this.model.toJSON(), { display_name })), this.el);

        } else if (requesting === true) {
            const display_name = this.model.getDisplayName();
            this.el.classList.add('requesting-xmpp-contact');
            render(tpl_requesting_contact(
                Object.assign(this.model.toJSON(), {
                    display_name,
                    'desc_accept': __("Click to accept the contact request from %1$s", display_name),
                    'desc_decline': __("Click to decline the contact request from %1$s", display_name),
                    'allow_chat_pending_contacts': api.settings.get('allow_chat_pending_contacts')
                })
            ), this.el);
        } else if (subscription === 'both' || subscription === 'to' || _converse.rosterview.isSelf(jid)) {
            this.el.classList.add('current-xmpp-contact');
            this.el.classList.remove(without(['both', 'to'], subscription)[0]);
            this.el.classList.add(subscription);
            this.renderRosterItem(this.model);
        }
        return this;
    },

    /**
     * If appropriate, highlight the contact (by adding the 'open' class).
     * @private
     * @method _converse.RosterContactView#highlight
     */
    highlight () {
        if (_converse.isUniView()) {
            const chatbox = _converse.chatboxes.get(this.model.get('jid'));
            if ((chatbox && chatbox.get('hidden')) || !chatbox) {
                this.el.classList.remove('open');
            } else {
                this.el.classList.add('open');
            }
        }
    },

    renderRosterItem (item) {
        const show = item.presence.get('show') || 'offline';
        let status_icon;
        if (show === 'online') {
            status_icon = 'fa fa-circle chat-status chat-status--online';
        } else if (show === 'away') {
            status_icon = 'fa fa-circle chat-status chat-status--away';
        } else if (show === 'xa') {
            status_icon = 'far fa-circle chat-status chat-status-xa';
        } else if (show === 'dnd') {
            status_icon = 'fa fa-minus-circle chat-status chat-status--busy';
        } else {
            status_icon = 'fa fa-times-circle chat-status chat-status--offline';
        }
        const display_name = item.getDisplayName();
        render(tpl_roster_item(
            Object.assign(item.toJSON(), {
                show,
                display_name,
                status_icon,
                'desc_status': STATUSES[show],
                'num_unread': item.get('num_unread') || 0,
                classes: ''
            })
        ), this.el);
        this.renderAvatar();
        return this;
    },

    /**
     * Returns a boolean indicating whether this contact should
     * generally be visible in the roster.
     * It doesn't check for the more specific case of whether
     * the group it's in is collapsed.
     * @private
     * @method _converse.RosterContactView#mayBeShown
     */
    mayBeShown () {
        const chatStatus = this.model.presence.get('show');
        if (api.settings.get('hide_offline_users') && chatStatus === 'offline') {
            // If pending or requesting, show
            if ((this.model.get('ask') === 'subscribe') ||
                    (this.model.get('subscription') === 'from') ||
                    (this.model.get('requesting') === true)) {
                return true;
            }
            return false;
        }
        return true;
    },

    openChat (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        this.model.openChat();
    },

    async removeContact (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        if (!api.settings.get('allow_contact_removal')) { return; }
        if (!confirm(__("Are you sure you want to remove this contact?"))) { return; }

        try {
            await this.model.removeFromRoster();
            this.remove();
            if (this.model.collection) {
                // The model might have already been removed as
                // result of a roster push.
                this.model.destroy();
            }
        } catch (e) {
            log.error(e);
            api.alert('error', __('Error'),
                [__('Sorry, there was an error while trying to remove %1$s as a contact.', this.model.getDisplayName())]
            );
        }
    },

    async acceptRequest (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }

        await _converse.roster.sendContactAddIQ(
            this.model.get('jid'),
            this.model.getFullname(),
            []
        );
        this.model.authorize().subscribe();
    },

    declineRequest (ev) {
        if (ev && ev.preventDefault) { ev.preventDefault(); }
        const result = confirm(__("Are you sure you want to decline this contact request?"));
        if (result === true) {
            this.model.unauthorize().destroy();
        }
        return this;
    }
});

export default RosterContactView;
