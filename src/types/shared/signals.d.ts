/**
 * Mirror a model attribute (or `computed` key) as a `Signal.State`.
 * Reading the returned signal inside a Lit `watch()` directive auto-tracks it,
 * so only the binding that reads it updates when `change:<key>` fires.
 * Works for computed keys too, since they also emit `change:<computedKey>`.
 * @param {import('@converse/skeletor').Model} model
 * @param {string} key - The attribute (or computed) key to mirror
 * @returns {import('@lit-labs/signals').Signal.State<any>}
 */
export function attrSignal(model: import("@converse/skeletor").Model, key: string): import("@lit-labs/signals").Signal.State<any>;
/**
 * Mirror a collection's membership as a `Signal.State` snapshot of its models.
 * The snapshot is replaced with a fresh array on every add/remove/reset/sort,
 * so Lit re-renders the parts of the template that read it.
 * @param {import('@converse/skeletor').Collection} collection
 * @returns {import('@lit-labs/signals').Signal.State<import('@converse/skeletor').Model[]>}
 */
export function collectionSignal(collection: import("@converse/skeletor").Collection): import("@lit-labs/signals").Signal.State<import("@converse/skeletor").Model[]>;
/**
 * Merge the child collections of every model in a parent collection into one
 * (optionally sorted) `Signal.Computed` snapshot (e.g. a single timeline
 * aggregated from many feeds).
 *
 * The computed reads `collectionSignal(parent)` plus, for each parent model,
 * `collectionSignal(childAccessor(model))`. Because every one of those reads is
 * auto-tracked, the aggregate recomputes when the parent gains or loses a model
 * AND when any child collection changes. No manual subscription bookkeeping.
 *
 * Memoized per parent collection: the first call binds `childAccessor` and
 * `comparator` for that parent (one aggregate view per parent collection),
 * mirroring how {@link collectionSignal} memoizes per collection.
 * @param {import('@converse/skeletor').Collection} parent
 * @param {(model: import('@converse/skeletor').Model) => import('@converse/skeletor').Collection} childAccessor
 * @param {(a: import('@converse/skeletor').Model, b: import('@converse/skeletor').Model) => number} [comparator]
 * @returns {import('@lit-labs/signals').Signal.Computed<import('@converse/skeletor').Model[]>}
 */
export function aggregatedCollectionSignal(parent: import("@converse/skeletor").Collection, childAccessor: (model: import("@converse/skeletor").Model) => import("@converse/skeletor").Collection, comparator?: (a: import("@converse/skeletor").Model, b: import("@converse/skeletor").Model) => number): import("@lit-labs/signals").Signal.Computed<import("@converse/skeletor").Model[]>;
//# sourceMappingURL=signals.d.ts.map