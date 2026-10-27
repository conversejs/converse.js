import converse from '../../../dist/converse-headless.js';
import mock from '../../../tests/mock.js';

const { stx } = converse.env;

describe('A failed chat send', function () {
    it(
        'rejects with its code and is kept as a failed message, without an alert or a resend',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const chat = _converse.chatboxes.get(contact_jid);

            // Headless has no UI, so api.alert doesn't exist here. A send that alerts fails the test.
            api.alert = () => {
                throw new Error('Headless code must not alert');
            };
            try {
                spyOn(api, 'send');
                spyOn(chat, 'createMessageStanza').and.callFake(() => {
                    throw Object.assign(new Error('No OMEMO devices'), { code: 'no-omemo-devices' });
                });

                await expect(chat.sendMessage({ body: 'Not delivered' })).rejects.toMatchObject({
                    code: 'no-omemo-devices',
                });

                const failed = chat.messages.findWhere({ send_status: 'failed' });
                expect(failed.get('body')).toBe('Not delivered');
                expect(failed.get('send_error_code')).toBe('no-omemo-devices');
                expect(api.send).not.toHaveBeenCalled();
                expect(chat.get('num_unread')).toBe(0);

                // Retrying is a call the client makes. Once it succeeds, the failure is cleared.
                chat.createMessageStanza.and.resolveTo(stx`<message xmlns="jabber:client"/>`);
                await chat.resendFailedMessage(failed);
                expect(api.send).toHaveBeenCalledTimes(1);
                expect(failed.get('send_status')).toBeUndefined();
                expect(failed.get('send_error_code')).toBeUndefined();

                // A message that didn't fail can't be resent.
                await expect(chat.resendFailedMessage(failed)).rejects.toThrow(
                    'Only a failed message can be sent again',
                );
            } finally {
                delete api.alert;
            }
        }),
    );

    it(
        'stays encrypted when a send without encryption fails, so Retry does not send it in the clear',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const chat = _converse.chatboxes.get(contact_jid);

            // Only the encrypted attempt can offer a send without encryption, as in production.
            spyOn(chat, 'createMessageStanza').and.callFake((message) => {
                const e = Object.assign(new Error('x'), { code: 'send-failed' });
                if (message.get('is_encrypted')) e.can_send_unencrypted = true;
                throw e;
            });
            await expect(chat.sendMessage({ body: 'fallback', is_encrypted: true })).rejects.toMatchObject({
                code: 'send-failed',
            });

            const failed = chat.messages.findWhere({ send_status: 'failed' });
            failed.save({ plaintext: 'Secret' });
            expect(failed.get('send_can_send_unencrypted')).toBe(true);
            await expect(
                _converse.api.hook('resendFailedMessageUnencrypted', chat, { message: failed, handled: false }),
            ).rejects.toMatchObject({ code: 'send-failed' });

            expect(failed.get('is_encrypted')).toBe(true);
            expect(failed.get('body')).toBe('fallback');
            expect(failed.get('plaintext')).toBe('Secret');
            expect(failed.get('send_status')).toBe('failed');
            expect(failed.get('send_can_send_unencrypted')).toBe(true);
        }),
    );

    it(
        'is not handled when the message cannot be sent without encryption',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const chat = _converse.chatboxes.get(contact_jid);

            spyOn(chat, 'createMessageStanza').and.rejectWith(Object.assign(new Error('x'), { code: 'send-failed' }));
            await expect(chat.sendMessage({ body: 'No flag' })).rejects.toMatchObject({ code: 'send-failed' });

            const failed = chat.messages.findWhere({ send_status: 'failed' });
            const data = await _converse.api.hook('resendFailedMessageUnencrypted', chat, {
                message: failed,
                handled: false,
            });
            expect(data.handled).toBe(false);
            expect(failed.get('send_status')).toBe('failed');
        }),
    );

    it(
        'keeps the sender of a failed IQ with the failed message, until it is sent again',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const chat = _converse.chatboxes.get(contact_jid);

            const iq = stx`<iq xmlns="jabber:client" type="error" from="capulet.lit"/>`.tree();
            spyOn(chat, 'createMessageStanza').and.rejectWith(
                Object.assign(new Error('x'), { code: 'omemo-remote-server-not-found', iq }),
            );
            await expect(chat.sendMessage({ body: 'Lost' })).rejects.toMatchObject({
                code: 'omemo-remote-server-not-found',
            });

            const failed = chat.messages.findWhere({ send_status: 'failed' });
            expect(failed.get('send_error_from')).toBe('capulet.lit');

            chat.createMessageStanza.and.resolveTo(stx`<message xmlns="jabber:client"/>`);
            spyOn(_converse.api, 'send');
            await chat.resendFailedMessage(failed);
            expect(failed.get('send_error_from')).toBeUndefined();
        }),
    );

    it(
        'can be discarded from the history',
        mock.initConverse(converse, ['rosterInitialized', 'chatBoxesInitialized'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const chat = _converse.chatboxes.get(contact_jid);

            spyOn(chat, 'createMessageStanza').and.rejectWith(Object.assign(new Error('x'), { code: 'send-failed' }));
            await expect(chat.sendMessage({ body: 'Drop me' })).rejects.toMatchObject({ code: 'send-failed' });

            const failed = chat.messages.findWhere({ send_status: 'failed' });
            chat.discardFailedMessage(failed);
            expect(chat.messages.findWhere({ send_status: 'failed' })).toBeUndefined();
        }),
    );
});
