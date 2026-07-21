import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, u, stx } = converse.env;

const muc_jid = 'lounge@montague.lit';

/**
 * Enter a MUC and wait until its rich composer is on screen.
 * @param {any} _converse
 * @param {string} [nick]
 */
async function enterMUC(_converse, nick = 'tom') {
    const model = await mock.openAndEnterMUC(_converse, muc_jid, nick);
    const view = _converse.chatboxviews.get(muc_jid);
    await u.waitUntil(() => view.querySelector('.chat-rich__editable'));
    const form = mock.getMessageForm(view);
    await form.ensureEditor();
    // The menu only opens while the editor has focus, since Lexical keeps its selection
    // across a blur.
    view.querySelector('.chat-rich__editable').focus();
    return { model, view, form };
}

/**
 * Announce occupants by presence, as the server would.
 * @param {any} _converse
 * @param {string[]} nicks
 */
function addOccupants(_converse, nicks) {
    nicks.forEach((nick) => {
        _converse.api.connection.get()._dataRecv(
            mock.createRequest(
                _converse,
                stx`<presence
                        to="tom@montague.lit/resource"
                        from="${muc_jid}/${nick}"
                        xmlns="jabber:client">
                    <x xmlns="${Strophe.NS.MUC_USER}">
                        <item affiliation="none" jid="${nick}@montague.lit/resource" role="participant"/>
                    </x>
                </presence>`,
            ),
        );
    });
}

/**
 * Type `text` into the composer and let the typeahead react, the way an editor update
 * would. Uses the real trigger patterns against the real caret, rather than stubbing
 * them out.
 * @param {any} view
 * @param {string} text
 */
async function typeIntoComposer(view, text) {
    await mock.setComposerText(view, text);
    await mock.getMessageForm(view).typeahead.update();
    await mock.getMessageForm(view).updateComplete;
}

/** The labels currently offered by the typeahead menu, read off the rendered DOM. */
function suggestions(view) {
    return Array.from(view.querySelectorAll('.rich-ac .rich-ac__label')).map((el) => el.textContent.trim());
}

