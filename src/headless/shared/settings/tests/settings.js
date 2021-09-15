/*global mock */


describe("The \"settings\" API", function () {
    it("has methods 'get' and 'set' to set configuration settings",
            mock.initConverse(null, {'play_sounds': true}, (_converse) => {

        const { api } = _converse;

        expect(Object.keys(api.settings)).toEqual(["extend", "update", "get", "set", "listen"]);
        expect(api.settings.get("play_sounds")).toBe(true);
        api.settings.set("play_sounds", false);
        expect(api.settings.get("play_sounds")).toBe(false);
        api.settings.set({"play_sounds": true});
        expect(api.settings.get("play_sounds")).toBe(true);
        // Only whitelisted settings allowed.
        expect(typeof api.settings.get("non_existing")).toBe("undefined");
        api.settings.set("non_existing", true);
        expect(typeof api.settings.get("non_existing")).toBe("undefined");
    }));

    it("extended via settings.extend don't override settings passed in via converse.initialize",
            mock.initConverse([], {'emoji_categories': {"travel": ":rocket:"}}, (_converse) => {

        expect(_converse.api.settings.get('emoji_categories')?.travel).toBe(':rocket:');

        // Test that the extend command doesn't override user-provided site
        // settings (i.e. settings passed in via converse.initialize).
        _converse.api.settings.extend({'emoji_categories': {"travel": ":motorcycle:", "food": ":burger:"}});

        expect(_converse.api.settings.get('emoji_categories')?.travel).toBe(':rocket:');
        expect(_converse.api.settings.get('emoji_categories')?.food).toBe(undefined);
    }));

    it("only overrides the passed in properties",
            mock.initConverse([],
            {
                'root': document.createElement('div').attachShadow({ 'mode': 'open' }),
                'emoji_categories': { 'travel': ':rocket:' },
            },
            (_converse) => {
                expect(_converse.api.settings.get('emoji_categories')?.travel).toBe(':rocket:');

                // Test that the extend command doesn't override user-provided site
                // settings (i.e. settings passed in via converse.initialize).
                _converse.api.settings.extend({
                    'emoji_categories': { 'travel': ':motorcycle:', 'food': ':burger:' },
                });

                expect(_converse.api.settings.get('emoji_categories').travel).toBe(':rocket:');
                expect(_converse.api.settings.get('emoji_categories').food).toBe(undefined);
            }
        )
    );
});


describe("Configuration settings", function () {

    describe("when set", function () {

        it("will trigger a change event for which listeners can be registered",
                mock.initConverse([], {}, function (_converse) {

            const { api } = _converse;
            let changed;
            const callback = (o) => {
                changed = o;
            }
            api.settings.listen.on('change', callback);
            api.settings.set('allowed_image_domains', ['conversejs.org']);
            expect(changed).toEqual({'allowed_image_domains': ['conversejs.org']});

            api.settings.set('allowed_image_domains', ['conversejs.org', 'opkode.com']);
            expect(changed).toEqual({'allowed_image_domains': ['conversejs.org', 'opkode.com']});

            api.settings.listen.not('change', callback);

            api.settings.set('allowed_image_domains', ['conversejs.org', 'opkode.com', 'inverse.chat']);
            expect(changed).toEqual({'allowed_image_domains': ['conversejs.org', 'opkode.com']});

            api.settings.listen.on('change:allowed_image_domains', callback);

            api.settings.set('allowed_video_domains', ['inverse.chat']);
            expect(changed).toEqual({'allowed_image_domains': ['conversejs.org', 'opkode.com']});

            api.settings.set('allowed_image_domains', ['inverse.chat']);
            expect(changed).toEqual(['inverse.chat']);
        }));
    });
});
