import { Model } from '@converse/skeletor';
import u, { getUniqueId } from '../../utils/index.js';

export default class MAMPlaceholderMessage extends Model {
    /**
     * The message whose `mam_gap` this placeholder is for, if it's for one.
     * @type {import('../../shared/message.js').default}
     */
    gap_message;

    defaults() {
        return {
            msgid: getUniqueId(),
            is_ephemeral: false,
        };
    }

    async fetchMissingMessages() {
        this.set('fetching', true);
        const options = {
            rsm: {
                before: this.get('before') ?? '', // We always query backwards (newest first)
            },
            mam: {
                start: this.get('start'),
                end: this.get('end'),
            },
        };
        const result = await u.mam.fetchArchivedMessages(this.collection.chatbox, options);
        // A query that failed or wasn't made leaves the gap recorded, for the next try.
        if (result && !result.error) this.gap_message?.save({ mam_gap: null });
        this.destroy();
    }
}
