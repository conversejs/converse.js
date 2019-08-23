// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// This is the internationalization module.
//
// Copyright (c) 2013-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
import 'dayjs/locale/af';
import 'dayjs/locale/ar';
import 'dayjs/locale/bg';
import 'dayjs/locale/ca';
import 'dayjs/locale/cs';
import 'dayjs/locale/de';
import 'dayjs/locale/eo';
import 'dayjs/locale/es';
import 'dayjs/locale/eu';
import 'dayjs/locale/fr';
import 'dayjs/locale/gl';
import 'dayjs/locale/he';
import 'dayjs/locale/hi';
import 'dayjs/locale/hu';
import 'dayjs/locale/id';
import 'dayjs/locale/it';
import 'dayjs/locale/ja';
import 'dayjs/locale/nb';
import 'dayjs/locale/nl';
import 'dayjs/locale/oc-lnc';
import 'dayjs/locale/pl';
import 'dayjs/locale/pt';
import 'dayjs/locale/pt-br';
import 'dayjs/locale/ro';
import 'dayjs/locale/ru';
import 'dayjs/locale/tr';
import 'dayjs/locale/uk';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';
import Jed from "jed";
import Promise from "es6-promise/dist/es6-promise.auto";
import _ from "./lodash.noconflict";
import dayjs from "dayjs";


function detectLocale (library_check) {
    /* Determine which locale is supported by the user's system as well
     * as by the relevant library (e.g. converse.js or dayjs).
     * @param { Function } library_check - Returns a boolean indicating whether
     *   the locale is supported.
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

/* Check whether the locale or sub locale (e.g. en-US, en) is supported.
 * @param { String } locale - The locale to check for
 * @param { Function } available - Returns a boolean indicating whether the locale is supported
 */
function isLocaleAvailable (locale, available) {
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

/**
 * @namespace i18n
 */
export default {

    setLocales (preferred_locale, _converse) {
        _converse.locale = getLocale(
            preferred_locale,
            _.partial(isConverseLocale, _, _converse.locales)
        );
        dayjs.locale(getLocale(preferred_locale, l => dayjs.locale(l)));
    },

    translate (str) {
        if (!jed_instance) {
            return Jed.sprintf.apply(Jed, arguments);
        }
        const t = jed_instance.translate(str);
        if (arguments.length > 1) {
            return t.fetch.apply(t, [].slice.call(arguments, 1));
        } else {
            return t.fetch();
        }
    },

    /**
     * Fetch the translations for the given local at the given URL.
     * @private
     * @method i18n#fetchTranslations
     * @param { String } locale -The given i18n locale
     * @param { Array } supported_locales -  List of locales supported
     */
    async fetchTranslations (locale, supported_locales) {
        if (!isConverseLocale(locale, supported_locales) || locale === 'en') {
            return;
        }
        const { default: data } = await import(/*webpackChunkName: "locales/[request]" */ `../../locale/${locale}/LC_MESSAGES/converse.po`);
        jed_instance = new Jed(data);
    }
};
