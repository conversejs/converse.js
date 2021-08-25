import "shared/components/image-picker.js";
import spinner from "templates/spinner.js";
import { __ } from 'i18n';
import { _converse, converse } from  "@converse/headless/core";
import { html } from "lit";
import { modal_header_close_button } from "./buttons.js";

const u = converse.env.utils;

const fingerprint = (o) => html`
    <span class="fingerprint">${u.formatFingerprint(o.view.current_device.get('bundle').fingerprint)}</span>`;


const device_with_fingerprint = (o) => {
    const i18n_fingerprint_checkbox_label = __('Checkbox for selecting the following fingerprint');
    return html`
        <li class="fingerprint-removal-item list-group-item nopadding">
            <label>
            <input type="checkbox" value="${o.device.get('id')}"
                aria-label="${i18n_fingerprint_checkbox_label}"/>
            <span class="fingerprint">${u.formatFingerprint(o.device.get('bundle').fingerprint)}</span>
            </label>
        </li>
    `;
}


const device_without_fingerprint = (o) => {
    const i18n_device_without_fingerprint = __('Device without a fingerprint');
    const i18n_fingerprint_checkbox_label = __('Checkbox for selecting the following device');
    return html`
        <li class="fingerprint-removal-item list-group-item nopadding">
            <label>
            <input type="checkbox" value="${o.device.get('id')}"
                aria-label="${i18n_fingerprint_checkbox_label}"/>
            <span>${i18n_device_without_fingerprint}</span>
            </label>
        </li>
    `;
}


const device_item = (o) => html`
    ${(o.device.get('bundle') && o.device.get('bundle').fingerprint) ? device_with_fingerprint(o) : device_without_fingerprint(o) }
`;


const device_list = (o) => {
    const i18n_other_devices = __('Other OMEMO-enabled devices');
    const i18n_other_devices_label = __('Checkbox to select fingerprints of all other OMEMO devices');
    const i18n_remove_devices = __('Remove checked devices and close');
    const i18n_select_all = __('Select all');
    return html`
        <ul class="list-group fingerprints">
            <li class="list-group-item nopadding active">
                <label>
                    <input type="checkbox" class="select-all" title="${i18n_select_all}" aria-label="${i18n_other_devices_label}"/>
                    ${i18n_other_devices}
                </label>
            </li>
            ${ o.view.other_devices?.map(device => device_item(Object.assign({device}, o))) }
        </ul>
        <div class="form-group"><button type="submit" class="save-form btn btn-primary">${i18n_remove_devices}</button></div>
    `;
}


// TODO: this needs to go as a component into the OMEMO plugin folder
const omemo_page = (o) => {
    const i18n_fingerprint = __("This device's OMEMO fingerprint");
    const i18n_generate = __('Generate new keys and fingerprint');
    return html`
        <div class="tab-pane" id="omemo-tabpanel" role="tabpanel" aria-labelledby="omemo-tab">
            <form class="converse-form fingerprint-removal">
                <ul class="list-group fingerprints">
                    <li class="list-group-item active">${i18n_fingerprint}</li>
                    <li class="list-group-item">
                        ${ (o.view.current_device && o.view.current_device.get('bundle') && o.view.current_device.get('bundle').fingerprint) ? fingerprint(o) : spinner() }
                    </li>
                </ul>
                <div class="form-group">
                    <button type="button" class="generate-bundle btn btn-danger">${i18n_generate}</button>
                </div>
                ${ o.view.other_devices?.length ? device_list(o) : '' }
            </form>
        </div>`;
}


export default (o) => {
    const heading_profile = __('Your Profile');
    const i18n_email = __('Email');
    const i18n_fullname = __('Full Name');
    const i18n_jid = __('XMPP Address');
    const i18n_nickname = __('Nickname');
    const i18n_role = __('Role');
    const i18n_save = __('Save and close');
    const i18n_role_help = __('Use commas to separate multiple roles. Your roles are shown next to your name on your chat messages.');
    const i18n_url = __('URL');
    const i18n_omemo = __('OMEMO');
    const i18n_profile = __('Profile');

    const navigation = o.view.current_device ?
        html`<ul class="nav nav-pills justify-content-center">
            <li role="presentation" class="nav-item">
                <a class="nav-link active" id="profile-tab" href="#profile-tabpanel" aria-controls="profile-tabpanel" role="tab" data-toggle="tab">${i18n_profile}</a>
            </li>
            <li role="presentation" class="nav-item">
                <a class="nav-link" id="omemo-tab" href="#omemo-tabpanel" aria-controls="omemo-tabpanel" role="tab" data-toggle="tab">${i18n_omemo}</a>
            </li>
        </ul>` : '';

    return html`
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="user-profile-modal-label">${heading_profile}</h5>
                    ${modal_header_close_button}
                </div>
                <div class="modal-body">
                    <span class="modal-alert"></span>
                    ${_converse.pluggable.plugins['converse-omemo'].enabled(_converse) && navigation || ''}
                    <div class="tab-content">
                        <div class="tab-pane active" id="profile-tabpanel" role="tabpanel" aria-labelledby="profile-tab">
                            <form class="converse-form converse-form--modal profile-form" action="#">
                                <div class="row">
                                    <div class="col-auto">
                                        <converse-image-picker image="${o.image}" width="${o.width}" height="${o.height}"></converse-image-picker>
                                    </div>
                                    <div class="col">
                                        <div class="form-group">
                                            <label class="col-form-label">${i18n_jid}:</label>
                                            <div>${o.jid}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="vcard-fullname" class="col-form-label">${i18n_fullname}:</label>
                                    <input id="vcard-fullname" type="text" class="form-control" name="fn" value="${o.fullname || ''}"/>
                                </div>
                                <div class="form-group">
                                    <label for="vcard-nickname" class="col-form-label">${i18n_nickname}:</label>
                                    <input id="vcard-nickname" type="text" class="form-control" name="nickname" value="${o.nickname || ''}"/>
                                </div>
                                <div class="form-group">
                                    <label for="vcard-url" class="col-form-label">${i18n_url}:</label>
                                    <input id="vcard-url" type="url" class="form-control" name="url" value="${o.url || ''}"/>
                                </div>
                                <div class="form-group">
                                    <label for="vcard-email" class="col-form-label">${i18n_email}:</label>
                                    <input id="vcard-email" type="email" class="form-control" name="email" value="${o.email || ''}"/>
                                </div>
                                <div class="form-group">
                                    <label for="vcard-role" class="col-form-label">${i18n_role}:</label>
                                    <input id="vcard-role" type="text" class="form-control" name="role" value="${o.role || ''}" aria-describedby="vcard-role-help"/>
                                    <small id="vcard-role-help" class="form-text text-muted">${i18n_role_help}</small>
                                </div>
                                <hr/>
                                <div class="form-group">
                                    <button type="submit" class="save-form btn btn-primary">${i18n_save}</button>
                                </div>
                            </form>
                        </div>
                        ${ _converse.pluggable.plugins['converse-omemo'].enabled(_converse) && omemo_page(o) || '' }
                    </div>
                </div>
            </div>
        </div>
    `;
}
