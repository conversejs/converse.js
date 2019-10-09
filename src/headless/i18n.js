// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// This is the internationalization module.
//
// Copyright (c) 2013-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
import Jed from "jed";
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
    return typeof locale === 'string' && supported_locales.includes(locale);
}

function getLocale (preferred_locale, isSupportedByLibrary) {
    if (typeof preferred_locale === 'string') {
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

    getLocale (preferred_locale, available_locales) {
        return getLocale(preferred_locale, preferred => isConverseLocale(preferred, available_locales));
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
     * @param { _converse }
     */
    async fetchTranslations (_converse) {
        const locale = _converse.locale;
        if (!isConverseLocale(locale, _converse.locales) || locale === 'en') {
            return;
        }
        const { default: data } = await import(/*webpackChunkName: "locales/[request]" */ `../../locale/${locale}/LC_MESSAGES/converse.po`);
        await import(/*webpackChunkName: "locales/dayjs/[request]" */ `dayjs/locale/${locale.toLowerCase().replace('_', '-')}`);
        dayjs.locale(getLocale(_converse.locale, l => dayjs.locale(l)));
        jed_instance = new Jed(data);
    }
};
