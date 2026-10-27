/**
 * Adds a messages collection to a model and various methods related to sending
 * and receiving chat messages.
 *
 * This model should be UX-agnostic, except when it comes to the rendering of
 * messages. So there's no assumption of uniformity with regards to UI elements
 * represented by this object.
 *
 * @template {import('./types').ModelExtender} T
 * @param {T} BaseModel
 * @returns {T & import('./types').Constructor<import('./types').MessagesAware>}
 */
export default function ModelWithMessages<T extends import("./types").ModelExtender>(BaseModel: T): T & import("./types").Constructor<import("./types").MessagesAware>;
//# sourceMappingURL=model-with-messages.d.ts.map