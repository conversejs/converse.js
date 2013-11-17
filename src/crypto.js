;(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define([
            "crypto.core",
            "crypto.enc-base64",
            "crypto.md5",
            "crypto.evpkdf",
            "crypto.cipher-core",
            "crypto.aes",
            "crypto.sha1",
            "crypto.sha256",
            "crypto.hmac",
            "crypto.pad-nopadding",
            "crypto.mode-ctr"
            ], function() {
                return CryptoJS;
            }
        );
    } else {
        root.CryptoJS = factory();
    }
}(this));
