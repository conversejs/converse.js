import { CustomElement } from './element.js';

export type ObservableProperty = 'once' | 'always' | null;

// Represents the class that will be extended via a mixin.
type Constructor<T = {}> = new (...args: any[]) => T;

export type CustomElementExtender = Constructor<CustomElement>;

export type ResizablePair = {
    a: 0 | 1;
    b: 0 | 1;
    direction: 'horizontal' | 'vertical';
    dragging: boolean;
    aMin: number;
    bMin: number;
    dragOffset: number;
    size: number;
    start: number;
    end: number;
    gutter: HTMLElement;
    parent: HTMLElement;
    stop: (this: Window, ev: Event) => any;
    move: (this: Window, ev: Event) => any;
};

export type ResizableElement = {
    element: HTMLElement;
    size: number;
    maxSize: number;
    minSize: number;
    snapOffset: number;
    i: number;
};
