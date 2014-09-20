config = {
    baseUrl: '.',
    paths: {
        "backbone":                 "components/backbone/backbone",
        "backbone.browserStorage":  "components/backbone.browserStorage/backbone.browserStorage",
        "backbone.overview":        "components/backbone.overview/backbone.overview",
        "bootstrap":                "components/bootstrap/dist/js/bootstrap",                  // XXX: Only required for https://conversejs.org website
        "converse-dependencies":    "src/deps-website",
        "converse-templates":       "src/templates",
        "eventemitter":             "components/otr/build/dep/eventemitter",
        "jquery":                   "components/jquery/dist/jquery",
        "jquery.browser":           "components/jquery.browser/dist/jquery.browser",
        "jquery.easing":            "components/jquery-easing-original/jquery.easing.1.3", // XXX: Only required for https://conversejs.org website
        "moment":                   "components/momentjs/moment",
        "strophe":                  "components/strophe/strophe",
        "strophe.disco":            "components/strophe.disco/index",
        "strophe.muc":              "components/strophe.muc/index",
        "strophe.roster":           "components/strophe.roster/index",
        "strophe.vcard":            "components/strophe.vcard/index",
        "text":                     'components/requirejs-text/text',
        "tpl":                      'components/requirejs-tpl-jcbrand/tpl',
        "typeahead":                "components/typeahead.js/dist/typeahead.jquery",
        "underscore":               "components/underscore/underscore",
        "utils":                    "src/utils",

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
        "crypto.sha1":         "components/otr/vendor/cryptojs/sha1",
        "crypto.sha256":        "components/otr/vendor/cryptojs/sha256",
        "salsa20":              "components/otr/build/dep/salsa20",
        "otr":                  "src/otr",

        // Locales paths
        "locales":   "locale/locales",
        "jed":       "components/jed/jed",
        "af":        "locale/af/LC_MESSAGES/af",
        "de":        "locale/de/LC_MESSAGES/de",
        "en":        "locale/en/LC_MESSAGES/en",
        "es":        "locale/es/LC_MESSAGES/es",
        "fr":        "locale/fr/LC_MESSAGES/fr",
        "he":        "locale/he/LC_MESSAGES/he",
        "hu":        "locale/hu/LC_MESSAGES/hu",
        "id":        "locale/id/LC_MESSAGES/id",
        "it":        "locale/it/LC_MESSAGES/it",
        "ja":        "locale/ja/LC_MESSAGES/ja",
        "nl":        "locale/nl/LC_MESSAGES/nl",
        "pt_BR":     "locale/pt_BR/LC_MESSAGES/pt_BR",
        "ru":        "locale/ru/LC_MESSAGES/ru",
        "zh":        "locale/zh/LC_MESSAGES/zh",

        // Templates
        "action":                   "src/templates/action",
        "add_contact_dropdown":     "src/templates/add_contact_dropdown",
        "add_contact_form":         "src/templates/add_contact_form",
        "change_status_message":    "src/templates/change_status_message",
        "chat_status":              "src/templates/chat_status",
        "chatarea":                 "src/templates/chatarea",
        "chatbox":                  "src/templates/chatbox",
        "chatroom":                 "src/templates/chatroom",
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
        "form_checkbox":            "src/templates/form_checkbox",
        "form_input":               "src/templates/form_input",
        "form_select":              "src/templates/form_select",
        "group_header":             "src/templates/group_header",
        "info":                     "src/templates/info",
        "login_panel":              "src/templates/login_panel",
        "login_tab":                "src/templates/login_tab",
        "message":                  "src/templates/message",
        "new_day":                  "src/templates/new_day",
        "occupant":                 "src/templates/occupant",
        "pending_contact":          "src/templates/pending_contact",
        "pending_contacts":         "src/templates/pending_contacts",
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
        "trimmed_chat":             "src/templates/trimmed_chat"
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
        'backbone': {
            //These script dependencies should be loaded before loading
            //backbone.js
            deps: [
                'underscore',
                'jquery'
                ],
            //Once loaded, use the global 'Backbone' as the
            //module value.
            exports: 'Backbone'
        },
        'underscore':           { exports: '_' },
        'bootstrap':            { deps: ['jquery'] },
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
        'typeahead':            { deps: ['jquery'] },
        'jquery.browser':       { deps: ['jquery'] },
        'jquery.easing':        { deps: ['jquery'] },
        'utils':                { deps: ['jquery'] },
        'strophe':              { deps: ['jquery'] },
        'strophe.disco':        { deps: ['strophe'] },
        'strophe.muc':          { deps: ['strophe', 'jquery'] },
        'strophe.roster':       { deps: ['strophe'] },
        'strophe.vcard':        { deps: ['strophe'] }
    }
};

var initializeEasing = function () {
    /* XXX: This function initializes jquery.easing for the https://conversejs.org
     * website. This code is only useful in the context of the converse.js
     * website and converse.js itself is not dependent on it.
     */
    $(window).scroll(function() {
        if ($(".navbar").offset().top > 50) {
            $(".navbar-fixed-top").addClass("top-nav-collapse");
        } else {
            $(".navbar-fixed-top").removeClass("top-nav-collapse");
        }
    });
    //jQuery for page scrolling feature - requires jQuery Easing plugin
    $('.page-scroll a').bind('click', function(event) {
        var $anchor = $(this);
        $('html, body').stop().animate({
            scrollTop: $($anchor.attr('href')).offset().top
        }, 700, 'easeInOutExpo');
        event.preventDefault();
    });
};

if (typeof(require) !== 'undefined') {
    require.config(config);
    require(["jquery", "converse"], function($, converse) {
        window.converse = converse;
        initializeEasing(); // Only for https://conversejs.org website
    });
}
