/*global jQuery, _, moment, Strophe, $build, $iq, $msg, $pres, SHA1, Base64, MD5, DSA, OTR */
define('jquery.browser', [], function () { return jQuery; });
define('typeahead', [], function () { return jQuery; });
define('underscore', [], function () { return _; });
define('moment_with_locales', [], function () { return moment; });
define('strophe', [], function () {
    return {
        'Strophe':         Strophe,
        '$build':          $build,
        '$iq':             $iq,
        '$msg':            $msg,
        '$pres':           $pres,
        'SHA1':            SHA1,
        'Base64':          Base64,
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
define('backbone', [], emptyFunction);
define('backbone.browserStorage', ['backbone'], emptyFunction);
define('backbone.overview', ['backbone'], emptyFunction);
define('otr', [], function () { return { 'DSA': DSA, 'OTR': OTR };});
define("locales", [], emptyFunction);
