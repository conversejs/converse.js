require(["jquery", "converse"], function($, converse) {
    converse.initialize({
        bosh_service_url: 'https://bind.opkode.im',
        prebind: false,
        xhr_user_search: false,
        auto_subscribe: false 
    });
});
