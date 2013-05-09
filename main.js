require(["jquery", "converse"], function($, converse) {
    converse.initialize({
        animate: true,
        bosh_service_url: 'https://bind.opkode.im', // Please use this connection manager only for testing purposes
        prebind: false,
        xhr_user_search: false,
        auto_subscribe: false,
        auto_list_rooms: false
    });
});
