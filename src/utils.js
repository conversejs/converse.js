// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// This is the utilities module.
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, escape, locales, window, Jed */
(function (root, factory) {
    define([
        "sizzle",
        "es6-promise",
        "jquery.browser",
        "lodash.noconflict",
        "locales",
        "moment_with_locales",
        "strophe",
    ], factory);
}(this, function (
        sizzle,
        Promise,
        jQBrowser,
        _,
        locales,
        moment,
        Strophe
    ) {
    "use strict";
    locales = locales || {};
    const b64_sha1 = Strophe.SHA1.b64_sha1;
    Strophe = Strophe.Strophe;

    const URL_REGEX = /\b(https?:\/\/|www\.|https?:\/\/www\.)[^\s<>]{2,200}\b/g;

    const logger = _.assign({
        'debug': _.get(console, 'log') ? console.log.bind(console) : _.noop,
        'error': _.get(console, 'log') ? console.log.bind(console) : _.noop,
        'info': _.get(console, 'log') ? console.log.bind(console) : _.noop,
        'warn': _.get(console, 'log') ? console.log.bind(console) : _.noop
    }, console);

    var afterAnimationEnd = function (el, callback) {
        el.classList.remove('visible');
        if (_.isFunction(callback)) {
            callback();
        }
    };

    var unescapeHTML = function (htmlEscapedText) {
        /* Helper method that replace HTML-escaped symbols with equivalent characters
         * (e.g. transform occurrences of '&amp;' to '&')
         *
         * Parameters:
         *  (String) htmlEscapedText: a String containing the HTML-escaped symbols.
         */
        var div = document.createElement('div');
        div.innerHTML = htmlEscapedText;
        return div.innerText;
    };

    var isImage = function (url) {
        return new Promise((resolve, reject) => {
            var img = new Image();
            var timer = window.setTimeout(function () {
                reject(new Error("Could not determine whether it's an image"));
                img = null;
            }, 3000);
            img.onerror = img.onabort = function () {
                clearTimeout(timer);
                reject(new Error("Could not determine whether it's an image"));
            };
            img.onload = function () {
                clearTimeout(timer);
                resolve(img);
            };
            img.src = url;
        });
    };

    function calculateSlideStep (height) {
        if (height > 100) {
            return 10;
        } else if (height > 50) {
            return 5;
        } else {
            return 1;
        }
    }

    function calculateElementHeight (el) {
        /* Return the height of the passed in DOM element,
         * based on the heights of its children.
         */
        return _.reduce(
            el.children,
            (result, child) => result + child.offsetHeight, 0
        );
    }

    function slideOutWrapup (el) {
        /* Wrapup function for slideOut. */
        el.removeAttribute('data-slider-marker');
        el.classList.remove('collapsed');
        el.style.overflow = "";
        el.style.height = "";
    }


    var u = {};

    // Translation machinery
    // ---------------------
    u.__ = function (str) {
        if (_.isUndefined(window.Jed)) {
            return str;
        }
        if (!u.isConverseLocale(this.locale) || this.locale === 'en') {
            return Jed.sprintf.apply(window.Jed, arguments);
        }
        if (typeof this.jed === "undefined") {
            this.jed = new Jed(window.JSON.parse(locales[this.locale]));
        }
        var t = this.jed.translate(str);
        if (arguments.length>1) {
            return t.fetch.apply(t, [].slice.call(arguments,1));
        } else {
            return t.fetch();
        }
    };

    u.___ = function (str) {
        /* XXX: This is part of a hack to get gettext to scan strings to be
         * translated. Strings we cannot send to the function above because
         * they require variable interpolation and we don't yet have the
         * variables at scan time.
         *
         * See actionInfoMessages in src/converse-muc.js
         */
        return str;
    };

    u.isLocaleAvailable = function (locale, available) {
        /* Check whether the locale or sub locale (e.g. en-US, en) is supported.
         *
         * Parameters:
         *      (Function) available - returns a boolean indicating whether the locale is supported
         */
        if (available(locale)) {
            return locale;
        } else {
            var sublocale = locale.split("-")[0];
            if (sublocale !== locale && available(sublocale)) {
                return sublocale;
            }
        }
    };

    u.addHyperlinks = function (text) {
        const list = text.match(URL_REGEX) || [];
        var links = [];
        _.each(list, (match) => {
            const prot = match.indexOf('http://') === 0 || match.indexOf('https://') === 0 ? '' : 'http://';
            const url = prot + encodeURI(decodeURI(match)).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");
            const  a = '<a target="_blank" rel="noopener" href="' + url + '">'+ _.escape(match) + '</a>';
            // We first insert a hash of the code that will be inserted, and
            // then later replace that with the code itself. That way we avoid
            // issues when some matches are substrings of others.
            links.push(a);
            text = text.replace(match, b64_sha1(a));
        });
        while (links.length) {
            const a = links.pop();
            text = text.replace(b64_sha1(a), a);
        }
        return text;
    };

    u.renderImageURLs = function (obj) {
        const list = obj.textContent.match(URL_REGEX) || [];
        _.forEach(list, function (url) {
            isImage(url).then(function (img) {
                img.className = 'chat-image';
                var anchors = sizzle(`a[href="${url}"]`, obj);
                _.each(anchors, (a) => { a.innerHTML = img.outerHTML; });
            });
        });
        return obj;
    };

    u.slideInAllElements = function (elements) {
        return Promise.all(
            _.map(
                elements,
                _.partial(u.slideIn, _, 600)
            ));
    };

    u.slideToggleElement = function (el) {
        if (_.includes(el.classList, 'collapsed')) {
            return u.slideOut(el);
        } else {
            return u.slideIn(el);
        }
    };

    u.slideOut = function (el, duration=900) {
        /* Shows/expands an element by sliding it out of itself
         *
         * Parameters:
         *      (HTMLElement) el - The HTML string
         *      (Number) duration - The duration amount in milliseconds
         */
        return new Promise((resolve, reject) => {
            if (_.isNil(el)) {
                const err = "Undefined or null element passed into slideOut"
                logger.warn(err);
                reject(new Error(err));
                return;
            }
            let interval_marker = el.getAttribute('data-slider-marker');
            if (interval_marker) {
                el.removeAttribute('data-slider-marker');
                window.clearInterval(interval_marker);
            }
            const end_height = calculateElementHeight(el);
            if (window.converse_disable_effects) { // Effects are disabled (for tests)
                el.style.height = end_height + 'px';
                slideOutWrapup(el);
                resolve();
                return;
            }

            const step = calculateSlideStep(end_height),
                  interval = end_height/duration*step;
            let h = 0;

            interval_marker = window.setInterval(function () {
                h += step;
                if (h < end_height) {
                    el.style.height = h + 'px';
                } else {
                    // We recalculate the height to work around an apparent
                    // browser bug where browsers don't know the correct
                    // offsetHeight beforehand.
                    el.style.height = calculateElementHeight(el) + 'px';
                    window.clearInterval(interval_marker);
                    slideOutWrapup(el);
                    resolve();
                }
            }, interval);
            el.setAttribute('data-slider-marker', interval_marker);
        });
    };

    u.slideIn = function (el, duration=600) {
        /* Hides/collapses an element by sliding it into itself. */
        return new Promise((resolve, reject) => {
            if (_.isNil(el)) {
                const err = "Undefined or null element passed into slideIn";
                logger.warn(err);
                return reject(new Error(err));
            } else if (_.includes(el.classList, 'collapsed')) {
                return resolve();
            } else if (window.converse_disable_effects) { // Effects are disabled (for tests)
                el.classList.add('collapsed');
                el.style.height = "";
                return resolve();
            }
            let interval_marker = el.getAttribute('data-slider-marker');
            if (interval_marker) {
                el.removeAttribute('data-slider-marker');
                window.clearInterval(interval_marker);
            }
            let h = el.offsetHeight;
            const step = calculateSlideStep(h),
                  interval = h/duration*step;

            el.style.overflow = 'hidden';

            interval_marker = window.setInterval(function () {
                h -= step;
                if (h > 0) {
                    el.style.height = h + 'px';
                } else {
                    el.removeAttribute('data-slider-marker');
                    window.clearInterval(interval_marker);
                    el.classList.add('collapsed');
                    el.style.height = "";
                    resolve();
                }
            }, interval);
            el.setAttribute('data-slider-marker', interval_marker);
        });
    };

    u.fadeIn = function (el, callback) {
        if (_.isNil(el)) {
            logger.warn("Undefined or null element passed into fadeIn");
        }
        if (window.converse_disable_effects) { // Effects are disabled (for tests)
            el.classList.remove('hidden');
            if (_.isFunction(callback)) {
                callback();
            }
            return;
        }
        if (_.includes(el.classList, 'hidden')) {
            /* XXX: This doesn't appear to be working...
                el.addEventListener("webkitAnimationEnd", _.partial(afterAnimationEnd, el, callback), false);
                el.addEventListener("animationend", _.partial(afterAnimationEnd, el, callback), false);
            */
            setTimeout(_.partial(afterAnimationEnd, el, callback), 351);
            el.classList.add('visible');
            el.classList.remove('hidden');
        } else {
            afterAnimationEnd(el, callback);
        }
    };

    u.isSameBareJID = function (jid1, jid2) {
        return Strophe.getBareJidFromJid(jid1).toLowerCase() ===
                Strophe.getBareJidFromJid(jid2).toLowerCase();
    };

    u.isNewMessage = function (message) {
        /* Given a stanza, determine whether it's a new
         * message, i.e. not a MAM archived one.
         */
        if (message instanceof Element) {
            return !(sizzle('result[xmlns="'+Strophe.NS.MAM+'"]', message).length);
        } else {
            return !message.get('archive_id');
        }
    };

    u.isOTRMessage = function (message) {
        var body = message.querySelector('body'),
            text = (!_.isNull(body) ? body.textContent: undefined);
        return text && !!text.match(/^\?OTR/);
    };

    u.isHeadlineMessage = function (message) {
        var from_jid = message.getAttribute('from');
        if (message.getAttribute('type') === 'headline') {
            return true;
        }
        if (message.getAttribute('type') !== 'error' &&
                !_.isNil(from_jid) &&
                !_.includes(from_jid, '@')) {
            // Some servers (I'm looking at you Prosody) don't set the message
            // type to "headline" when sending server messages. For now we
            // check if an @ signal is included, and if not, we assume it's
            // a headline message.
            return true;
        }
        return false;
    };

    u.merge = function merge (first, second) {
        /* Merge the second object into the first one.
         */
        for (var k in second) {
            if (_.isObject(first[k])) {
                merge(first[k], second[k]);
            } else {
                first[k] = second[k];
            }
        }
    };

    u.applyUserSettings = function applyUserSettings (context, settings, user_settings) {
        /* Configuration settings might be nested objects. We only want to
         * add settings which are whitelisted.
         */
        for (var k in settings) {
            if (_.isUndefined(user_settings[k])) {
                continue;
            }
            if (_.isObject(settings[k]) && !_.isArray(settings[k])) {
                applyUserSettings(context[k], settings[k], user_settings[k]);
            } else {
                context[k] = user_settings[k];
            }
        }
    };

    u.refreshWebkit = function () {
        /* This works around a webkit bug. Refreshes the browser's viewport,
         * otherwise chatboxes are not moved along when one is closed.
         */
        if (jQBrowser.webkit && window.requestAnimationFrame) {
            window.requestAnimationFrame(function () {
                var conversejs = document.getElementById('conversejs');
                conversejs.style.display = 'none';
                var tmp = conversejs.offsetHeight; // jshint ignore:line
                conversejs.style.display = 'block';
            });
        }
    };

    u.stringToDOM = function (s) {
        /* Converts an HTML string into a DOM element.
         *
         * Parameters:
         *      (String) s - The HTML string
         */
        var div = document.createElement('div');
        div.innerHTML = s;
        return div.childNodes;
    };

    u.matchesSelector = function (el, selector) {
        /* Checks whether the DOM element matches the given selector.
         *
         * Parameters:
         *      (DOMElement) el - The DOM element
         *      (String) selector - The selector
         */
        return (
            el.matches ||
            el.matchesSelector ||
            el.msMatchesSelector ||
            el.mozMatchesSelector ||
            el.webkitMatchesSelector ||
            el.oMatchesSelector
        ).call(el, selector);
    };

    u.queryChildren = function (el, selector) {
        /* Returns a list of children of the DOM element that match the
         * selector.
         *
         *  Parameters:
         *      (DOMElement) el - the DOM element
         *      (String) selector - the selector they should be matched
         *          against.
         */
        return _.filter(el.children, _.partial(u.matchesSelector, _, selector));
    };

    u.contains = function (attr, query) {
        return function (item) {
            if (typeof attr === 'object') {
                var value = false;
                _.forEach(attr, function (a) {
                    value = value || _.includes(item.get(a).toLowerCase(), query.toLowerCase());
                });
                return value;
            } else if (typeof attr === 'string') {
                return _.includes(item.get(attr).toLowerCase(), query.toLowerCase());
            } else {
                throw new TypeError('contains: wrong attribute type. Must be string or array.');
            }
        };
    };


    u.detectLocale = function (library_check) {
        /* Determine which locale is supported by the user's system as well
         * as by the relevant library (e.g. converse.js or moment.js).
         *
         * Parameters:
         *      (Function) library_check - returns a boolean indicating whether
         *          the locale is supported.
         */
        var locale, i;
        if (window.navigator.userLanguage) {
            locale = u.isLocaleAvailable(window.navigator.userLanguage, library_check);
        }
        if (window.navigator.languages && !locale) {
            for (i=0; i<window.navigator.languages.length && !locale; i++) {
                locale = u.isLocaleAvailable(window.navigator.languages[i], library_check);
            }
        }
        if (window.navigator.browserLanguage && !locale) {
            locale = u.isLocaleAvailable(window.navigator.browserLanguage, library_check);
        }
        if (window.navigator.language && !locale) {
            locale = u.isLocaleAvailable(window.navigator.language, library_check);
        }
        if (window.navigator.systemLanguage && !locale) {
            locale = u.isLocaleAvailable(window.navigator.systemLanguage, library_check);
        }
        return locale || 'en';
    };

    u.isConverseLocale = function (locale) {
        if (!_.isString(locale)) { return false; }
        return _.includes(_.keys(locales || {}), locale);
    };

    u.isMomentLocale  = function (locale) {
        if (!_.isString(locale)) { return false; }
        return moment.locale() !== moment.locale(locale);
    };

    u.getLocale = function (preferred_locale, isSupportedByLibrary) {
        if (_.isString(preferred_locale)) {
            if (preferred_locale === 'en' || isSupportedByLibrary(preferred_locale)) {
                return preferred_locale;
            }
            try {
                var obj = window.JSON.parse(preferred_locale);
                return obj.locale_data.converse[""].lang;
            } catch (e) {
                logger.error(e);
            }
        }
        return u.detectLocale(isSupportedByLibrary) || 'en';
    };

    u.isOfType = function (type, item) {
        return item.get('type') == type;
    };

    u.isInstance = function (type, item) {
        return item instanceof type;
    };

    u.getAttribute = function (key, item) {
        return item.get(key);
    };

    u.contains.not = function (attr, query) {
        return function (item) {
            return !(u.contains(attr, query)(item));
        };
    };

    u.createFragmentFromText = function (markup) {
        /* Returns a DocumentFragment containing DOM nodes based on the
         * passed-in markup text.
         */
        // http://stackoverflow.com/questions/9334645/create-node-from-markup-string
        var frag = document.createDocumentFragment(),
            tmp = document.createElement('body'), child;
        tmp.innerHTML = markup;
        // Append elements in a loop to a DocumentFragment, so that the
        // browser does not re-render the document for each node.
        while (child = tmp.firstChild) {  // eslint-disable-line no-cond-assign
            frag.appendChild(child);
        }
        return frag
    };

    u.addEmoji = function (_converse, emojione, text) {
        if (_converse.use_emojione) {
            return emojione.toImage(text);
        } else {
            return emojione.shortnameToUnicode(text);
        }
    }

    u.getEmojisByCategory = function (_converse, emojione) {
        /* Return a dict of emojis with the categories as keys and
         * lists of emojis in that category as values.
         */
        if (_.isUndefined(_converse.emojis_by_category)) {
            const emojis = _.values(_.mapValues(emojione.emojioneList, function (value, key, o) {
                value._shortname = key;
                return value
            }));
            const tones = [':tone1:', ':tone2:', ':tone3:', ':tone4:', ':tone5:'];
            const excluded = [':kiss_ww:', ':kiss_mm:', ':kiss_woman_man:'];
            const excluded_substrings = [
                ':woman', ':man', ':women_', ':men_', '_man_', '_woman_', '_woman:', '_man:'
            ];
            const excluded_categories = ['modifier', 'regional'];
            const categories = _.difference(
                _.uniq(_.map(emojis, _.partial(_.get, _, 'category'))),
                excluded_categories
            );
            const emojis_by_category = {};
            _.forEach(categories, (cat) => {
                let list = _.sortBy(_.filter(emojis, ['category', cat]), ['uc_base']);
                list = _.filter(
                    list,
                    (item) => !_.includes(_.concat(tones, excluded), item._shortname) &&
                              !_.some(excluded_substrings, _.partial(_.includes, item._shortname))
                );
                if (cat === 'people') {
                    const idx = _.findIndex(list, ['uc_base', '1f600']);
                    list = _.union(_.slice(list, idx), _.slice(list, 0, idx+1));
                } else if (cat === 'activity') {
                    list = _.union(_.slice(list, 27-1), _.slice(list, 0, 27));
                } else if (cat === 'objects') {
                    list = _.union(_.slice(list, 24-1), _.slice(list, 0, 24));
                } else if (cat === 'travel') {
                    list = _.union(_.slice(list, 17-1), _.slice(list, 0, 17));
                } else if (cat === 'symbols') {
                    list = _.union(_.slice(list, 60-1), _.slice(list, 0, 60));
                }
                emojis_by_category[cat] = list;
            });
            _converse.emojis_by_category = emojis_by_category;
        }
        return _converse.emojis_by_category;
    };

    u.getTonedEmojis = function (_converse) {
        _converse.toned_emojis = _.uniq(
            _.map(
                _.filter(
                    u.getEmojisByCategory(_converse).people,
                    (person) => _.includes(person._shortname, '_tone')
                ),
                (person) => person._shortname.replace(/_tone[1-5]/, '')
            ));
        return _converse.toned_emojis;
    };

    u.isPersistableModel = function (model) {
        return model.collection && model.collection.browserStorage;
    };

    u.getWrappedPromise = function () {
        const wrapper = {};
        wrapper.promise = new Promise((resolve, reject) => {
            wrapper.resolve = resolve;
            wrapper.reject = reject;
        })
        return wrapper;
    };

    u.safeSave = function (model, attributes) {
        if (u.isPersistableModel(model)) {
            model.save(attributes);
        } else {
            model.set(attributes);
        }
    }
    return u;
}));
