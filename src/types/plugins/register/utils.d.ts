export function setActiveForm(value: any): Promise<void>;
export function routeToForm(event: any): void;
/**
 * Fetches the list of XMPP providers from the configured URL.
 * The list is cached after the first successful fetch.
 * @returns {Promise<import('./types.ts').XMPPProvider[]>} - Array of provider objects
 */
export function fetchXMPPProviders(): Promise<import("./types.ts").XMPPProvider[]>;
//# sourceMappingURL=utils.d.ts.map