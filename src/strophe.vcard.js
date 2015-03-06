/* Plugin to implement the vCard extension.
 *  http://xmpp.org/extensions/xep-0054.html
 *
 *  Author: Nathan Zorn (nathan.zorn@gmail.com)
 *  AMD support by JC Brand
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([
            "strophe"
        ], function (Strophe) {
            factory(
                Strophe.Strophe,
                Strophe.$build,
                Strophe.$iq ,
                Strophe.$msg,
                Strophe.$pres
            );
            return Strophe;
        });
    } else {
        // Browser globals
        factory(
            root.Strophe,
            root.$build,
            root.$iq ,
            root.$msg,
            root.$pres
        );
    }
}(this, function (Strophe, $build, $iq, $msg, $pres) {

    var buildIq = function(type, jid, vCardEl) {
        var iq = $iq(jid ? {type: type, to: jid} : {type: type});
        iq.c("vCard", {xmlns: Strophe.NS.VCARD});
        if (vCardEl) {
            iq.cnode(vCardEl);
        }
        return iq;
    };

    Strophe.addConnectionPlugin('vcard', {
        _connection: null,
        init: function(conn) {
            this._connection = conn;
            return Strophe.addNamespace('VCARD', 'vcard-temp');
        },

        /*Function
        Retrieve a vCard for a JID/Entity
        Parameters:
        (Function) handler_cb - The callback function used to handle the request.
        (String) jid - optional - The name of the entity to request the vCard
            If no jid is given, this function retrieves the current user's vcard.
        */
        get: function(handler_cb, jid, error_cb) {
            var iq = buildIq("get", jid);
            return this._connection.sendIQ(iq, handler_cb, error_cb);
        },

        /* Function
            Set an entity's vCard.
        */
        set: function(handler_cb, vCardEl, jid, error_cb) {
            var iq = buildIq("set", jid, vCardEl);
            return this._connection.sendIQ(iq, handler_cb, error_cb);
        }
    });
}));
