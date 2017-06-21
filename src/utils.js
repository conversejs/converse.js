/*global define, escape, locales, Jed */
(function (root, factory) {
    define([
        "jquery.noconflict",
        "sizzle",
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
        $, sizzle, dummy, _,
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
    Strophe = Strophe.Strophe;

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
    }

    var isImage = function (url) {
        var deferred = new $.Deferred();
        var img = new Image();
        var timer = window.setTimeout(function () {
            deferred.reject();
            img = null;
        }, 3000);
        img.onerror = img.onabort = function () {
            clearTimeout(timer);
            deferred.reject();
        };
        img.onload = function () {
            clearTimeout(timer);
            deferred.resolve(img);
        };
        img.src = url;
        return deferred.promise();
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

    var throttledHTML = _.throttle(function (el, html) {
        el.innerHTML = html;
    }, 500);

    $.fn.addHyperlinks = function () {
        if (this.length > 0) {
            this.each(function (i, obj) {
                var prot, escaped_url;
                var x = obj.innerHTML;
                var list = x.match(/\b(https?:\/\/|www\.|https?:\/\/www\.)[^\s<]{2,200}\b/g );
                if (list) {
                    for (i=0; i<list.length; i++) {
                        prot = list[i].indexOf('http://') === 0 || list[i].indexOf('https://') === 0 ? '' : 'http://';
                        escaped_url = encodeURI(decodeURI(list[i])).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");
                        x = x.replace(list[i], '<a target="_blank" rel="noopener" href="' + prot + escaped_url + '">'+ list[i] + '</a>' );
                    }
                }
                obj.innerHTML = x;
                _.forEach(list, function (url) {
                    isImage(unescapeHTML(url)).then(function (img) {
                        img.className = 'chat-image';
                        throttledHTML(obj.querySelector('a'), img.outerHTML);
                    });
                });
            });
        }
        return this;
    };

    $.fn.addEmoticons = function (allowed) {
        if (allowed) {
            if (this.length > 0) {
                this.each(function (i, obj) {
                    var text = $(obj).html();
                    text = text.replace(/&gt;:\)/g, '<span class="emoticon icon-evil"></span>');
                    text = text.replace(/:\)/g, '<span class="emoticon icon-smiley"></span>');
                    text = text.replace(/:\-\)/g, '<span class="emoticon icon-smiley"></span>');
                    text = text.replace(/;\)/g, '<span class="emoticon icon-wink"></span>');
                    text = text.replace(/;\-\)/g, '<span class="emoticon icon-wink"></span>');
                    text = text.replace(/:D/g, '<span class="emoticon icon-grin"></span>');
                    text = text.replace(/:\-D/g, '<span class="emoticon icon-grin"></span>');
                    text = text.replace(/:P/g, '<span class="emoticon icon-tongue"></span>');
                    text = text.replace(/:\-P/g, '<span class="emoticon icon-tongue"></span>');
                    text = text.replace(/:p/g, '<span class="emoticon icon-tongue"></span>');
                    text = text.replace(/:\-p/g, '<span class="emoticon icon-tongue"></span>');
                    text = text.replace(/8\)/g, '<span class="emoticon icon-cool"></span>');
                    text = text.replace(/:S/g, '<span class="emoticon icon-confused"></span>');
                    text = text.replace(/:\\/g, '<span class="emoticon icon-wondering"></span>');
                    text = text.replace(/:\/ /g, '<span class="emoticon icon-wondering"></span>');
                    text = text.replace(/&gt;:\(/g, '<span class="emoticon icon-angry"></span>');
                    text = text.replace(/:\(/g, '<span class="emoticon icon-sad"></span>');
                    text = text.replace(/:\-\(/g, '<span class="emoticon icon-sad"></span>');
                    text = text.replace(/:O/g, '<span class="emoticon icon-shocked"></span>');
                    text = text.replace(/:\-O/g, '<span class="emoticon icon-shocked"></span>');
                    text = text.replace(/\=\-O/g, '<span class="emoticon icon-shocked"></span>');
                    text = text.replace(/\(\^.\^\)b/g, '<span class="emoticon icon-thumbs-up"></span>');
                    text = text.replace(/&lt;3/g, '<span class="emoticon icon-heart"></span>');
                    $(obj).html(text);
                });
            }
        }
        return this;
    };

    var utils = {
        // Translation machinery
        // ---------------------
        __: function (str) {
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
        },

        ___: function (str) {
            /* XXX: This is part of a hack to get gettext to scan strings to be
             * translated. Strings we cannot send to the function above because
             * they require variable interpolation and we don't yet have the
             * variables at scan time.
             *
             * See actionInfoMessages in src/converse-muc.js
             */
            return str;
        },

        isLocaleAvailable: function (locale, available) {
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
        },

        fadeIn: function (el, callback) {
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
        },

        isSameBareJID: function (jid1, jid2) {
            return Strophe.getBareJidFromJid(jid1).toLowerCase() ===
                   Strophe.getBareJidFromJid(jid2).toLowerCase();
        },

        isNewMessage: function (message) {
            /* Given a stanza, determine whether it's a new
             * message, i.e. not a MAM archived one.
             */
            if (message instanceof Element) {
                return !(sizzle('result[xmlns="'+Strophe.NS.MAM+'"]', message).length);
            } else {
                return !message.get('archive_id');
            }
        },

        isOTRMessage: function (message) {
            var body = message.querySelector('body'),
                text = (!_.isNull(body) ? body.textContent: undefined);
            return text && !!text.match(/^\?OTR/);
        },

        isHeadlineMessage: function (message) {
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
        },

        merge: function merge (first, second) {
            /* Merge the second object into the first one.
             */
            for (var k in second) {
                if (_.isObject(first[k])) {
                    merge(first[k], second[k]);
                } else {
                    first[k] = second[k];
                }
            }
        },

        applyUserSettings: function applyUserSettings (context, settings, user_settings) {
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
        },

        refreshWebkit: function () {
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
        },

        webForm2xForm: function (field) {
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
        },

        contains: function (attr, query) {
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
        },

        xForm2webForm: function ($field, $stanza) {
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
    };

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
        return _.includes(_.keys(locales || {}), locale)
    };

    utils.isMomentLocale  = function (locale) {
        if (!_.isString(locale)) { return false; }
        return moment.locale() !== moment.locale(locale);
    }

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
    }

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

    utils.createElementsFromString = function (element, html) {
        // http://stackoverflow.com/questions/9334645/create-node-from-markup-string
        var frag = document.createDocumentFragment(),
            tmp = document.createElement('body'), child;
        tmp.innerHTML = html;
        // Append elements in a loop to a DocumentFragment, so that the browser does
        // not re-render the document for each node
        while (child = tmp.firstChild) {  // eslint-disable-line no-cond-assign
            frag.appendChild(child);
        }
        element.appendChild(frag); // Now, append all elements at once
        frag = tmp = null;
    }

    utils.isPersistableModel = function (model) {
        return model.collection && model.collection.browserStorage;
    }

    utils.saveWithFallback = function (model, attrs) {
        if (utils.isPersistableModel(this)) {
            model.save(attrs);
        } else {
            model.set(attrs);
        }
    }
    return utils;
}));
