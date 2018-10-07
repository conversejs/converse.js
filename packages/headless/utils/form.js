// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// This is the utilities module.
//
// Copyright (c) 2013-2018, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, escape, Jed */
(function (root, factory) {
    define([
        "sizzle",
        "lodash.noconflict",
        "utils/core",
        "templates/field.html",
        "templates/select_option.html",
        "templates/form_select.html",
        "templates/form_textarea.html",
        "templates/form_checkbox.html",
        "templates/form_username.html",
        "templates/form_input.html",
        "templates/form_captcha.html",
        "templates/form_url.html",
    ], factory);
}(this, function (
        sizzle,
        _,
        u,
        tpl_field,
        tpl_select_option,
        tpl_form_select,
        tpl_form_textarea,
        tpl_form_checkbox,
        tpl_form_username,
        tpl_form_input,
        tpl_form_captcha,
        tpl_form_url
    ) {
    "use strict";

    var XFORM_TYPE_MAP = {
        'text-private': 'password',
        'text-single': 'text',
        'fixed': 'label',
        'boolean': 'checkbox',
        'hidden': 'hidden',
        'jid-multi': 'textarea',
        'list-single': 'dropdown',
        'list-multi': 'dropdown'
    };

    u.webForm2xForm = function (field) {
        /* Takes an HTML DOM and turns it into an XForm field.
         *
         * Parameters:
         *      (DOMElement) field - the field to convert
         */
        let value;
        if (field.getAttribute('type') === 'checkbox') {
            value = field.checked && 1 || 0;
        } else if (field.tagName == "TEXTAREA") {
            value = _.filter(field.value.split('\n'), _.trim);
        } else if (field.tagName == "SELECT") {
            value = u.getSelectValues(field);
        } else {
            value = field.value;
        }
        return u.stringToNode(
            tpl_field({
                'name': field.getAttribute('name'),
                'value': value
            })
        );
    };

    u.xForm2webForm = function (field, stanza, domain) {
        /* Takes a field in XMPP XForm (XEP-004: Data Forms) format
         * and turns it into an HTML field.
         *
         * Returns either text or a DOM element (which is not ideal, but fine
         * for now).
         *
         *  Parameters:
         *      (XMLElement) field - the field to convert
         */
        if (field.getAttribute('type')) {
            if (field.getAttribute('type') === 'list-single' ||
                field.getAttribute('type') === 'list-multi') {

                const values = _.map(
                    u.queryChildren(field, 'value'),
                    _.partial(_.get, _, 'textContent')
                );
                const options = _.map(
                    u.queryChildren(field, 'option'),
                    function (option) {
                        const value = _.get(option.querySelector('value'), 'textContent');
                        return tpl_select_option({
                            'value': value,
                            'label': option.getAttribute('label'),
                            'selected': _.includes(values, value),
                            'required': !_.isNil(field.querySelector('required'))
                        })
                    }
                );
                return tpl_form_select({
                    'id': u.getUniqueId(),
                    'name': field.getAttribute('var'),
                    'label': field.getAttribute('label'),
                    'options': options.join(''),
                    'multiple': (field.getAttribute('type') === 'list-multi'),
                    'required': !_.isNil(field.querySelector('required'))
                });
            } else if (field.getAttribute('type') === 'fixed') {
                const text = _.get(field.querySelector('value'), 'textContent');
                return '<p class="form-help">'+text+'</p>';
            } else if (field.getAttribute('type') === 'jid-multi') {
                return tpl_form_textarea({
                    'name': field.getAttribute('var'),
                    'label': field.getAttribute('label') || '',
                    'value': _.get(field.querySelector('value'), 'textContent'),
                    'required': !_.isNil(field.querySelector('required'))
                });
            } else if (field.getAttribute('type') === 'boolean') {
                return tpl_form_checkbox({
                    'id': u.getUniqueId(),
                    'name': field.getAttribute('var'),
                    'label': field.getAttribute('label') || '',
                    'checked': _.get(field.querySelector('value'), 'textContent') === "1" && 'checked="1"' || '',
                    'required': !_.isNil(field.querySelector('required'))
                });
            } else if (field.getAttribute('var') === 'url') {
                return tpl_form_url({
                    'label': field.getAttribute('label') || '',
                    'value': _.get(field.querySelector('value'), 'textContent')
                });
            } else if (field.getAttribute('var') === 'username') {
                return tpl_form_username({
                    'domain': ' @'+domain,
                    'name': field.getAttribute('var'),
                    'type': XFORM_TYPE_MAP[field.getAttribute('type')],
                    'label': field.getAttribute('label') || '',
                    'value': _.get(field.querySelector('value'), 'textContent'),
                    'required': !_.isNil(field.querySelector('required'))
                });
            } else {
                return tpl_form_input({
                    'id': u.getUniqueId(),
                    'label': field.getAttribute('label') || '',
                    'name': field.getAttribute('var'),
                    'placeholder': null,
                    'required': !_.isNil(field.querySelector('required')),
                    'type': XFORM_TYPE_MAP[field.getAttribute('type')],
                    'value': _.get(field.querySelector('value'), 'textContent')
                });
            }
        } else {
            if (field.getAttribute('var') === 'ocr') { // Captcha
                const uri = field.querySelector('uri');
                const el = sizzle('data[cid="'+uri.textContent.replace(/^cid:/, '')+'"]', stanza)[0];
                return tpl_form_captcha({
                    'label': field.getAttribute('label'),
                    'name': field.getAttribute('var'),
                    'data': _.get(el, 'textContent'),
                    'type': uri.getAttribute('type'),
                    'required': !_.isNil(field.querySelector('required'))
                });
            }
        }
    }
    return u;
}));
