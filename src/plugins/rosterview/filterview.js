import tpl_roster_filter from "./templates/roster_filter.js";
import { Model } from '@converse/skeletor/src/model.js';
import { View } from '@converse/skeletor/src/view.js';
import { __ } from 'i18n';
import { _converse } from "@converse/headless/core";
import { debounce } from "lodash-es";


export const RosterFilter = Model.extend({
    initialize () {
        this.set({
            'filter_text': '',
            'filter_type': 'contacts',
            'chat_state': 'online'
        });
    },
});


export const RosterFilterView = View.extend({
    tagName: 'span',

    initialize () {
        this.listenTo(this.model, 'change:filter_type', this.render);
        this.listenTo(this.model, 'change:filter_text', this.render);
    },

    toHTML () {
        return tpl_roster_filter(
            Object.assign(this.model.toJSON(), {
                visible: this.shouldBeVisible(),
                placeholder: __('Filter'),
                title_contact_filter: __('Filter by contact name'),
                title_group_filter: __('Filter by group name'),
                title_status_filter: __('Filter by status'),
                label_any: __('Any'),
                label_unread_messages: __('Unread'),
                label_online: __('Online'),
                label_chatty: __('Chatty'),
                label_busy: __('Busy'),
                label_away: __('Away'),
                label_xa: __('Extended Away'),
                label_offline: __('Offline'),
                changeChatStateFilter: ev => this.changeChatStateFilter(ev),
                changeTypeFilter: ev => this.changeTypeFilter(ev),
                clearFilter: ev => this.clearFilter(ev),
                liveFilter: ev => this.liveFilter(ev),
                submitFilter: ev => this.submitFilter(ev),
            }));
    },

    changeChatStateFilter (ev) {
        ev && ev.preventDefault();
        this.model.save({'chat_state': this.el.querySelector('.state-type').value});
    },

    changeTypeFilter (ev) {
        ev && ev.preventDefault();
        const type = ev.target.dataset.type;
        if (type === 'state') {
            this.model.save({
                'filter_type': type,
                'chat_state': this.el.querySelector('.state-type').value
            });
        } else {
            this.model.save({
                'filter_type': type,
                'filter_text': this.el.querySelector('.roster-filter').value
            });
        }
    },

    liveFilter: debounce(function () {
        this.model.save({'filter_text': this.el.querySelector('.roster-filter').value});
    }, 250),

    submitFilter (ev) {
        ev && ev.preventDefault();
        this.liveFilter();
    },

    /**
     * Returns true if the filter is enabled (i.e. if the user
     * has added values to the filter).
     * @private
     * @method _converse.RosterFilterView#isActive
     */
    isActive () {
        return (this.model.get('filter_type') === 'state' || this.model.get('filter_text'));
    },

    shouldBeVisible () {
        return _converse.roster && _converse.roster.length >= 5 || this.isActive();
    },

    clearFilter (ev) {
        ev && ev.preventDefault();
        this.model.save({'filter_text': ''});
    }
});
