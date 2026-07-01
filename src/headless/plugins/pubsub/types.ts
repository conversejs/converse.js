import { RSMQueryOptions } from 'shared/types';

export type PubSubConfigOptions = {
    access_model?: 'authorize' | 'open' | 'presence' | 'roster' | 'whitelist';
    dataform_xslt?: string; // Payload XSLT
    deliver_notifications?: boolean;
    deliver_payloads?: boolean; // Whether to deliver payloads with event notifications
    item_expire?: string; // Time after which to auto-purge items. `max` for no limit other than a server imposed max
    max_items?: string; // Max # of items to persist. `max` for no specific limit other than a server imposed max
    max_payload_size?: string; // Max Payload size in bytes
    notification_type?: 'normal' | 'headline';
    notify_config?: boolean; // Notify subscribers when the node config changes
    notify_delete?: boolean; // Notify subscribers when the node is deleted
    notify_retract?: boolean; // Notify subscribers when items are removed from the node
    notify_sub?: boolean;
    persist_items?: boolean;
    presence_based_delivery?: boolean; // Deliver event notifications only to available users
    publish_model?: 'publishers' | 'subscribers' | 'open';
    purge_offline?: boolean; // Purge all items when the relevant publisher goes offline?
    roster_groups_allowed?: string[];
    // When to send the last published item
    // - Never
    // - When a new subscription is processed
    // - When a new subscription is processed and whenever a subscriber comes online
    send_last_published_item?: 'never' | 'on_sub' | 'on_sub_and_presence';
    subscribe?: boolean; // Whether to allow subscriptions
    title?: string; // A friendly name for the node'/>
    type?: string; // Specify the semantic type of payload data to be provided at this node.
};

export type PubSubSubscription = {
    node: string;
    jid: string;
    subscription: 'subscribed' | 'unconfigured';
    subid?: string;
};

export type PubSubItemsOptions = {
    max_items?: number; // Restrict the result to the N most recent items.
    item_ids?: string[]; // Request specific item ids instead of all items.
    rsm?: RSMQueryOptions; // Page through large result sets via XEP-0059 Result Set Management.
    timeout?: number; // Override the IQ timeout (ms). Defaults to `stanza_timeout` setting.
};

export type PubSubItemsResult = {
    items: Element[]; // The `<item/>` elements returned by the node (each wraps its payload).
    rsm?: import('../../shared/rsm.js').RSM; // RSM for paging, present when service includes a `<set/>` element
};
