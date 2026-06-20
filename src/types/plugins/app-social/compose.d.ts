/**
 * A minimal compose box for publishing a microblog post to the user's own feed.
 * Reuses the chat textarea's Enter-to-send convention.
 */
export default class SocialCompose extends CustomElement {
    static get properties(): {
        model: {
            type: typeof PubSubFeed;
        };
    };
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev: KeyboardEvent): void;
    /**
     * @param {Event} [ev]
     */
    onSubmit(ev?: Event): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
import { PubSubFeed } from '@converse/headless';
//# sourceMappingURL=compose.d.ts.map