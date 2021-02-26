import tpl_roster_filter from "./templates/roster_filter.js";
import { ElementView } from '@converse/skeletor/src/element.js';
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api } from "@converse/headless/core";
import { debounce } from "lodash-es";
import { render } from 'lit-html';

export const RosterFilter = Model.extend({
    initialize () {
        this.set({
            'filter_text': '',
            'filter_type': 'contacts',
            'chat_state': 'online'
        });
    }
});

export class RosterFilterView extends ElementView {
    tagName = 'span';

    initialize () {
        const model = new _converse.RosterFilter();
        model.id = `_converse.rosterfilter-${_converse.bare_jid}`;
        model.browserStorage = _converse.createStore(model.id);
        this.model = model;
        _converse.roster_filter = model;

        this.liveFilter = debounce(() => {
            this.model.save({'filter_text': this.querySelector('.roster-filter').value});
        }, 250);

        this.listenTo(this.model, 'change', this.render);
        this.listenTo(
            this.model,
            'change',
            () => this.dispatchEvent(new CustomEvent('update', { 'detail': this.model.changed }))
        );

        this.listenTo(_converse.roster, "add", this.render);
        this.listenTo(_converse.roster, "destroy", this.render);
        this.listenTo(_converse.roster, "remove", this.render);
        _converse.presences.on('change:show', this.render, this);

        this.model.fetch();
        this.render();
    }

    render () {
        render(tpl_roster_filter(
            Object.assign(this.model.toJSON(), {
                visible: this.shouldBeVisible(),
                changeChatStateFilter: ev => this.changeChatStateFilter(ev),
                changeTypeFilter: ev => this.changeTypeFilter(ev),
                clearFilter: ev => this.clearFilter(ev),
                liveFilter: ev => this.liveFilter(ev),
                submitFilter: ev => this.submitFilter(ev),
            })), this);
        return this;
    }

    changeChatStateFilter (ev) {
        ev && ev.preventDefault();
        this.model.save({'chat_state': this.querySelector('.state-type').value});
    }

    changeTypeFilter (ev) {
        ev && ev.preventDefault();
        const type = ev.target.dataset.type;
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
        return _converse.roster && _converse.roster.length >= 5 || this.isActive();
    }

    clearFilter (ev) {
        ev && ev.preventDefault();
        this.model.save({'filter_text': ''});
    }
}

api.elements.define('converse-roster-filter', RosterFilterView);
