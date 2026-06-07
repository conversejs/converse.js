/**
 * A minimal subset of the Standard Schema (v1) interface.
 * @see https://standardschema.dev
 *
 * Validation libraries such as Zod, Valibot and ArkType all expose this same
 * `~standard` property, which means a value held in the settings schema registry
 * can later be swapped from a lightweight `coerce` wrapper to a full schema
 * without changing any call site.
 */
export type StandardIssue = {
    message: string;
};
export type StandardResult = {
    value?: unknown;
    issues?: ReadonlyArray<StandardIssue>;
};
export type StandardSchemaProps = {
    version: 1;
    vendor: string;
    validate: (value: unknown) => StandardResult | Promise<StandardResult>;
};
export type StandardSchemaV1 = {
    '~standard': StandardSchemaProps;
};
//# sourceMappingURL=types.d.ts.map