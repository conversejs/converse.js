export default class Avatar extends ObservableElement {
    /**
     * @typedef {import('shared/components/types').ObservableProperty} ObservableProperty
     */
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        pickerdata: {
            type: ObjectConstructor;
        };
        name: {
            type: StringConstructor;
        };
        width: {
            type: StringConstructor;
        };
        height: {
            type: StringConstructor;
        };
        nonce: {
            type: StringConstructor;
        };
        observable: {
            type: StringConstructor;
        };
        intersectionRatio: {
            type: NumberConstructor;
        };
    };
    pickerdata: any;
    width: number;
    height: number;
    name: string;
    render(): import("lit-html").TemplateResult<1> | "";
    onVisibilityChanged(): void;
    /**
     * @param {string} name
     * @returns {string}
     */
    getInitials(name: string): string;
}
import { ObservableElement } from 'shared/components/observable.js';
//# sourceMappingURL=avatar.d.ts.map