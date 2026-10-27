import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

/** @param {Element} el @param {string} label */
function findButton(el, label) {
    return Array.from(el.querySelectorAll('button')).find((b) => b.textContent.trim() === label);
}

/** @param {any} _converse */
function sentBodies(_converse) {
    return _converse.api.connection
        .get()
        .send.mock.calls.map(([stanza]) => stanza.querySelector?.('body')?.textContent)
        .filter(Boolean);
}

describe('A failed encrypted send', function () {
    it(
        'shows the reason once, keeps the text in the failed message, and sends unencrypted only after confirmation',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.initializedOMEMO(_converse);
            mock.deferV2DeviceList(contact_jid);
            await mock.openChatBoxFor(_converse, contact_jid);

            const view = _converse.chatboxviews.get(contact_jid);
            view.model.set('omemo_active', true);
            spyOn(api.connection.get(), 'send');

            // Fail the encrypted stanza, as a contact without reachable devices would.
            let fail = true;
            const createStanza = view.model.createMessageStanza.bind(view.model);
            spyOn(view.model, 'createMessageStanza').and.callFake((message) => {
                if (fail)
                    throw Object.assign(new Error('No OMEMO devices'), {
                        code: 'no-omemo-devices',
                        can_send_unencrypted: true,
                    });
                return createStanza(message);
            });

            await mock.setComposerText(view, 'Keep this text');
            await mock.pressComposerKey(view, 'Enter');

            await u.waitUntil(() => document.querySelector('.alert-danger .modal-title'));
            expect(document.querySelectorAll('.alert-danger').length).toBe(1);
            const reason = 'Sorry, no devices found to which we can send an OMEMO encrypted message.';
            expect(document.querySelector('.alert-danger .modal-title').textContent).toBe('Error');
            expect(
                u
                    .ancestor(document.querySelector('.alert-danger .modal-title'), '.modal-content')
                    .querySelector('.modal-body p')
                    .textContent.trim(),
            ).toBe(reason);

            // The failed message holds the text, so the composer is cleared and a second send can't duplicate it.
            expect(mock.composerText(view)).toBe('');
            const failed = view.model.messages.findWhere({ send_status: 'failed' });
            expect(failed.get('send_error_code')).toBe('no-omemo-devices');
            expect(failed.get('plaintext')).toBe('Keep this text');

            const row = await u.waitUntil(() => view.querySelector('.chat-msg__send-failed'));
            expect(row.querySelector('.chat-msg__send-failed-reason').textContent.trim()).toBe(reason);

            // Declining the confirmation sends nothing.
            spyOn(api, 'confirm').and.resolveTo(false);
            fail = false;
            findButton(row, 'Send without encryption').click();
            await u.waitUntil(() => api.confirm.calls.count() === 1);
            expect(sentBodies(_converse)).not.toContain('Keep this text');
            expect(failed.get('send_status')).toBe('failed');

            // Confirming sends the message in the clear, and it's no longer marked as failed.
            api.confirm.and.resolveTo(true);
            findButton(row, 'Send without encryption').click();
            await u.waitUntil(() => sentBodies(_converse).includes('Keep this text'));
            expect(failed.get('send_status')).toBeUndefined();
            expect(failed.get('is_encrypted')).toBe(false);
            await u.waitUntil(() => !view.querySelector('.chat-msg__send-failed'));
        }),
    );

    it(
        'can be discarded from the history',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.initializedOMEMO(_converse);
            mock.deferV2DeviceList(contact_jid);
            await mock.openChatBoxFor(_converse, contact_jid);

            const view = _converse.chatboxviews.get(contact_jid);
            view.model.set('omemo_active', true);
            spyOn(api.connection.get(), 'send');
            spyOn(view.model, 'createMessageStanza').and.callFake(() => {
                throw Object.assign(new Error('No OMEMO devices'), {
                    code: 'no-omemo-devices',
                    can_send_unencrypted: true,
                });
            });

            await mock.setComposerText(view, 'Discard me');
            await mock.pressComposerKey(view, 'Enter');
            const row = await u.waitUntil(() => view.querySelector('.chat-msg__send-failed'));
            const { msgid } = view.model.messages.findWhere({ send_status: 'failed' }).attributes;

            findButton(row, 'Discard').click();
            await u.waitUntil(() => !view.model.messages.findWhere({ send_status: 'failed' }));
            expect(view.model.messages.findWhere({ msgid })).toBeUndefined();
            expect(sentBodies(_converse)).not.toContain('Discard me');
        }),
    );
});
