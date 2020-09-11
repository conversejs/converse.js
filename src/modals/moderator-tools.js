import log from "@converse/headless/log";
import sizzle from "sizzle";
import tpl_moderator_tools_modal from "../templates/moderator_tools_modal.js";
import { AFFILIATIONS, ROLES } from "@converse/headless/converse-muc.js";
import { BootstrapModal } from "../converse-modal.js";
import { __ } from '../i18n';
import { api, converse } from "@converse/headless/converse-core";

const { Strophe } = converse.env;
const u = converse.env.utils;
let _converse;


export default BootstrapModal.extend({
    id: "converse-modtools-modal",

    initialize (attrs) {
        _converse  = attrs._converse;
        this.chatroomview = attrs.chatroomview;
        BootstrapModal.prototype.initialize.apply(this, arguments);

        this.affiliations_filter = '';
        this.roles_filter = '';

        this.listenTo(this.model, 'change:role', () => {
            this.users_with_role = this.chatroomview.model.getOccupantsWithRole(this.model.get('role'));
            this.render();
        });
        this.listenTo(this.model, 'change:affiliation', async () => {
            this.loading_users_with_affiliation = true;
            this.users_with_affiliation = null;
            this.render();
            const chatroom = this.chatroomview.model;
            const affiliation = this.model.get('affiliation');
            if (this.shouldFetchAffiliationsList()) {
                this.users_with_affiliation = await chatroom.getAffiliationList(affiliation);
            } else {
                this.users_with_affiliation = chatroom.getOccupantsWithAffiliation(affiliation);
            }
            this.loading_users_with_affiliation = false;
            this.render();
        });
    },

    toHTML () {
        const occupant = this.chatroomview.model.occupants.findWhere({'jid': _converse.bare_jid});
        return tpl_moderator_tools_modal(Object.assign(this.model.toJSON(), {
            'affiliations_filter': this.affiliations_filter,
            'assignAffiliation': ev => this.assignAffiliation(ev),
            'assignRole': ev => this.assignRole(ev),
            'assignable_affiliations': this.getAssignableAffiliations(occupant),
            'assignable_roles': this.getAssignableRoles(occupant),
            'filterAffiliationResults': ev => this.filterAffiliationResults(ev),
            'filterRoleResults': ev => this.filterRoleResults(ev),
            'loading_users_with_affiliation': this.loading_users_with_affiliation,
            'queryAffiliation': ev => this.queryAffiliation(ev),
            'queryRole': ev => this.queryRole(ev),
            'queryable_affiliations': AFFILIATIONS.filter(a => !_converse.modtools_disable_query.includes(a)),
            'queryable_roles': ROLES.filter(a => !_converse.modtools_disable_query.includes(a)),
            'roles_filter': this.roles_filter,
            'switchTab': ev => this.switchTab(ev),
            'toggleForm': ev => this.toggleForm(ev),
            'users_with_affiliation': this.users_with_affiliation,
            'users_with_role': this.users_with_role
        }));
    },

    getAssignableAffiliations (occupant) {
        let disabled = api.settings.get('modtools_disable_assign');
        if (!Array.isArray(disabled)) {
            disabled = disabled ? AFFILIATIONS : [];
        }

        if (occupant.get('affiliation') === 'owner') {
            return AFFILIATIONS.filter(a => !disabled.includes(a));
        } else if (occupant.get('affiliation') === 'admin') {
            return AFFILIATIONS.filter(a => !['owner', 'admin', ...disabled].includes(a));
        } else {
            return [];
        }
    },

    getAssignableRoles (occupant) {
        let disabled = api.settings.get('modtools_disable_assign');
        if (!Array.isArray(disabled)) {
            disabled = disabled ? ROLES : [];
        }

        if (occupant.get('role') === 'moderator') {
            return ROLES.filter(r => !disabled.includes(r));
        } else {
            return [];
        }
    },

    shouldFetchAffiliationsList () {
        const affiliation = this.model.get('affiliation');
        if (affiliation === 'none') {
            return false;
        }
        const chatroom = this.chatroomview.model;
        const auto_fetched_affs = chatroom.occupants.getAutoFetchedAffiliationLists();
        if (auto_fetched_affs.includes(affiliation)) {
            return false;
        } else {
            return true;
        }
    },

    toggleForm (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const form_class = ev.target.getAttribute('data-form');
        const form = u.ancestor(ev.target, '.list-group-item').querySelector(`.${form_class}`);
        if (u.hasClass('hidden', form)) {
            u.removeClass('hidden', form);
        } else {
            u.addClass('hidden', form);
        }
    },

    filterRoleResults (ev) {
        this.roles_filter = ev.target.value;
        this.render();
    },

    filterAffiliationResults (ev) {
        this.affiliations_filter = ev.target.value;
        this.render();
    },

    queryRole (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const data = new FormData(ev.target);
        const role = data.get('role');
        this.model.set({'role': null}, {'silent': true});
        this.model.set({'role': role});
    },

    queryAffiliation (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const data = new FormData(ev.target);
        const affiliation = data.get('affiliation');
        this.model.set({'affiliation': null}, {'silent': true});
        this.model.set({'affiliation': affiliation});
    },

    async assignAffiliation (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const data = new FormData(ev.target);
        const affiliation = data.get('affiliation');
        const attrs = {
            'jid': data.get('jid'),
            'reason': data.get('reason')
        }
        const current_affiliation = this.model.get('affiliation');
        try {
            await this.chatroomview.model.setAffiliation(affiliation, [attrs]);
        } catch (e) {
            if (e === null) {
                this.alert(__('Timeout error while trying to set the affiliation'), 'danger');
            } else if (sizzle(`not-allowed[xmlns="${Strophe.NS.STANZAS}"]`, e).length) {
                this.alert(__('Sorry, you\'re not allowed to make that change'), 'danger');
            } else {
                this.alert(__('Sorry, something went wrong while trying to set the affiliation'), 'danger');
            }
            log.error(e);
            return;
        }
        this.alert(__('Affiliation changed'), 'primary');
        await this.chatroomview.model.occupants.fetchMembers()
        this.model.set({'affiliation': null}, {'silent': true});
        this.model.set({'affiliation': current_affiliation});
    },

    assignRole (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const data = new FormData(ev.target);
        const occupant = this.chatroomview.model.getOccupant(data.get('jid') || data.get('nick'));
        const role = data.get('role');
        const reason = data.get('reason');
        const current_role = this.model.get('role');
        this.chatroomview.model.setRole(occupant, role, reason,
            () => {
                this.alert(__('Role changed'), 'primary');
                this.model.set({'role': null}, {'silent': true});
                this.model.set({'role': current_role});
            },
            (e) => {
                if (sizzle(`not-allowed[xmlns="${Strophe.NS.STANZAS}"]`, e).length) {
                    this.alert(__('You\'re not allowed to make that change'), 'danger');
                } else {
                    this.alert(__('Sorry, something went wrong while trying to set the role'), 'danger');
                    if (u.isErrorObject(e)) {
                        log.error(e);
                    }
                }
            }
        );
    }
});
