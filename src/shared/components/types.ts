import { CustomElement } from './element.js';

export type ObservableProperty = 'once' | 'always' | null;

// Represents the class that will be extended via a mixin.
type Constructor<T = {}> = new (...args: any[]) => T;

export type CustomElementExtender = Constructor<CustomElement>;
