/*global mock, converse */

const u = converse.env.utils;

describe("The Controlbox", function () {
    describe("The user profile", function () {

        it("shows the user's configured nickname",
            mock.initConverse([], { blacklisted_plugins: ['converse-vcard'], nickname: 'nicky'},
            async function (_converse) {

                mock.openControlBox(_converse);
                const el = await u.waitUntil(() => document.querySelector('converse-user-profile .username'));
                expect(el.textContent).toBe('nicky');
        }));
    });
});
