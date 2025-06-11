import { CustomElement } from './element.js';
export type ObservableProperty = 'once' | 'always' | null;
type Constructor<T = {}> = new (...args: any[]) => T;
export type CustomElementExtender = Constructor<CustomElement>;
export {};
//# sourceMappingURL=types.d.ts.map