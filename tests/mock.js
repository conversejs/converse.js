(function (root, factory) {
    define("mock", ['jquery.noconflict', 'converse'], factory);
}(this, function ($, converse) {
    var _ = converse.env._;
    var Promise = converse.env.Promise;
    var Strophe = converse.env.Strophe;
    var $iq = converse.env.$iq;
    var mock = {};
    // Names from http://www.fakenamegenerator.com/
    mock.req_names = [
        'Louw Spekman', 'Mohamad Stet', 'Dominik Beyer'
    ];
    mock.pend_names = [
        'Suleyman van Beusichem', 'Nanja van Yperen', 'Nicole Diederich'
    ];
    mock.cur_names = [
        'Max Frankfurter', 'Candice van der Knijff', 'Irini Vlastuin', 'Rinse Sommer', 'Annegreet Gomez',
        'Robin Schook', 'Marcel Eberhardt', 'Simone Brauer', 'Asmaa Haakman', 'Felix Amsel',
        'Lena Grunewald', 'Laura Grunewald', 'Mandy Seiler', 'Sven Bosch', 'Nuriye Cuypers'
    ];
    mock.num_contacts = mock.req_names.length + mock.pend_names.length + mock.cur_names.length;

    mock.groups = {
        'colleagues': 3,
        'friends & acquaintences': 3,
        'Family': 4,
        'ænemies': 3,
        'Ungrouped': 2
    };

    mock.chatroom_names = [
        'Dyon van de Wege', 'Thomas Kalb', 'Dirk Theissen', 'Felix Hofmann', 'Ka Lek', 'Anne Ebersbacher'
    ];
    // TODO: need to also test other roles and affiliations
    mock.chatroom_roles = {
        'Anne Ebersbacher': { affiliation: "owner", role: "moderator" },
        'Dirk Theissen': { affiliation: "admin", role: "moderator" },
        'Dyon van de Wege': { affiliation: "member", role: "occupant" },
        'Felix Hofmann': { affiliation: "member", role: "occupant" },
        'Ka Lek': { affiliation: "member", role: "occupant" },
        'Thomas Kalb': { affiliation: "member", role: "occupant" }
    };

    mock.event = {
        'preventDefault': function () {}
    };

    mock.mock_connection = function ()  {  // eslint-disable-line wrap-iife
        return function () {
            Strophe.Bosh.prototype._processRequest = function () {}; // Don't attempt to send out stanzas
            var c = new Strophe.Connection('jasmine tests');
            var sendIQ = c.sendIQ;

            c.IQ_stanzas = [];
            c.IQ_ids = [];
            c.sendIQ = function (iq, callback, errback) {
                this.IQ_stanzas.push(iq);
                var id = sendIQ.bind(this)(iq, callback, errback);
                this.IQ_ids.push(id);
                return id;
            }

            c.vcard = {
                'get': function (callback, jid) {
                    var fullname;
                    if (!jid) {
                        jid = 'dummy@localhost';
                        fullname = 'Max Mustermann' ;
                    } else {
                        var name = jid.split('@')[0].replace(/\./g, ' ').split(' ');
                        var last = name.length-1;
                        name[0] =  name[0].charAt(0).toUpperCase()+name[0].slice(1);
                        name[last] = name[last].charAt(0).toUpperCase()+name[last].slice(1);
                        fullname = name.join(' ');
                    }
                    var vcard = $iq().c('vCard').c('FN').t(fullname);
                    callback(vcard.tree());
                }
            };
            c._proto._connect = function () {
                c.authenticated = true;
                c.connected = true;
                c.mock = true;
                c.jid = 'dummy@localhost/resource';
                c._changeConnectStatus(Strophe.Status.CONNECTED);
            };
            return c;
        };
    }();

    function initConverse (settings, spies, promises) {
        window.localStorage.clear();
        window.sessionStorage.clear();

        var connection = mock.mock_connection();
        if (!_.isUndefined(spies)) {
            _.forEach(spies, function (method) {
                spyOn(connection, method);
            });
        }

        var _converse = converse.initialize(_.extend({
            'i18n': 'en',
            'auto_subscribe': false,
            'play_sounds': false,
            'bosh_service_url': 'localhost',
            'connection': connection,
            'animate': false,
            'no_trimming': true,
            'auto_login': true,
            'jid': 'dummy@localhost',
            'password': 'secret',
            'debug': false
        }, settings || {}));
        _converse.ChatBoxViews.prototype.trimChat = function () {};
        window.converse_disable_effects = true;
        $.fx.off = true;
        return _converse;
    }

    mock.initConverseWithPromises = function (spies, promise_names, settings, func) {
        return function (done) {
            var _converse = initConverse(settings, spies);
            var promises = _.map(promise_names, _converse.api.waitUntil);
            Promise.all(promises)
                .then(_.partial(func, done, _converse))
                .catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
        }
    };

    mock.initConverseWithConnectionSpies = function (spies, settings, func) {
        return function (done) {
            return func(done, initConverse(settings, spies));
        };
    };

    mock.initConverseWithAsync = function (settings, func) {
        if (_.isFunction(settings)) {
            var _func = settings;
            settings = func;
            func = _func;
        }
        return function (done) {
            return func(done, initConverse(settings));
        };
    };
    mock.initConverse = function (settings, func) {
        if (_.isFunction(settings)) {
            var _func = settings;
            settings = func;
            func = _func;
        }
        return function () {
            return func(initConverse(settings));
        };
    };
    return mock;
}));
