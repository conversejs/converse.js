import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, stx, u } = converse.env;

/**
 * Answer a pending omemo:2 device-list fetch for `jid` with `device_ids`.
 */
export async function answerV2DeviceList(_converse, jid, device_ids) {
    const conn = _converse.api.connection.get();
    const sel = `iq[to="${jid}"] items[node="${Strophe.NS.OMEMO2_DEVICELIST}"]`;
    const iq = await u.waitUntil(() =>
        Array.from(conn.IQ_stanzas)
            .filter((i) => i.querySelector(sel))
            .pop(),
    );
    conn._dataRecv(
        mock.createRequest(
            _converse,
            stx`<iq from="${jid}" id="${iq.getAttribute('id')}" to="${conn.jid}" xmlns="jabber:server" type="result">
                <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <items node="${Strophe.NS.OMEMO2_DEVICELIST}">
                        <item>
                            <devices xmlns="${Strophe.NS.OMEMO2}">
                                ${device_ids.map((id) => stx`<device id="${id}"/>`)}
                            </devices>
                        </item>
                    </items>
                </pubsub>
            </iq>`,
        ),
    );
    return iq;
}

/**
 * Answer a pending omemo:2 bundle fetch for `jid`/`device_id`.
 */
export async function answerV2Bundle(_converse, jid, device_id) {
    const conn = _converse.api.connection.get();
    const sel = `iq[to="${jid}"] items[node="${Strophe.NS.OMEMO2_BUNDLES}"]`;
    const iq = await u.waitUntil(() =>
        Array.from(conn.IQ_stanzas)
            .filter((i) => i.querySelector(sel))
            .pop(),
    );
    conn._dataRecv(
        mock.createRequest(
            _converse,
            stx`<iq from="${jid}" id="${iq.getAttribute('id')}" to="${conn.jid}" xmlns="jabber:server" type="result">
                <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <items node="${Strophe.NS.OMEMO2_BUNDLES}">
                        <item id="${device_id}">
                            <bundle xmlns="${Strophe.NS.OMEMO2}">
                                <spk id="1">${btoa('v2-spk-pub')}</spk>
                                <spks>${btoa('v2-spk-sig')}</spks>
                                <ik>${btoa('v2-identity-key')}</ik>
                                <prekeys><pk id="1">${btoa('v2-pk-1')}</pk></prekeys>
                            </bundle>
                        </item>
                    </items>
                </pubsub>
            </iq>`,
        ),
    );
    return iq;
}
