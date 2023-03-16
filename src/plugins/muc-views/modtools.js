import tplModeratorTools from './templates/moderator-tools.js';
import { AFFILIATIONS, ROLES } from '@converse/headless/plugins/muc/constants.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { api, converse } from '@converse/headless/core.js';
import { getAffiliationList, getAssignableAffiliations } from '@converse/headless/plugins/muc/affiliations/utils.js';
import { getAssignableRoles, getAutoFetchedAffiliationLists } from '@converse/headless/plugins/muc/utils.js';
import { getOpenPromise } from '@converse/openpromise';

import './styles/moderator-tools.scss';

const { u } = converse.env;

export default class ModeratorTools extends CustomElement {
    static get properties () {
        return {
            affiliation: { type: String },
            affiliations_filter: { type: String, attribute: false },
            alert_message: { type: String, attribute: false },
            alert_type: { type: String, attribute: false },
            jid: { type: String },
            muc: { type: Object, attribute: false },
            role: { type: String },
            roles_filter: { type: String, attribute: false },
            tab: { type: String },
            users_with_affiliation: { type: Array, attribute: false },
            users_with_role: { type: Array, attribute: false },
        };
    }

    constructor () {
        super();
        this.tab = 'affiliations';
        this.affiliation = '';
        this.affiliations_filter = '';
        this.role = '';
        this.roles_filter = '';

        this.addEventListener("affiliationChanged", () => {
            this.alert(__('Affiliation changed'), 'primary');
            this.onSearchAffiliationChange();
            this.requestUpdate()
        });

        this.addEventListener("roleChanged", () => {
            this.alert(__('Role changed'), 'primary');
            this.requestUpdate()
        });
    }

    updated (changed) {
        changed.has('role') && this.onSearchRoleChange();
        changed.has('affiliation') && this.onSearchAffiliationChange();
        changed.has('jid') && changed.get('jid') && this.initialize();
    }

    async initialize () {
        this.initialized = getOpenPromise();
        const muc = await api.rooms.get(this.jid);
        await muc.initialized;
        this.muc = muc;
        this.initialized.resolve();
    }

    render () {
        if (this.muc?.occupants) {
            const occupant = this.muc.occupants.getOwnOccupant();
            return tplModeratorTools(this, {
                'affiliations_filter': this.affiliations_filter,
                'alert_message': this.alert_message,
                'alert_type': this.alert_type,
                'assignRole': ev => this.assignRole(ev),
                'assignable_affiliations': getAssignableAffiliations(occupant),
                'assignable_roles': getAssignableRoles(occupant),
                'filterAffiliationResults': ev => this.filterAffiliationResults(ev),
                'filterRoleResults': ev => this.filterRoleResults(ev),
                'loading_users_with_affiliation': this.loading_users_with_affiliation,
                'queryAffiliation': ev => this.queryAffiliation(ev),
                'queryRole': ev => this.queryRole(ev),
                'queryable_affiliations': AFFILIATIONS.filter(
                    a => !api.settings.get('modtools_disable_query').includes(a)
                ),
                'queryable_roles': ROLES.filter(a => !api.settings.get('modtools_disable_query').includes(a)),
                'roles_filter': this.roles_filter,
                'switchTab': ev => this.switchTab(ev),
                'tab': this.tab,
                'toggleForm': ev => this.toggleForm(ev),
                'users_with_affiliation': this.users_with_affiliation,
                'users_with_role': this.users_with_role,
            });
        } else {
            return '';
        }
    }

    switchTab (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        this.tab = ev.target.getAttribute('data-name');
        this.requestUpdate();
    }

    async onSearchAffiliationChange () {
        if (!this.affiliation) return;

        await this.initialized;
        this.clearAlert();
        this.loading_users_with_affiliation = true;
        this.users_with_affiliation = null;

        if (this.shouldFetchAffiliationsList()) {
            const result = await getAffiliationList(this.affiliation, this.jid);
            if (result instanceof Error) {
                this.alert(result.message, 'danger');
                this.users_with_affiliation = [];
            } else {
                this.users_with_affiliation = result;
            }
        } else {
            this.users_with_affiliation = this.muc.getOccupantsWithAffiliation(this.affiliation);
        }
        this.loading_users_with_affiliation = false;
    }

    async onSearchRoleChange () {
        if (!this.role) {
            return;
        }
        await this.initialized;
        this.clearAlert();
        this.users_with_role = this.muc.getOccupantsWithRole(this.role);
    }

    shouldFetchAffiliationsList () {
        const affiliation = this.affiliation;
        if (affiliation === 'none') {
            return false;
        }
        const auto_fetched_affs = getAutoFetchedAffiliationLists();
        if (auto_fetched_affs.includes(affiliation)) {
            return false;
        } else {
            return true;
        }
    }

    // eslint-disable-next-line class-methods-use-this
    toggleForm (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const toggle = u.ancestor(ev.target, '.toggle-form');
        const sel = toggle.getAttribute('data-form');
        const form = u.ancestor(toggle, '.list-group-item').querySelector(sel);
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
        this.role = null;
        this.role = role;
    }

    queryAffiliation (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const data = new FormData(ev.target);
        const affiliation = data.get('affiliation');
        this.affiliation = null;
        this.affiliation = affiliation;
    }

    alert (message, type) {
        this.alert_message = message;
        this.alert_type = type;
    }

    clearAlert () {
        this.alert_message = undefined;
        this.alert_type = undefined;
    }

}

api.elements.define('converse-modtools', ModeratorTools);
