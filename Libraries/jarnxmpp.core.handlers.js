/*global $:false, document:false, window:false, portal_url:false,
$msg:false, Strophe:false, setTimeout:false, navigator:false, jarn:false, google:false, jarnxmpp:false, jQuery:false, sessionStorage:false, $iq:false, $pres:false, Image:false, */

(function (jarnxmpp, $, portal_url) {

    portal_url = portal_url || '';

    jarnxmpp.Storage = {
        storage: null,
        init: function () {
            try {
                if ('sessionStorage' in window && window.sessionStorage !== null && JSON in window && window.JSON !== null) {
                    jarnxmpp.Storage.storage = sessionStorage;
                    if (!('_user_info' in jarnxmpp.Storage.storage)) {
                        jarnxmpp.Storage.set('_user_info', {});
                    }
                    if (!('_vCards' in jarnxmpp.Storage.storage)) {
                        jarnxmpp.Storage.set('_vCards', {});
                    }
                    if (!('_subscriptions' in jarnxmpp.Storage.storage)) {
                        jarnxmpp.Storage.set('_subscriptions', null);
                    }
                }
            } catch (e) {}
        },

        get: function (key) {
            if (key in sessionStorage) {
                return JSON.parse(sessionStorage[key]);
            }
            return null;
        },

        set: function (key, value) {
            sessionStorage[key] = JSON.stringify(value);
        },

        xmppGet: function (key, callback) {
            var stanza = $iq({type: 'get'})
                .c('query', {xmlns: 'jabber:iq:private'})
                .c('jarnxmpp', {xmlns: 'http://jarn.com/ns/jarnxmpp:prefs:' + key})
                .tree();
            jarnxmpp.connection.sendIQ(stanza, function success(result) {
                callback($('jarnxmpp ' + 'value', result).first().text());
            });
        },

        xmppSet: function (key, value) {
            var stanza = $iq({type: 'set'})
                .c('query', {xmlns: 'jabber:iq:private'})
                .c('jarnxmpp', {xmlns: 'http://jarn.com/ns/jarnxmpp:prefs:' + key})
                .c('value', value)
                .tree();
            jarnxmpp.connection.sendIQ(stanza);
        }
    };

    jarnxmpp.Storage.init();

    jarnxmpp.Presence = {
        online: {},
        _user_info: {},

        onlineCount: function () {
            var me = Strophe.getNodeFromJid(jarnxmpp.connection.jid),
                counter = 0,
                user;
            for (user in jarnxmpp.Presence.online) {
                if ((jarnxmpp.Presence.online.hasOwnProperty(user)) && user !== me) {
                    counter += 1;
                }
            }
            return counter;
        },

        getUserInfo: function (user_id, callback) {
            // User info on browsers without storage
            if (jarnxmpp.Storage.storage === null) {
                if (user_id in jarnxmpp.Presence._user_info) {
                    callback(jarnxmpp.Presence._user_info[user_id]);
                } else {
                    $.getJSON(portal_url + "/xmpp-userinfo?user_id=" + user_id, function (data) {
                        jarnxmpp.Presence._user_info[user_id] = data;
                        callback(data);
                    });
                }
            } else {
                var _user_info = jarnxmpp.Storage.get('_user_info');
                if (user_id in _user_info) {
                    callback(_user_info[user_id]);
                } else {
                    $.getJSON(portal_url + "/xmpp-userinfo?user_id=" + user_id, function (data) {
                        _user_info[user_id] = data;
                        jarnxmpp.Storage.set('_user_info', _user_info);
                        callback(data);
                    });
                }
            }
        }
    };

    jarnxmpp.vCard = {

        _vCards: {},

        _getVCard: function (jid, callback) {
            var stanza =
                $iq({type: 'get', to: jid})
                .c('vCard', {xmlns: 'vcard-temp'}).tree();
            jarnxmpp.connection.sendIQ(stanza, function (data) {
                var result = {};
                $('vCard[xmlns="vcard-temp"]', data).children().each(function (idx, element) {
                    result[element.nodeName] = element.textContent;
                });
                if (typeof (callback) !== 'undefined') {
                    callback(result);
                }
            });
        },

        getVCard: function (jid, callback) {
            jid = Strophe.getBareJidFromJid(jid);
            if (jarnxmpp.Storage.storage === null) {
                if (jid in jarnxmpp.vCard._vCards) {
                    callback(jarnxmpp.vCard._vCards[jid]);
                } else {
                    jarnxmpp.vCard._getVCard(jid, function (result) {
                        jarnxmpp.vCard._vCards[jid] = result;
                        callback(result);
                    });
                }
            } else {
                var _vCards = jarnxmpp.Storage.get('_vCards');
                if (jid in _vCards) {
                    callback(_vCards[jid]);
                } else {
                    jarnxmpp.vCard._getVCard(jid, function (result) {
                        _vCards[jid] = result;
                        jarnxmpp.Storage.set('_vCards', _vCards);
                        callback(result);
                    });
                }
            }
        },

        setVCard: function (params, photoUrl) {
            var key,
                vCard = Strophe.xmlElement('vCard', [['xmlns', 'vcard-temp'], ['version', '2.0']]);
            for (key in params) {
                if (params.hasOwnProperty(key)) {
                    vCard.appendChild(Strophe.xmlElement(key, [], params[key]));
                }
            }
            var send = function () {
                var stanza = $iq({type: 'set'}).cnode(vCard).tree();
                jarnxmpp.connection.sendIQ(stanza);
            };
            if (typeof (photoUrl) === 'undefined') {
                send();
            } else {
                jarnxmpp.vCard.getBase64Image(photoUrl, function (base64img) {
                    base64img = base64img.replace(/^data:image\/png;base64,/, "");
                    var photo = Strophe.xmlElement('PHOTO');
                    photo.appendChild(Strophe.xmlElement('TYPE', [], 'image/png'));
                    photo.appendChild(Strophe.xmlElement('BINVAL', [], base64img));
                    vCard.appendChild(photo);
                    send();
                });
            }
        },

        getBase64Image: function (url, callback) {
            // Create the element, then draw it on a canvas to get the base64 data.
            var img = new Image();
            $(img).load(function () {
                var canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                callback(canvas.toDataURL('image/png'));
            }).attr('src', url);
        }
    };

    jarnxmpp.onConnect = function (status) {
        if ((status === Strophe.Status.ATTACHED) || (status === Strophe.Status.CONNECTED)) {
            $(window).bind('beforeunload', function () {
                $(document).trigger('jarnxmpp.disconnecting');
                var presence = $pres({type: 'unavailable'});
                jarnxmpp.connection.send(presence);
                jarnxmpp.connection.disconnect();
                jarnxmpp.connection.flush();
            });
            $(document).trigger('jarnxmpp.connected');
        } else if (status === Strophe.Status.DISCONNECTED) {
            $(document).trigger('jarnxmpp.disconnected');
        }
    };

    jarnxmpp.rawInput = function (data) {
        var event = jQuery.Event('jarnxmpp.dataReceived');
        event.text = data;
        $(document).trigger(event);
    };

    jarnxmpp.rawOutput = function (data) {
        var event = jQuery.Event('jarnxmpp.dataSent');
        event.text = data;
        $(document).trigger(event);
    };

    $(document).bind('jarnxmpp.connected', function () {
        // Logging
        jarnxmpp.connection.rawInput = jarnxmpp.rawInput;
        jarnxmpp.connection.rawOutput = jarnxmpp.rawOutput;
    });

    $(document).bind('jarnxmpp.disconnecting', function () {
        if (jarnxmpp.Storage.storage !== null) {
            jarnxmpp.Storage.set('online-count', jarnxmpp.Presence.onlineCount());
        }
    });

    $(document).ready(function () {
        var resource = jarnxmpp.Storage.get('xmppresource');
        if (resource) {
            data = {'resource': resource};
        } else {
            data = {};
        }
        $.ajax({
            'url':portal_url + '/@@xmpp-loader',
            'dataType': 'json',
            'data': data,
            'success': function (data) {
                if (!(('rid' in data) && ('sid' in data) && ('BOSH_SERVICE' in data))) {
                    return;
                }
                if (!resource) {
                    jarnxmpp.Storage.set('xmppresource', Strophe.getResourceFromJid(data.jid));
                }
                jarnxmpp.BOSH_SERVICE = data.BOSH_SERVICE;
                jarnxmpp.jid = data.jid;
                jarnxmpp.connection = new Strophe.Connection(jarnxmpp.BOSH_SERVICE);
                jarnxmpp.connection.attach(jarnxmpp.jid, data.sid, data.rid, jarnxmpp.onConnect);
            }
        });
    });

})(window.jarnxmpp = window.jarnxmpp || {}, jQuery, portal_url);
