import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, stx, u } = converse.env;

export const settings = { whitelisted_plugins: ['converse-voice-messages'] };

export const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

/**
 * A stand-in for the browser's MediaRecorder. The test decides when data
 * chunks arrive and, with `auto_stop = false`, when `stop` fires.
 */
export class FakeMediaRecorder {
    static instances = [];
    static supported = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
    static isTypeSupported = (type) => FakeMediaRecorder.supported.includes(type);

    constructor(stream, options) {
        this.stream = stream;
        this.options = options;
        this.mimeType = options.mimeType ?? '';
        this.state = 'inactive';
        this.auto_stop = true;
        FakeMediaRecorder.instances.push(this);
    }

    start() {
        this.state = 'recording';
    }

    pause() {
        this.state = 'paused';
    }

    resume() {
        this.state = 'recording';
    }

    stop() {
        this.state = 'inactive';
        if (this.auto_stop) Promise.resolve().then(() => this.emitStop());
    }

    /** @param {string} data */
    emitData(data) {
        this.ondataavailable?.({ data: new Blob([data], { type: this.mimeType }) });
    }

    emitStop() {
        this.onstop?.();
    }
}

/**
 * Install a fake microphone and MediaRecorder.
 * @param {Object} [options]
 * @param {string} [options.error] - The name of the error getUserMedia rejects with.
 */
export function installFakeMedia({ error } = {}) {
    FakeMediaRecorder.instances = [];
    const tracks = [];
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const getUserMedia = vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockImplementation(() => {
        if (error) return Promise.reject(new DOMException('Nope', error));
        const track = { stopped: false, stop: () => (track.stopped = true) };
        tracks.push(track);
        return Promise.resolve(/** @type {any} */ ({ getTracks: () => [track] }));
    });
    return {
        getUserMedia,
        tracks,
        get recorder() {
            return FakeMediaRecorder.instances.at(-1);
        },
    };
}

/**
 * Advertise an HTTP File Upload service at upload.montague.tld
 * @param {Object} [options]
 * @param {number} [options.max_file_size] - In bytes
 */
export async function waitForUploadService(_converse, { max_file_size } = {}) {
    const domain = _converse.session.get('domain');
    await mock.waitUntilDiscoConfirmed(
        _converse,
        domain,
        [{ category: 'server', type: 'IM' }],
        ['http://jabber.org/protocol/disco#items'],
        [],
        'info',
    );
    await mock.waitUntilDiscoConfirmed(_converse, domain, [], [], ['upload.montague.tld'], 'items');
    if (max_file_size === undefined) {
        await mock.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []);
        return;
    }
    const connection = _converse.api.connection.get();
    const iq = await u.waitUntil(() =>
        connection.IQ_stanzas.find(
            (iq) =>
                iq.getAttribute('to') === 'upload.montague.tld' &&
                iq.getElementsByTagNameNS(Strophe.NS.DISCO_INFO, 'query').length,
        ),
    );
    connection._dataRecv(
        mock.createRequest(
            _converse,
            stx`<iq type="result" from="upload.montague.tld" to="romeo@montague.lit/orchard"
                    id="${iq.getAttribute('id')}" xmlns="jabber:client">
                <query xmlns="http://jabber.org/protocol/disco#info">
                    <feature var="${Strophe.NS.HTTPUPLOAD}"/>
                    <x type="result" xmlns="jabber:x:data">
                        <field var="FORM_TYPE" type="hidden"><value>${Strophe.NS.HTTPUPLOAD}</value></field>
                        <field var="max-file-size"><value>${max_file_size}</value></field>
                    </x>
                </query>
            </iq>`,
        ),
    );
}

/**
 * Wait for the next upload slot request and answer it.
 * @param {string} [get_url]
 * @param {Element} [request] - A specific slot request to answer instead of the latest one.
 * @returns {Promise<Element>} The slot request IQ
 */
export async function answerSlotRequest(_converse, get_url = 'https://upload.montague.tld/voice.m4a', request) {
    const connection = _converse.api.connection.get();
    const iq =
        request ??
        (await u.waitUntil(() =>
            connection.IQ_stanzas.filter((iq) => iq.querySelector('iq[to="upload.montague.tld"] request')).pop(),
        ));
    connection.IQ_stanzas.splice(connection.IQ_stanzas.indexOf(iq), 1);
    connection._dataRecv(
        mock.createRequest(
            _converse,
            stx`<iq from="upload.montague.tld" id="${iq.getAttribute('id')}" to="romeo@montague.lit/orchard"
                    type="result" xmlns="jabber:client">
                <slot xmlns="urn:xmpp:http:upload:0">
                    <put url="https://upload.montague.tld/put/voice.m4a"></put>
                    <get url="${get_url}"></get>
                </slot>
            </iq>`,
        ),
    );
    return iq;
}

/**
 * Make HTTP PUT uploads finish with the given status.
 * @param {number} status
 */
export function fakeUploads(status = 201) {
    return vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(function () {
        Object.defineProperty(this, 'readyState', { value: XMLHttpRequest.DONE });
        Object.defineProperty(this, 'status', { value: status });
        Promise.resolve().then(() => this.onreadystatechange());
    });
}

/**
 * Open a 1:1 chat with an upload service available.
 * @param {Object} [options] - Passed on to {@link waitForUploadService}
 */
export async function openChat(_converse, options) {
    await waitForUploadService(_converse, options);
    await mock.waitForRoster(_converse, 'current', 1);
    await mock.openChatBoxFor(_converse, contact_jid);
    return _converse.chatboxviews.get(contact_jid);
}

/**
 * Open the recorder the way a user does: from the attachment menu's "Record a
 * voice message" item.
 */
export async function openRecorder(view) {
    await mock.openAttachmentMenu(view);
    view.querySelector('.attachment-menu__item[data-name="voice-message"]').click();
}

/**
 * Open the recorder and wait until it is recording.
 */
export async function startRecording(view) {
    await openRecorder(view);
    return u.waitUntil(() => view.querySelector('converse-audio-recorder .audio-recorder--recording'));
}
