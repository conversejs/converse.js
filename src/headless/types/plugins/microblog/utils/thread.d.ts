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
 * The ancestor chain of a comment, root-first (excluding the comment itself), for
 * rendering the context above a focused item in the drill-down view. Returns an
 * empty array for a root or an id not present in the tree.
 * @param { import('./types.ts').CommentTreeMap} by_id - The `by_id` from {@link buildCommentTree}.
 * @param {string} id - The focused comment's item id.
 * @returns {import('./types.ts').CommentTreeNode[]}
 */
export function getAncestors(by_id: import("./types.ts").CommentTreeMap, id: string): import("./types.ts").CommentTreeNode[];
//# sourceMappingURL=thread.d.ts.map