require(["jquery", "converse"], function($, converse) {
    converse.initialize({
        prebind: false,
        xhr_user_search: false,
        auto_subscribe: false 
    });
});
