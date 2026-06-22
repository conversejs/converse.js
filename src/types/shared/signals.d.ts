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
//# sourceMappingURL=signals.d.ts.map