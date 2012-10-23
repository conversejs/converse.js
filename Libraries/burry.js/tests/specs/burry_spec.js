(function (Burry) {

    describe('burry.js Storage', function () {

        afterEach(function () {
            localStorage.clear();
        });

        describe('Static methods', function () {

            it('returns the stores that have been created', function () {
                var burryfoo, burrybar;
                burryfoo = new Burry.Store('foo');
                burrybar = new Burry.Store('bar');
                burrybar2 = new Burry.Store('bar');
                expect(Burry.stores()).toEqual(['', 'foo', 'bar']);
            });

            it('calculates time elapsed since epoch in minutues', function () {
                var datea = new Date(10 * 60 * 1000);
                spyOn(window, 'Date').andReturn(datea);
                expect(Burry._mEpoch()).toEqual(10);
            });

            it('supports localStorage', function () {
                expect(Burry.isSupported()).toBeTruthy();
            });

            it('flushes expired key/values from all stores', function () {
                burryfoo = new Burry.Store('foo');
                burrybar = new Burry.Store('bar');
                burryfoo.set('expired1', {foo: 'bar'}, -1);
                burryfoo.set('expired2', {foo: 'bar'}, -2);
                burryfoo.set('not-expired', {foo: 'bar'}, 10);
                burrybar.set('expired1', {foo: 'bar'}, -1);
                burrybar.set('expired2', {foo: 'bar'}, -2);
                burrybar.set('not-expired', {foo: 'bar'}, 10);
                Burry.flushExpired();
                expect(localStorage.getItem(burryfoo._internalKey('expired1'))).toBeNull();
                expect(localStorage.getItem(burryfoo._expirationKey('expired1'))).toBeNull();
                expect(localStorage.getItem(burryfoo._internalKey('expired2'))).toBeNull();
                expect(localStorage.getItem(burryfoo._expirationKey('expired2'))).toBeNull();
                expect(burryfoo.get('not-expired')).toBeDefined();
                expect(localStorage.getItem(burrybar._internalKey('expired1'))).toBeNull();
                expect(localStorage.getItem(burrybar._expirationKey('expired1'))).toBeNull();
                expect(localStorage.getItem(burrybar._internalKey('expired2'))).toBeNull();
                expect(localStorage.getItem(burrybar._expirationKey('expired2'))).toBeNull();
                expect(burrybar.get('not-expired')).toBeDefined();

            });
        });

        describe('Instance methods', function () {

            var burry;

            beforeEach(function () {
                burry = new Burry.Store('');
            });

            it('allows to set a default ttl', function () {
                burry = new Burry.Store('', 10);
                burry.set('akey', {foo: 'bar'});
                expect(localStorage.getItem('akey-_burry_')).toEqual('{"foo":"bar"}');
                expect(parseInt(localStorage.getItem('akey-_burry_exp_'), 10)).toEqual(Burry._mEpoch() + 10);
            });

            it('calculates the key used internally', function () {
                expect(burry._internalKey('akey')).toEqual('akey-_burry_');
            });

            it('calculates the expiration key used internally', function () {
                expect(burry._expirationKey(12345)).toEqual('12345-_burry_exp_');
            });

            it('decides whether a key is a "burry" key', function () {
                expect(burry._isInternalKey('foo-_burry_')).toEqual('foo');
                expect(burry._isInternalKey('foo-_burry_bar')).toBeFalsy();
            });

            it('decides whether a key is a "burry" expiration key', function () {
                expect(burry._isExpirationKey('foo-_burry_exp_')).toEqual('foo');
                expect(burry._isExpirationKey('foo-_burry_exp_bar')).toBeFalsy();
            });

            it('applies correctly the namespace on the keys on construction', function () {
                var nsburry = new Burry.Store('testing');
                expect(nsburry._isInternalKey('foo-_burry_testing')).toEqual('foo');
                expect(nsburry._isInternalKey('foo-_burry_')).toBeFalsy();
                expect(nsburry._isExpirationKey('foo-_burry_exp_testing')).toEqual('foo');
                expect(nsburry._isExpirationKey('foo-_burry_exp_')).toBeFalsy();
            });

            it('stores a key/value to localStorage', function () {
                burry.set('akey', {foo: 'bar'});
                expect(localStorage.getItem('akey-_burry_')).toEqual('{"foo":"bar"}');
            });

            it('stores a key/value to localStorage with an expiration time', function () {
                burry.set('akey', {foo: 'bar'}, 10);
                expect(localStorage.getItem('akey-_burry_')).toEqual('{"foo":"bar"}');
                expect(parseInt(localStorage.getItem('akey-_burry_exp_'), 10)).toEqual(Burry._mEpoch() + 10);
            });

            it('returns the value from a stored key', function () {
                burry.set('akey', {foo: 'bar'});
                expect(burry.get('akey')).toEqual({foo: 'bar'});
            });

            it('returns undefined for a non-existing key', function () {
                expect(burry.get('akey')).toBeUndefined();
            });

            it('returns undefined for an expired key, and removes it from localStorage', function () {
                burry.set('akey', {foo: 'bar'}, -1);
                expect(localStorage.getItem('akey-_burry_')).toEqual('{"foo":"bar"}');
                expect(parseInt(localStorage.getItem('akey-_burry_exp_'), 10)).toEqual(Burry._mEpoch() - 1);
                expect(burry.get('akey')).toBeUndefined();
                expect(localStorage.getItem('akey-_burry_')).toBeNull();
                expect(localStorage.getItem('akey-_burry_exp_')).toBeNull();
                expect(burry.get('akey')).toBeUndefined();
            });

            it('adds a key/value when the key does not already exist or has expired', function () {
                burry.set('akey', {foo: 'bar'});
                burry.add('akey', {bar: 'foo'});
                expect(burry.get('akey')).toEqual({foo: 'bar'});
                burry.add('otherkey', {foo: 'bar'});
                expect(burry.get('otherkey')).toEqual({foo: 'bar'});
                burry.set('akey', {foo: 'bar'}, -10);
                burry.add('akey', {bar: 'foo'});
                expect(burry.get('akey')).toEqual({bar: 'foo'});
            });

            it('replaces a key/value only when the key already exists and has not expired', function () {
                burry.set('akey', {foo: 'bar'});
                burry.replace('akey', {bar: 'foo'});
                expect(burry.get('akey')).toEqual({bar: 'foo'});
                burry.replace('otherkey', {foo: 'bar'});
                expect(burry.get('otherkey')).not.toBeDefined();
                burry.set('akey', {foo: 'bar'}, -10);
                burry.replace('akey', {bar: 'foo'});
                expect(burry.get('akey')).not.toBeDefined();
            });

            it('removes a key/value', function () {
                burry.set('akey', {foo: 'bar'});
                burry.remove('akey');
                expect(burry.get('akey')).toBeUndefined();
                expect(localStorage.getItem('akey-_burry_')).toBeNull();
                expect(localStorage.getItem('akey-_burry_exp_')).toBeNull();
            });

            it('increments a counter', function () {
                burry.incr('counter');
                expect(burry.get('counter')).toEqual(1);
                burry.set('counter', 0);
                burry.incr('counter');
                burry.incr('counter');
                expect(burry.get('counter')).toEqual(2);
            });

            it('decrements a counter', function () {
                burry.decr('counter');
                expect(burry.get('counter')).toEqual(-1);
                burry.set('counter', 0);
                burry.decr('counter');
                burry.decr('counter');
                expect(burry.get('counter')).toEqual(-2);
            });

            it('determines if an item has expired', function () {
                burry.set('akey', {foo: 'bar'});
                expect(burry.hasExpired('akey')).toBeFalsy();
                burry.set('akey', {foo: 'bar'}, 10);
                expect(burry.hasExpired('akey')).toBeFalsy();
                burry.set('akey', {foo: 'bar'}, -10);
                expect(burry.hasExpired('akey')).toBeTruthy();
            });

            it('returns all cache keys', function () {
                var keys;
                burry.set('expirable1', {foo: 'bar'}, 10);
                burry.set('expirable2', {foo: 'bar'}, -20);
                burry.set('non-expirable', {foo: 'bar'});
                expect(burry.keys().indexOf('expirable1')).not.toEqual(-1);
                expect(burry.keys().indexOf('expirable2')).not.toEqual(-1);
                expect(burry.keys().indexOf('non-expirable')).not.toEqual(-1);

            });

            it('returns all expirable keys', function () {
                var expirable, fakedate = new Date(0);
                spyOn(window, 'Date').andReturn(fakedate);
                burry.set('expirable1', {foo: 'bar'}, 10);
                burry.set('expirable2', {foo: 'bar'}, 20);
                burry.set('non-expirable', {foo: 'bar'});
                expect(burry.expirableKeys()).toEqual({expirable1: 10, expirable2: 20});
            });

            it('flushes all Burry items', function () {
                burry.set('expirable2', {foo: 'bar'}, 20);
                burry.set('non-expirable', {foo: 'bar'});
                localStorage.setItem('foo', 'bar');
                burry.flush();
                expect(localStorage.length).toEqual(2);
                expect(localStorage.key(0)).toEqual('_burry_stores_');
                expect(localStorage.key(1)).toEqual('foo');
            });

            it('flushes expired key/values', function () {
                burry.set('expired1', {foo: 'bar'}, -1);
                burry.set('expired2', {foo: 'bar'}, -2);
                burry.set('not-expired', {foo: 'bar'}, 10);
                burry.flushExpired();
                expect(localStorage.getItem(burry._internalKey('expired1'))).toBeNull();
                expect(localStorage.getItem(burry._expirationKey('expired1'))).toBeNull();
                expect(localStorage.getItem(burry._internalKey('expired2'))).toBeNull();
                expect(localStorage.getItem(burry._expirationKey('expired2'))).toBeNull();
                expect(burry.get('not-expired')).toBeDefined();
            });

            it('removes expired objects when setting a value that does not fit in localStorage', function () {
                var biggie = Array(1024*1024 + 1).join('0'),
                    key = '';
                while (true) {
                    try {
                        key += 'key';
                        localStorage.setItem(burry._internalKey(key), JSON.stringify(biggie));
                        localStorage.setItem(burry._expirationKey(key), '0');
                    } catch (e) {
                        // The storage is now full.
                        break;
                    }
                }
                expect(localStorage.length > 0).toBeTruthy();
                burry.set('biggie', biggie);
                    expect(localStorage.length).toEqual(2);
                expect(burry.get('biggie')).toEqual(biggie);
            });
        });
    });

})(this.Burry);