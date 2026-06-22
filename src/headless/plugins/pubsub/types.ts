import { RSMQueryOptions } from 'shared/types';

export type PubSubConfigOptions = {
    access_model?: 'authorize' | 'open' | 'presence' | 'roster' | 'whitelist';
    // Payload XSLT
    dataform_xslt?: string;
    deliver_notifications?: boolean;
    // Whether to deliver payloads with event notifications
    deliver_payloads?: boolean;
    // Time after which to automatically purge items. `max` for no specific limit other than a server imposed maximum.
    item_expire?: string;
    // Max # of items to persist. `max` for no specific limit other than a server imposed maximum.
    max_items?: string;
    // Max Payload size in bytes
    max_payload_size?: string;
    notification_type?: 'normal' | 'headline';
    // Notify subscribers when the node configuration changes
    notify_config?: boolean;
    // Notify subscribers when the node is deleted
    notify_delete?: boolean;
    // Notify subscribers when items are removed from the node
    notify_retract?: boolean;
    // <field var='notify_sub' type='boolean'
    notify_sub?: boolean;
    // <field var='persist_items' type='boolean'
    persist_items?: boolean;
    // Deliver event notifications only to available users
    presence_based_delivery?: boolean;
    publish_model?: 'publishers' | 'subscribers' | 'open';
    // Purge all items when the relevant publisher goes offline?
    purge_offline?: boolean;
    roster_groups_allowed?: string[];
    // When to send the last published item
    // - Never
    // - When a new subscription is processed
    // - When a new subscription is processed and whenever a subscriber comes online
    send_last_published_item?: 'never' | 'on_sub' | 'on_sub_and_presence';
    // Whether to allow subscriptions
    subscribe?: boolean;
    // A friendly name for the node'/>
    title?: string;
    // Specify the semantic type of payload data to be provided at this node.
    type?: string;
};

export type PubSubSubscription = {
    node: string;
    jid: string;
    subscription: 'subscribed' | 'unconfigured';
    subid?: string;
};

export type PubSubItemsOptions = {
    // Restrict the result to the N most recent items.
    max_items?: number;
    // Request specific item ids instead of all items.
    item_ids?: string[];
    // Page through large result sets via XEP-0059 Result Set Management.
    rsm?: RSMQueryOptions;
};

export type PubSubItemsResult = {
    // The `<item/>` elements returned by the node (each wraps its payload).
    items: Element[];
    // RSM result for paging, present when the service includes a `<set/>` element.
    rsm?: import('../../shared/rsm.js').RSM;
};
