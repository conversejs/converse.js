(function (root, factory) {
    define(["jasmine"], factory);
} (this, function (jasmine) {
    var utils = converse.env.utils,
        _ = converse.env._;

    return describe("Converse.js Utilities", function() {

        it("applyUserSettings: recursively applies user settings", function () {
            var context = {};
            var settings = {
                show_toolbar: true,
                chatview_avatar_width: 32,
                chatview_avatar_height: 32,
                auto_join_rooms: [],
                visible_toolbar_buttons: {
                    'emojis': true,
                    'call': false,
                    'clear': true,
                    'toggle_occupants': true
                }
            };
            _.extend(context, settings);

            var user_settings = {
                something_else: 'xxx',
                show_toolbar: false,
                chatview_avatar_width: 32,
                chatview_avatar_height: 48,
                auto_join_rooms: [
                    'anonymous@conference.nomnom.im',
                ],
                visible_toolbar_buttons: {
                    'emojis': false,
                    'call': false,
                    'toggle_occupants':false,
                    'invalid': false 
                }
            };
            utils.applyUserSettings(context, settings, user_settings);

            expect(context.something_else).toBeUndefined();
            expect(context.show_toolbar).toBeFalsy();
            expect(context.chatview_avatar_width).toBe(32);
            expect(context.chatview_avatar_height).toBe(48);
            expect(_.keys(context.visible_toolbar_buttons)).toEqual(_.keys(settings.visible_toolbar_buttons));
            expect(context.visible_toolbar_buttons.emojis).toBeFalsy();
            expect(context.visible_toolbar_buttons.call).toBeFalsy();
            expect(context.visible_toolbar_buttons.toggle_occupants).toBeFalsy();
            expect(context.visible_toolbar_buttons.invalid).toBeFalsy();
            expect(context.auto_join_rooms.length).toBe(1);
            expect(context.auto_join_rooms[0]).toBe('anonymous@conference.nomnom.im');

            user_settings = {
                visible_toolbar_buttons: {
                    'toggle_occupants': true
                }
            };
            utils.applyUserSettings(context, settings, user_settings);
            expect(_.keys(context.visible_toolbar_buttons)).toEqual(_.keys(settings.visible_toolbar_buttons));
            expect(context.visible_toolbar_buttons.toggle_occupants).toBeTruthy();
        });
    });
}));
