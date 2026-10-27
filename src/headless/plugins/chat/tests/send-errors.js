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

            // Headless has no UI. Any call to an alert throws, so a send that alerts fails the test.
            api.alert = () => {
                throw new Error('Headless code must not alert');
            };
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
            await expect(chat.resendFailedMessage(failed)).rejects.toThrow('Only a failed message can be sent again');
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
