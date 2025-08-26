# TODO Plugin Implementation Plan

This document outlines the step-by-step plan to add multi-list TODO functionality using XEP-0060 PubSub. Each step can be checked off as it’s implemented.

- [x] 1. Add `api.disco.entities.find(feature)` in `src/headless/plugins/disco/api.js` to lookup JIDs advertising a feature.  
- [x] 2. In `src/headless/plugins/pubsub/api.js`, add `pubsub.subscribe(jid, node)` and `pubsub.unsubscribe(jid, node)`
- [ ] 3. Modify `src/plugins/todo/plugin.js` to:  
  - [ ] Discovers the PubSub service JID via `api.disco.entities.find('http://jabber.org/protocol/pubsub')`.  
  - [ ] Subscribes to the master index node `urn:conversejs:todolists:1`.  
  - [ ] Listens for item-add and item-delete events to track available TODO lists.  
- [ ] 4. For each index entry, subscribe/unsubscribe to its list node and:  
  - [ ] Fetch existing items via `api.pubsub.items(serviceJid, node)`.  
  - [ ] Emit high-level events for list item additions/removals.  
- [ ] 5. Implement payload parsing/serialization in PEP Bookmarks style (XEP-0402) or JSON inside `<item>` payloads.  
- [ ] 6. Expose CRUD methods on `api.apps.todo`:  
  - [ ] `listLists(): Promise<Array<{ node, title }>>`  
  - [ ] `createList(node, title): Promise<void>`  
  - [ ] `deleteList(node): Promise<void>`  
  - [ ] `listItems(node): Promise<Item[]>`  
  - [ ] `addItem(node, data): Promise<void>`  
  - [ ] `removeItem(node, id): Promise<void>`  
- [ ] 7. Maintain internal state of lists/items and fire events via `api.emit('todo:lists', lists)` and `api.emit('todo:items', node, items)`.  
- [ ] 8. Write tests for:  
  - [x] `api.disco.entities.find`  
  - [x] `api.pubsub.subscribe/unsubscribe`  
  - [ ] Index module behavior  
  - [ ] CRUD API methods  
- [ ] 9. Update documentation in `src/plugins/todo/README.md` and project docs.

Once all items are checked, the multi-list TODO plugin will support dynamic discovery, subscription, and management of multiple TODO lists via XMPP PubSub.  

---

When adding a new TODO list, let the user enter a name for the list.

Then, upon submission, automatically look for a pubsub service on the user's domain.
If none is found, return to the form with a new input to let the user specify a PubSub service.
