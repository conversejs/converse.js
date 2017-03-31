var config;
if (typeof(require) === 'undefined') {
    /* XXX: Hack to work around r.js's stupid parsing.
     * We want to save the configuration in a variable so that we can reuse it in
     * tests/main.js.
     */
    // eslint-disable-next-line
    require = { // jshint ignore:line
        config: function (c) {
            config = c;
        }
    };
}

require.config({
    baseUrl: '.',
    paths: {
        "almond":                   "node_modules/almond/almond",
        "awesomplete":              "node_modules/awesomplete/awesomplete",
        "backbone":                 "node_modules/backbone/backbone",
        "backbone.browserStorage":  "node_modules/backbone.browserStorage/backbone.browserStorage",
        "backbone.overview":        "node_modules/backbone.overview/backbone.overview",
        "eventemitter":             "node_modules/otr/build/dep/eventemitter",
        "jquery":                   "node_modules/jquery/dist/jquery",
        "jquery-private":           "src/jquery-private",
        "jquery.browser":           "node_modules/jquery.browser/dist/jquery.browser",
        "jquery.easing":            "node_modules/jquery-easing/jquery.easing.1.3.umd", // XXX: Only required for https://conversejs.org website
        "moment":                   "node_modules/moment/moment",
        "pluggable":                "node_modules/pluggable.js/dist/pluggable",
        "polyfill":                 "src/polyfill",
        "sizzle":                   "node_modules/jquery/sizzle/dist/sizzle",
        "strophe":                  "node_modules/strophe.js/strophe",
        "strophe.disco":            "node_modules/strophejs-plugin-disco/strophe.disco",
        "strophe.ping":             "node_modules/strophejs-plugin-ping/strophe.ping",
        "strophe.rsm":              "node_modules/strophejs-plugin-rsm/strophe.rsm",
        "strophe.vcard":            "node_modules/strophejs-plugin-vcard/strophe.vcard",
        "text":                     "node_modules/text/text",
        "tpl":                      "node_modules/lodash-template-loader/loader",
        "typeahead":                "components/typeahead.js/index",
        "lodash":                   "node_modules/lodash/lodash",
        "underscore":               "src/underscore-shim",
        "utils":                    "src/utils",

        // Converse
        "converse":                 "src/converse",

        "converse-core":            "src/converse-core",
        "converse-bookmarks":       "src/converse-bookmarks",
        "converse-chatview":        "src/converse-chatview",
        "converse-controlbox":      "src/converse-controlbox",
        "converse-dragresize":      "src/converse-dragresize",
        "converse-headline":        "src/converse-headline",
        "converse-mam":             "src/converse-mam",
        "converse-minimize":        "src/converse-minimize",
        "converse-muc":             "src/converse-muc",
        "converse-muc-embedded":    "src/converse-muc-embedded",
        "converse-notification":    "src/converse-notification",
        "converse-otr":             "src/converse-otr",
        "converse-ping":            "src/converse-ping",
        "converse-register":        "src/converse-register",
        "converse-rosterview":      "src/converse-rosterview",
        "converse-vcard":           "src/converse-vcard",

        // Off-the-record-encryption
        // "bigint":               "node_modules/otr/build/dep/bigint",
        "bigint":               "3rdparty/bigint",
        "crypto":               "node_modules/otr/build/dep/crypto",
        "salsa20":              "node_modules/otr/build/dep/salsa20",
        "otr":                  "node_modules/otr/build/otr",

        // Locales paths
        "locales":   "src/locales",
        "jed":       "node_modules/jed/jed",
        "af":        "locale/af/LC_MESSAGES/converse.json",
        "ca":        "locale/ca/LC_MESSAGES/converse.json",
        "de":        "locale/de/LC_MESSAGES/converse.json",
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

        "moment_with_locales": "3rdparty/moment_locales",
        'moment_af':        "node_modules/moment/locale/af",
        'moment_de':        "node_modules/moment/locale/de",
        'moment_es':        "node_modules/moment/locale/es",
        'moment_fr':        "node_modules/moment/locale/fr",
        'moment_he':        "node_modules/moment/locale/he",
        'moment_hu':        "node_modules/moment/locale/hu",
        'moment_id':        "node_modules/moment/locale/id",
        'moment_it':        "node_modules/moment/locale/it",
        'moment_ja':        "node_modules/moment/locale/ja",
        'moment_nb':        "node_modules/moment/locale/nb",
        'moment_nl':        "node_modules/moment/locale/nl",
        'moment_pl':        "node_modules/moment/locale/pl",
        'moment_pt-br':     "node_modules/moment/locale/pt-br",
        'moment_ru':        "node_modules/moment/locale/ru",
        'moment_uk':        "node_modules/moment/locale/uk",
        'moment_zh':        "node_modules/moment/locale/zh-cn",

        // Templates
        "action":                   "src/templates/action",
        "add_contact_dropdown":     "src/templates/add_contact_dropdown",
        "add_contact_form":         "src/templates/add_contact_form",
        "avatar":                   "src/templates/avatar",
        "bookmark":                 "src/templates/bookmark",
        "bookmarks_list":           "src/templates/bookmarks_list",
        "change_status_message":    "src/templates/change_status_message",
        "chat_status":              "src/templates/chat_status",
        "chatarea":                 "src/templates/chatarea",
        "chatbox":                  "src/templates/chatbox",
        "chatbox_minimize":         "src/templates/chatbox_minimize",
        "chatroom":                 "src/templates/chatroom",
        "chatroom_bookmark_form":   "src/templates/chatroom_bookmark_form",
        "chatroom_bookmark_toggle": "src/templates/chatroom_bookmark_toggle",
        "chatroom_features":        "src/templates/chatroom_features",
        "chatroom_form":            "src/templates/chatroom_form",
        "chatroom_head":            "src/templates/chatroom_head",
        "chatroom_invite":          "src/templates/chatroom_invite",
        "chatroom_nickname_form":   "src/templates/chatroom_nickname_form",
        "chatroom_password_form":   "src/templates/chatroom_password_form",
        "chatroom_sidebar":         "src/templates/chatroom_sidebar",
        "chatroom_toolbar":         "src/templates/chatroom_toolbar",
        "chatrooms_tab":            "src/templates/chatrooms_tab",
        "chats_panel":              "src/templates/chats_panel",
        "choose_status":            "src/templates/choose_status",
        "contacts_panel":           "src/templates/contacts_panel",
        "contacts_tab":             "src/templates/contacts_tab",
        "controlbox":               "src/templates/controlbox",
        "controlbox_toggle":        "src/templates/controlbox_toggle",
        "dragresize":               "src/templates/dragresize",
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
        "register_panel":           "src/templates/register_panel",
        "register_tab":             "src/templates/register_tab",
        "registration_form":        "src/templates/registration_form",
        "registration_request":     "src/templates/registration_request",
        "requesting_contact":       "src/templates/requesting_contact",
        "room_description":         "src/templates/room_description",
        "room_item":                "src/templates/room_item",
        "room_panel":               "src/templates/room_panel",
        "roster":                   "src/templates/roster",
        "roster_filter":            "src/templates/roster_filter",
        "roster_item":              "src/templates/roster_item",
        "search_contact":           "src/templates/search_contact",
        "select_option":            "src/templates/select_option",
        "status_option":            "src/templates/status_option",
        "toggle_chats":             "src/templates/toggle_chats",
        "toolbar":                  "src/templates/toolbar",
        "toolbar_otr":              "src/templates/toolbar_otr",
        "trimmed_chat":             "src/templates/trimmed_chat"
    },

    map: {
        // '*' means all modules will get 'jquery-private'
        // for their 'jquery' dependency.
        '*': {
            'jquery': 'jquery-private',
         },
        'backbone': {
            "underscore": "lodash"
         },
        // 'jquery-private' wants the real jQuery module
        // though. If this line was not here, there would
        // be an unresolvable cyclic dependency.
        'jquery-private': { 'jquery': 'jquery' }
    },

    lodashLoader: {
        // Configuration for requirejs-tpl
        // Use Mustache style syntax for variable interpolation
        templateSettings: {
            'escape': /\{\{\{([\s\S]+?)\}\}\}/g,
            'evaluate': /\{\[([\s\S]+?)\]\}/g,
            'interpolate': /\{\{([\s\S]+?)\}\}/g
        }
    },

    // define module dependencies for modules not using define
    shim: {
        'awesomplete':          { exports: 'Awesomplete' },
    }
});
