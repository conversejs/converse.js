/**
 * @module i18n
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the internationalization module
 */
import Jed from 'jed';
import log from '@converse/headless/log.js';
import { _converse, api, converse, i18n } from '@converse/headless/core.js';

const { dayjs } = converse.env;

let jed_instance;

/**
 * @private
 * @param { string } locale
 * @param { string[] } supported_locales
 */
function isConverseLocale (locale, supported_locales) {
    return typeof locale === 'string' && supported_locales.includes(locale);
}

/**
 * Determines which locale is supported by the user's system as well
 * as by the relevant library (e.g. converse.js or dayjs).
 * @private
 * @param { string } preferred_locale
 * @param { Function } isSupportedByLibrary - Returns a boolean indicating whether
 *   the locale is supported.
 * @returns { string }
 */
function getLocale (preferred_locale, isSupportedByLibrary) {
    if (preferred_locale === 'en' || isSupportedByLibrary(preferred_locale)) {
        return preferred_locale;
    }

    const { languages } = window.navigator;

    let locale;
    for (let i = 0; i < languages.length && !locale; i++) {
        locale = isLocaleAvailable(languages[i], isSupportedByLibrary);
    }
    return locale || 'en';
}

/**
 * Check whether the locale or sub locale (e.g. en-US, en) is supported.
 * @private
 * @param { String } locale - The locale to check for
 * @param { Function } available - Returns a boolean indicating whether the locale is supported
 */
function isLocaleAvailable (locale, available) {
    if (available(locale)) {
        return locale;
    } else {
        var sublocale = locale.split('-')[0];
        if (sublocale !== locale && available(sublocale)) {
            return sublocale;
        }
    }
}

/**
 * Given a locale, return the closest locale returned by dayJS
 * @private
 * @param { string } locale
 */
function getDayJSLocale (locale) {
    const dayjs_locale = locale.toLowerCase().replace('_', '-');
    return dayjs_locale === 'ug' ? 'ug-cn' : dayjs_locale;
}

/**
 * Fetch the translations for the given local at the given URL.
 * @private
 * @returns { Jed }
 */
async function fetchTranslations () {
    const { api, locale } = _converse;
    const dayjs_locale = getDayJSLocale(locale);

    if (!isConverseLocale(locale, api.settings.get('locales')) || locale === 'en') {
        return;
    }
    const { default: data } = await import(
        /*webpackChunkName: "locales/[request]" */ `../i18n/${locale}/LC_MESSAGES/converse.po`
    );
    await import(/*webpackChunkName: "locales/dayjs/[request]" */ `dayjs/locale/${dayjs_locale}.js`);
    dayjs.locale(getLocale(dayjs_locale, (l) => dayjs.locale(l)));
    return new Jed(data);
}


/**
 * @namespace i18n
 */
Object.assign(i18n, {

    /**
     * @param { string } preferred_locale
     * @param { string[] } available_locales
     */
    getLocale (preferred_locale, available_locales) {
        return getLocale(preferred_locale, (preferred) => isConverseLocale(preferred, available_locales));
    },

    /**
     * @param { string } str - The string to be translated
     */
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
                _converse.locale = i18n.getLocale(preferred_locale, api.settings.get('locales'));
                jed_instance = await fetchTranslations();
            } catch (e) {
                log.fatal(e.message);
                _converse.locale = 'en';
            }
        }
    },

    __ (...args) {
        return i18n.translate(...args);
    },
});

export const __ = i18n.__;
