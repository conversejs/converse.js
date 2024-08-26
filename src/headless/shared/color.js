import u from '../utils/index.js';
import { CHATROOMS_TYPE } from './constants.js';

const { safeSave, colorize } = u;

/**
 * @template {import('./types').ModelExtender} T
 * @param {T} BaseModel
 */
export default function ColorAwareModel(BaseModel) {

    return class ColorAwareModel extends BaseModel {
        async setColor() {
            const color = await colorize(this.getIdentifier());
            safeSave(this, { color });
        }

        getIdentifier() {
            if (this.get('type') === CHATROOMS_TYPE) {
                return this.get('jid');
            } else if (this.get('type') === 'groupchat') {
                return this.get('from_real_jid') || this.get('from');
            } else {
                return this.get('occupant_id') || this.get('jid') || this.get('from') || this.get('nick');
            }
        }

        /**
        * @returns {Promise<string>}
        */
        async getColor() {
            if (!this.get('color')) {
                await this.setColor();
            }
            return this.get('color');
        }

        /**
        * @param {string} append_style
        * @returns {Promise<string>}
        */
        async getAvatarStyle(append_style = '') {
            try {
                const color = await this.getColor();
                return `background-color: ${color} !important; ${append_style}`;
            } catch {
                return `background-color: gray !important; ${append_style}`;
            }
        }
    }
}
