declare const ChatBoxBase_base: typeof Model & import("./types.js").Constructor<import("./types.js").MessagesAware>;
/**
 * Base class for all chat boxes. Provides common methods.
 */
export default class ChatBoxBase extends ChatBoxBase_base {
    constructor(attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions);
    initialize(): void;
    validate(attrs: any): string;
    /**
     * @param {boolean} force
     */
    maybeShow(force: boolean): this;
    shouldDestroyOnClose(): Promise<any>;
    /**
     * @param {Object} [_ev]
     */
    close(_ev?: any): Promise<void>;
    announceReconnection(): void;
    onReconnection(): Promise<void>;
}
import { Model } from '@converse/skeletor';
export {};
//# sourceMappingURL=chatbox.d.ts.map