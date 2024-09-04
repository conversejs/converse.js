declare namespace _default {
    namespace headlines {
        /**
         * Retrieves a headline-channel or all headline-channels.
         *
         * @method api.headlines.get
         * @param {String|String[]} jids - e.g. 'buddy@example.com' or ['buddy1@example.com', 'buddy2@example.com']
         * @param { Object } [attrs] - Attributes to be set on the _converse.ChatBox model.
         * @param { Boolean } [create=false] - Whether the chat should be created if it's not found.
         * @returns { Promise<HeadlinesFeed[]|HeadlinesFeed> }
         */
        function get(jids: string | string[], attrs?: any, create?: boolean): Promise<HeadlinesFeed[] | HeadlinesFeed>;
    }
}
export default _default;
export type HeadlinesFeed = import("./feed.js").default;
//# sourceMappingURL=api.d.ts.map