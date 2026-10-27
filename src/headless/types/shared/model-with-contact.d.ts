/**
 * @template {import('./types').ModelExtender} T
 * @param {T} BaseModel
 * @returns {T & import('./types').Constructor<import('./types').ContactAware>}
 */
export default function ModelWithContact<T extends import("./types").ModelExtender>(BaseModel: T): T & import("./types").Constructor<import("./types").ContactAware>;
//# sourceMappingURL=model-with-contact.d.ts.map