/**
 * @module i18n
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description This is the internationalization module
 */
import Jed from 'jed';
import { api, converse, log } from '@converse/headless';
import { isTestEnv } from '@converse/headless/utils/session';

const { dayjs } = converse.env;

let jed_instance;
let locale = 'en';

/**
 * @param {string} preferred_locale
 * @param {string[]} supported_locales
 */
function isConverseLocale (preferred_locale, supported_locales) {
    return supported_locales.includes(preferred_locale);
}

/**
 * Determines which locale is supported by the user's system as well
 * as by the relevant library (e.g. converse.js or dayjs).
 * @param {string} preferred_locale
 * @param {Function} isSupportedByLibrary - Returns a boolean indicating whether
 *   the locale is supported.
 * @returns {string}
 */
function determineLocale (preferred_locale, isSupportedByLibrary) {
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
 * @param {string} locale - The locale to check for
 * @param {Function} available - Returns a boolean indicating whether the locale is supported
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
 * @param {string} locale
 */
function getDayJSLocale (locale) {
    const dayjs_locale = locale.toLowerCase().replace('_', '-');
    return dayjs_locale === 'ug' ? 'ug-cn' : dayjs_locale;
}

/**
 * Fetch the translations for the given local at the given URL.
 * @returns {Jed}
 */
async function fetchTranslations () {
    const dayjs_locale = getDayJSLocale(locale);

    if (!isConverseLocale(locale, api.settings.get('locales')) || locale === 'en') {
        return;
    }
    const { default: data } = await import(
        /*webpackChunkName: "locales/[request]" */ `../i18n/${locale}/LC_MESSAGES/converse.po`
    );
    await import(/*webpackChunkName: "locales/dayjs/[request]" */ `dayjs/locale/${dayjs_locale}.js`);
    dayjs.locale(determineLocale(dayjs_locale, (l) => dayjs.locale(l)));
    return new Jed(data);
}


/**
 * @namespace i18n
 */
const i18n = {
    getLocale() {
        return locale;
    },

    /**
     * @param {string} str - The string to be translated
     * @param {Array<any>} args
     */
    translate(str, args) {
        if (!jed_instance) {
            return Jed.sprintf.apply(Jed, arguments);
        }
        const t = jed_instance.translate(str);
        if (arguments.length > 1) {
            return t.fetch.apply(t, args);
        } else {
            return t.fetch();
        }
    },

    async initialize() {
        if (isTestEnv()) {
            locale = 'en';
        } else {
            try {
                const preferred_locale = api.settings.get('i18n');
                const available_locales = api.settings.get('locales');
                const isSupportedByLibrary = /** @param {string} pref */ (pref) =>
                    isConverseLocale(pref, available_locales);
                locale = determineLocale(preferred_locale, isSupportedByLibrary);
                jed_instance = await fetchTranslations();
            } catch (e) {
                log.fatal(e.message);
                locale = 'en';
            }
        }
    },

    __(str, ...args) {
        return i18n.translate(str, args);
    },
};

export { i18n };
export const __ = i18n.__;
