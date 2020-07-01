import { _converse } from "@converse/headless/converse-core";

const registry = {};

function define (componentName, componentClass) {
    this.registry[componentName] = componentClass;
}

function register () {
    Object.keys(registry).map(componentName =>
        window.customElements.define(componentName, registry[componentName])
    );
}

_converse.api.elements = {
    registry,
    define,
    register
}
