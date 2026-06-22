import { Collection, Model } from '@converse/skeletor';
import { attrSignal, collectionSignal } from '../signals.js';

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
});
