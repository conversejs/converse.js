/*global mock, converse */

const { stx, Strophe, $iq, sizzle, u } = converse.env;


describe("The Registration Form", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    afterEach(() => {
        // Remove the hash
        history.pushState("", document.title, window.location.pathname + window.location.search);
    });

    it("is not available unless allow_registration=true",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              allow_registration: false },
            async function (_converse) {

        await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
        const cbview = _converse.api.controlbox.get();
        expect(cbview.querySelectorAll('a.register-account').length).toBe(0);
    }));

    it("can be opened by clicking on the registration tab",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              allow_registration: true },
            async function (_converse) {

        const toggle = await u.waitUntil(() => document.querySelector(".toggle-controlbox"));
        if (!u.isVisible(document.querySelector("#controlbox"))) {
            if (!u.isVisible(toggle)) {
                u.removeClass('hidden', toggle);
            }
            toggle.click();
        }
        const cbview = _converse.chatboxviews.get('controlbox');
        expect(cbview.querySelector('converse-registration-form')).toBe(null);

        const register_link = await u.waitUntil(() => cbview.querySelector('a.register-account'));
        expect(register_link.textContent).toBe("Create an account");
        register_link.click();

        expect(cbview.querySelector('converse-registration-form')).toBeDefined();
    }));

    it("allows the user to choose an XMPP provider's domain",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              discover_connection_methods: false,
              allow_registration: true },
            async function (_converse) {

        const { api } = _converse;

        const toggle = await u.waitUntil(() => document.querySelector(".toggle-controlbox"));
        toggle.click();

        const cbview = _converse.api.controlbox.get();
        await u.waitUntil(() => u.isVisible(cbview));

        cbview.querySelector('.toggle-register-login').click();

        const registerview = await u.waitUntil(() => cbview.querySelector('converse-registration-form'));
        spyOn(registerview, 'onProviderChosen').and.callThrough();
        spyOn(registerview, 'fetchRegistrationForm').and.callThrough();

        // Check the form layout
        const form = cbview.querySelector('#converse-register');
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
        expect(registerview.fetchRegistrationForm).toHaveBeenCalled();

        api.connection.destroy();
    }));

    it("allows the user to choose an XMPP provider's domain in fullscreen view mode",
        mock.initConverse(
            ['chatBoxesInitialized'], {
                auto_login: false,
                view_mode: 'fullscreen',
                discover_connection_methods: false,
                allow_registration: true
            },
            async function (_converse) {

        const cbview = _converse.api.controlbox.get();
        cbview.querySelector('.toggle-register-login').click();

        const registerview = await u.waitUntil(() => cbview.querySelector('converse-registration-form'));
        spyOn(registerview, 'fetchRegistrationForm').and.callThrough();
        spyOn(registerview, 'onProviderChosen').and.callThrough();
        spyOn(registerview, 'getRegistrationFields').and.callThrough();
        spyOn(registerview, 'renderRegistrationForm').and.callThrough();

        expect(registerview._registering).toBeFalsy();
        expect(_converse.api.connection.connected()).toBeFalsy();
        registerview.querySelector('input[name=domain]').value  = 'conversejs.org';
        registerview.querySelector('input[type=submit]').click();
        expect(registerview.onProviderChosen).toHaveBeenCalled();
        expect(registerview._registering).toBeTruthy();

        await u.waitUntil(() => registerview.fetchRegistrationForm.calls.count());

        let stanza = new Strophe.Builder("stream:features", {
                    'xmlns:stream': "http://etherx.jabber.org/streams",
                    'xmlns': "jabber:client"
                })
            .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
            .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
        _converse.api.connection.get()._connect_cb(mock.createRequest(stanza));

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
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        expect(registerview.renderRegistrationForm).toHaveBeenCalled();

        await u.waitUntil(() => registerview.querySelectorAll('input').length === 5);
        expect(registerview.querySelectorAll('input[type=submit]').length).toBe(1);
        expect(registerview.querySelectorAll('input[type=button]').length).toBe(1);
    }));

    it("will render a registration form as received from the XMPP provider",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              discover_connection_methods: false,
              allow_registration: true },
            async function (_converse) {

        await mock.toggleControlBox();
        const cbview = _converse.api.controlbox.get();
        const login_form = await u.waitUntil(() => cbview.querySelector('.toggle-register-login'));
        login_form.click();

        const registerview = await u.waitUntil(() => cbview.querySelector('converse-registration-form'));
        spyOn(registerview, 'fetchRegistrationForm').and.callThrough();
        spyOn(registerview, 'onProviderChosen').and.callThrough();
        spyOn(registerview, 'getRegistrationFields').and.callThrough();
        spyOn(registerview, 'onRegistrationFields').and.callThrough();
        spyOn(registerview, 'renderRegistrationForm').and.callThrough();

        expect(registerview._registering).toBeFalsy();
        expect(_converse.api.connection.connected()).toBeFalsy();
        registerview.querySelector('input[name=domain]').value  = 'conversejs.org';
        registerview.querySelector('input[type=submit]').click();
        expect(registerview.onProviderChosen).toHaveBeenCalled();
        expect(registerview._registering).toBeTruthy();
        await u.waitUntil(() => registerview.fetchRegistrationForm.calls.count());

        let stanza = new Strophe.Builder("stream:features", {
                    'xmlns:stream': "http://etherx.jabber.org/streams",
                    'xmlns': "jabber:client"
                })
            .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
            .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
        _converse.api.connection.get()._connect_cb(mock.createRequest(stanza));

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
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        expect(registerview.onRegistrationFields).toHaveBeenCalled();
        expect(registerview.renderRegistrationForm).toHaveBeenCalled();

        await u.waitUntil(() => registerview.querySelectorAll('input').length === 5);
        expect(registerview.querySelectorAll('input[type=submit]').length).toBe(1);
        expect(registerview.querySelectorAll('input[type=button]').length).toBe(1);
    }));

    it("will set form_type to legacy and submit it as legacy",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              discover_connection_methods: false,
              allow_registration: true },
            async function (_converse) {

        const toggle = document.querySelector(".toggle-controlbox");
        if (!u.isVisible(document.querySelector("#controlbox"))) {
            if (!u.isVisible(toggle)) {
                u.removeClass('hidden', toggle);
            }
            toggle.click();
        }
        const cbview = _converse.api.controlbox.get();
        const login_form = await u.waitUntil(() => cbview.querySelector('.toggle-register-login'));
        login_form.click();

        const registerview = await u.waitUntil(() => cbview.querySelector('converse-registration-form'));
        spyOn(registerview, 'onProviderChosen').and.callThrough();
        spyOn(registerview, 'getRegistrationFields').and.callThrough();
        spyOn(registerview, 'onRegistrationFields').and.callThrough();
        spyOn(registerview, 'renderRegistrationForm').and.callThrough();

        registerview.querySelector('input[name=domain]').value = 'conversejs.org';
        registerview.querySelector('input[type=submit]').click();

        let stanza = new Strophe.Builder("stream:features", {
                    'xmlns:stream': "http://etherx.jabber.org/streams",
                    'xmlns': "jabber:client"
                })
            .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
            .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
        _converse.api.connection.get()._connect_cb(mock.createRequest(stanza));
        stanza = $iq({
                'type': 'result',
                'id': 'reg1'
            }).c('query', {'xmlns': 'jabber:iq:register'})
                .c('instructions')
                    .t('Please choose a username, password and provide your email address').up()
                .c('username').up()
                .c('password').up()
                .c('email');
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        expect(registerview.form_type).toBe('legacy');

        const username_input = await u.waitUntil(() => registerview.querySelector('input[name=username]'));

        username_input.value = 'testusername';
        registerview.querySelector('input[name=password]').value = 'testpassword';
        registerview.querySelector('input[name=email]').value = 'test@email.local';

        spyOn(_converse.api.connection.get(), 'send');
        registerview.querySelector('input[type=submit]').click();

        expect(_converse.api.connection.get().send).toHaveBeenCalled();
        stanza = _converse.api.connection.get().send.calls.argsFor(0)[0].tree();
        expect(stanza.querySelector('query').childNodes.length).toBe(3);
        expect(stanza.querySelector('query').firstElementChild.tagName).toBe('username');

        _converse.api.connection.destroy();
    }));

    it("will set form_type to xform and submit it as xform",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              discover_connection_methods: false,
              allow_registration: true },
            async function (_converse) {

        const toggle = document.querySelector(".toggle-controlbox");
        if (!u.isVisible(document.querySelector("#controlbox"))) {
            if (!u.isVisible(toggle)) u.removeClass('hidden', toggle);
            toggle.click();
        }
        const cbview = _converse.api.controlbox.get();
        const login_form = await u.waitUntil(() => cbview.querySelector('.toggle-register-login'));
        login_form.click();

        const registerview = await u.waitUntil(() => cbview.querySelector('converse-registration-form'));
        spyOn(registerview, 'onProviderChosen').and.callThrough();
        spyOn(registerview, 'getRegistrationFields').and.callThrough();
        spyOn(registerview, 'onRegistrationFields').and.callThrough();
        spyOn(registerview, 'renderRegistrationForm').and.callThrough();

        registerview.querySelector('input[name=domain]').value = 'conversejs.org';
        registerview.querySelector('input[type=submit]').click();

        let stanza = new Strophe.Builder("stream:features", {
                    'xmlns:stream': "http://etherx.jabber.org/streams",
                    'xmlns': "jabber:client"
                })
            .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
            .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
        _converse.api.connection.get()._connect_cb(mock.createRequest(stanza));

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
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        expect(registerview.form_type).toBe('xform');

        const username_input = await u.waitUntil(() => registerview.querySelector('input[name=username]'));

        username_input.value = 'testusername';
        registerview.querySelector('input[name=password]').value = 'testpassword';
        registerview.querySelector('input[name=email]').value = 'test@email.local';

        spyOn(_converse.api.connection.get(), 'send');

        registerview.querySelector('input[type=submit]').click();

        expect(_converse.api.connection.get().send).toHaveBeenCalled();
        stanza = _converse.api.connection.get().send.calls.argsFor(0)[0].tree();
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

        _converse.api.connection.destroy();
    }));

    it("renders the account registration form",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              discover_connection_methods: false,
              allow_registration: true },
            async function (_converse) {

        const toggle = document.querySelector(".toggle-controlbox");
        if (!u.isVisible(document.querySelector("#controlbox"))) {
            if (!u.isVisible(toggle)) {
                u.removeClass('hidden', toggle);
            }
            toggle.click();
        }
        const cbview = _converse.chatboxviews.get('controlbox');
        const login_form = await u.waitUntil(() => cbview.querySelector('.toggle-register-login'));
        login_form.click();

        const registerview = await u.waitUntil(() => cbview.querySelector('converse-registration-form'));
        registerview.querySelector('input[name=domain]').value = 'conversejs.org';
        registerview.querySelector('input[type=submit]').click();

        let stanza = new Strophe.Builder("stream:features", {
                    'xmlns:stream': "http://etherx.jabber.org/streams",
                    'xmlns': "jabber:client"
                })
            .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
            .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
        _converse.api.connection.get()._connect_cb(mock.createRequest(stanza));

        stanza = stx`
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
            </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        await u.waitUntil(() => registerview.querySelectorAll('#converse-register input[required]').length === 3);
        expect(registerview.form_type).toBe('xform');

        // Hide the controlbox so that we can see whether the test passed or failed
        u.addClass('hidden', _converse.chatboxviews.get('controlbox'));
        _converse.api.connection.destroy();
    }));

    it("lets you choose a different provider",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              view_mode: 'fullscreen',
              discover_connection_methods: false,
              allow_registration: true },
            async function (_converse) {

        const toggle = document.querySelector(".toggle-controlbox");
        if (!u.isVisible(document.querySelector("#controlbox"))) {
            if (!u.isVisible(toggle)) {
                u.removeClass('hidden', toggle);
            }
            toggle.click();
        }
        const cbview = _converse.chatboxviews.get('controlbox');
        cbview.querySelector('.toggle-register-login').click();
        const registerview = await u.waitUntil(() => cbview.querySelector('converse-registration-form'));

        registerview.querySelector('input[name=domain]').value = 'conversejs.org';
        registerview.querySelector('input[type=submit]').click();

        let stanza = new Strophe.Builder("stream:features", {
                    'xmlns:stream': "http://etherx.jabber.org/streams",
                    'xmlns': "jabber:client"
                })
            .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
            .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
        _converse.api.connection.get()._connect_cb(mock.createRequest(stanza));

        stanza = stx`
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
                    </x>
                </query>
            </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        await u.waitUntil(() => registerview.querySelectorAll('#converse-register input[required]').length === 2);
        expect(registerview.form_type).toBe('xform');

        const button = await u.waitUntil(() => registerview.querySelector('.btn-secondary'));
        expect(button.value).toBe("Choose a different provider");
        button.click();

        await u.waitUntil(() => registerview.querySelector('input[name="domain"]'));
        expect(registerview.querySelectorAll('input[required]').length).toBe(1);

        // Hide the controlbox so that we can see whether the test passed or failed
        u.addClass('hidden', _converse.chatboxviews.get('controlbox'));
        _converse.api.connection.destroy();
    }));

    it("renders errors",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              view_mode: 'fullscreen',
              discover_connection_methods: false,
              allow_registration: true },
            async function (_converse) {

        const toggle = document.querySelector(".toggle-controlbox");
        if (!u.isVisible(document.querySelector("#controlbox"))) {
            if (!u.isVisible(toggle)) {
                u.removeClass('hidden', toggle);
            }
            toggle.click();
        }
        const cbview = _converse.chatboxviews.get('controlbox');
        cbview.querySelector('.toggle-register-login').click();
        const view = await u.waitUntil(() => cbview.querySelector('converse-registration-form'));

        view.querySelector('input[name=domain]').value = 'conversejs.org';
        view.querySelector('input[type=submit]').click();

        let stanza = new Strophe.Builder("stream:features", {
                    'xmlns:stream': "http://etherx.jabber.org/streams",
                    'xmlns': "jabber:client"
                })
            .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
            .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
        _converse.api.connection.get()._connect_cb(mock.createRequest(stanza));

        stanza = stx`
            <iq xmlns="jabber:client" type="result" from="conversejs.org" id="ad1e0d50-5adb-4397-a997-5feab56fe418:sendIQ" xml:lang="en">
                <query xmlns="jabber:iq:register">
                    <x xmlns="jabber:x:data" type="form">
                        <instructions>Choose a username and password to register with this server</instructions>
                        <field var="FORM_TYPE" type="hidden"><value>urn:xmpp:captcha</value></field>
                        <field var="username" type="text-single" label="User"><required/></field>
                        <field var="password" type="text-private" label="Password"><required/></field>
                        <field var="from" type="hidden"><value>conversejs.org</value></field>
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
            </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        spyOn(view, 'submitRegistrationForm').and.callThrough();

        const username_input = await u.waitUntil(() => view.querySelector('[name="username"]'));
        username_input.value = 'romeo';
        const password_input = view.querySelector('[name="password"]');
        password_input.value = 'secret';
        const ocr_input = view.querySelector('[name="ocr"]');
        ocr_input.value = '8m9D88';
        view.querySelector('[type="submit"]').click();
        expect(view.submitRegistrationForm).toHaveBeenCalled();

        const response_IQ = stx`
            <iq xml:lang='en' from='conversejs.org' type='error' id='d9917b7a-588f-4ef6-8a56-0d6d3ad538ae:sendIQ' xmlns="jabber:client">
                <query xmlns='jabber:iq:register'/>
                <error code='500' type='wait'>
                    <resource-constraint xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                    <text xml:lang='en' xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'>Too many CAPTCHA requests</text>
                </error>
            </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(response_IQ));

        const alert = await u.waitUntil(() => view.querySelector('.alert'));
        expect(alert.textContent.trim()).toBe('Registration failed.\nToo many CAPTCHA requests');
        // Hide the controlbox so that we can see whether the test passed or failed
        u.addClass('hidden', _converse.chatboxviews.get('controlbox'));
        _converse.api.connection.destroy();
    }));

    it("properly escapes an ampersand from an input field",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              view_mode: 'fullscreen',
              discover_connection_methods: false,
              allow_registration: true },
            async function (_converse) {

        await mock.toggleControlBox();
        const cbview = _converse.api.controlbox.get();
        const login_form = await u.waitUntil(() => cbview.querySelector('.toggle-register-login'));
        login_form.click();

        const registerview = await u.waitUntil(() => cbview.querySelector('converse-registration-form'));
        spyOn(registerview, 'fetchRegistrationForm').and.callThrough();

        expect(registerview._registering).toBeFalsy();
        expect(_converse.api.connection.connected()).toBeFalsy();
        registerview.querySelector('input[name=domain]').value  = 'conversejs.org';
        registerview.querySelector('input[type=submit]').click();
        expect(registerview._registering).toBeTruthy();
        await u.waitUntil(() => registerview.fetchRegistrationForm.calls.count());

        let stanza = new Strophe.Builder("stream:features", {
                    'xmlns:stream': "http://etherx.jabber.org/streams",
                    'xmlns': "jabber:client"
                })
            .c('register',  {xmlns: "http://jabber.org/features/iq-register"}).up()
            .c('mechanisms', {xmlns: "urn:ietf:params:xml:ns:xmpp-sasl"});
        _converse.api.connection.get()._connect_cb(mock.createRequest(stanza));

        stanza = $iq({
                'type': 'result',
                'id': 'reg1'
            }).c('query', {'xmlns': 'jabber:iq:register'})
                .c('instructions')
                    .t('Using xform data').up()
                .c('x', { 'xmlns': 'jabber:x:data', 'type': 'form' })
                    .c('instructions').t('Please enter a username and password').up()
                    .c('field', {'type': 'text-single', 'var': 'username'}).c('required').up().up()
                    .c('field', {'type': 'text-private', 'var': 'password'}).c('required');
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => registerview.querySelectorAll('input').length === 4);

        const username = registerview.querySelector('input[name="username"]');
        const password = registerview.querySelector('input[name="password"]');

        username.value = 'me';
        password.value = '123&456';

        const form = registerview.querySelector('#converse-register');
        const submit_button = form.querySelector('input[type=submit]');

        const sent_stanzas = _converse.api.connection.get().sent_stanzas;
        while (sent_stanzas.length) { sent_stanzas.pop(); }

        submit_button.click();

        const iq = await u.waitUntil(() => sent_stanzas.filter(iq => sizzle('x[type="submit"]', iq).length).pop());
        expect(iq).toEqualStanza(stx`
            <iq type="set" id="${iq.getAttribute('id')}" xmlns="jabber:client">
                <query xmlns="jabber:iq:register">
                    <x xmlns="jabber:x:data" type="submit">
                        <field var="username"><value>me</value></field>
                        <field var="password"><value>123&amp;456</value></field>
                    </x>
                </query>
            </iq>`
        );
    }));
});
