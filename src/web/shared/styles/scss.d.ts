// Stylesheets are imported for their side effect (the bundler emits the CSS).
// TypeScript's `noUncheckedSideEffectImports` needs a module declaration for them.
declare module '*.scss';
