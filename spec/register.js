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

    describe("The Registration Panel", $.proxy(function (mock, test_utils) {
        beforeEach(function () {
            test_utils.openControlBox();
        });

        afterEach(function () {
            test_utils.closeControlBox();
        });

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
            // TODO
        }, converse));

    }, converse, mock, test_utils));
}));
