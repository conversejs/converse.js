import { initConverse } from "../../../tests/mock.js";

describe("The \"settings\" API", function () {
    it("has methods 'get' and 'set' to set configuration settings",
            initConverse(null, { loglevel: 'debug' }, (_converse) => {

        const { api } = _converse;

        expect(Object.keys(api.settings)).toEqual(["extend", "get", "set", "listen"]);
        expect(api.settings.get("loglevel")).toBe('debug');
        api.settings.set("loglevel", 'warn');
        expect(api.settings.get("loglevel")).toBe('warn');
        api.settings.set({"loglevel": 'error'});
        expect(api.settings.get("loglevel")).toBe('error');

        // Only whitelisted settings allowed.
        expect(typeof api.settings.get("non_existing")).toBe("undefined");
        api.settings.set("non_existing", true);
        expect(typeof api.settings.get("non_existing")).toBe("undefined");
    }));

    it("extended via settings.extend don't override settings passed in via converse.initialize",
            initConverse([], {'emoji_categories': {"travel": ":rocket:"}}, (_converse) => {

        expect(_converse.api.settings.get('emoji_categories')?.travel).toBe(':rocket:');

        // Test that the extend command doesn't override user-provided site
        // settings (i.e. settings passed in via converse.initialize).
        _converse.api.settings.extend({'emoji_categories': {"travel": ":motorcycle:", "food": ":burger:"}});

        expect(_converse.api.settings.get('emoji_categories')?.travel).toBe(':rocket:');
        expect(_converse.api.settings.get('emoji_categories')?.food).toBe(undefined);
    }));

    it("only overrides the passed in properties",
            initConverse([],
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
                initConverse([], {}, function (_converse) {

            const { api } = _converse;
            let changed;
            const callback = (o) => {
                changed = o;
            }
            api.settings.listen.on('change', callback);

            expect(api.settings.get('allow_non_roster_messaging')).toBe(true);

            api.settings.set('allow_non_roster_messaging', false);
            expect(changed).toEqual({ allow_non_roster_messaging: false });

            api.settings.set('allow_non_roster_messaging', true);
            expect(changed).toEqual({ allow_non_roster_messaging: true });

            api.settings.listen.not('change', callback);

            api.settings.set('allow_non_roster_messaging', false );
            expect(changed).toEqual({ allow_non_roster_messaging: true });

            api.settings.listen.on('change:clear_cache_on_logout', callback);

            expect(api.settings.get('clear_cache_on_logout')).toBe(false);
            api.settings.set('clear_cache_on_logout', true);
            expect(changed).toEqual(true);

            api.settings.set('clear_cache_on_logout', false);
            expect(changed).toEqual(false);
        }));
    });
});
