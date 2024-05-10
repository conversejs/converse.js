import { Model } from '@converse/skeletor';
import u from '../utils/index.js';

const { safeSave, colorize } = u;

class ColorAwareModel extends Model {

    async setColor() {
        const color = await colorize(this.get('jid'));
        safeSave(this, { color });
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

export { ColorAwareModel };
