
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

        setBookmark(bookmark) {
            this.bookmark = bookmark;
            this.listenTo(this.bookmark, 'change', () => this.trigger('bookmark:change', bookmark));
            this.trigger('bookmark:change', bookmark);
        }
    };
}
