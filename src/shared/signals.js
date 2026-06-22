/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * @description
 * A small bridge between Skeletor's reactive Models/Collections and TC39
 * Signals, so that Lit components using `@lit-labs/signals` can track Skeletor
 * state with fine-grained, auto-tracked reactivity instead of re-rendering the
 * whole component on every change.
 */
import { Signal } from '@lit-labs/signals';

// Memoize signals per (model, key) and per collection so multiple components
// bridging the same state don't create duplicate signals and listeners. The
// WeakMap keys let the signals (and their model listeners) be reclaimed once
// the model/collection is gone.
const attr_signals = new WeakMap(); // Model -> Map<string, Signal.State>
const collection_signals = new WeakMap(); // Collection -> Signal.State

/**
 * Mirror a model attribute (or `computed` key) as a `Signal.State`.
 * Reading the returned signal inside a Lit `watch()` directive auto-tracks it,
 * so only the binding that reads it updates when `change:<key>` fires.
 * Works for computed keys too, since they also emit `change:<computedKey>`.
 * @param {import('@converse/skeletor').Model} model
 * @param {string} key - The attribute (or computed) key to mirror
 * @returns {import('@lit-labs/signals').Signal.State<any>}
 */
export function attrSignal(model, key) {
    let map = attr_signals.get(model);
    if (!map) {
        map = new Map();
        attr_signals.set(model, map);
    }
    let signal = map.get(key);
    if (!signal) {
        signal = new Signal.State(model.get(key));
        model.on(`change:${key}`, () => signal.set(model.get(key)));
        map.set(key, signal);
    }
    return signal;
}

/**
 * Mirror a collection's membership as a `Signal.State` snapshot of its models.
 * The snapshot is replaced with a fresh array on every add/remove/reset/sort,
 * so Lit re-renders the parts of the template that read it.
 * @param {import('@converse/skeletor').Collection} collection
 * @returns {import('@lit-labs/signals').Signal.State<import('@converse/skeletor').Model[]>}
 */
export function collectionSignal(collection) {
    let signal = collection_signals.get(collection);
    if (!signal) {
        signal = new Signal.State([...collection.models]);
        // `subscribe` fires once per add/remove/reset/sort (not per model).
        collection.subscribe(() => signal.set([...collection.models]));
        collection_signals.set(collection, signal);
    }
    return signal;
}
