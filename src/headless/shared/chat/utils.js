import debounce from 'lodash-es/debounce.js';
import { api, converse } from '@converse/headless/core.js';

const { u } = converse.env;

export function pruneHistory (model) {
    const max_history = api.settings.get('prune_messages_above');
    if (max_history && typeof max_history === 'number') {
        if (model.messages.length > max_history) {
            const non_empty_messages = model.messages.filter((m) => !u.isEmptyMessage(m));
            if (non_empty_messages.length > max_history) {
                while (non_empty_messages.length > max_history) {
                    non_empty_messages.shift().destroy();
                }
                /**
                 * Triggered once the message history has been pruned, i.e.
                 * once older messages have been removed to keep the
                 * number of messages below the value set in `prune_messages_above`.
                 * @event _converse#historyPruned
                 * @type { _converse.ChatBox | _converse.ChatRoom }
                 * @example _converse.api.listen.on('historyPruned', this => { ... });
                 */
                api.trigger('historyPruned', model);
            }
        }
    }
}

/**
 * Given an array of {@link MediaURLMetadata} objects and text, return an
 * array of {@link MediaURL} objects.
 * @param { Array<MediaURLMetadata> } arr
 * @param { String } text
 * @returns{ Array<MediaURL> }
 */
export function getMediaURLs (arr, text, offset=0) {
    /**
     * @typedef { Object } MediaURLData
     * An object representing a URL found in a chat message
     * @property { Boolean } is_audio
     * @property { Boolean } is_image
     * @property { Boolean } is_video
     * @property { String } end
     * @property { String } start
     * @property { String } url
     */
    return arr.map(o => {
        const start = o.start - offset;
        const end = o.end - offset;
        if (start < 0 || start >= text.length) {
            return null;
        }
        return Object.assign({}, o, {
            start,
            end,
            'url': text.substring(o.start-offset, o.end-offset),
        });
    }).filter(o => o);
}


/**
 * Determines whether the given attributes of an incoming message
 * represent a XEP-0308 correction and, if so, handles it appropriately.
 * @private
 * @method _converse.ChatBox#handleCorrection
 * @param { _converse.ChatBox | _converse.ChatRoom }
 * @param { object } attrs - Attributes representing a received
 *  message, as returned by {@link parseMessage}
 * @returns { _converse.Message|undefined } Returns the corrected
 *  message or `undefined` if not applicable.
 */
export async function handleCorrection (model, attrs) {
    if (!attrs.replace_id || !attrs.from) {
        return;
    }

    const query = (attrs.type === 'groupchat' && attrs.occupant_id)
        ? ({ attributes: m }) => m.msgid === attrs.replace_id && m.occupant_id == attrs.occupant_id
        // eslint-disable-next-line no-eq-null
        : ({ attributes: m }) => m.msgid === attrs.replace_id && m.from === attrs.from && m.occupant_id == null

    const message = model.messages.models.find(query);
    if (!message) {
        attrs['older_versions'] = {};
        return await model.createMessage(attrs); // eslint-disable-line no-return-await
    }

    const older_versions = message.get('older_versions') || {};
    if ((attrs.time < message.get('time')) && message.get('edited')) {
        // This is an older message which has been corrected afterwards
        older_versions[attrs.time] = attrs['message'];
        message.save({'older_versions': older_versions});
    } else {
        // This is a correction of an earlier message we already received
        if (Object.keys(older_versions).length) {
            older_versions[message.get('edited')] = message.getMessageText();
        } else {
            older_versions[message.get('time')] = message.getMessageText();
        }
        attrs = Object.assign(attrs, { older_versions });
        delete attrs['msgid']; // We want to keep the msgid of the original message
        delete attrs['id']; // Delete id, otherwise a new cache entry gets created
        attrs['time'] = message.get('time');
        message.save(attrs);
    }
    return message;
}


export const debouncedPruneHistory = debounce(pruneHistory, 500);
