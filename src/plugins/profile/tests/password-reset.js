/*global mock, converse */

const { Strophe, u } = converse.env;

async function submitPasswordResetForm (_converse) {
    await mock.openControlBox(_converse);
    const cbview = _converse.chatboxviews.get('controlbox');
    cbview.querySelector('a.show-profile')?.click();
    const modal = _converse.api.modal.get('converse-profile-modal');
    await u.waitUntil(() => u.isVisible(modal));

    modal.querySelector('#passwordreset-tab').click();
    const form = await u.waitUntil(() => modal.querySelector('.passwordreset-form'));

    const pw_input = form.querySelector('input[name="password"]');
    pw_input.value = 'secret-password';
    const pw_check_input = form.querySelector('input[name="password_check"]');
    pw_check_input.value = 'secret-password';
    form.querySelector('input[type="submit"]').click();

    return modal;
}


describe('The profile modal', function () {
    it(
        'allows you to reset your password',
        mock.initConverse([], {}, async function (_converse) {
            await submitPasswordResetForm(_converse);

            const sent_IQs = _converse.connection.IQ_stanzas;
            const query_iq = await u.waitUntil(() =>
                sent_IQs.filter(iq => iq.querySelector('iq[type="get"] query[xmlns="jabber:iq:register"]')).pop()
            );
            expect(Strophe.serialize(query_iq)).toBe(
                `<iq id="${query_iq.getAttribute('id')}" to="${_converse.domain}" type="get" xmlns="jabber:client">` +
                    `<query xmlns="jabber:iq:register"/>` +
                    `</iq>`
            );

            _converse.connection._dataRecv(
                mock.createRequest(
                    u.toStanza(`
                    <iq type='result' id='${query_iq.getAttribute('id')}'>
                        <query xmlns='jabber:iq:register'>
                            <username>romeo@montague.lit</username>
                            <password/>
                        </query>
                    </iq>`)
                )
            );

            const set_iq = await u.waitUntil(() =>
                sent_IQs.filter(iq => iq.querySelector('iq[type="set"] query[xmlns="jabber:iq:register"]')).pop()
            );
            expect(Strophe.serialize(set_iq)).toBe(
                `<iq id="${set_iq.getAttribute('id')}" to="${_converse.domain}" type="set" xmlns="jabber:client">` +
                    `<query xmlns="jabber:iq:register">` +
                    `<username>romeo@montague.lit</username>` +
                    `<password>secret-password</password>` +
                    `</query>` +
                    `</iq>`
            );

            _converse.connection._dataRecv(
                mock.createRequest(u.toStanza(`<iq type='result' id='${set_iq.getAttribute('id')}'></iq>`))
            );

            const alert = await u.waitUntil(() => document.querySelector('converse-alert-modal'));
            await u.waitUntil(() => u.isVisible(alert));
            expect(alert.querySelector('.modal-title').textContent).toBe('Success');
        })
    );

    it(
        'informs you if you cannot reset your password due to in-band registration not being supported',
        mock.initConverse([], {}, async function (_converse) {
            const modal = await submitPasswordResetForm(_converse);

            const sent_IQs = _converse.connection.IQ_stanzas;
            const query_iq = await u.waitUntil(() =>
                sent_IQs.filter(iq => iq.querySelector('query[xmlns="jabber:iq:register"]')).pop()
            );

            expect(Strophe.serialize(query_iq)).toBe(
                `<iq id="${query_iq.getAttribute('id')}" to="${_converse.domain}" type="get" xmlns="jabber:client">` +
                    `<query xmlns="jabber:iq:register"/>` +
                    `</iq>`
            );

            _converse.connection._dataRecv(
                mock.createRequest(
                    u.toStanza(`
                <iq type='result' id="${query_iq.getAttribute('id')}">
                    <error type="cancel"><service-unavailable xmlns="${Strophe.NS.STANZAS}"/></error>
                </iq>`)
                )
            );

            const alert = await u.waitUntil(() => modal.querySelector('.alert-danger'));
            expect(alert.textContent).toBe('Your server does not support in-band password reset');
        })
    );

    it(
        'informs you if you\'re not allowed to reset your password',
        mock.initConverse([], {}, async function (_converse) {
            const modal = await submitPasswordResetForm(_converse);

            const sent_IQs = _converse.connection.IQ_stanzas;
            const query_iq = await u.waitUntil(() =>
                sent_IQs.filter(iq => iq.querySelector('query[xmlns="jabber:iq:register"]')).pop()
            );

            expect(Strophe.serialize(query_iq)).toBe(
                `<iq id="${query_iq.getAttribute('id')}" to="${_converse.domain}" type="get" xmlns="jabber:client">` +
                    `<query xmlns="jabber:iq:register"/>` +
                    `</iq>`
            );

            _converse.connection._dataRecv(
                mock.createRequest(
                    u.toStanza(`
                    <iq type='result' id='${query_iq.getAttribute('id')}'>
                        <query xmlns='jabber:iq:register'>
                            <username>romeo@montague.lit</username>
                            <password/>
                        </query>
                    </iq>`)
                )
            );

            const set_iq = await u.waitUntil(() =>
                sent_IQs.filter(iq => iq.querySelector('iq[type="set"] query[xmlns="jabber:iq:register"]')).pop()
            );
            expect(Strophe.serialize(set_iq)).toBe(
                `<iq id="${set_iq.getAttribute('id')}" to="${_converse.domain}" type="set" xmlns="jabber:client">` +
                    `<query xmlns="jabber:iq:register">` +
                    `<username>romeo@montague.lit</username>` +
                    `<password>secret-password</password>` +
                    `</query>` +
                    `</iq>`
            );

            _converse.connection._dataRecv(
                mock.createRequest(
                    u.toStanza(`
                <iq type='result' id="${set_iq.getAttribute('id')}">
                    <error type="modify"><forbidden xmlns="${Strophe.NS.STANZAS}"/></error>
                </iq>`)
                )
            );

            const alert = await u.waitUntil(() => modal.querySelector('.alert-danger'));
            expect(alert.textContent).toBe('You are not allowed to change your password');
        })
    );
});
