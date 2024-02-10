import _converse from '../../shared/_converse.js';
import api, { converse } from '../../shared/api/index.js';
import { Collection } from "@converse/skeletor";
import { createStore } from '../../utils/storage.js';

const { Strophe, $iq } = converse.env;


function onDiscoInfoRequest (stanza) {
    const node = stanza.getElementsByTagName('query')[0].getAttribute('node');
    const attrs = {xmlns: Strophe.NS.DISCO_INFO};
    if (node) { attrs.node = node; }

    const iqresult = $iq({'type': 'result', 'id': stanza.getAttribute('id')});
    const from = stanza.getAttribute('from');
    if (from !== null) {
        iqresult.attrs({'to': from});
    }

    iqresult.c('query', attrs);
    _converse.state.disco._identities.forEach(identity => {
        const attrs = {
            'category': identity.category,
            'type': identity.type
        };
        if (identity.name) {
            attrs.name = identity.name;
        }
        if (identity.lang) {
            attrs['xml:lang'] = identity.lang;
        }
        iqresult.c('identity', attrs).up();
    });
    _converse.state.disco._features.forEach(f => iqresult.c('feature', {'var': f}).up());
    api.send(iqresult.tree());
    return true;
}


function addClientFeatures () {
    // See https://xmpp.org/registrar/disco-categories.html
    api.disco.own.identities.add('client', 'web', 'Converse');

    api.disco.own.features.add(Strophe.NS.CHATSTATES);
    api.disco.own.features.add(Strophe.NS.DISCO_INFO);
    api.disco.own.features.add(Strophe.NS.ROSTERX); // Limited support
    api.disco.own.features.add(Strophe.NS.CARBONS);
    /**
     * Triggered in converse-disco once the core disco features of
     * Converse have been added.
     * @event _converse#addClientFeatures
     * @example _converse.api.listen.on('addClientFeatures', () => { ... });
     */
    api.trigger('addClientFeatures');
    return this;
}


export async function initializeDisco () {
    addClientFeatures();
    api.connection.get().addHandler(
        stanza => onDiscoInfoRequest(stanza),
        Strophe.NS.DISCO_INFO,
        'iq', 'get', null, null
    );

    const disco_entities = new _converse.exports.DiscoEntities();

    Object.assign(_converse, { disco_entities }); // XXX: DEPRECATED
    Object.assign(_converse.state, { disco_entities });

    const bare_jid = _converse.session.get('bare_jid');
    const id = `converse.disco-entities-${bare_jid}`;

    disco_entities.browserStorage = createStore(id, 'session');
    const collection = await disco_entities.fetchEntities();

    const domain = _converse.session.get('domain');

    if (collection.length === 0 || !collection.get(domain)) {
        // If we don't have an entity for our own XMPP server, create one.
        api.disco.entities.create({'jid': domain}, {'ignore_cache': true});
    }
    /**
     * Triggered once the `converse-disco` plugin has been initialized and the
     * `_converse.disco_entities` collection will be available and populated with at
     * least the service discovery features of the user's own server.
     * @event _converse#discoInitialized
     * @example _converse.api.listen.on('discoInitialized', () => { ... });
     */
    api.trigger('discoInitialized');
}

export function initStreamFeatures () {
    // Initialize the stream_features collection, and if we're
    // re-attaching to a pre-existing BOSH session, we restore the
    // features from cache.
    // Otherwise the features will be created once we've received them
    // from the server (see populateStreamFeatures).
    if (!_converse.state.stream_features) {
        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.stream-features-${bare_jid}`;
        api.promises.add('streamFeaturesAdded');

        const stream_features = new Collection();
        stream_features.browserStorage = createStore(id, "session");
        Object.assign(_converse, { stream_features }); // XXX: DEPRECATED
        Object.assign(_converse.state, { stream_features });
    }
}

export function notifyStreamFeaturesAdded () {
    /**
     * Triggered as soon as the stream features are known.
     * If you want to check whether a stream feature is supported before proceeding,
     * then you'll first want to wait for this event.
     * @event _converse#streamFeaturesAdded
     * @example _converse.api.listen.on('streamFeaturesAdded', () => { ... });
     */
    api.trigger('streamFeaturesAdded');
}

export function populateStreamFeatures () {
    // Strophe.js sets the <stream:features> element on the
    // Strophe.Connection instance.
    //
    // Once this is we populate the stream_features collection
    // and trigger streamFeaturesAdded.
    initStreamFeatures();
    Array.from(api.connection.get().features.childNodes).forEach(feature => {
        _converse.state.stream_features.create({
            'name': feature.nodeName,
            'xmlns': feature.getAttribute('xmlns')
        });
    });
    notifyStreamFeaturesAdded();
}

export function clearSession () {
    const { disco_entities } = _converse.state;
    disco_entities?.forEach(e => e.features.clearStore());
    disco_entities?.forEach(e => e.identities.clearStore());
    disco_entities?.forEach(e => e.dataforms.clearStore());
    disco_entities?.forEach(e => e.fields.clearStore());
    disco_entities?.clearStore();
    delete _converse.state.disco_entities;
    Object.assign(_converse, { disco_entities: undefined });
}
