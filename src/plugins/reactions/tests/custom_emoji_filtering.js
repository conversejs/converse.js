/* global converse */
const { u } = converse.env;

describe("Reaction Picker Custom Emoji Filtering", function () {
    let _converse;

    beforeAll(async function () {
        await converse.plugins.get('converse-emoji');
        /*
         * We mock the emojies API setup for this test.
         * We inject a custom emoji and standard emojis.
         */
        const json = {
            "custom": {
                ":custom_emoji:": { "sn": ":custom_emoji:", "url": "http://example.com/image.png", "c": "custom" }
            },
            "smileys": {
                ":smile:": { "sn": ":smile:", "cp": "1f604", "c": "smileys" }
            }
        };
        converse.emojis.json = json;
        converse.emojis.by_sn = Object.keys(json).reduce((result, cat) => Object.assign(result, json[cat]), {});
        converse.emojis.list = Object.values(converse.emojis.by_sn);
        converse.emojis.shortnames = converse.emojis.list.map((m) => m.sn);
    });

    beforeEach(function () {
        _converse = converse.env._converse;
        _converse.api.settings.set('emoji_categories', {
            "smileys": "Smileys",
            "custom": "Custom"
        });
    });

    it("filters out custom emojis when unicode_only is true", async function () {
        const picker = document.createElement('converse-emoji-picker-content');
        picker.allowed_emojis = [];
        picker.unicode_only = true;
        picker.query = "";
        
        // We need to mock the model as it's used in shouldBeHidden for skintone checks
        picker.model = new _converse.Model({}); 

        // Test Custom Emoji (no cp)
        expect(picker.shouldBeHidden(":custom_emoji:")).toBe(true);

        // Test Standard Emoji (has cp)
        expect(picker.shouldBeHidden(":smile:")).toBe(false);
    });

    it("shows custom emojis when unicode_only is false", async function () {
        const picker = document.createElement('converse-emoji-picker-content');
        picker.allowed_emojis = [];
        picker.unicode_only = false;
        picker.query = "";
        picker.model = new _converse.Model({});

        // Test Custom Emoji (no cp)
        expect(picker.shouldBeHidden(":custom_emoji:")).toBe(false);

        // Test Standard Emoji (has cp)
        expect(picker.shouldBeHidden(":smile:")).toBe(false);
    });
});
