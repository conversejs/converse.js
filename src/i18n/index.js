/**
 * @module i18n
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the internationalization module
 */
import Jed from 'jed';
import log from "@converse/headless/log";
import { _converse, api, converse, i18n } from '@converse/headless/core';

const { dayjs } = converse.env;


function detectLocale (library_check) {
    /* Determine which locale is supported by the user's system as well
     * as by the relevant library (e.g. converse.js or dayjs).
     * @param { Function } library_check - Returns a boolean indicating whether
     *   the locale is supported.
     */
    let locale;
    if (window.navigator.userLanguage) {
        locale = isLocaleAvailable(window.navigator.userLanguage, library_check);
    }
    if (window.navigator.languages && !locale) {
        for (let i=0; i<window.navigator.languages.length && !locale; i++) {
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


/* Fetch the translations for the given local at the given URL.
 * @private
 * @method i18n#fetchTranslations
 * @param { _converse }
 */
async function fetchTranslations (_converse) {
    const { api, locale } = _converse;
    const dayjs_locale = locale.toLowerCase().replace('_', '-');

    if (!isConverseLocale(locale, api.settings.get("locales")) || locale === 'en') {
        return;
    }
    const { default: data } = await import(/*webpackChunkName: "locales/[request]" */ `../i18n/${locale}/LC_MESSAGES/converse.po`);
    await import(/*webpackChunkName: "locales/dayjs/[request]" */ `dayjs/locale/${dayjs_locale}.js`);
    dayjs.locale(getLocale(dayjs_locale, l => dayjs.locale(l)));
    jed_instance = new Jed(data);
}


let jed_instance;

/**
 * @namespace i18n
 */
Object.assign(i18n, {

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

    async initialize () {
        if (_converse.isTestEnv()) {
            _converse.locale = 'en';
        } else {
            try {
                const preferred_locale = api.settings.get('i18n');
                _converse.locale = i18n.getLocale(preferred_locale, api.settings.get("locales"));
                await fetchTranslations(_converse);
            } catch (e) {
                log.fatal(e.message);
                _converse.locale = 'en';
            }
        }
    },

    __ (...args) {
        return i18n.translate(...args);
    }
});

export const __ = i18n.__;
