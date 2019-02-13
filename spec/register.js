(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    const Strophe = converse.env.Strophe;
    const $iq = converse.env.$iq;
    const { _, sizzle}  = converse.env;
    const u = converse.env.utils;

    describe("The Registration Panel", function () {

        it("is not available unless allow_registration=true",
            mock.initConverse(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  allow_registration: false },
                async function (done, _converse) {

            await test_utils.waitUntil(() => _converse.chatboxviews.get('controlbox'));
            test_utils.openControlBox();
            const cbview = _converse.chatboxviews.get('controlbox');
            expect(cbview.el.querySelectorAll('a.register-account').length).toBe(0);
            done();
        }));

        it("can be opened by clicking on the registration tab",
            mock.initConverse(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  allow_registration: true },
                async function (done, _converse) {

            await test_utils.waitUntil(() => _.get(_converse.chatboxviews.get('controlbox'), 'registerpanel'), 300);
            const cbview = _converse.chatboxviews.get('controlbox');
            test_utils.openControlBox();
            const panels = cbview.el.querySelector('.controlbox-panes');
            const login = panels.firstElementChild;
            const registration = panels.childNodes[1];
            const register_link = cbview.el.querySelector('a.register-account');
            expect(register_link.textContent).toBe("Create an account");
            register_link.click();
            await test_utils.waitUntil(() => u.isVisible(registration));
            expect(u.isVisible(login)).toBe(false);
            done();
        }));

        it("allows the user to choose an XMPP provider's domain",
            mock.initConverse(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  allow_registration: true },
                async function (done, _converse) {

            await test_utils.waitUntil(() => _.get(_converse.chatboxviews.get('controlbox'), 'registerpanel'));
            test_utils.openControlBox();
            const cbview = _converse.chatboxviews.get('controlbox');
            const registerview = cbview.registerpanel;
            spyOn(registerview, 'onProviderChosen').and.callThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(_converse.connection, 'connect');

            // Open the register panel
            cbview.el.querySelector('.toggle-register-login').click();

            // Check the form layout
            const form = cbview.el.querySelector('#converse-register');
            expect(form.querySelectorAll('input').length).toEqual(2);
            expect(form.querySelectorAll('input')[0].getAttribute('name')).toEqual('domain');
            expect(sizzle('input:last', form).pop().getAttribute('type')).toEqual('submit');
            // Check that the input[type=domain] input is required
            const submit_button = form.querySelector('input[type=submit]');
            submit_button.click();
            expect(registerview.onProviderChosen).not.toHaveBeenCalled();

            // Check that the form is accepted if input[type=domain] has a value
            form.querySelector('input[name=domain]').value = 'conversejs.org';
            submit_button.click();
            expect(registerview.onProviderChosen).toHaveBeenCalled();
            expect(_converse.connection.connect).toHaveBeenCalled();
            done();
        }));

        it("will render a registration form as received from the XMPP provider",
            mock.initConverse(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  allow_registration: true },
                async function (done, _converse) {

            await test_utils.waitUntil(() => _.get(_converse.chatboxviews.get('controlbox'), 'registerpanel'));
            test_utils.openControlBox();
            const cbview = _converse.chatboxviews.get('controlbox');
            cbview.el.querySelector('.toggle-register-login').click();

            const registerview = _converse.chatboxviews.get('controlbox').registerpanel;
            spyOn(registerview, 'onProviderChosen').and.callThrough();
            spyOn(registerview, 'getRegistrationFields').and.callThrough();
            spyOn(registerview, 'onRegistrationFields').and.callThrough();
            spyOn(registerview, 'renderRegistrationForm').and.callThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(_converse.connection, 'connect').and.callThrough();

            expect(registerview._registering).toBeFalsy();
            expect(_converse.connection.connected).toBeFalsy();
            registerview.el.querySelector('input[name=domain]').value  = 'conversejs.org';
            registerview.el.querySelector('input[type=submit]').click();
            expect(registerview.onProviderChosen).toHaveBeenCalled();
            expect(registerview._registering).toBeTruthy();
            expect(_converse.connection.connect).toHaveBeenCalled();

            let stanza = new Strophe.Builder("stream:features", {
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
            expect(registerview.el.querySelectorAll('input').length).toBe(5);
            expect(registerview.el.querySelectorAll('input[type=submit]').length).toBe(1);
            expect(registerview.el.querySelectorAll('input[type=button]').length).toBe(1);
            done();
        }));

        it("will set form_type to legacy and submit it as legacy",
            mock.initConverse(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  allow_registration: true },
                async function (done, _converse) {

            await test_utils.waitUntil(() => _.get(_converse.chatboxviews.get('controlbox'), 'registerpanel'));
            test_utils.openControlBox();
            const cbview = _converse.chatboxviews.get('controlbox');
            cbview.el.querySelector('.toggle-register-login').click();

            const registerview = cbview.registerpanel;
            spyOn(registerview, 'onProviderChosen').and.callThrough();
            spyOn(registerview, 'getRegistrationFields').and.callThrough();
            spyOn(registerview, 'onRegistrationFields').and.callThrough();
            spyOn(registerview, 'renderRegistrationForm').and.callThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(_converse.connection, 'connect').and.callThrough();

            registerview.el.querySelector('input[name=domain]').value = 'conversejs.org';
            registerview.el.querySelector('input[type=submit]').click();

            let stanza = new Strophe.Builder("stream:features", {
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

            registerview.el.querySelector('input[name=username]').value = 'testusername';
            registerview.el.querySelector('input[name=password]').value = 'testpassword';
            registerview.el.querySelector('input[name=email]').value = 'test@email.local';

            spyOn(_converse.connection, 'send');

            registerview.el.querySelector('input[type=submit]').click();

            expect(_converse.connection.send).toHaveBeenCalled();
            stanza = _converse.connection.send.calls.argsFor(0)[0].tree();
            expect(stanza.querySelector('query').childNodes.length).toBe(3);
            expect(stanza.querySelector('query').firstElementChild.tagName).toBe('username');
            done();
        }));

        it("will set form_type to xform and submit it as xform",
            mock.initConverse(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  allow_registration: true },
                async function (done, _converse) {

            await test_utils.waitUntil(() => _.get(_converse.chatboxviews.get('controlbox'), 'registerpanel'));
            test_utils.openControlBox();
            const cbview = _converse.chatboxviews.get('controlbox');
            cbview.el.querySelector('.toggle-register-login').click();
            const registerview = _converse.chatboxviews.get('controlbox').registerpanel;
            spyOn(registerview, 'onProviderChosen').and.callThrough();
            spyOn(registerview, 'getRegistrationFields').and.callThrough();
            spyOn(registerview, 'onRegistrationFields').and.callThrough();
            spyOn(registerview, 'renderRegistrationForm').and.callThrough();
            registerview.delegateEvents();  // We need to rebind all events otherwise our spy won't be called
            spyOn(_converse.connection, 'connect').and.callThrough();

            registerview.el.querySelector('input[name=domain]').value = 'conversejs.org';
            registerview.el.querySelector('input[type=submit]').click();

            let stanza = new Strophe.Builder("stream:features", {
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

            registerview.el.querySelector('input[name=username]').value = 'testusername';
            registerview.el.querySelector('input[name=password]').value = 'testpassword';
            registerview.el.querySelector('input[name=email]').value = 'test@email.local';

            spyOn(_converse.connection, 'send');

            registerview.el.querySelector('input[type=submit]').click();

            expect(_converse.connection.send).toHaveBeenCalled();
            stanza = _converse.connection.send.calls.argsFor(0)[0].tree();
            expect(Strophe.serialize(stanza).toLocaleString().trim().replace(/(\n|\s{2,})/g, '')).toEqual(
                '<iq id="'+stanza.getAttribute('id')+'" type="set" xmlns="jabber:client">'+
                    '<query xmlns="jabber:iq:register">'+
                        '<x type="submit" xmlns="jabber:x:data">'+
                            '<field var="username">'+
                                '<value>testusername</value>'+
                            '</field>'+
                            '<field var="password">'+
                                '<value>testpassword</value>'+
                            '</field>'+
                            '<field var="email">'+
                                '<value>test@email.local</value>'+
                            '</field>'+
                        '</x>'+
                    '</query>'+
                '</iq>'
            );
            done();
        }));
    });
}));
