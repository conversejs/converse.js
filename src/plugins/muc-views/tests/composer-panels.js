import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import { html } from 'lit';

const { Strophe, stx, u } = converse.env;

const MUC_JID = 'trollbox@montague.lit';

/**
 * @param {string} role
 * @param {number} [status] - A 110 status code marks it as the user's own presence.
 */
function ownPresence(role, status = 110) {
    return stx`<presence from="${MUC_JID}/troll" to="romeo@montague.lit/orchard" xmlns="jabber:client">
        <x xmlns="http://jabber.org/protocol/muc#user">
            <item affiliation="none" nick="troll" role="${role}"/>
            <status code="${status}"/>
        </x>
    </presence>`;
}

describe('Composer panels in a groupchat', function () {
    it(
        'sit directly above the message form',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.openAndEnterMUC(_converse, MUC_JID, 'troll');
            const view = _converse.chatboxviews.get(MUC_JID);
            await u.waitUntil(() => view.querySelector('.chat-textarea'));

            const container = view.querySelector('converse-composer-panels');
            expect(container.nextElementSibling.tagName).toBe('CONVERSE-MUC-MESSAGE-FORM');
        }),
    );

    it(
        'keep the frame left-aligned and at the normal font size, like in a one-to-one chat',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { tplComposerPanel } = _converse.exports;
            _converse.api.listen.on('getComposerPanels', (_container, panels) => {
                panels.push({
                    name: 'test-panel',
                    order: 250,
                    template: tplComposerPanel({ kind: 'context', content: html`<span>Replying to bob</span>` }),
                });
                return panels;
            });
            await mock.openAndEnterMUC(_converse, MUC_JID, 'troll');
            const view = _converse.chatboxviews.get(MUC_JID);

            // The groupchat's bottom panel centres its own text in a smaller size.
            const panel = await u.waitUntil(() => view.querySelector('converse-muc-bottom-panel .composer-panel'));
            const style = getComputedStyle(panel);
            expect(style.textAlign).toBe('start');
            expect(style.fontSize).toBe(getComputedStyle(panel).getPropertyValue('--font-size').trim());
        }),
    );

    it(
        'are not shown to a muted visitor, and come back when they are given voice',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const features = ['http://jabber.org/protocol/muc', 'jabber:iq:register', Strophe.NS.SID, 'muc_moderated'];
            await mock.openAndEnterMUC(_converse, MUC_JID, 'troll', features);
            const view = _converse.chatboxviews.get(MUC_JID);
            await u.waitUntil(() => view.querySelector('.chat-textarea'));

            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, ownPresence('visitor')));
            await u.waitUntil(() => view.querySelector('.chat-textarea') === null);
            expect(view.querySelector('converse-composer-panels')).toBeNull();

            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, ownPresence('participant')));
            await u.waitUntil(() => view.querySelector('converse-composer-panels'));
            expect(view.querySelector('.chat-textarea')).not.toBeNull();
        }),
    );

    it(
        'show a panel that a plugin adds through the getComposerPanels hook, at its order',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            _converse.api.listen.on('getComposerPanels', (_container, panels) => {
                panels.push({ name: 'test-panel', order: 250, template: html`<div class="test-panel"></div>` });
                return panels;
            });
            await mock.openAndEnterMUC(_converse, MUC_JID, 'troll');
            const view = _converse.chatboxviews.get(MUC_JID);
            const panel = await u.waitUntil(() => view.querySelector('.test-panel'));

            // The reply preview is ordered after it, so it sits closer to the message form.
            const reply_preview = view.querySelector('converse-reply-preview');
            expect(panel.compareDocumentPosition(reply_preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        }),
    );

    it(
        'do not include the off-hours warning, which is for one-to-one chats only',
        mock.initConverse(converse, ['chatBoxesFetched'], { show_entity_time: true }, async function (_converse) {
            await mock.openAndEnterMUC(_converse, MUC_JID, 'troll');
            const view = _converse.chatboxviews.get(MUC_JID);
            await u.waitUntil(() => view.querySelector('.chat-textarea'));

            expect(view.querySelector('converse-entity-time-alert')).toBeNull();
        }),
    );
});
