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
import { LIKE_MARKER } from '../constants.js';

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

    for (const comment of comments) {
        /** @type {import('./types.ts').CommentTreeNode} */
        const node = { comment, replies: [], parent: null };
        by_id.set(comment.get('id'), node);
    }

    // Resolve each comment's parent (tentatively; cycles broken below), reusing the
    // one nesting/resolution pass so structure and counts can never disagree.
    const parents = resolveThreadParents(comments);
    for (const node of by_id.values()) {
        const info = parents.get(node.comment.get('id'));
        if (info.parent && by_id.has(info.parent)) node.parent = by_id.get(info.parent);
        else if (info.orphan) node.orphan = true;
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
 * Resolve, for every passed item (comments *and* ♥ likes), how it attaches to the
 * thread: the loaded item it nests under, or that it is a post-level item (no
 * nesting pointer), or that it is an orphan (a nesting pointer whose parent isn't
 * loaded). Shared by {@link buildCommentTree} and {@link computeThreadCounts} so a
 * rendered reply and its counted total can never disagree.
 * @param {import('../post-comment').default[]} items
 * @returns {Map<string, { parent: string|null, orphan: boolean }>}
 */
export function resolveThreadParents(items) {
    const present = new Set();
    /** @type {Map<string, string>} atom:id → item id */
    const by_atom = new Map();
    for (const it of items) {
        present.add(it.get('id'));
        const atom_id = it.get('atom_id');
        if (atom_id && !by_atom.has(atom_id)) by_atom.set(atom_id, it.get('id'));
    }

    /** @type {Map<string, { parent: string|null, orphan: boolean }>} */
    const out = new Map();
    for (const it of items) {
        const pk = nestingParent(it);
        let parent = null;
        let orphan = false;
        if (pk) {
            const resolved = pk.id && present.has(pk.id) ? pk.id : pk.ref ? by_atom.get(pk.ref) : undefined;
            if (resolved && resolved !== it.get('id')) parent = resolved;
            else if (!resolved) orphan = true; // pointer set, parent not loaded
            // a self-reference (resolved === own id) falls through as a post-level root
        }
        out.set(it.get('id'), { parent, orphan });
    }
    return out;
}

/**
 * The distinct-reactor key for a reaction item: its author's bare JID, or a
 * per-item fallback when the author is unknown (so unattributable reactions count
 * once each rather than collapsing together).
 * @param {import('../post-comment').default} item
 * @returns {string}
 */
function reactorKey(item) {
    const jid = item.getAuthorJID?.();
    return jid ? Strophe.getBareJidFromJid(jid) : `id:${item.get('id')}`;
}

/**
 * @typedef {{ reactors: Set<string>, mine: boolean, my_id: (string|undefined) }} ReactionBucket
 */

/**
 * Reduce a per-emoji reaction map into the denormalised shape stored on a model:
 * a sorted `reactions` array, a `my_reaction_ids` lookup (for retract), and the
 * legacy ♥ `like_*` fields derived from the heart bucket.
 * @param {Map<string, ReactionBucket>} reaction_map
 * @returns {{ reactions: Array<{emoji: string, count: number, reacted_by_me: boolean}>, my_reaction_ids: Record<string,string>, like_count: number, liked_by_me: boolean, my_like_id: (string|undefined) }}
 */
function summariseReactions(reaction_map) {
    const entries = [];
    for (const [emoji, a] of reaction_map) {
        entries.push({ emoji, count: a.reactors.size, reacted_by_me: a.mine, my_id: a.mine ? a.my_id : undefined });
    }
    // Most-reacted first, emoji ascending as a stable tie-break, so the serialised
    // form is deterministic (the sync layer diffs `reactions` as JSON).
    entries.sort((x, y) => y.count - x.count || x.emoji.localeCompare(y.emoji));

    const reactions = entries.map(({ emoji, count, reacted_by_me }) => ({ emoji, count, reacted_by_me }));
    const my_reaction_ids = {};
    for (const e of entries) if (e.my_id) my_reaction_ids[e.emoji] = e.my_id;

    const heart = entries.find((e) => e.emoji === LIKE_MARKER);
    return {
        reactions,
        my_reaction_ids,
        like_count: heart?.count ?? 0,
        liked_by_me: heart?.reacted_by_me ?? false,
        my_like_id: heart?.my_id,
    };
}

/**
 * Partition a thread's items into denormalised counts in a single pass: the
 * post-level summary plus per-comment counts, keyed by comment id.
 *
 * Reactions (single-emoji comments, ♥ included) are attributed to their target
 * (the post when they carry no nesting pointer, else the comment they reply to)
 * and counted **per emoji by distinct reactor**, so a reaction aimed at a comment
 * never inflates the post's counts and one person reacting the same emoji twice
 * counts once. `comment_count` is the whole thread's reply total (every real
 * comment, orphans included); a comment's `reply_count` is its *direct* replies
 * only. The legacy `like_*` fields carry the ♥ bucket for backwards compatibility.
 * @param {import('../post-comment').default[]} items - A thread's items (reactions included).
 * @returns {{
 *   post: { comment_count: number, reactions: Array<{emoji: string, count: number, reacted_by_me: boolean}>, my_reaction_ids: Record<string,string>, like_count: number, liked_by_me: boolean, my_like_id: (string|undefined) },
 *   byComment: Map<string, { reply_count: number, reactions: Array<{emoji: string, count: number, reacted_by_me: boolean}>, my_reaction_ids: Record<string,string>, like_count: number, liked_by_me: boolean, my_like_id: (string|undefined) }>
 * }}
 */
export function computeThreadCounts(items) {
    const reals = items.filter((it) => typeof it.getReactionEmoji === 'function');
    const parents = resolveThreadParents(reals);

    let comment_count = 0;
    /** @type {Map<string, ReactionBucket>} */
    const post_reactions = new Map();

    /** @type {Map<string, { reply_count: number, reactions: Map<string, ReactionBucket> }>} */
    const agg = new Map();
    const ensure = (/** @type {string} */ id) => {
        let a = agg.get(id);
        if (!a) {
            a = { reply_count: 0, reactions: new Map() };
            agg.set(id, a);
        }
        return a;
    };
    const bucket = (/** @type {Map<string, ReactionBucket>} */ map, /** @type {string} */ emoji) => {
        let a = map.get(emoji);
        if (!a) {
            a = { reactors: new Set(), mine: false, my_id: undefined };
            map.set(emoji, a);
        }
        return a;
    };
    // Seed every real comment so a childless, un-reacted comment still reports zeros.
    for (const it of reals) if (!it.getReactionEmoji()) ensure(it.get('id'));

    for (const it of reals) {
        const info = parents.get(it.get('id'));
        const emoji = it.getReactionEmoji();
        if (emoji) {
            // A reaction belongs to exactly one target; an orphan reaction (whose
            // target isn't loaded), or one aimed at a non-comment, is counted nowhere.
            if (info.orphan) continue;
            const target = info.parent === null ? post_reactions : agg.get(info.parent)?.reactions;
            if (!target) continue;
            const a = bucket(target, emoji);
            a.reactors.add(reactorKey(it));
            if (it.get('is_mine')) {
                a.mine = true;
                a.my_id = it.get('id');
            }
        } else {
            // Every real comment counts toward the thread total, orphans included;
            // only a resolved, non-orphan parent gets a reply credited to it.
            comment_count++;
            if (!info.orphan && info.parent !== null && agg.has(info.parent)) {
                agg.get(info.parent).reply_count++;
            }
        }
    }

    const byComment = new Map();
    for (const [id, a] of agg) {
        byComment.set(id, { reply_count: a.reply_count, ...summariseReactions(a.reactions) });
    }
    return {
        post: { comment_count, ...summariseReactions(post_reactions) },
        byComment,
    };
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
