import avatar from 'shared/avatar/templates/avatar.js';
import { __ } from 'i18n';
import { api } from '@converse/headless/core';
import { html } from 'lit';
import { modal_close_button } from 'plugins/modal/templates/buttons.js';
import { getGroupsAutoCompleteList } from '@converse/headless/plugins/roster/utils.js';
import ModelWithContact from 'headless/plugins/chat/model-with-contact';

export const tplFooter = (el) => {
    const is_roster_contact = el.model.contact !== undefined;
    const i18n_refresh = __('Refresh');
    const allow_contact_removal = api.settings.get('allow_contact_removal');
    return html` <div class="modal-footer">${modal_close_button}</div> `;
};

export const tplUserDetailsModal = (el) => {
    const i18n_save = __('Save');
    const i18n_group = __('Group');
    const i18n_nickname = __('Name');

    return html` <form class="converse-form add-xmpp-contact" @submit=${(ev) => el.applyContactChanges(ev)}>
        <div class="modal-body">
            <span class="modal-alert"></span>
            <div class="form-group add-xmpp-contact__name">
                <label class="clearfix" for="name">${i18n_nickname}:</label>
                <div class="suggestion-box suggestion-box__name">
                    <ul class="suggestion-box__results suggestion-box__results--above" hidden=""></ul>
                    <input
                        type="text"
                        name="name"
                        value="${el.model.get('nickname') || ''}"
                        class="form-control suggestion-box__input"
                    />
                    <span
                        class="suggestion-box__additions visually-hidden"
                        role="status"
                        aria-live="assertive"
                        aria-relevant="additions"
                    ></span>
                </div>
            </div>

            <label class="clearfix" for="name">${i18n_group}:</label>
            <div class="suggestion-box suggestion-box__name">
                <ul class="suggestion-box__results suggestion-box__results--above" hidden=""></ul>
                <input
                    type="text"
                    name="group"
                    value="${el.model.get('groups') || ''}"
                    class="form-control suggestion-box__input"
                />
                <span
                    class="suggestion-box__additions visually-hidden"
                    role="status"
                    aria-live="assertive"
                    aria-relevant="additions"
                ></span>

                <!--<converse-autocomplete
                    .list=${[getGroupsAutoCompleteList()]}
                    name="group"
                ></converse-autocomplete>-->
            </div>

            <button type="submit" class="btn btn-primary">${i18n_save}</button>
        </div>
    </form>`;
};
