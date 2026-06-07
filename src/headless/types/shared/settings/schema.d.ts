/**
 * Wraps a plain coercion function as a minimal Standard Schema (v1) validator.
 *
 * This is the zero-dependency degenerate case of a schema: it only ever
 * transforms, never rejects. When richer validation is wanted, replace the
 * registry value with a real schema (e.g. a Valibot or Zod schema) — the
 * `~standard` shape is identical, so {@link normalizeSettings} keeps working.
 *
 * @param {(value: unknown) => unknown} fn
 * @returns {import('./types').StandardSchemaV1}
 */
export function coerce(fn: (value: unknown) => unknown): import("./types").StandardSchemaV1;
/**
 * Register (or override) the schema for a setting. This is the seam through
 * which `api.settings.extend` can eventually let plugins declare validation for
 * their own settings.
 * @param {string} key
 * @param {import('./types').StandardSchemaV1} schema
 */
export function registerSettingSchema(key: string, schema: import("./types").StandardSchemaV1): void;
/**
 * Return a copy of `attrs` with each value passed through its registered schema.
 * Keys without a registered schema pass through untouched.
 * @param {Record<string, any>} attrs
 * @returns {Record<string, any>}
 */
export function normalizeSettings(attrs: Record<string, any>): Record<string, any>;
//# sourceMappingURL=schema.d.ts.map