describe('The nickname autocomplete feature', function () {
    it(
        'offers every known nickname on a bare @',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view } = await enterMUC(_converse);
            addOccupants(_converse, ['dick', 'harry']);

            // A nickname known only from the message history, with nobody in the room by
            // that name, still gets offered.
            await view.model.handleMessageStanza(
                stx`<message
                        from="${muc_jid}/jane"
                        id="${u.getUniqueId()}"
                        to="romeo@montague.lit"
                        type="groupchat"
                        xmlns="jabber:client">
                    <body>Hello world</body>
                </message>`.tree(),
            );
            await u.waitUntil(() => view.model.messages.last()?.get('received'));

            await typeIntoComposer(view, '@');

            expect(suggestions(view)).toEqual(['dick', 'harry', 'jane', 'tom']);

            // Occupants that are in the room show an avatar; a history-only nickname has
            // no occupant to draw one from.
            const rows = view.querySelectorAll('.rich-ac .rich-ac__item');
            expect(rows[0].querySelector('converse-avatar').textContent.trim()).toBe('D');
            expect(rows[1].querySelector('converse-avatar').textContent.trim()).toBe('H');
        }),
    );

    it(
        'triggers after punctuation, not only after a space',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view } = await enterMUC(_converse);
            addOccupants(_converse, ['dick', 'harry']);
            await u.waitUntil(() => view.model.occupants.length === 3);

            // Opening a parenthesis then mentioning is a mention, as it was with the
            // textarea autocomplete (any separator or punctuation was a boundary).
            await typeIntoComposer(view, 'call me (@di');
            expect(suggestions(view)).toEqual(['dick']);

            // An address mid-typing must not re-trigger on its own '@'.
            await typeIntoComposer(view, 'mail dick@');
            expect(suggestions(view)).toEqual([]);
        }),
    );

    it(
        'orders matches by query position, then by length',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { muc_mention_autocomplete_filter: 'contains' },
            async function (_converse) {
                const { model, view } = await enterMUC(_converse);
                addOccupants(_converse, ['bernard', 'naber', 'helberlo', 'john', 'jones']);
                await u.waitUntil(() => model.getOccupantByNickname('jones'));

                // 'ber' starts bernard, is at index 2 of naber and index 3 of helberlo.
                await typeIntoComposer(view, '@ber');
                expect(suggestions(view)).toEqual(['bernard', 'naber', 'helberlo']);

                // Equal position, so the shorter one wins.
                await typeIntoComposer(view, '@jo');
                expect(suggestions(view)).toEqual(['john', 'jones']);
            },
        ),
    );

    it(
        'inserts a plain @nick, which is sent as a XEP-0372 reference',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view, form } = await enterMUC(_converse);
            addOccupants(_converse, ['some1']);
            await u.waitUntil(() => view.model.occupants.length === 2);

            await typeIntoComposer(view, 'hello @som');
            expect(suggestions(view)).toEqual(['some1']);

            // Enter picks the highlighted row rather than sending the message.
            form.onKeyDown({ key: 'Enter', preventDefault: () => {}, stopImmediatePropagation: () => {} });
            await u.waitUntil(() => mock.composerText(view) === 'hello @some1');

            // Plain text, not a link: the MUC turns the mention into a XEP-0372 reference
            // downstream by scanning the body for '@nick' and recording character offsets
            // into it. That pass also drops the '@', so the body on the wire carries the
            // bare nickname with the reference pointing at it.
            await mock.pressComposerKey(view, 'Enter');
            const sent = await u.waitUntil(() =>
                _converse.api.connection
                    .get()
                    .sent_stanzas.filter((s) => s.nodeName === 'message' && s.querySelector('body'))
                    .pop(),
            );
            expect(sent.querySelector('body').textContent).toBe('hello some1');
            const ref = sent.querySelector('reference');
            expect(ref.getAttribute('type')).toBe('mention');
            expect(ref.getAttribute('uri')).toBe(`xmpp:${muc_jid}/some1`);
            expect(ref.getAttribute('begin')).toBe('6');
            expect(ref.getAttribute('end')).toBe('11');
            expect(sent.querySelector('body').textContent.slice(6, 11)).toBe('some1');
        }),
    );

    it(
        'moves the selection with the arrow keys',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view, form } = await enterMUC(_converse);
            addOccupants(_converse, ['some1', 'some2']);
            await u.waitUntil(() => view.model.occupants.length === 3);

            await typeIntoComposer(view, 'hello @some');
            expect(suggestions(view)).toEqual(['some1', 'some2']);
            expect(view.querySelector('.rich-ac__item[aria-selected="true"] .rich-ac__label').textContent.trim()).toBe(
                'some1',
            );

            form.onKeyDown({ key: 'ArrowDown', preventDefault: () => {}, stopImmediatePropagation: () => {} });
            await form.updateComplete;
            expect(view.querySelector('.rich-ac__item[aria-selected="true"] .rich-ac__label').textContent.trim()).toBe(
                'some2',
            );

            // Wrapping around, so the list is navigable in one direction alone.
            form.onKeyDown({ key: 'ArrowDown', preventDefault: () => {}, stopImmediatePropagation: () => {} });
            await form.updateComplete;
            expect(view.querySelector('.rich-ac__item[aria-selected="true"] .rich-ac__label').textContent.trim()).toBe(
                'some1',
            );

            form.onKeyDown({ key: 'Tab', preventDefault: () => {}, stopImmediatePropagation: () => {} });
            await u.waitUntil(() => mock.composerText(view) === 'hello @some1');
        }),
    );

    it(
        'honours muc_mention_autocomplete_min_chars',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { muc_mention_autocomplete_min_chars: 3 },
            async function (_converse) {
                const { view } = await enterMUC(_converse);
                addOccupants(_converse, ['some1']);
                await u.waitUntil(() => view.model.occupants.length === 2);

                await typeIntoComposer(view, '@so');
                expect(suggestions(view)).toEqual([]);

                await typeIntoComposer(view, '@som');
                expect(suggestions(view)).toEqual(['some1']);
            },
        ),
    );

    it(
        'does not complete for a visitor in a moderated room',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { view, form } = await enterMUC(_converse);
            addOccupants(_converse, ['dick']);
            await u.waitUntil(() => view.model.occupants.length === 2);

            // As a participant, completion works.
            await typeIntoComposer(view, '@di');
            expect(suggestions(view)).toEqual(['dick']);

            // A visitor in a moderated room cannot post, so there is nothing to complete.
            view.model.features.set('moderated', true);
            view.model.getOwnOccupant().set('role', 'visitor');
            expect(form.shouldAutoComplete()).toBe(false);
            await form.typeahead.update();
            await form.updateComplete;
            expect(suggestions(view)).toEqual([]);
        }),
    );
});
