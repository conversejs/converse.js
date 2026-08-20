import { Collection, Model } from '@converse/skeletor';
import { aggregatedCollectionSignal, attrSignal, collectionSignal } from '../signals.js';

describe('The signals adapter', function () {
    it('mirrors a model attribute as a signal that updates on change', function () {
        const model = new Model({ name: 'Romeo' });
        const name = attrSignal(model, 'name');
        expect(name.get()).toBe('Romeo');
        model.set('name', 'Juliet');
        expect(name.get()).toBe('Juliet');
    });

    it('memoizes the signal per (model, key)', function () {
        const model = new Model({ name: 'Romeo' });
        expect(attrSignal(model, 'name')).toBe(attrSignal(model, 'name'));
    });

    it('mirrors a collection membership snapshot that updates on add/remove', function () {
        const collection = new Collection();
        const models = collectionSignal(collection);
        expect(models.get().length).toBe(0);

        const added = collection.add({ id: 'a' });
        expect(models.get().length).toBe(1);
        expect(models.get()[0]).toBe(added);

        collection.remove(added);
        expect(models.get().length).toBe(0);
    });

    it('memoizes the signal per collection', function () {
        const collection = new Collection();
        expect(collectionSignal(collection)).toBe(collectionSignal(collection));
    });

    it('merges the child collections of a parent into one sorted snapshot', function () {
        const parent = new Collection();
        const a = new Model({ id: 'a' });
        a.messages = new Collection();
        const b = new Model({ id: 'b' });
        b.messages = new Collection();
        parent.add([a, b]);
        a.messages.add({ id: 'a1', time: 3 });
        b.messages.add({ id: 'b1', time: 1 });

        const byTimeDesc = (x, y) => y.get('time') - x.get('time');
        const posts = aggregatedCollectionSignal(parent, (m) => m.messages, byTimeDesc);
        expect(posts.get().map((m) => m.get('id'))).toEqual(['a1', 'b1']);

        // A new post in any child updates the aggregate (and re-sorts).
        b.messages.add({ id: 'b2', time: 5 });
        expect(posts.get().map((m) => m.get('id'))).toEqual(['b2', 'a1', 'b1']);

        // Adding a new feed (parent member) folds its posts in too.
        const c = new Model({ id: 'c' });
        c.messages = new Collection();
        parent.add(c);
        c.messages.add({ id: 'c1', time: 4 });
        expect(posts.get().map((m) => m.get('id'))).toEqual(['b2', 'c1', 'a1', 'b1']);

        // Removing a feed drops its posts from the aggregate.
        parent.remove(a);
        expect(posts.get().map((m) => m.get('id'))).toEqual(['b2', 'c1', 'b1']);
    });

    it('memoizes the aggregate signal per parent collection', function () {
        const parent = new Collection();
        const accessor = (m) => m.messages;
        expect(aggregatedCollectionSignal(parent, accessor)).toBe(aggregatedCollectionSignal(parent, accessor));
    });
});
