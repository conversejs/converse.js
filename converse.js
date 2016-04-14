var config;
if (typeof(require) === 'undefined') {
    /* XXX: Hack to work around r.js's stupid parsing.
     * We want to save the configuration in a variable so that we can reuse it in
     * tests/main.js.
     */
    require = { // jshint ignore:line
        config: function (c) {
            config = c;
        }
    };
}

require.config({
    baseUrl: '.',
    paths: {
        "backbone":                 "components/backbone/backbone",
        "backbone.browserStorage":  "components/backbone.browserStorage/backbone.browserStorage",
        "backbone.overview":        "components/backbone.overview/backbone.overview",
        "eventemitter":             "components/otr/build/dep/eventemitter",
        "jquery":                   "components/jquery/dist/jquery",
        "jquery-private":           "src/jquery-private",
        "jquery.browser":           "components/jquery.browser/dist/jquery.browser",
        "jquery.easing":            "components/jquery-easing-original/index",          // XXX: Only required for https://conversejs.org website
        "moment":                   "components/momentjs/moment",
        "strophe":                  "components/strophejs/src/wrapper",
        "strophe-base64":           "components/strophejs/src/base64",
        "strophe-bosh":             "components/strophejs/src/bosh",
        "strophe-core":             "components/strophejs/src/core",
        "strophe-md5":              "components/strophejs/src/md5",
        "strophe-polyfill":         "components/strophejs/src/polyfills",
        "strophe-sha1":             "components/strophejs/src/sha1",
        "strophe-utils":            "components/strophejs/src/utils",
        "strophe-websocket":        "components/strophejs/src/websocket",
        "strophe.disco":            "components/strophejs-plugins/disco/strophe.disco",
        "strophe.ping":             "src/strophe.ping",
        "strophe.rsm":              "components/strophejs-plugins/rsm/strophe.rsm",
        "strophe.vcard":            "src/strophe.vcard",
        "text":                     'components/requirejs-text/text',
        "tpl":                      'components/requirejs-tpl-jcbrand/tpl',
        "typeahead":                "components/typeahead.js/index",
        "underscore":               "components/underscore/underscore",
        "utils":                    "src/utils",
        "polyfill":                 "src/polyfill",
        
        // Converse
        "converse-api":             "src/converse-api",
        "converse-chatview":        "src/converse-chatview",
        "converse-controlbox":      "src/converse-controlbox",
        "converse-core":            "src/converse-core",
        "converse-dragresize":      "src/converse-dragresize",
        "converse-headline":        "src/converse-headline",
        "converse-mam":             "src/converse-mam",
        "converse-minimize":        "src/converse-minimize",
        "converse-muc":             "src/converse-muc",
        "converse-notification":    "src/converse-notification",
        "converse-otr":             "src/converse-otr",
        "converse-ping":            "src/converse-ping",
        "converse-register":        "src/converse-register",
        "converse-rosterview":      "src/converse-rosterview",
        "converse-templates":       "src/converse-templates",
        "converse-vcard":           "src/converse-vcard",

        // Off-the-record-encryption
        "bigint":               "src/bigint",
        "crypto":               "src/crypto",
        "crypto.aes":           "components/otr/vendor/cryptojs/aes",
        "crypto.cipher-core":   "components/otr/vendor/cryptojs/cipher-core",
        "crypto.core":          "components/otr/vendor/cryptojs/core",
        "crypto.enc-base64":    "components/otr/vendor/cryptojs/enc-base64",
        "crypto.evpkdf":        "components/crypto-js-evanvosberg/src/evpkdf",
        "crypto.hmac":          "components/otr/vendor/cryptojs/hmac",
        "crypto.md5":           "components/crypto-js-evanvosberg/src/md5",
        "crypto.mode-ctr":      "components/otr/vendor/cryptojs/mode-ctr",
        "crypto.pad-nopadding": "components/otr/vendor/cryptojs/pad-nopadding",
        "crypto.sha1":          "components/otr/vendor/cryptojs/sha1",
        "crypto.sha256":        "components/otr/vendor/cryptojs/sha256",
        "salsa20":              "components/otr/build/dep/salsa20",
        "otr":                  "src/otr",

        // Locales paths
        "locales":   "src/locales",
        "jed":       "components/jed/jed",
        "af":        "locale/af/LC_MESSAGES/converse.json",
        "ca":        "locale/ca/LC_MESSAGES/converse.json",
        "de":        "locale/de/LC_MESSAGES/converse.json",
        "en":        "locale/en/LC_MESSAGES/converse.json",
        "es":        "locale/es/LC_MESSAGES/converse.json",
        "fr":        "locale/fr/LC_MESSAGES/converse.json",
        "he":        "locale/he/LC_MESSAGES/converse.json",
        "hu":        "locale/hu/LC_MESSAGES/converse.json",
        "id":        "locale/id/LC_MESSAGES/converse.json",
        "it":        "locale/it/LC_MESSAGES/converse.json",
        "ja":        "locale/ja/LC_MESSAGES/converse.json",
        "nb":        "locale/nb/LC_MESSAGES/converse.json",
        "nl":        "locale/nl/LC_MESSAGES/converse.json",
        "pl":        "locale/pl/LC_MESSAGES/converse.json",
        "pt_BR":     "locale/pt_BR/LC_MESSAGES/converse.json",
        "ru":        "locale/ru/LC_MESSAGES/converse.json",
        "uk":        "locale/uk/LC_MESSAGES/converse.json",
        "zh":        "locale/zh/LC_MESSAGES/converse.json",

        "moment_with_locales": "src/moment_locales",
        'moment_af':        "components/momentjs/locale/af",
        'moment_de':        "components/momentjs/locale/de",
        'moment_es':        "components/momentjs/locale/es",
        'moment_fr':        "components/momentjs/locale/fr",
        'moment_he':        "components/momentjs/locale/he",
        'moment_hu':        "components/momentjs/locale/hu",
        'moment_id':        "components/momentjs/locale/id",
        'moment_it':        "components/momentjs/locale/it",
        'moment_ja':        "components/momentjs/locale/ja",
        'moment_nb':        "components/momentjs/locale/nb",
        'moment_nl':        "components/momentjs/locale/nl",
        'moment_pl':        "components/momentjs/locale/pl",
        'moment_pt-br':     "components/momentjs/locale/pt-br",
        'moment_ru':        "components/momentjs/locale/ru",
        'moment_uk':        "components/momentjs/locale/uk",
        'moment_zh':        "components/momentjs/locale/zh-cn",

        // Templates
        "action":                   "src/templates/action",
        "add_contact_dropdown":     "src/templates/add_contact_dropdown",
        "add_contact_form":         "src/templates/add_contact_form",
        "change_status_message":    "src/templates/change_status_message",
        "chat_status":              "src/templates/chat_status",
        "chatarea":                 "src/templates/chatarea",
        "chatbox":                  "src/templates/chatbox",
        "chatroom":                 "src/templates/chatroom",
        "chatroom_form":            "src/templates/chatroom_form",
        "chatroom_password_form":   "src/templates/chatroom_password_form",
        "chatroom_sidebar":         "src/templates/chatroom_sidebar",
        "chatrooms_tab":            "src/templates/chatrooms_tab",
        "chats_panel":              "src/templates/chats_panel",
        "choose_status":            "src/templates/choose_status",
        "contacts_panel":           "src/templates/contacts_panel",
        "contacts_tab":             "src/templates/contacts_tab",
        "controlbox":               "src/templates/controlbox",
        "controlbox_toggle":        "src/templates/controlbox_toggle",
        "field":                    "src/templates/field",
        "form_captcha":             "src/templates/form_captcha",
        "form_checkbox":            "src/templates/form_checkbox",
        "form_input":               "src/templates/form_input",
        "form_select":              "src/templates/form_select",
        "form_textarea":            "src/templates/form_textarea",
        "form_username":            "src/templates/form_username",
        "group_header":             "src/templates/group_header",
        "info":                     "src/templates/info",
        "login_panel":              "src/templates/login_panel",
        "login_tab":                "src/templates/login_tab",
        "message":                  "src/templates/message",
        "new_day":                  "src/templates/new_day",
        "occupant":                 "src/templates/occupant",
        "pending_contact":          "src/templates/pending_contact",
        "pending_contacts":         "src/templates/pending_contacts",
        "register_panel":           "src/templates/register_panel",
        "register_tab":             "src/templates/register_tab",
        "registration_form":        "src/templates/registration_form",
        "registration_request":     "src/templates/registration_request",
        "requesting_contact":       "src/templates/requesting_contact",
        "requesting_contacts":      "src/templates/requesting_contacts",
        "room_description":         "src/templates/room_description",
        "room_item":                "src/templates/room_item",
        "room_panel":               "src/templates/room_panel",
        "roster":                   "src/templates/roster",
        "roster_item":              "src/templates/roster_item",
        "search_contact":           "src/templates/search_contact",
        "select_option":            "src/templates/select_option",
        "status_option":            "src/templates/status_option",
        "toggle_chats":             "src/templates/toggle_chats",
        "toolbar":                  "src/templates/toolbar",
        "toolbar_otr":              "src/templates/toolbar_otr",
        "trimmed_chat":             "src/templates/trimmed_chat",
        "vcard":                    "src/templates/vcard",
        "chatbox_minimize":         "src/templates/chatbox_minimize"
    },

    map: {
        // '*' means all modules will get 'jquery-private'
        // for their 'jquery' dependency.
        '*': { 'jquery': 'jquery-private' },
        // 'jquery-private' wants the real jQuery module
        // though. If this line was not here, there would
        // be an unresolvable cyclic dependency.
        'jquery-private': { 'jquery': 'jquery' }
    },

    tpl: {
        // Configuration for requirejs-tpl
        // Use Mustache style syntax for variable interpolation
        templateSettings: {
            evaluate : /\{\[([\s\S]+?)\]\}/g,
            interpolate : /\{\{([\s\S]+?)\}\}/g
        }
    },

    // define module dependencies for modules not using define
    shim: {
        'crypto.aes':           { deps: ['crypto.cipher-core'] },
        'crypto.cipher-core':   { deps: ['crypto.enc-base64', 'crypto.evpkdf'] },
        'crypto.enc-base64':    { deps: ['crypto.core'] },
        'crypto.evpkdf':        { deps: ['crypto.md5'] },
        'crypto.hmac':          { deps: ['crypto.core'] },
        'crypto.md5':           { deps: ['crypto.core'] },
        'crypto.mode-ctr':      { deps: ['crypto.cipher-core'] },
        'crypto.pad-nopadding': { deps: ['crypto.cipher-core'] },
        'crypto.sha1':          { deps: ['crypto.core'] },
        'crypto.sha256':        { deps: ['crypto.core'] },
        'bigint':               { deps: ['crypto'] },
        'strophe.ping':         { deps: ['strophe'] },
        'strophe.register':     { deps: ['strophe'] },
        'strophe.vcard':        { deps: ['strophe'] }
    }
});


