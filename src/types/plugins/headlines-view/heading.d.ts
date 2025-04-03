export default class HeadlinesHeading extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    initialize(): Promise<void>;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * Returns a list of objects which represent buttons for the headlines header.
     * @async
     * @emits _converse#getHeadingButtons
     * @method HeadlinesHeading#getHeadingButtons
     */
    getHeadingButtons(): any;
    close(ev: any): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=heading.d.ts.map