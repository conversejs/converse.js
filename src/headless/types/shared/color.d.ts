/**
 * @template {import('./types').ModelExtender} T
 * @param {T} BaseModel
 * @returns {T & import('./types').Constructor<import('./types').ColorAware>}
 */
export default function ColorAwareModel<T extends import("./types").ModelExtender>(BaseModel: T): T & import("./types").Constructor<import("./types").ColorAware>;
//# sourceMappingURL=color.d.ts.map