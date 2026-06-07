import log from '@converse/log';

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
export function coerce(fn) {
    return {
        '~standard': {
            version: 1,
            vendor: 'converse',
            validate: (value) => ({ value: fn(value) }),
        },
    };
}

const stripTrailingSlashes = (v) => (typeof v === 'string' ? v.replace(/\/+$/, '') : v);

/**
 * Registry of per-setting schemas, keyed by setting name. Values are Standard
 * Schema (v1) compliant. Normalizing at the point settings are *written* (rather
 * than read) means every consumer — and every future consumer — sees an
 * already-normalized value.
 * @type {Map<string, import('./types').StandardSchemaV1>}
 */
const SETTING_SCHEMAS = new Map([
    ['assets_path', coerce(stripTrailingSlashes)],
]);

/**
 * Register (or override) the schema for a setting. This is the seam through
 * which `api.settings.extend` can eventually let plugins declare validation for
 * their own settings.
 * @param {string} key
 * @param {import('./types').StandardSchemaV1} schema
 */
export function registerSettingSchema(key, schema) {
    SETTING_SCHEMAS.set(key, schema);
}

/**
 * Validate/coerce a single value against its registered schema. Returns the
 * value unchanged when no schema is registered for the key.
 *
 * Settings normalization is synchronous, so async Standard Schema validators are
 * unsupported: their (pending) result is ignored and the original value is
 * passed through with a warning.
 * @param {string} key
 * @param {unknown} value
 * @returns {*}
 */
function normalizeSetting(key, value) {
    const schema = SETTING_SCHEMAS.get(key);
    if (!schema) return value;

    const result = schema['~standard'].validate(value);
    if (result instanceof Promise) {
        log.warn(`Ignoring async schema for setting "${key}"; settings validation is synchronous.`);
        return value;
    }
    if (result.issues?.length) {
        log.warn(`Invalid value for setting "${key}": ${result.issues.map((i) => i.message).join(', ')}`);
        return value;
    }
    return result.value;
}

/**
 * Return a copy of `attrs` with each value passed through its registered schema.
 * Keys without a registered schema pass through untouched.
 * @param {Record<string, any>} attrs
 * @returns {Record<string, any>}
 */
export function normalizeSettings(attrs) {
    const out = { ...attrs };
    for (const key of Object.keys(out)) {
        out[key] = normalizeSetting(key, out[key]);
    }
    return out;
}
