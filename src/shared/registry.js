import { api } from "@converse/headless/core";

const registry = {};

function define (name, constructor) {
    this.registry[name] = constructor;
}

function register () {
    Object.keys(registry).forEach(name => {
        if (!customElements.get(name)) {
            customElements.define(name, registry[name])
        }
    });
}

api.elements = {
    registry,
    define,
    register
}
