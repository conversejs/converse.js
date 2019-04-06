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

        it("renders the account registration form",
            mock.initConverse(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  view_mode: 'fullscreen',
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

            stanza = u.toStanza(`
                <iq xmlns="jabber:client" type="result" from="conversations.im" id="ad1e0d50-5adb-4397-a997-5feab56fe418:sendIQ" xml:lang="en">
                    <query xmlns="jabber:iq:register">
                        <x xmlns="jabber:x:data" type="form">
                            <instructions>Choose a username and password to register with this server</instructions>
                            <field var="FORM_TYPE" type="hidden"><value>urn:xmpp:captcha</value></field>
                            <field var="username" type="text-single" label="User"><required/></field>
                            <field var="password" type="text-private" label="Password"><required/></field>
                            <field var="from" type="hidden"><value>conversations.im</value></field>
                            <field var="challenge" type="hidden"><value>15376320046808160053</value></field>
                            <field var="sid" type="hidden"><value>ad1e0d50-5adb-4397-a997-5feab56fe418:sendIQ</value></field>
                            <field var="ocr" type="text-single" label="Enter the text you see">
                                <media xmlns="urn:xmpp:media-element">
                                    <uri type="image/png">cid:sha1+2df8c1b366f1e90ce60354f97d1fe75237290b8a@bob.xmpp.org</uri>
                                </media>
                                <required/>
                            </field>
                        </x>
                        <data xmlns="urn:xmpp:bob" cid="sha1+2df8c1b366f1e90ce60354f97d1fe75237290b8a@bob.xmpp.org"
                              type="image/png"
                              max-age="0">iVBORw0KGgoAAAANSUhEUgAAALQAAAA8BAMAAAA9AI20AAAAMFBMVEX///8AAADf39+fn59fX19/f3+/v78fHx8/Pz9PT08bGxsvLy9jY2NTU1MXFxcnJyc84bkWAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAERUlEQVRYhe1WTXMaRxDdDxY4JWpYvDinpVyxdATLin0MiRLlCHEi+7hYUcVHTSI7urhK6yr5//gn5N/4Z7inX89+CQkTcFUO6gOwS8/r7tdvesbzvoT5ROR5JJ9bB97xAK22XWAY1WznlnUr7QaAzSOsWufXQ6wH/FmO60b4D936LJr8TWRwW4SNgOsodZr8m4vZUoRt2xZ3xHXgna1FCE5+f5aWwPU//bXgg8eHjyqPp4aXJeOlwLUIt0O39zOvPWW3WfHmCCkli816FxlK0rnFGKZ484dN+eIXsw1R+G+JfjwgOpMnm+r5SxA63gS2Q8MchO1RLN8jSn4W4F5OPed2evhTthKLG3bsfjLL874XGBpWHLrU0953i/ev7JsfViHbhsWSQTunJDOppeAe0hVGokJUHBOphmjrbBlgabviJKXbIP0B//gKSBHZh2rvJnQp3wsapMFz+VsTPNhPr0Hn9N57YOjywaxFSU6S79fUF39KBDgnt6yjZOeSffk+4IXDZovbQl9E96m34EzQKMepQcbzijAGiBmDsO+LaqzqG3m3kEf+DQ2mY+vdk5c2n2Iaj5QGi6n59FHDmcuP4t8MGlRaF39P6ENyIaB2EXdpjLnQq9IgdVxfax3ilBc10u4gowX9K6BaKiZNmCC7CF/WpkJvWxN00OjuoqGYLqAnpILLE68Ymrt9M0S9hcznUJ8RykdlLalUfFaDjvA8pT2kxmsl5fuMaM6mSWUpUhDoudSucdhiZFDwphEHwsMwhEpH0jsm+/UBK2wCzFIiitalN7YjWkyIBgTNPgpDXX4rjk4UH+yPPgfK4HNZQCP/KZ0fGnrnKl8+pXl3X7FwZuwNUdwDGO+BjPUn6XaKtbkm+MJ6vtaXSnIz6wBT/m+VvZNIhz7ayabQLSeRQDmYkjt0KlmHDa555v9DzFxx+CCvCG4K3dbx6mTYtfPs1Dgdh0i3W+cl4lnnhblMKKBBA23X1Ezc3E5ZoPS5KHjPiU1rKTviYe1fTsa6e3UwXGWI4ykB8uiGqkmA6Cbf3K4JTH3LOBlbX+yPWll57LKVeH8CTEvyVPV2TXL8kPnPqtA51CaFYxOH2rJoZunSnvsSj48WiaDccl6KEgiMSarITsa+rWWBnqFloYlT1qWW2GKw9nPSbEvoVHFst967XgNQjxdA66Q6VFEUh488xfaSo7cHB52XYzA4eRlVteeT8ostWfuPea0oF6MwzlwgZE9gQI+uUV0gzK+WlpUrNI8juhhX/OyNwZnRrsDfxOqS1aDR+gC6NUPvJpvQeVZ9eiNr9aDUuddY3bLnA4tH4r/49UboznH1ia8PV/uP3WUB3dxtzj1uxfDZgbEbZx17Itwrf0Jyc8N4en+5dhivtKeYjGJ8yXgUzKvSU/uWJZmsuAYtseDku+K3zMHi4lC1h0suPmtZaEp2tm3hEV2lXwb6zu7szv6f9glF5rPGT5xR7AAAAABJRU5ErkJggg==</data>
                        <instructions>You need a client that supports x:data and CAPTCHA to register</instructions>
                    </query>
                </iq>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(registerview.form_type).toBe('xform');
            expect(registerview.el.querySelectorAll('#converse-register input[required="required"]').length).toBe(3);
            // Hide the controlbox so that we can see whether the test
            // passed or failed
            u.addClass('hidden', _converse.chatboxviews.get('controlbox').el);
            done();
        }));
    });
}));
