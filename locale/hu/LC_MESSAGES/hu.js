(function (root, factory) {
    define("hu", ['jed'], function () {
        var hu = new Jed({
            "domain": "converse",
            "locale_data": {
                // Paste the data from hu/LC_MESSAGES/converse.json here (but
                // remove the outermost curly brackets).
            }
        });
        return factory(hu);
    });
}(this, function (hu) { 
    return hu; 
}));
