/**
 * @template {import('./types').ModelExtender} T
 * @param {T} BaseModel
 * @returns {T & import('./types').Constructor<import('./types').VCardAware>}
 */
export default function ModelWithVCard<T extends import("./types").ModelExtender>(BaseModel: T): T & import("./types").Constructor<import("./types").VCardAware>;
//# sourceMappingURL=model-with-vcard.d.ts.map