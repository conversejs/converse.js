import { initConverse } from "../../../tests/mock.js";
import converse from "../../../dist/converse-headless.js";

describe("The \"settings\" API", function () {
    it("has methods 'get' and 'set' to set configuration settings",
            initConverse(converse, null, { loglevel: 'debug' }, (_converse) => {

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
            initConverse(converse, [], {'emoji_categories': {"travel": ":rocket:"}}, (_converse) => {

        expect(_converse.api.settings.get('emoji_categories')?.travel).toBe(':rocket:');

        // Test that the extend command doesn't override user-provided site
        // settings (i.e. settings passed in via converse.initialize).
        _converse.api.settings.extend({'emoji_categories': {"travel": ":motorcycle:", "food": ":burger:"}});

        expect(_converse.api.settings.get('emoji_categories')?.travel).toBe(':rocket:');
        expect(_converse.api.settings.get('emoji_categories')?.food).toBe(undefined);
    }));

    it("only overrides the passed in properties",
            initConverse(converse, [],
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

    it("deep-merges a partial site override onto the default when the key opts in",
            initConverse(converse, [], { 'deep_buttons': { 'call': false } }, (_converse) => {

        const { api } = _converse;
        // Register a new object setting, opting it into deep-merge. The site value
        // passed via converse.initialize only specifies `call`.
        api.settings.extend(
            { 'deep_buttons': { 'call': true, 'emoji': true, 'fileupload': true } },
            { deep_merge: ['deep_buttons'] }
        );

        const buttons = api.settings.get('deep_buttons');
        expect(buttons.call).toBe(false);      // the site override wins
        expect(buttons.emoji).toBe(true);      // default preserved, not dropped
        expect(buttons.fileupload).toBe(true); // default preserved, not dropped
    }));

    it("still replaces an object setting wholesale when the key did not opt in",
            initConverse(converse, [], { 'replace_buttons': { 'call': false } }, (_converse) => {

        const { api } = _converse;
        api.settings.extend({ 'replace_buttons': { 'call': true, 'emoji': true } });

        const buttons = api.settings.get('replace_buttons');
        expect(buttons.call).toBe(false);     // the site override wins
        expect(buttons.emoji).toBe(undefined); // default dropped (replace semantics)
    }));

    it("patches the current value on set() for a deep-merge key instead of clobbering it",
            initConverse(converse, [], {}, (_converse) => {

        const { api } = _converse;
        api.settings.extend(
            { 'patch_buttons': { 'call': true, 'emoji': true } },
            { deep_merge: ['patch_buttons'] }
        );

        api.settings.set('patch_buttons', { 'call': false });
        expect(api.settings.get('patch_buttons')).toEqual({ 'call': false, 'emoji': true });
    }));
});


describe("Configuration settings", function () {

    describe("when set", function () {

        it("will trigger a change event for which listeners can be registered",
                initConverse(converse, [], {}, function (_converse) {

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

    describe("the assets_path setting", function () {

        it("has its trailing slash stripped when passed in via converse.initialize",
                initConverse(converse, [], { assets_path: '/dist/' }, function (_converse) {
            expect(_converse.api.settings.get('assets_path')).toBe('/dist');
        }));

        it("has its trailing slash stripped when updated at runtime",
                initConverse(converse, [], {}, function (_converse) {
            const { api } = _converse;

            api.settings.set('assets_path', '/cdn/assets/');
            expect(api.settings.get('assets_path')).toBe('/cdn/assets');

            // Multiple trailing slashes are collapsed, the rest is left intact.
            api.settings.set({ assets_path: '/cdn/assets//' });
            expect(api.settings.get('assets_path')).toBe('/cdn/assets');

            // A path without a trailing slash is left untouched.
            api.settings.set('assets_path', '/dist');
            expect(api.settings.get('assets_path')).toBe('/dist');
        }));
    });
});
