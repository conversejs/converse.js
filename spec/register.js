(function (root, factory) {
    define(["jquery.noconflict", "jasmine", "mock", "converse-core", "test-utils"], factory);
} (this, function ($, jasmine, mock, converse, test_utils) {
    var Strophe = converse.env.Strophe;
    var $iq = converse.env.$iq;
    var _ = converse.env._;

    describe("The Registration Panel", function () {

        it("is not available unless allow_registration=true",
            mock.initConverseWithPromises(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  allow_registration: false },
                function (done, _converse) {

            test_utils.waitUntil(function () {
                    return _converse.chatboxviews.get('controlbox');
                }, 300)
            .then(function () {

            test_utils.openControlBox();
            var cbview = _converse.chatboxviews.get('controlbox');
            expect(cbview.$('#controlbox-tabs li').length).toBe(1);
            expect(cbview.$('#controlbox-tabs li').text().trim()).toBe("Sign in");
            done();
            });
        }));

        it("can be opened by clicking on the registration tab",
            mock.initConverseWithPromises(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  allow_registration: true },
                function (done, _converse) {

            test_utils.waitUntil(function () {
                    return _.get(_converse.chatboxviews.get('controlbox'), 'registerpanel');
                }, 300)
            .then(function () {

            var cbview = _converse.chatboxviews.get('controlbox');
            test_utils.openControlBox();
            var $tabs = cbview.$('#controlbox-tabs');
            var $panels = cbview.$('.controlbox-panes');
            var $login = $panels.children().first();
            var $registration = $panels.children().last();
            expect($tabs.find('li').first().text()).toBe('Sign in');
            expect($tabs.find('li').last().text()).toBe('Register');

            spyOn(cbview, 'switchTab').and.callThrough();
            cbview.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
            $tabs.find('li').last().find('a').click(); // Click the Register tab
            expect($login.is(':visible')).toBe(false);
            expect($registration.is(':visible')).toBe(true);
            expect(cbview.switchTab).toHaveBeenCalled();
            done();
            });
        }));

        it("allows the user to choose an XMPP provider's domain",
            mock.initConverseWithPromises(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  allow_registration: true },
                function (done, _converse) {

            test_utils.waitUntil(function () {
                    return _.get(_converse.chatboxviews.get('controlbox'), 'registerpanel');
                }, 300)
            .then(function () {

            var cbview = _converse.chatboxviews.get('controlbox');
            var registerview = cbview.registerpanel;
            spyOn(registerview, 'onProviderChosen').and.callThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(_converse.connection, 'connect');
            var $tabs = cbview.$('#controlbox-tabs');
            $tabs.find('li').last().find('a').click(); // Click the Register tab
            // Check the form layout
            var $form = cbview.$('#converse-register');
            expect($form.find('input').length).toEqual(2);
            expect($form.find('input').first().attr('name')).toEqual('domain');
            expect($form.find('input').last().attr('type')).toEqual('submit');
            // Check that the input[type=domain] input is required
            $form.find('input[type=submit]').click();
            expect(registerview.onProviderChosen).toHaveBeenCalled();
            expect($form.find('input[name=domain]').hasClass('error')).toBeTruthy();
            // Check that the form is accepted if input[type=domain] has a value
            $form.find('input[name=domain]').val('conversejs.org');
            $form.find('input[type=submit]').click();
            expect(registerview.onProviderChosen).toHaveBeenCalled();
            expect(_converse.connection.connect).toHaveBeenCalled();
            done();
            });
        }));

        it("will render a registration form as received from the XMPP provider",
            mock.initConverseWithPromises(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  allow_registration: true },
                function (done, _converse) {

            test_utils.waitUntil(function () {
                    return _.get(_converse.chatboxviews.get('controlbox'), 'registerpanel');
                }, 300)
            .then(function () {

            var cbview = _converse.chatboxviews.get('controlbox');
            cbview.$('#controlbox-tabs').find('li').last().find('a').click(); // Click the Register tab
            var registerview = _converse.chatboxviews.get('controlbox').registerpanel;
            spyOn(registerview, 'onProviderChosen').and.callThrough();
            spyOn(registerview, 'getRegistrationFields').and.callThrough();
            spyOn(registerview, 'onRegistrationFields').and.callThrough();
            spyOn(registerview, 'renderRegistrationForm').and.callThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(_converse.connection, 'connect').and.callThrough();

            expect(registerview._registering).toBeFalsy();
            expect(_converse.connection.connected).toBeFalsy();
            registerview.$('input[name=domain]').val('conversejs.org');
            registerview.$('input[type=submit]').click();
            expect(registerview.onProviderChosen).toHaveBeenCalled();
            expect(registerview._registering).toBeTruthy();
            expect(_converse.connection.connect).toHaveBeenCalled();

            var stanza = new Strophe.Builder("stream:features", {
                        'xmlns:stream': "http://etherx.jabber.org/streams",
                        'xmlns': "jabber:client"
                    })
                .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
                .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
            _converse.connection._connect_cb(test_utils.createRequest(stanza));

            expect(registerview.getRegistrationFields).toHaveBeenCalled();

            stanza = $iq({
                    'type': 'result',
                    'id': 'reg1'
                }).c('query', {'xmlns': 'jabber:iq:register'})
                    .c('instructions')
                        .t('Please choose a username, password and provide your email address').up()
                    .c('username').up()
                    .c('password').up()
                    .c('email');
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(registerview.onRegistrationFields).toHaveBeenCalled();
            expect(registerview.renderRegistrationForm).toHaveBeenCalled();
            expect(registerview.$('input').length).toBe(5);
            expect(registerview.$('input[type=submit]').length).toBe(1);
            expect(registerview.$('input[type=button]').length).toBe(1);
            done();
            });
        }));

        it("will set form_type to legacy and submit it as legacy",
            mock.initConverseWithPromises(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  allow_registration: true },
                function (done, _converse) {

            test_utils.waitUntil(function () {
                    return _.get(_converse.chatboxviews.get('controlbox'), 'registerpanel');
                }, 300)
            .then(function () {

            var cbview = _converse.chatboxviews.get('controlbox');
            cbview.$('#controlbox-tabs').find('li').last().find('a').click(); // Click the Register tab
            var registerview = cbview.registerpanel;
            spyOn(registerview, 'onProviderChosen').and.callThrough();
            spyOn(registerview, 'getRegistrationFields').and.callThrough();
            spyOn(registerview, 'onRegistrationFields').and.callThrough();
            spyOn(registerview, 'renderRegistrationForm').and.callThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(_converse.connection, 'connect').and.callThrough();

            registerview.$('input[name=domain]').val('conversejs.org');
            registerview.$('input[type=submit]').click();

            var stanza = new Strophe.Builder("stream:features", {
                        'xmlns:stream': "http://etherx.jabber.org/streams",
                        'xmlns': "jabber:client"
                    })
                .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
                .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
            _converse.connection._connect_cb(test_utils.createRequest(stanza));
            stanza = $iq({
                    'type': 'result',
                    'id': 'reg1'
                }).c('query', {'xmlns': 'jabber:iq:register'})
                    .c('instructions')
                        .t('Please choose a username, password and provide your email address').up()
                    .c('username').up()
                    .c('password').up()
                    .c('email');
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(registerview.form_type).toBe('legacy');

            registerview.$('input[name=username]').val('testusername');
            registerview.$('input[name=password]').val('testpassword');
            registerview.$('input[name=email]').val('test@email.local');

            spyOn(_converse.connection, 'send');

            registerview.$('input[type=submit]').click();

            expect(_converse.connection.send).toHaveBeenCalled();
            var $stanza = $(_converse.connection.send.calls.argsFor(0)[0].tree());
            expect($stanza.children('query').children().length).toBe(3);
            expect($stanza.children('query').children()[0].tagName).toBe('username');
            done();
            });
        }));

        it("will set form_type to xform and submit it as xform",
            mock.initConverseWithPromises(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  allow_registration: true },
                function (done, _converse) {

            test_utils.waitUntil(function () {
                    return _.get(_converse.chatboxviews.get('controlbox'), 'registerpanel');
                }, 300)
            .then(function () {

            var cbview = _converse.chatboxviews.get('controlbox');
            cbview.$('#controlbox-tabs').find('li').last().find('a').click(); // Click the Register tab
            var registerview = _converse.chatboxviews.get('controlbox').registerpanel;
            spyOn(registerview, 'onProviderChosen').and.callThrough();
            spyOn(registerview, 'getRegistrationFields').and.callThrough();
            spyOn(registerview, 'onRegistrationFields').and.callThrough();
            spyOn(registerview, 'renderRegistrationForm').and.callThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(_converse.connection, 'connect').and.callThrough();

            registerview.$('input[name=domain]').val('conversejs.org');
            registerview.$('input[type=submit]').click();

            var stanza = new Strophe.Builder("stream:features", {
                        'xmlns:stream': "http://etherx.jabber.org/streams",
                        'xmlns': "jabber:client"
                    })
                .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
                .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
            _converse.connection._connect_cb(test_utils.createRequest(stanza));
            stanza = $iq({
                    'type': 'result',
                    'id': 'reg1'
                }).c('query', {'xmlns': 'jabber:iq:register'})
                    .c('instructions')
                        .t('Using xform data').up()
                    .c('x', { 'xmlns': 'jabber:x:data', 'type': 'form' })
                        .c('instructions').t('xform instructions').up()
                        .c('field', {'type': 'text-single', 'var': 'username'}).c('required').up().up()
                        .c('field', {'type': 'text-private', 'var': 'password'}).c('required').up().up()
                        .c('field', {'type': 'text-single', 'var': 'email'}).c('required').up().up();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(registerview.form_type).toBe('xform');

            registerview.$('input[name=username]').val('testusername');
            registerview.$('input[name=password]').val('testpassword');
            registerview.$('input[name=email]').val('test@email.local');

            spyOn(_converse.connection, 'send');

            registerview.$('input[type=submit]').click();

            expect(_converse.connection.send).toHaveBeenCalled();
            var $stanza = $(_converse.connection.send.calls.argsFor(0)[0].tree());
            expect($stanza.children('query').children().length).toBe(1);
            expect($stanza.children('query').children().children().length).toBe(3);
            expect($stanza.children('query').children().children()[0].tagName).toBe('field');
            done();
            });
        }));
    });
}));
