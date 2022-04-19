import debounce from "lodash-es/debounce";
import tpl_roster_filter from "./templates/roster_filter.js";
import { CustomElement } from 'shared/components/element.js';
import { _converse, api } from "@converse/headless/core";
import { ancestor } from 'utils/html.js';


export class RosterFilterView extends CustomElement {

    async initialize () {
        await api.waitUntil('rosterInitialized')
        this.model = _converse.roster_filter;

        this.liveFilter = debounce(() => {
            this.model.save({'filter_text': this.querySelector('.roster-filter').value});
        }, 250);

        this.listenTo(_converse, 'rosterContactsFetched', () => this.requestUpdate());
        this.listenTo(_converse.presences, 'change:show', () => this.requestUpdate());
        this.listenTo(_converse.roster, "add", () => this.requestUpdate());
        this.listenTo(_converse.roster, "destroy", () => this.requestUpdate());
        this.listenTo(_converse.roster, "remove", () => this.requestUpdate());
        this.listenTo(this.model, 'change', this.dispatchUpdateEvent);
        this.listenTo(this.model, 'change', () => this.requestUpdate());

        this.requestUpdate();
    }

    render () {
        return this.model ?
        tpl_roster_filter(
            Object.assign(this.model.toJSON(), {
                visible: this.shouldBeVisible(),
                changeChatStateFilter: ev => this.changeChatStateFilter(ev),
                changeTypeFilter: ev => this.changeTypeFilter(ev),
                clearFilter: ev => this.clearFilter(ev),
                liveFilter: ev => this.liveFilter(ev),
                submitFilter: ev => this.submitFilter(ev),
            })) : '';
    }

    dispatchUpdateEvent () {
        this.dispatchEvent(new CustomEvent('update', { 'detail': this.model.changed }));
    }

    changeChatStateFilter (ev) {
        ev && ev.preventDefault();
        this.model.save({'chat_state': this.querySelector('.state-type').value});
    }

    changeTypeFilter (ev) {
        ev && ev.preventDefault();
        const type = ancestor(ev.target, 'converse-icon')?.dataset.type || 'contacts';
        if (type === 'state') {
            this.model.save({
                'filter_type': type,
                'chat_state': this.querySelector('.state-type').value
            });
        } else {
            this.model.save({
                'filter_type': type,
                'filter_text': this.querySelector('.roster-filter').value
            });
        }
    }

    submitFilter (ev) {
        ev && ev.preventDefault();
        this.liveFilter();
    }

    /**
     * Returns true if the filter is enabled (i.e. if the user
     * has added values to the filter).
     * @private
     * @method _converse.RosterFilterView#isActive
     */
    isActive () {
        return (this.model.get('filter_type') === 'state' || this.model.get('filter_text'));
    }

    shouldBeVisible () {
        return _converse.roster?.length >= 5 || this.isActive();
    }

    clearFilter (ev) {
        ev && ev.preventDefault();
        this.model.save({'filter_text': ''});
    }
}

api.elements.define('converse-roster-filter', RosterFilterView);
