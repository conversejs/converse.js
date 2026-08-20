export function getTheme(): any;
/**
 * Whether the theme currently in force is a dark one.
 *
 * A theme answers this for itself, by declaring the standard `color-scheme`
 * property in the same CSS rule that carries its colors.
 *
 * A theme that declares nothing is taken to be light, which is what the
 * `color-scheme` initial value of `normal` means in practice.
 *
 * @param {Element} [el] - The element to resolve the theme against. Any
 *  element inside `converse-root` will do, since `color-scheme` inherits;
 *  defaults to `converse-root` itself.
 * @returns {boolean}
 */
export function isDarkTheme(el?: Element): boolean;
export function ensureElement(): void;
//# sourceMappingURL=utils.d.ts.map