import { Model } from '@converse/skeletor';

// Types for mixins.
// -----------------

// Represents the class that will be extended via a mixin.
type Constructor<T = {}> = new (...args: any[]) => T;

export type ModelExtender = Constructor<Model>;
