/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Pure helpers that assemble a flat comment collection into a reply tree
 * (XEP-0277 § Comments + RFC 4685 threading). Unit-testable in isolation and
 * cheap to recompute on every render.
 *
 * The wire is flat with every reply, at any depth, living in one comments node and
 * pointing at its parent with `<thr:in-reply-to>`. These helpers turn that flat
 * list into a parent/child structure.
 */
import { Strophe } from 'strophe.js';

/**
 * The parent pointer of a comment if it nests within this thread.
 *
 * A comment carries a raw `in_reply_to` that may point at a sibling in the same
 * node (i.e. a nesting reply) or at a post in another node (a Movim-style post-reply).
 * Since a `buildCommentTree` call only ever sees one node's items,
 * "same thread" means the pointer's node/jid match the comment's own.
 * A pointer with no node/jid is treated as same-thread.
 * @param {import('../post-comment').default} comment
 * @returns {{ id: string, ref: (string|undefined) }|null}
 */
function nestingParent(comment) {
    const id = comment.get('in_reply_to');
    const ref = comment.get('in_reply_to_ref');
    if (!id && !ref) return null;

    const ptr_node = comment.get('in_reply_to_node');
    const ptr_jid = comment.get('in_reply_to_jid');
    const same_node = !ptr_node || ptr_node === comment.get('node');
    const same_jid =
        !ptr_jid || Strophe.getBareJidFromJid(ptr_jid) === Strophe.getBareJidFromJid(comment.get('from') || '');
    if (!same_node || !same_jid) return null; // cross-node: a post-reply, not a nesting one

    // `id` (the parent item id) is the primary key; `ref` (its atom:id) resolves an
    // entry whose href carried no item id (see parseAtomEntry).
    return { id: id || undefined, ref: ref || undefined };
}

/**
 * Oldest-first comparator for two tree nodes, tie-broken by id for stability
 * (the backing collection is newest-first, so we sort an explicit snapshot).
 * @param {import('./types').CommentTreeNode} a
 * @param {import('./types').CommentTreeNode} b
 * @returns {number}
 */
function byTimeAsc(a, b) {
    const ta = a.comment.get('published') || a.comment.get('time') || '';
    const tb = b.comment.get('published') || b.comment.get('time') || '';
    return ta.localeCompare(tb) || String(a.comment.get('id')).localeCompare(String(b.comment.get('id')));
}

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
export function buildCommentTree(comments) {
    /** @type {import('./types.ts').CommentTreeMap} */
    const by_id = new Map();

    /** @type {import('./types.ts').CommentTreeMap} atom:id → node, for `ref`-only resolution */
    const by_atom = new Map();

    for (const comment of comments) {
        /** @type {import('./types.ts').CommentTreeNode} */
        const node = { comment, replies: [], parent: null };
        by_id.set(comment.get('id'), node);

        const atom_id = comment.get('atom_id');
        if (atom_id && !by_atom.has(atom_id)) by_atom.set(atom_id, node);
    }

    // Resolve each comment's parent (tentatively; cycles broken below).
    for (const node of by_id.values()) {
        const pk = nestingParent(node.comment);
        if (!pk) continue; // a real root: no nesting pointer

        const parent = by_id.get(pk.id) || (pk.ref ? by_atom.get(pk.ref) : undefined);
        if (parent && parent !== node) {
            node.parent = parent;
        } else if (!parent) {
            // A nesting pointer whose target isn't loaded: orphan (kept, unshown).
            // A self-reference (parent === node) is left as a root instead.
            node.orphan = true;
        }
    }

    // Break any reference cycle by cutting the edge that closes it, which makes
    // that node a root (parent restored to null, not orphaned).
    for (const start of by_id.values()) {
        const seen = new Set();
        let cur = start;
        while (cur?.parent) {
            if (seen.has(cur)) {
                cur.parent = null;
                break;
            }
            seen.add(cur);
            cur = cur.parent;
        }
    }

    // Materialise the child lists and collect the roots. A root is any node with
    // no parent that isn't an orphan (real roots + cycle-demoted nodes).
    /** @type {import('./types.ts').CommentTreeNode[]} */
    const roots = [];
    for (const node of by_id.values()) {
        if (node.parent) node.parent.replies.push(node);
        else if (!node.orphan) roots.push(node);
    }

    roots.sort(byTimeAsc);
    for (const node of by_id.values()) node.replies.sort(byTimeAsc);

    return { roots, by_id };
}

/**
 * The ancestor chain of a comment, root-first (excluding the comment itself), for
 * rendering the context above a focused item in the drill-down view. Returns an
 * empty array for a root or an id not present in the tree.
 * @param { import('./types.ts').CommentTreeMap} by_id - The `by_id` from {@link buildCommentTree}.
 * @param {string} id - The focused comment's item id.
 * @returns {import('./types.ts').CommentTreeNode[]}
 */
export function getAncestors(by_id, id) {
    const start = by_id.get(id);
    if (!start) return [];

    /** @type {import('./types').CommentTreeNode[]} */
    const chain = [];
    let node = start.parent;
    while (node) {
        chain.push(node);
        node = node.parent;
    }
    return chain.reverse();
}
