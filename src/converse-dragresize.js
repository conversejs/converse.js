// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, window */

(function (root, factory) {
    define(["jquery.noconflict",
            "converse-core",
            "tpl!dragresize",
            "converse-chatview",
            "converse-muc", // XXX: would like to remove this
            "converse-controlbox"
    ], factory);
}(this, function ($, converse, tpl_dragresize) {
    "use strict";
    const { _ } = converse.env;

    function renderDragResizeHandles (_converse, view) {
        const flyout = view.el.querySelector('.box-flyout');
        const div = document.createElement('div');
        div.innerHTML = tpl_dragresize();
        flyout.insertBefore(
            div,
            flyout.firstChild
        );
    }


    converse.plugins.add('converse-dragresize', {
        /* Optional dependencies are other plugins which might be
         * overridden or relied upon, and therefore need to be loaded before
         * this plugin. They are called "optional" because they might not be
         * available, in which case any overrides applicable to them will be
         * ignored.
         *
         * It's possible however to make optional dependencies non-optional.
         * If the setting "strict_plugin_dependencies" is set to true,
         * an error will be raised if the plugin is not found.
         *
         * NB: These plugins need to have already been loaded via require.js.
         */
        optional_dependencies: ["converse-headline"],

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            registerGlobalEventHandlers () {
                const that = this;
                
                $(document).on('mousemove', function (ev) {
                    if (!that.resizing || !that.allow_dragresize) { return true; }
                    ev.preventDefault();
                    that.resizing.chatbox.resizeChatBox(ev);
                });

                $(document).on('mouseup', function (ev) {
                    if (!that.resizing || !that.allow_dragresize) { return true; }
                    ev.preventDefault();
                    const height = that.applyDragResistance(
                            that.resizing.chatbox.height,
                            that.resizing.chatbox.model.get('default_height')
                    );
                    const width = that.applyDragResistance(
                            that.resizing.chatbox.width,
                            that.resizing.chatbox.model.get('default_width')
                    );
                    if (that.connection.connected) {
                        that.resizing.chatbox.model.save({'height': height});
                        that.resizing.chatbox.model.save({'width': width});
                    } else {
                        that.resizing.chatbox.model.set({'height': height});
                        that.resizing.chatbox.model.set({'width': width});
                    }
                    that.resizing = null;
                });

                return this.__super__.registerGlobalEventHandlers.apply(this, arguments);
            },

            ChatBox: {
                initialize () {
                    const { _converse } = this.__super__;
                    const result = this.__super__.initialize.apply(this, arguments),
                        height = this.get('height'), width = this.get('width'),
                        save = this.get('id') === 'controlbox' ? this.set.bind(this) : this.save.bind(this);
                    save({
                        'height': _converse.applyDragResistance(height, this.get('default_height')),
                        'width': _converse.applyDragResistance(width, this.get('default_width')),
                    });
                    return result;
                }
            },

            ChatBoxView: {
                events: {
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },

                initialize () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this.__super__.initialize.apply(this, arguments);
                },

                render () {
                    const result = this.__super__.render.apply(this, arguments);
                    renderDragResizeHandles(this.__super__._converse, this);
                    this.setWidth();
                    return result;
                },

                setWidth () {
                    // If a custom width is applied (due to drag-resizing),
                    // then we need to set the width of the .chatbox element as well.
                    if (this.model.get('width')) {
                        this.$el.css('width', this.model.get('width'));
                    }
                },

                _show () {
                    this.initDragResize().setDimensions();
                    this.__super__._show.apply(this, arguments);
                },

                initDragResize () {
                    /* Determine and store the default box size.
                     * We need this information for the drag-resizing feature.
                     */
                    const { _converse } = this.__super__;
                    const $flyout = this.$el.find('.box-flyout');
                    if (_.isUndefined(this.model.get('height'))) {
                        const height = $flyout.height();
                        const width = $flyout.width();
                        this.model.set('height', height);
                        this.model.set('default_height', height);
                        this.model.set('width', width);
                        this.model.set('default_width', width);
                    }
                    const min_width = $flyout.css('min-width');
                    const min_height = $flyout.css('min-height');
                    this.model.set('min_width', min_width.endsWith('px') ? Number(min_width.replace(/px$/, '')) :0);
                    this.model.set('min_height', min_height.endsWith('px') ? Number(min_height.replace(/px$/, '')) :0);
                    // Initialize last known mouse position
                    this.prev_pageY = 0;
                    this.prev_pageX = 0;
                    if (_converse.connection.connected) {
                        this.height = this.model.get('height');
                        this.width = this.model.get('width');
                    }
                    return this;
                },

                setDimensions () {
                    // Make sure the chat box has the right height and width.
                    this.adjustToViewport();
                    this.setChatBoxHeight(this.model.get('height'));
                    this.setChatBoxWidth(this.model.get('width'));
                },

                setChatBoxHeight (height) {
                    const { _converse } = this.__super__;
                    if (height) {
                        height = _converse.applyDragResistance(height, this.model.get('default_height'))+'px';
                    } else {
                        height = "";
                    }
                    this.$el.children('.box-flyout')[0].style.height = height;
                },

                setChatBoxWidth (width) {
                    const { _converse } = this.__super__;
                    if (width) {
                        width = _converse.applyDragResistance(width, this.model.get('default_width'))+'px';
                    } else {
                        width = "";
                    }
                    this.$el[0].style.width = width;
                    this.$el.children('.box-flyout')[0].style.width = width;
                },


                adjustToViewport () {
                    /* Event handler called when viewport gets resized. We remove
                     * custom width/height from chat boxes.
                     */
                    const viewport_width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
                    const viewport_height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                    if (viewport_width <= 480) {
                        this.model.set('height', undefined);
                        this.model.set('width', undefined);
                    } else if (viewport_width <= this.model.get('width')) {
                        this.model.set('width', undefined);
                    } else if (viewport_height <= this.model.get('height')) {
                        this.model.set('height', undefined);
                    }
                },

                onStartVerticalResize (ev) {
                    const { _converse } = this.__super__;
                    if (!_converse.allow_dragresize) { return true; }
                    // Record element attributes for mouseMove().
                    this.height = this.$el.children('.box-flyout').height();
                    _converse.resizing = {
                        'chatbox': this,
                        'direction': 'top'
                    };
                    this.prev_pageY = ev.pageY;
                },

                onStartHorizontalResize (ev) {
                    const { _converse } = this.__super__;
                    if (!_converse.allow_dragresize) { return true; }
                    this.width = this.$el.children('.box-flyout').width();
                    _converse.resizing = {
                        'chatbox': this,
                        'direction': 'left'
                    };
                    this.prev_pageX = ev.pageX;
                },

                onStartDiagonalResize (ev) {
                    const { _converse } = this.__super__;
                    this.onStartHorizontalResize(ev);
                    this.onStartVerticalResize(ev);
                    _converse.resizing.direction = 'topleft';
                },

                resizeChatBox (ev) {
                    let diff;
                    const { _converse } = this.__super__;
                    if (_converse.resizing.direction.indexOf('top') === 0) {
                        diff = ev.pageY - this.prev_pageY;
                        if (diff) {
                            this.height = ((this.height-diff) > (this.model.get('min_height') || 0)) ? (this.height-diff) : this.model.get('min_height');
                            this.prev_pageY = ev.pageY;
                            this.setChatBoxHeight(this.height);
                        }
                    }
                    if (_.includes(_converse.resizing.direction, 'left')) {
                        diff = this.prev_pageX - ev.pageX;
                        if (diff) {
                            this.width = ((this.width+diff) > (this.model.get('min_width') || 0)) ? (this.width+diff) : this.model.get('min_width');
                            this.prev_pageX = ev.pageX;
                            this.setChatBoxWidth(this.width);
                        }
                    }
                }
            },

            HeadlinesBoxView: {
                events: {
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },

                initialize () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    return this.__super__.initialize.apply(this, arguments);
                },

                render () {
                    const result = this.__super__.render.apply(this, arguments);
                    renderDragResizeHandles(this.__super__._converse, this);
                    this.setWidth();
                    return result;
                }
            },

            ControlBoxView: {
                events: {
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },

                initialize () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this.__super__.initialize.apply(this, arguments);
                },

                render () {
                    const result = this.__super__.render.apply(this, arguments);
                    renderDragResizeHandles(this.__super__._converse, this);
                    this.setWidth();
                    return result;
                },

                renderLoginPanel () {
                    const result = this.__super__.renderLoginPanel.apply(this, arguments);
                    this.initDragResize().setDimensions();
                    return result;
                },

                renderContactsPanel () {
                    const result = this.__super__.renderContactsPanel.apply(this, arguments);
                    this.initDragResize().setDimensions();
                    return result;
                }
            },

            ChatRoomView: {
                events: {
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },

                initialize () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this.__super__.initialize.apply(this, arguments);
                },

                render () {
                    const result = this.__super__.render.apply(this, arguments);
                    renderDragResizeHandles(this.__super__._converse, this);
                    this.setWidth();
                    return result;
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this;

            _converse.api.settings.update({
                allow_dragresize: true,
            });

            _converse.applyDragResistance = function (value, default_value) {
                /* This method applies some resistance around the
                * default_value. If value is close enough to
                * default_value, then default_value is returned instead.
                */
                if (_.isUndefined(value)) {
                    return undefined;
                } else if (_.isUndefined(default_value)) {
                    return value;
                }
                const resistance = 10;
                if ((value !== default_value) &&
                    (Math.abs(value- default_value) < resistance)) {
                    return default_value;
                }
                return value;
            };
        }
    });
}));