/* Converse.js components configuration
 *
 * This file is used to tell require.js which components (or plugins) to load
 * when it generates a build.
 */
if (typeof define !== 'undefined') {
    /* When running tests, define is not defined. */
    define("converse", [
        "jquery",
        "converse-api",

        /* START: Removable components
        * --------------------
        * Any of the following components may be removed if they're not needed.
        */
        "locales",              // Translations for converse.js. This line can be removed
                                // to remove *all* translations, or you can modify the
                                // file src/locales.js to include only those
                                // translations that you care about.

        "converse-chatview",    // Renders standalone chat boxes for single user chat
        "converse-mam",         // XEP-0313 Message Archive Management
        "converse-muc",         // XEP-0045 Multi-user chat
        "converse-vcard",       // XEP-0054 VCard-temp
        "converse-otr",         // Off-the-record encryption for one-on-one messages
        "converse-controlbox",  // The control box
        "converse-register",    // XEP-0077 In-band registration
        "converse-ping",        // XEP-0199 XMPP Ping
        "converse-notification",// HTML5 Notifications
        "converse-minimize",    // Allows chat boxes to be minimized
        "converse-dragresize",  // Allows chat boxes to be resized by dragging them
        "converse-headline",    // Support for headline messages
        /* END: Removable components */

    ], function($, converse_api) {
        window.converse = converse_api;
        $(window).trigger('converse-loaded', converse_api);
        return converse_api;
    });
}
