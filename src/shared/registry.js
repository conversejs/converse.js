import api from "@converse/headless/shared/api/index.js";

const registry = {};

/**
 * The "elements" namespace groups methods relevant to registering custom
 * HTML elements.
 * @namespace api.elements
 * @memberOf api
 */
api.elements = {
    registry,

    /**
     * Defines a new custom HTML element.
     *
     * By using this API instead of `customElements.define` from the DOM,
     * we can allow custom elements to be overwritten.
     *
     * Once `converse.initialize()` is called, `api.elements.register()`
     * will get called and all custom elements will be registered to the DOM,
     * from which point onward they cannot be overwritten.
     *
     * @method api.elements.define
     * @param { string } name
     * @param { object } constructor
     */
    define (name, constructor) {
        this.registry[name] = constructor;
    },

    /**
     * Registers all previously defined custom HTML elements
     * @method api.elements.register
     */
    register () {
        Object.keys(registry).forEach(name => {
            if (!customElements.get(name)) {
                customElements.define(name, registry[name])
            }
        });
    }
}
