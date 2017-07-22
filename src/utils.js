/*global define, escape, locales, Jed */
(function (root, factory) {
    define([
        "jquery.noconflict",
        "sizzle",
        "es6-promise",
        "jquery.browser",
        "lodash.noconflict",
        "locales",
        "moment_with_locales",
        "strophe",
        "tpl!field",
        "tpl!select_option",
        "tpl!form_select",
        "tpl!form_textarea",
        "tpl!form_checkbox",
        "tpl!form_username",
        "tpl!form_input",
        "tpl!form_captcha"
    ], factory);
}(this, function (
        $, sizzle,
        Promise,
        dummy, _,
        locales,
        moment,
        Strophe,
        tpl_field,
        tpl_select_option,
        tpl_form_select,
        tpl_form_textarea,
        tpl_form_checkbox,
        tpl_form_username,
        tpl_form_input,
        tpl_form_captcha
    ) {
    "use strict";
    locales = locales || {};
    const b64_sha1 = Strophe.SHA1.b64_sha1;
    Strophe = Strophe.Strophe;

    const URL_REGEX = /\b(https?:\/\/|www\.|https?:\/\/www\.)[^\s<>]{2,200}\b/g;

    var XFORM_TYPE_MAP = {
        'text-private': 'password',
        'text-single': 'text',
        'fixed': 'label',
        'boolean': 'checkbox',
        'hidden': 'hidden',
        'jid-multi': 'textarea',
        'list-single': 'dropdown',
        'list-multi': 'dropdown'
    };

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

    $.fn.hasScrollBar = function() {
        if (!$.contains(document, this.get(0))) {
            return false;
        }
        if(this.parent().height() < this.get(0).scrollHeight) {
            return true;
        }
        return false;
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

    var utils = {};

    // Translation machinery
    // ---------------------
    utils.__ = function (str) {
        if (!utils.isConverseLocale(this.locale) || this.locale === 'en') {
            return Jed.sprintf.apply(Jed, arguments);
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

    utils.___ = function (str) {
        /* XXX: This is part of a hack to get gettext to scan strings to be
         * translated. Strings we cannot send to the function above because
         * they require variable interpolation and we don't yet have the
         * variables at scan time.
         *
         * See actionInfoMessages in src/converse-muc.js
         */
        return str;
    };

    utils.isLocaleAvailable = function (locale, available) {
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

    utils.addHyperlinks = function (text) {
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

    utils.renderImageURLs = function (obj) {
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

    utils.slideInAllElements = function (elements) {
        return Promise.all(
            _.map(
                elements,
                _.partial(utils.slideIn, _, 600)
            ));
    };

    utils.slideToggleElement = function (el) {
        if (_.includes(el.classList, 'collapsed')) {
            return utils.slideOut(el);
        } else {
            return utils.slideIn(el);
        }
    };

    utils.slideOut = function (el, duration=900) {
        /* Shows/expands an element by sliding it out of itself. */

        function calculateEndHeight (el) {
            return _.reduce(
                el.children,
                (result, child) => result + child.offsetHeight, 0
            );
        }

        function wrapup (el) {
            el.removeAttribute('data-slider-marker');
            el.classList.remove('collapsed');
            el.style.overflow = "";
            el.style.height = "";
        }

        return new Promise((resolve, reject) => {
            if (_.isNil(el)) {
                const err = "Undefined or null element passed into slideOut"
                console.warn(err);
                reject(new Error(err));
                return;
            }
            let interval_marker = el.getAttribute('data-slider-marker');
            if (interval_marker) {
                el.removeAttribute('data-slider-marker');
                window.clearInterval(interval_marker);
            }
            const end_height = calculateEndHeight(el);
            if ($.fx.off) { // Effects are disabled (for tests)
                el.style.height = end_height + 'px';
                wrapup(el);
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
                    el.style.height = calculateEndHeight(el) + 'px';
                    window.clearInterval(interval_marker);
                    wrapup(el);
                    resolve();
                }
            }, interval);
            el.setAttribute('data-slider-marker', interval_marker);
        });
    };

    utils.slideIn = function (el, duration=600) {
        /* Hides/collapses an element by sliding it into itself. */
        return new Promise((resolve, reject) => {
            if (_.isNil(el)) {
                const err = "Undefined or null element passed into slideIn";
                console.warn(err);
                return reject(new Error(err));
            } else if (_.includes(el.classList, 'collapsed')) {
                return resolve();
            } else if ($.fx.off) { // Effects are disabled (for tests)
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

    utils.fadeIn = function (el, callback) {
        if (_.isNil(el)) {
            console.warn("Undefined or null element passed into fadeIn");
        }
        if ($.fx.off) {
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

    utils.isSameBareJID = function (jid1, jid2) {
        return Strophe.getBareJidFromJid(jid1).toLowerCase() ===
                Strophe.getBareJidFromJid(jid2).toLowerCase();
    };

    utils.isNewMessage = function (message) {
        /* Given a stanza, determine whether it's a new
         * message, i.e. not a MAM archived one.
         */
        if (message instanceof Element) {
            return !(sizzle('result[xmlns="'+Strophe.NS.MAM+'"]', message).length);
        } else {
            return !message.get('archive_id');
        }
    };

    utils.isOTRMessage = function (message) {
        var body = message.querySelector('body'),
            text = (!_.isNull(body) ? body.textContent: undefined);
        return text && !!text.match(/^\?OTR/);
    };

    utils.isHeadlineMessage = function (message) {
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

    utils.merge = function merge (first, second) {
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

    utils.applyUserSettings = function applyUserSettings (context, settings, user_settings) {
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

    utils.refreshWebkit = function () {
        /* This works around a webkit bug. Refreshes the browser's viewport,
         * otherwise chatboxes are not moved along when one is closed.
         */
        if ($.browser.webkit && window.requestAnimationFrame) {
            window.requestAnimationFrame(function () {
                var conversejs = document.getElementById('conversejs');
                conversejs.style.display = 'none';
                var tmp = conversejs.offsetHeight; // jshint ignore:line
                conversejs.style.display = 'block';
            });
        }
    };

    utils.webForm2xForm = function (field) {
        /* Takes an HTML DOM and turns it into an XForm field.
        *
        * Parameters:
        *      (DOMElement) field - the field to convert
        */
        var $input = $(field), value;
        if ($input.is('[type=checkbox]')) {
            value = $input.is(':checked') && 1 || 0;
        } else if ($input.is('textarea')) {
            value = [];
            var lines = $input.val().split('\n');
            for( var vk=0; vk<lines.length; vk++) {
                var val = $.trim(lines[vk]);
                if (val === '')
                    continue;
                value.push(val);
            }
        } else {
            value = $input.val();
        }
        return $(tpl_field({
            name: $input.attr('name'),
            value: value
        }))[0];
    };

    utils.contains = function (attr, query) {
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

    utils.xForm2webForm = function ($field, $stanza) {
        /* Takes a field in XMPP XForm (XEP-004: Data Forms) format
        * and turns it into a HTML DOM field.
        *
        *  Parameters:
        *      (XMLElement) field - the field to convert
        */

        // FIXME: take <required> into consideration
        var options = [], j, $options, $values, value, values;

        if ($field.attr('type') === 'list-single' || $field.attr('type') === 'list-multi') {
            values = [];
            $values = $field.children('value');
            for (j=0; j<$values.length; j++) {
                values.push($($values[j]).text());
            }
            $options = $field.children('option');
            for (j=0; j<$options.length; j++) {
                value = $($options[j]).find('value').text();
                options.push(tpl_select_option({
                    value: value,
                    label: $($options[j]).attr('label'),
                    selected: _.startsWith(values, value),
                    required: $field.find('required').length
                }));
            }
            return tpl_form_select({
                name: $field.attr('var'),
                label: $field.attr('label'),
                options: options.join(''),
                multiple: ($field.attr('type') === 'list-multi'),
                required: $field.find('required').length
            });
        } else if ($field.attr('type') === 'fixed') {
            return $('<p class="form-help">').text($field.find('value').text());
        } else if ($field.attr('type') === 'jid-multi') {
            return tpl_form_textarea({
                name: $field.attr('var'),
                label: $field.attr('label') || '',
                value: $field.find('value').text(),
                required: $field.find('required').length
            });
        } else if ($field.attr('type') === 'boolean') {
            return tpl_form_checkbox({
                name: $field.attr('var'),
                type: XFORM_TYPE_MAP[$field.attr('type')],
                label: $field.attr('label') || '',
                checked: $field.find('value').text() === "1" && 'checked="1"' || '',
                required: $field.find('required').length
            });
        } else if ($field.attr('type') && $field.attr('var') === 'username') {
            return tpl_form_username({
                domain: ' @'+this.domain,
                name: $field.attr('var'),
                type: XFORM_TYPE_MAP[$field.attr('type')],
                label: $field.attr('label') || '',
                value: $field.find('value').text(),
                required: $field.find('required').length
            });
        } else if ($field.attr('type')) {
            return tpl_form_input({
                name: $field.attr('var'),
                type: XFORM_TYPE_MAP[$field.attr('type')],
                label: $field.attr('label') || '',
                value: $field.find('value').text(),
                required: $field.find('required').length
            });
        } else {
            if ($field.attr('var') === 'ocr') { // Captcha
                return _.reduce(_.map($field.find('uri'),
                        $.proxy(function (uri) {
                            return tpl_form_captcha({
                                label: this.$field.attr('label'),
                                name: this.$field.attr('var'),
                                data: this.$stanza.find('data[cid="'+uri.textContent.replace(/^cid:/, '')+'"]').text(),
                                type: uri.getAttribute('type'),
                                required: this.$field.find('required').length
                            });
                        }, {'$stanza': $stanza, '$field': $field})
                    ),
                    function (memo, num) { return memo + num; }, ''
                );
            }
        }
    }

    utils.detectLocale = function (library_check) {
        /* Determine which locale is supported by the user's system as well
         * as by the relevant library (e.g. converse.js or moment.js).
         *
         * Parameters:
         *      (Function) library_check - returns a boolean indicating whether
         *          the locale is supported.
         */
        var locale, i;
        if (window.navigator.userLanguage) {
            locale = utils.isLocaleAvailable(window.navigator.userLanguage, library_check);
        }
        if (window.navigator.languages && !locale) {
            for (i=0; i<window.navigator.languages.length && !locale; i++) {
                locale = utils.isLocaleAvailable(window.navigator.languages[i], library_check);
            }
        }
        if (window.navigator.browserLanguage && !locale) {
            locale = utils.isLocaleAvailable(window.navigator.browserLanguage, library_check);
        }
        if (window.navigator.language && !locale) {
            locale = utils.isLocaleAvailable(window.navigator.language, library_check);
        }
        if (window.navigator.systemLanguage && !locale) {
            locale = utils.isLocaleAvailable(window.navigator.systemLanguage, library_check);
        }
        return locale || 'en';
    };

    utils.isConverseLocale = function (locale) {
        if (!_.isString(locale)) { return false; }
        return _.includes(_.keys(locales || {}), locale);
    };

    utils.isMomentLocale  = function (locale) {
        if (!_.isString(locale)) { return false; }
        return moment.locale() !== moment.locale(locale);
    };

    utils.getLocale = function (preferred_locale, isSupportedByLibrary) {
        if (_.isString(preferred_locale)) {
            if (preferred_locale === 'en' || isSupportedByLibrary(preferred_locale)) {
                return preferred_locale;
            }
            try {
                var obj = window.JSON.parse(preferred_locale);
                return obj.locale_data.converse[""].lang;
            } catch (e) {
                console.log(e);
            }
        }
        return utils.detectLocale(isSupportedByLibrary) || 'en';
    };

    utils.isOfType = function (type, item) {
        return item.get('type') == type;
    };

    utils.isInstance = function (type, item) {
        return item instanceof type;
    };

    utils.getAttribute = function (key, item) {
        return item.get(key);
    };

    utils.contains.not = function (attr, query) {
        return function (item) {
            return !(utils.contains(attr, query)(item));
        };
    };

    utils.createFragmentFromText = function (markup) {
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

    utils.addEmoji = function (_converse, emojione, text) {
        if (_converse.use_emojione) {
            return emojione.toImage(text);
        } else {
            return emojione.shortnameToUnicode(text);
        }
    }

    utils.getEmojisByCategory = function (_converse, emojione) {
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

    utils.getTonedEmojis = function (_converse) {
        _converse.toned_emojis = _.uniq(
            _.map(
                _.filter(
                    utils.getEmojisByCategory(_converse).people,
                    (person) => _.includes(person._shortname, '_tone')
                ),
                (person) => person._shortname.replace(/_tone[1-5]/, '')
            ));
        return _converse.toned_emojis;
    };

    utils.isPersistableModel = function (model) {
        return model.collection && model.collection.browserStorage;
    };

    utils.getWrappedPromise = function () {
        const wrapper = {};
        wrapper.promise = new Promise((resolve, reject) => {
            wrapper.resolve = resolve;
            wrapper.reject = reject;
        })
        return wrapper;
    };

    utils.safeSave = function (model, attributes) {
        if (utils.isPersistableModel(model)) {
            model.save(attributes);
        } else {
            model.set(attributes);
        }
    }
    return utils;
}));
