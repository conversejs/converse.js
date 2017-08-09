    
    define('jquery', [], function () { return jQuery; });
    define('jquery.noconflict', [], function () { return jQuery; });
    define('jquery.browser', [], function () { return jQuery; });
    define('awesomplete', [], function () { return jQuery; });
    define('lodash', [], function () { return _; });
    define('lodash.converter', [], function () { return fp; });
    define('lodash.noconflict', [], function () { return _; });
    define('moment_with_locales', [], function () { return moment; });
    define('strophe', [], function () {
        return {
            'Strophe':         Strophe,
            '$build':          $build,
            '$iq':             $iq,
            '$msg':            $msg,
            '$pres':           $pres,
            'SHA1':            SHA1,
            'MD5':             MD5,
            'b64_hmac_sha1':   SHA1.b64_hmac_sha1,
            'b64_sha1':        SHA1.b64_sha1,
            'str_hmac_sha1':   SHA1.str_hmac_sha1,
            'str_sha1':        SHA1.str_sha1
        };
    });
    var strophePlugin = function () { return Strophe; };
    var emptyFunction = function () { };
    define('strophe.disco', ['strophe'], strophePlugin);
    define('strophe.ping', ['strophe'], strophePlugin);
    define('strophe.rsm', ['strophe'], strophePlugin);
    define('strophe.vcard', ['strophe'], strophePlugin);
    define('backbone', [], function () { return Backbone; });
    define('backbone.noconflict', [], function () { return Backbone; });
    define('backbone.browserStorage', ['backbone'], emptyFunction);
    define('backbone.overview', ['backbone'], emptyFunction);
    define('otr', [], function () { return { 'DSA': DSA, 'OTR': OTR };});
    define("locales", [], emptyFunction);
    return require('converse');
}));
