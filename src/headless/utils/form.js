// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// This is the utilities module.
//
// Copyright (c) 2013-2019, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)

import _ from "../lodash.noconflict";
import tpl_field from "../templates/field.html";
import u from "./core";

/**
 * Takes an HTML DOM and turns it into an XForm field.
 * @private
 * @method u#webForm2xForm
 * @param { DOMElement } field - the field to convert
 */
u.webForm2xForm = function (field) {
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
export default u;
