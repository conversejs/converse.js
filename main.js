require(["jquery", "converse"], function($, converse) {
    // Most of these initialization values are the defaults but they're
    // included here as a reference.
    converse.initialize({
        auto_list_rooms: false,
        auto_subscribe: false,
        bosh_service_url: 'https://bind.opkode.im', // Please use this connection manager only for testing purposes
        hide_muc_server: false,
        i18n: locales.en, // Refer to ./locale/locales.js to see which locales are supported
        prebind: false,
        xhr_user_search: false
    });
});
