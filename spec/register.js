(function (root, factory) {
    define([
        "jquery",
        "mock",
        "test_utils"
        ], function ($, mock, test_utils) {
            return factory($, mock, test_utils);
        }
    );
} (this, function ($, mock, test_utils) {
    var Strophe = converse_api.env.Strophe;
    var $iq = converse_api.env.$iq;

    describe("The Registration Panel", $.proxy(function (mock, test_utils) {
        beforeEach(function () {
            test_utils.closeControlBox();
            connection = mock.mock_connection;
            connection.connected = false;
            converse._tearDown();
            converse.initialize({
                bosh_service_url: 'localhost',
                allow_registration: true,
                auto_subscribe: false,
                animate: false,
                connection: connection,
                no_trimming: true,
                debug: true
            });
            test_utils.openControlBox();

        });

        afterEach($.proxy(function () {
            this.connection.connected = false;
            test_utils.closeControlBox();
        }, converse));

        it("is not available unless allow_registration=true",  $.proxy(function () {
            test_utils.closeControlBox();
            var connection = mock.mock_connection;
            connection.connected = false;
            converse._tearDown();
            converse.initialize({
                animate: false,
                auto_subscribe: false,
                bosh_service_url: 'localhost',
                connection: connection,
                no_trimming: true,
                allow_registration: false,
                debug: true
            });
            test_utils.openControlBox();
            var cbview = this.chatboxviews.get('controlbox');
            expect(cbview.$('#controlbox-tabs li').length).toBe(1);
            expect(cbview.$('#controlbox-tabs li').text().trim()).toBe("Sign in");
            connection = mock.mock_connection;
            connection.connected = false;
            converse._tearDown();
            converse.initialize({
                bosh_service_url: 'localhost',
                allow_registration: true,
                auto_subscribe: false,
                animate: false,
                connection: connection,
                no_trimming: true,
                debug: true
            });
            test_utils.openControlBox();
            cbview = this.chatboxviews.get('controlbox');
            expect(cbview.$el.find('#controlbox-tabs li').length).toBe(2);
            expect(cbview.$('#controlbox-tabs li').first().text().trim()).toBe("Sign in");
            expect(cbview.$('#controlbox-tabs li').last().text().trim()).toBe("Register");
        }, converse));

        it("can be opened by clicking on the registration tab", $.proxy(function () {
            var cbview = this.chatboxviews.get('controlbox');
            var $tabs = cbview.$('#controlbox-tabs');
            var $panels = cbview.$('.controlbox-panes');
            var $login = $panels.children().first();
            var $registration = $panels.children().last();
            expect($tabs.find('li').first().text()).toBe('Sign in');
            expect($tabs.find('li').last().text()).toBe('Register');

            spyOn(cbview, 'switchTab').andCallThrough();
            cbview.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
            $tabs.find('li').last().find('a').click(); // Click the Register tab
            expect($login.is(':visible')).toBe(false);
            expect($registration.is(':visible')).toBe(true);
            expect(cbview.switchTab).toHaveBeenCalled();
        }, converse));

        it("allows the user to choose an XMPP provider's domain", $.proxy(function () {
            var cbview = this.chatboxviews.get('controlbox');
            var registerview = cbview.registerpanel;
            spyOn(registerview, 'onProviderChosen').andCallThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(this.connection, 'connect');
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
            expect(this.connection.connect).toHaveBeenCalled();
        }, converse));

        it("will render a registration form as received from the XMPP provider", $.proxy(function () {
            var cbview = this.chatboxviews.get('controlbox');
            cbview.$('#controlbox-tabs').find('li').last().find('a').click(); // Click the Register tab
            var registerview = this.chatboxviews.get('controlbox').registerpanel;
            spyOn(registerview, 'onProviderChosen').andCallThrough();
            spyOn(registerview, 'getRegistrationFields').andCallThrough();
            spyOn(registerview, 'onRegistrationFields').andCallThrough();
            spyOn(registerview, 'renderRegistrationForm').andCallThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(this.connection, 'connect').andCallThrough();

            expect(registerview._registering).toBeFalsy();
            expect(this.connection.connected).toBeFalsy();
            registerview.$('input[name=domain]').val('conversejs.org');
            registerview.$('input[type=submit]').click();
            expect(registerview.onProviderChosen).toHaveBeenCalled();
            expect(registerview._registering).toBeTruthy();
            expect(this.connection.connect).toHaveBeenCalled();

            var stanza = new Strophe.Builder("stream:features", {
                        'xmlns:stream': "http://etherx.jabber.org/streams",
                        'xmlns': "jabber:client"
                    })
                .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
                .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
            this.connection._connect_cb(test_utils.createRequest(stanza));

            expect(registerview.getRegistrationFields).toHaveBeenCalled();
            expect(this.connection.connected).toBeTruthy();

            stanza = $iq({
                    'type': 'result',
                    'id': 'reg1'
                }).c('query', {'xmlns': 'jabber:iq:register'})
                    .c('instructions')
                        .t('Please choose a username, password and provide your email address').up()
                    .c('username').up()
                    .c('password').up()
                    .c('email');
            this.connection._dataRecv(test_utils.createRequest(stanza));
            expect(registerview.onRegistrationFields).toHaveBeenCalled();
            expect(registerview.renderRegistrationForm).toHaveBeenCalled();
            expect(registerview.$('input').length).toBe(5);
            expect(registerview.$('input[type=submit]').length).toBe(1);
            expect(registerview.$('input[type=button]').length).toBe(1);
        }, converse));

        it("will set form_type to legacy and submit it as legacy", $.proxy(function () {
            var cbview = this.chatboxviews.get('controlbox');
            cbview.$('#controlbox-tabs').find('li').last().find('a').click(); // Click the Register tab
            var registerview = this.chatboxviews.get('controlbox').registerpanel;
            spyOn(registerview, 'onProviderChosen').andCallThrough();
            spyOn(registerview, 'getRegistrationFields').andCallThrough();
            spyOn(registerview, 'onRegistrationFields').andCallThrough();
            spyOn(registerview, 'renderRegistrationForm').andCallThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(this.connection, 'connect').andCallThrough();

            registerview.$('input[name=domain]').val('conversejs.org');
            registerview.$('input[type=submit]').click();

            var stanza = new Strophe.Builder("stream:features", {
                        'xmlns:stream': "http://etherx.jabber.org/streams",
                        'xmlns': "jabber:client"
                    })
                .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
                .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
            this.connection._connect_cb(test_utils.createRequest(stanza));
            stanza = $iq({
                    'type': 'result',
                    'id': 'reg1'
                }).c('query', {'xmlns': 'jabber:iq:register'})
                    .c('instructions')
                        .t('Please choose a username, password and provide your email address').up()
                    .c('username').up()
                    .c('password').up()
                    .c('email');
            this.connection._dataRecv(test_utils.createRequest(stanza));
            expect(registerview.form_type).toBe('legacy');

            registerview.$('input[name=username]').val('testusername');
            registerview.$('input[name=password]').val('testpassword');
            registerview.$('input[name=email]').val('test@email.local');

            spyOn(converse.connection, 'send');

            registerview.$('input[type=submit]').click();

            expect(converse.connection.send).toHaveBeenCalled();
            var $stanza = $(converse.connection.send.argsForCall[0][0].tree());
            expect($stanza.children('query').children().length).toBe(3);
            expect($stanza.children('query').children()[0].tagName).toBe('username');
        }, converse));

        it("will set form_type to xform and submit it as xform", $.proxy(function () {
            var cbview = this.chatboxviews.get('controlbox');
            cbview.$('#controlbox-tabs').find('li').last().find('a').click(); // Click the Register tab
            var registerview = this.chatboxviews.get('controlbox').registerpanel;
            spyOn(registerview, 'onProviderChosen').andCallThrough();
            spyOn(registerview, 'getRegistrationFields').andCallThrough();
            spyOn(registerview, 'onRegistrationFields').andCallThrough();
            spyOn(registerview, 'renderRegistrationForm').andCallThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(this.connection, 'connect').andCallThrough();

            registerview.$('input[name=domain]').val('conversejs.org');
            registerview.$('input[type=submit]').click();

            var stanza = new Strophe.Builder("stream:features", {
                        'xmlns:stream': "http://etherx.jabber.org/streams",
                        'xmlns': "jabber:client"
                    })
                .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
                .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
            this.connection._connect_cb(test_utils.createRequest(stanza));
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
            this.connection._dataRecv(test_utils.createRequest(stanza));
            expect(registerview.form_type).toBe('xform');

            registerview.$('input[name=username]').val('testusername');
            registerview.$('input[name=password]').val('testpassword');
            registerview.$('input[name=email]').val('test@email.local');

            spyOn(converse.connection, 'send');

            registerview.$('input[type=submit]').click();

            expect(converse.connection.send).toHaveBeenCalled();
            var $stanza = $(converse.connection.send.argsForCall[0][0].tree());
            expect($stanza.children('query').children().length).toBe(1);
            expect($stanza.children('query').children().children().length).toBe(3);
            expect($stanza.children('query').children().children()[0].tagName).toBe('field');
        }, converse));

    }, converse, mock, test_utils));
}));
