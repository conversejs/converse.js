/**
 * Assemble a flat list of a single thread's comments into a reply tree.
 *
 * Pass the thread's real comments (the caller must filter out ♥ likes).
 *
 * Classification per comment:
 *  - **root**: no nesting pointer (a direct comment on the post). Surfaced.
 *  - **child**: nesting pointer resolves to a loaded comment. Hung off it.
 *  - **orphan**: nesting pointer set but the parent isn't loaded.
 *  - a reference cycle is broken by demoting the closing node to a root.
 *
 * @param {import('../post-comment').default[]} comments
 * @returns {{ roots: import('./types.ts').CommentTreeNode[], by_id: import('./types').CommentTreeMap }}
 */
export function buildCommentTree(comments: import("../post-comment").default[]): {
    roots: import("./types.ts").CommentTreeNode[];
    by_id: import("./types").CommentTreeMap;
};
/**
 * Resolve, for every passed item (comments *and* ♥ likes), how it attaches to the
 * thread: the loaded item it nests under, or that it is a post-level item (no
 * nesting pointer), or that it is an orphan (a nesting pointer whose parent isn't
 * loaded). Shared by {@link buildCommentTree} and {@link computeThreadCounts} so a
 * rendered reply and its counted total can never disagree.
 * @param {import('../post-comment').default[]} items
 * @returns {Map<string, { parent: string|null, orphan: boolean }>}
 */
export function resolveThreadParents(items: import("../post-comment").default[]): Map<string, {
    parent: string | null;
    orphan: boolean;
}>;
/**
 * Partition a thread's items into denormalised counts in a single pass: the
 * post-level summary plus per-comment counts, keyed by comment id.
 *
 * Likes are attributed to their target (the post when they carry no nesting
 * pointer, else the comment they reply to) and counted by distinct liker, so a ♥
 * aimed at a comment never inflates the post's like count. `comment_count` is the
 * whole thread's reply total (every real comment, orphans included); a comment's
 * `reply_count` is its *direct* replies only.
 * @param {import('../post-comment').default[]} items - A thread's items (likes included).
 * @returns {{
 *   post: { comment_count: number, like_count: number, liked_by_me: boolean, my_like_id: (string|undefined) },
 *   byComment: Map<string, { reply_count: number, like_count: number, liked_by_me: boolean, my_like_id: (string|undefined) }>
 * }}
 */
export function computeThreadCounts(items: import("../post-comment").default[]): {
    post: {
        comment_count: number;
        like_count: number;
        liked_by_me: boolean;
        my_like_id: (string | undefined);
    };
    byComment: Map<string, {
        reply_count: number;
        like_count: number;
        liked_by_me: boolean;
        my_like_id: (string | undefined);
    }>;
};
/**
 * The ancestor chain of a comment, root-first (excluding the comment itself), for
 * rendering the context above a focused item in the drill-down view. Returns an
 * empty array for a root or an id not present in the tree.
 * @param { import('./types.ts').CommentTreeMap} by_id - The `by_id` from {@link buildCommentTree}.
 * @param {string} id - The focused comment's item id.
 * @returns {import('./types.ts').CommentTreeNode[]}
 */
export function getAncestors(by_id: import("./types.ts").CommentTreeMap, id: string): import("./types.ts").CommentTreeNode[];
//# sourceMappingURL=thread.d.ts.map