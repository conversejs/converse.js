/**
 * @typedef {module:muc-affiliations-utils.NonOutcastAffiliation} NonOutcastAffiliation
 */
import { getOpenPromise } from '@converse/openpromise';
import { api, converse, MUCOccupants, constants } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import tplModeratorTools from './templates/moderator-tools.js';

import './styles/moderator-tools.scss';

const { u } = converse.env;
const { AFFILIATIONS, ROLES } = constants;

export default class ModeratorTools extends CustomElement {
    static get properties() {
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

    constructor() {
        super();
        this.jid = null;
        this.tab = 'affiliations';
        this.affiliation = null;
        this.affiliations_filter = '';
        this.role = '';
        this.roles_filter = '';
        /** @type {import('@converse/headless').MUCOccupant[]} */
        this.users_with_affiliation = null;
        /** @type {import('@converse/headless').MUCOccupant[]} */
        this.users_with_role = null;

        this.addEventListener('affiliationChanged', () => {
            this.alert(__('Affiliation changed'), 'primary');
            this.onSearchAffiliationChange();
            this.requestUpdate();
        });

        this.addEventListener('roleChanged', () => {
            this.alert(__('Role changed'), 'primary');
            this.requestUpdate();
        });
    }

    /**
     * @param {import('lit').PropertyValues} changed
     */
    updated(changed) {
        if (changed.has('role')) this.onSearchRoleChange();
        if (changed.has('affiliation')) this.onSearchAffiliationChange();
        if (changed.has('jid') && changed.get('jid')) this.initialize();
    }

    async initialize() {
        this.initialized = getOpenPromise();
        const muc = await api.rooms.get(this.jid);
        await muc.initialized;
        this.muc = muc;
        this.initialized.resolve();
    }

    render() {
        if (this.muc?.occupants) {
            const occupant = this.muc.occupants.getOwnOccupant();
            return tplModeratorTools(this, {
                'affiliations_filter': this.affiliations_filter,
                'alert_message': this.alert_message,
                'alert_type': this.alert_type,
                'assignable_affiliations': occupant.getAssignableAffiliations(),
                'assignable_roles': occupant.getAssignableRoles(),
                'filterAffiliationResults': /** @param {Event} ev */ (ev) => this.filterAffiliationResults(ev),
                'filterRoleResults': /** @param {Event} ev */ (ev) => this.filterRoleResults(ev),
                'loading_users_with_affiliation': this.loading_users_with_affiliation,
                'queryAffiliation': /** @param {Event} ev */ (ev) => this.queryAffiliation(ev),
                'queryRole': /** @param {Event} ev */ (ev) => this.queryRole(ev),
                'queryable_affiliations': AFFILIATIONS.filter(
                    (a) => !api.settings.get('modtools_disable_query').includes(a),
                ),
                'queryable_roles': ROLES.filter((a) => !api.settings.get('modtools_disable_query').includes(a)),
                'roles_filter': this.roles_filter,
                'switchTab': /** @param {Event} ev */ (ev) => this.switchTab(ev),
                'tab': this.tab,
                'toggleForm': /** @param {Event} ev */ (ev) => this.toggleForm(ev),
                'users_with_affiliation': this.users_with_affiliation,
                'users_with_role': this.users_with_role,
            });
        } else {
            return '';
        }
    }

    switchTab(/** @type {Event} */ ev) {
        ev.stopPropagation();
        ev.preventDefault();
        this.tab = /** @type {string} */ (/** @type {HTMLElement} */ (ev.target).getAttribute('data-name'));
        this.requestUpdate();
    }

    async onSearchAffiliationChange() {
        if (!this.affiliation) return;

        await this.initialized;
        this.clearAlert();
        this.loading_users_with_affiliation = true;
        this.users_with_affiliation = null;

        if (this.shouldFetchAffiliationsList()) {
            const result = await api.rooms.affiliations.get(this.affiliation, this.jid);
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

    async onSearchRoleChange() {
        if (!this.role) {
            return;
        }
        await this.initialized;
        this.clearAlert();
        this.users_with_role = this.muc.getOccupantsWithRole(this.role);
    }

    shouldFetchAffiliationsList() {
        const affiliation = this.affiliation;
        if (affiliation === 'none') {
            return false;
        }
        const auto_fetched_affs = MUCOccupants.getAutoFetchedAffiliationLists();
        if (auto_fetched_affs.includes(affiliation)) {
            return false;
        } else {
            return true;
        }
    }

    /** @param {Event} ev */
    toggleForm(ev) {
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

    /** @param {Event} ev */
    filterRoleResults(ev) {
        this.roles_filter = /** @type {HTMLInputElement} */ (ev.target).value;
        this.requestUpdate();
    }

    filterAffiliationResults(/** @type {Event} */ ev) {
        this.affiliations_filter = /** @type {HTMLInputElement} */ (ev.target).value;
    }

    queryRole(/** @type {Event} */ ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const data = new FormData(/** @type {HTMLFormElement} */ (ev.target));
        const role = /** @type {string} */ (data.get('role'));
        this.role = null;
        this.role = role;
    }

    queryAffiliation(/** @type {Event} */ ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const data = new FormData(/** @type {HTMLFormElement} */ (ev.target));
        const affiliation = /** @type {NonOutcastAffiliation} */ (data.get('affiliation'));
        this.affiliation = null;
        this.affiliation = affiliation;
    }

    alert(/** @type {string} */ message, /** @type {string} */ type) {
        this.alert_message = message;
        this.alert_type = type;
    }

    clearAlert() {
        this.alert_message = undefined;
        this.alert_type = undefined;
    }
}

api.elements.define('converse-modtools', ModeratorTools);
