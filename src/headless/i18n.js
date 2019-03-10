// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// This is the internationalization module.
//
// Copyright (c) 2013-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

import 'moment/locale/af';
import 'moment/locale/ar';
import 'moment/locale/bg';
import 'moment/locale/ca';
import 'moment/locale/cs';
import 'moment/locale/de';
import 'moment/locale/eo';
import 'moment/locale/es';
import 'moment/locale/eu';
import 'moment/locale/fr';
import 'moment/locale/gl';
import 'moment/locale/he';
import 'moment/locale/hi';
import 'moment/locale/hu';
import 'moment/locale/id';
import 'moment/locale/it';
import 'moment/locale/ja';
import 'moment/locale/nb';
import 'moment/locale/nl';
import 'moment/locale/pl';
import 'moment/locale/pt-br';
import 'moment/locale/ro';
import 'moment/locale/ru';
import 'moment/locale/tr';
import 'moment/locale/uk';
import 'moment/locale/zh-cn';
import 'moment/locale/zh-tw';
import Jed from "jed";
import Promise from "es6-promise/dist/es6-promise.auto";
import _ from "./lodash.noconflict";
import moment from "moment";


function detectLocale (library_check) {
    /* Determine which locale is supported by the user's system as well
     * as by the relevant library (e.g. converse.js or moment.js).
     *
     * Parameters:
     *      (Function) library_check - Returns a boolean indicating whether
     *                                 the locale is supported.
     */
    var locale, i;
    if (window.navigator.userLanguage) {
        locale = isLocaleAvailable(window.navigator.userLanguage, library_check);
    }
    if (window.navigator.languages && !locale) {
        for (i=0; i<window.navigator.languages.length && !locale; i++) {
            locale = isLocaleAvailable(window.navigator.languages[i], library_check);
        }
    }
    if (window.navigator.browserLanguage && !locale) {
        locale = isLocaleAvailable(window.navigator.browserLanguage, library_check);
    }
    if (window.navigator.language && !locale) {
        locale = isLocaleAvailable(window.navigator.language, library_check);
    }
    if (window.navigator.systemLanguage && !locale) {
        locale = isLocaleAvailable(window.navigator.systemLanguage, library_check);
    }
    return locale || 'en';
}

function isMomentLocale (locale) {
    return _.includes(moment.locales(), locale);
}

function isConverseLocale (locale, supported_locales) {
    return _.isString(locale) && _.includes(supported_locales, locale);
}

function getLocale (preferred_locale, isSupportedByLibrary) {
    if (_.isString(preferred_locale)) {
        if (preferred_locale === 'en' || isSupportedByLibrary(preferred_locale)) {
            return preferred_locale;
        }
    }
    return detectLocale(isSupportedByLibrary) || 'en';
}

function isLocaleAvailable (locale, available) {
    /* Check whether the locale or sub locale (e.g. en-US, en) is supported.
     *
     * Parameters:
     *      (String) locale - The locale to check for
     *      (Function) available - returns a boolean indicating whether the locale is supported
     */
    if (available(locale)) {
        return locale;
    } else {
        var sublocale = locale.split("-")[0];
        if (sublocale !== locale && available(sublocale)) {
            return sublocale;
        }
    }
}

let jed_instance;

export default {

    setLocales (preferred_locale, _converse) {
        _converse.locale = getLocale(
            preferred_locale,
            _.partial(isConverseLocale, _, _converse.locales)
        );
        moment.locale(getLocale(preferred_locale, isMomentLocale));
    },

    translate (str) {
        if (_.isNil(jed_instance)) {
            return Jed.sprintf.apply(Jed, arguments);
        }
        var t = jed_instance.translate(str);
        if (arguments.length>1) {
            return t.fetch.apply(t, [].slice.call(arguments, 1));
        } else {
            return t.fetch();
        }
    },

    fetchTranslations (locale, supported_locales, locale_url) {
        /* Fetch the translations for the given local at the given URL.
         *
         * Parameters:
         *  (String) locale:            The given i18n locale
         *  (Array) supported_locales:  List of locales supported
         *  (String) locale_url:        The URL from which the translations
         *                              should be fetched.
         */
        return new Promise((resolve, reject) => {
            if (!isConverseLocale(locale, supported_locales) || locale === 'en') {
                return resolve();
            }
            const xhr = new XMLHttpRequest();
            xhr.open('GET', locale_url, true);
            xhr.setRequestHeader(
                'Accept',
                "application/json, text/javascript"
            );
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 400) {
                    try {
                        const data = window.JSON.parse(xhr.responseText);
                        jed_instance = new Jed(data);
                        resolve();
                    } catch (e) {
                        xhr.onerror(e);
                    }
                } else {
                    xhr.onerror();
                }
            };
            xhr.onerror = (e) => {
                const err_message = e ? ` Error: ${e.message}` : '';
                reject(new Error(`Could not fetch translations. Status: ${xhr.statusText}. ${err_message}`));
            }
            xhr.send();
        });
    }
};
