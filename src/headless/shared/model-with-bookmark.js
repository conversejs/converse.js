
/**
 * @template {import('./types').ModelExtender} T
 * @param {T} BaseModel
 */
export default function ModelWithBookmark(BaseModel) {
    return class ModelWithBookmark extends BaseModel {
        initialize() {
            super.initialize();
            this.bookmark = null;
        }

        /**
         * Associate this model with a bookmark (or clear it by passing `null`).
         * Idempotent: re-binding the same bookmark is a no-op, and rebinding a
         * different one detaches the previous listener first.
         * @param {import('@converse/skeletor').Model|null} bookmark
         */
        setBookmark(bookmark) {
            if (this.bookmark === bookmark) return;
            if (this.bookmark) this.stopListening(this.bookmark);
            this.bookmark = bookmark;
            if (bookmark) {
                this.listenTo(bookmark, 'change', () => this.trigger('bookmark:change', bookmark));
            }
            this.trigger('bookmark:change', bookmark);
        }
    };
}
