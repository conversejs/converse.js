/* global mock, converse */

const u = converse.env.utils;

describe("Converse", function() {

    it("Can be inserted into a converse-root custom element after having been initialized",
            mock.initConverse([], {'root': new DocumentFragment()}, async (_converse) => {

        const { api } = _converse;
        expect(document.body.querySelector('#conversejs')).toBe(null);
        expect(api.settings.get('root').firstElementChild.nodeName.toLowerCase()).toBe('converse-root');
        document.body.appendChild(document.createElement('converse-root'));
        await u.waitUntil(() => document.body.querySelector('#conversejs') !== null);
    }));
});
