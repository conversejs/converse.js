import log from '@converse/headless/log';
import tpl_moderator_tools from './templates/moderator-tools.js';
import { AFFILIATIONS, ROLES } from '@converse/headless/plugins/muc/index.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';
import { getAssignableRoles } from '@converse/headless/plugins/muc/utils.js';
import {
    getAffiliationList,
    getAssignableAffiliations,
    setAffiliation,
} from '@converse/headless/plugins/muc/affiliations/utils.js';

const { Strophe, sizzle, u } = converse.env;

export default class ModeratorTools extends CustomElement {
    static get properties () {
        return {
            affiliations_filter: { type: String, attribute: false },
            alert_message: { type: String, attribute: false },
            alert_type: { type: String, attribute: false },
            model: { type: Object },
            muc: { type: Object },
            roles_filter: { type: String, attribute: false },
            users_with_affiliation: { type: Array, attribute: false },
            users_with_role: { type: Array, attribute: false },
        };
    }

    constructor () {
        super();
        this.affiliations_filter = '';
        this.roles_filter = '';
    }

    connectedCallback () {
        super.connectedCallback();
        this.initialize();
    }

    initialize () {
        this.listenTo(this.model, 'change:role', this.onSearchRoleChange, this);
        this.listenTo(this.model, 'change:affiliation', this.onSearchAffiliationChange, this);
    }

    render () {
        const occupant = this.muc.occupants.findWhere({ 'jid': _converse.bare_jid });
        return tpl_moderator_tools(
            Object.assign(this.model.toJSON(), {
                'affiliations_filter': this.affiliations_filter,
                'alert_message': this.alert_message,
                'alert_type': this.alert_type,
                'assignAffiliation': ev => this.assignAffiliation(ev),
                'assignRole': ev => this.assignRole(ev),
                'assignable_affiliations': getAssignableAffiliations(occupant),
                'assignable_roles': getAssignableRoles(occupant),
                'filterAffiliationResults': ev => this.filterAffiliationResults(ev),
                'filterRoleResults': ev => this.filterRoleResults(ev),
                'loading_users_with_affiliation': this.loading_users_with_affiliation,
                'queryAffiliation': ev => this.queryAffiliation(ev),
                'queryRole': ev => this.queryRole(ev),
                'queryable_affiliations': AFFILIATIONS.filter(a => !api.settings.get('modtools_disable_query').includes(a)),
                'queryable_roles': ROLES.filter(a => !api.settings.get('modtools_disable_query').includes(a)),
                'roles_filter': this.roles_filter,
                'switchTab': ev => this.switchTab(ev),
                'toggleForm': ev => this.toggleForm(ev),
                'users_with_affiliation': this.users_with_affiliation,
                'users_with_role': this.users_with_role,
            })
        );
    }

    async onSearchAffiliationChange () {
        this.clearAlert();
        this.loading_users_with_affiliation = true;
        this.users_with_affiliation = null;

        const affiliation = this.model.get('affiliation');
        if (this.shouldFetchAffiliationsList()) {
            const muc_jid = this.muc.get('jid');
            const result = await getAffiliationList(affiliation, muc_jid);
            if (result instanceof Error) {
                this.alert(result.message, 'danger');
                this.users_with_affiliation = [];
            } else {
                this.users_with_affiliation = result;
            }
        } else {
            this.users_with_affiliation = this.muc.getOccupantsWithAffiliation(affiliation);
        }
        this.loading_users_with_affiliation = false;
    }

    onSearchRoleChange () {
        this.clearAlert();
        this.users_with_role = this.muc.getOccupantsWithRole(this.model.get('role'));
    }

    shouldFetchAffiliationsList () {
        const affiliation = this.model.get('affiliation');
        if (affiliation === 'none') {
            return false;
        }
        const chatroom = this.muc;
        const auto_fetched_affs = chatroom.occupants.getAutoFetchedAffiliationLists();
        if (auto_fetched_affs.includes(affiliation)) {
            return false;
        } else {
            return true;
        }
    }

    toggleForm (ev) { // eslint-disable-line class-methods-use-this
        ev.stopPropagation();
        ev.preventDefault();
        const form_class = ev.target.getAttribute('data-form');
        const form = u.ancestor(ev.target, '.list-group-item').querySelector(`.${form_class}`);
        if (u.hasClass('hidden', form)) {
            u.removeClass('hidden', form);
        } else {
            u.addClass('hidden', form);
        }
    }

    filterRoleResults (ev) {
        this.roles_filter = ev.target.value;
        this.render();
    }

    filterAffiliationResults (ev) {
        this.affiliations_filter = ev.target.value;
    }

    queryRole (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const data = new FormData(ev.target);
        const role = data.get('role');
        this.model.set({ 'role': null }, { 'silent': true });
        this.model.set({ 'role': role });
    }

    queryAffiliation (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const data = new FormData(ev.target);
        const affiliation = data.get('affiliation');
        this.model.set({ 'affiliation': null }, { 'silent': true });
        this.model.set({ 'affiliation': affiliation });
    }

    alert (message, type) {
        this.alert_message = message;
        this.alert_type = type;
    }

    clearAlert () {
        this.alert_message = undefined;
        this.alert_type = undefined;
    }

    async assignAffiliation (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        this.clearAlert();
        const data = new FormData(ev.target);
        const affiliation = data.get('affiliation');
        const attrs = {
            'jid': data.get('jid'),
            'reason': data.get('reason'),
        };
        const current_affiliation = this.model.get('affiliation');
        const muc_jid = this.muc.get('jid');
        try {
            await setAffiliation(affiliation, muc_jid, [attrs]);
        } catch (e) {
            if (e === null) {
                this.alert(__('Timeout error while trying to set the affiliation'), 'danger');
            } else if (sizzle(`not-allowed[xmlns="${Strophe.NS.STANZAS}"]`, e).length) {
                this.alert(__("Sorry, you're not allowed to make that change"), 'danger');
            } else {
                this.alert(__('Sorry, something went wrong while trying to set the affiliation'), 'danger');
            }
            log.error(e);
            return;
        }
        await this.muc.occupants.fetchMembers();
        this.model.set({ 'affiliation': null }, { 'silent': true });
        this.model.set({ 'affiliation': current_affiliation });
        this.alert(__('Affiliation changed'), 'primary');
    }

    assignRole (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        this.clearAlert();
        const data = new FormData(ev.target);
        const occupant = this.muc.getOccupant(data.get('jid') || data.get('nick'));
        const role = data.get('role');
        const reason = data.get('reason');
        const current_role = this.model.get('role');
        this.muc.setRole(
            occupant,
            role,
            reason,
            () => {
                this.alert(__('Role changed'), 'primary');
                this.model.set({ 'role': null }, { 'silent': true });
                this.model.set({ 'role': current_role });
            },
            e => {
                if (sizzle(`not-allowed[xmlns="${Strophe.NS.STANZAS}"]`, e).length) {
                    this.alert(__("You're not allowed to make that change"), 'danger');
                } else {
                    this.alert(__('Sorry, something went wrong while trying to set the role'), 'danger');
                    if (u.isErrorObject(e)) {
                        log.error(e);
                    }
                }
            }
        );
    }
}

api.elements.define('converse-modtools', ModeratorTools);
