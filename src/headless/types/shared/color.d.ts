export class ColorAwareModel extends Model {
    setColor(): Promise<void>;
    /**
     * @returns {Promise<string>}
     */
    getColor(): Promise<string>;
    /**
     * @param {string} append_style
     * @returns {Promise<string>}
     */
    getAvatarStyle(append_style?: string): Promise<string>;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=color.d.ts.map