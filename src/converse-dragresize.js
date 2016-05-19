// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, window */

(function (root, factory) {
    define("converse-dragresize", [
            "converse-core",
            "converse-api",
            "converse-chatview",
            "converse-muc", // XXX: would like to remove this
            "converse-controlbox"
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._;

    converse_api.plugins.add('dragresize', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.
            
            registerGlobalEventHandlers: function () {
                $(document).on('mousemove', function (ev) {
                    if (!this.resizing || !this.allow_dragresize) { return true; }
                    ev.preventDefault();
                    this.resizing.chatbox.resizeChatBox(ev);
                }.bind(this));

                $(document).on('mouseup', function (ev) {
                    if (!this.resizing || !this.allow_dragresize) { return true; }
                    ev.preventDefault();
                    var height = this.applyDragResistance(
                            this.resizing.chatbox.height,
                            this.resizing.chatbox.model.get('default_height')
                    );
                    var width = this.applyDragResistance(
                            this.resizing.chatbox.width,
                            this.resizing.chatbox.model.get('default_width')
                    );
                    if (this.connection.connected) {
                        this.resizing.chatbox.model.save({'height': height});
                        this.resizing.chatbox.model.save({'width': width});
                    } else {
                        this.resizing.chatbox.model.set({'height': height});
                        this.resizing.chatbox.model.set({'width': width});
                    }
                    this.resizing = null;
                }.bind(this));

                return this._super.registerGlobalEventHandlers.apply(this, arguments);
            },

            ChatBox: {
                initialize: function () {
                    var result = this._super.initialize.apply(this, arguments),
                        height = this.get('height'), width = this.get('width'),
                        save = this.get('id') === 'controlbox' ? this.set.bind(this) : this.save.bind(this);
                    save({
                        'height': converse.applyDragResistance(height, this.get('default_height')),
                        'width': converse.applyDragResistance(width, this.get('default_width')),
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

                initialize: function () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this._super.initialize.apply(this, arguments);
                },

                render: function () {
                    var result = this._super.render.apply(this, arguments);
                    this.setWidth();
                    return result;
                },

                setWidth: function () {
                    // If a custom width is applied (due to drag-resizing),
                    // then we need to set the width of the .chatbox element as well.
                    if (this.model.get('width')) {
                        this.$el.css('width', this.model.get('width'));
                    }
                },

                _show: function () {
                    this.initDragResize().setDimensions();
                    this._super._show.apply(this, arguments);
                },

                initDragResize: function () {
                    /* Determine and store the default box size.
                     * We need this information for the drag-resizing feature.
                     */
                    var $flyout = this.$el.find('.box-flyout');
                    if (typeof this.model.get('height') === 'undefined') {
                        var height = $flyout.height();
                        var width = $flyout.width();
                        this.model.set('height', height);
                        this.model.set('default_height', height);
                        this.model.set('width', width);
                        this.model.set('default_width', width);
                    }
                    var min_width = $flyout.css('min-width');
                    var min_height = $flyout.css('min-height');
                    this.model.set('min_width', min_width.endsWith('px') ? Number(min_width.replace(/px$/, '')) :0);
                    this.model.set('min_height', min_height.endsWith('px') ? Number(min_height.replace(/px$/, '')) :0);
                    // Initialize last known mouse position
                    this.prev_pageY = 0;
                    this.prev_pageX = 0;
                    if (converse.connection.connected) {
                        this.height = this.model.get('height');
                        this.width = this.model.get('width');
                    }
                    return this;
                },

                setDimensions: function () {
                    // Make sure the chat box has the right height and width.
                    this.adjustToViewport();
                    this.setChatBoxHeight(this.model.get('height'));
                    this.setChatBoxWidth(this.model.get('width'));
                },

                setChatBoxHeight: function (height) {
                    if (height) {
                        height = converse.applyDragResistance(height, this.model.get('default_height'))+'px';
                    } else {
                        height = "";
                    }
                    this.$el.children('.box-flyout')[0].style.height = height;
                },

                setChatBoxWidth: function (width) {
                    if (width) {
                        width = converse.applyDragResistance(width, this.model.get('default_width'))+'px';
                    } else {
                        width = "";
                    }
                    this.$el[0].style.width = width;
                    this.$el.children('.box-flyout')[0].style.width = width;
                },


                adjustToViewport: function () {
                    /* Event handler called when viewport gets resized. We remove
                     * custom width/height from chat boxes.
                     */
                    var viewport_width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
                    var viewport_height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                    if (viewport_width <= 480) {
                        this.model.set('height', undefined);
                        this.model.set('width', undefined);
                    } else if (viewport_width <= this.model.get('width')) {
                        this.model.set('width', undefined);
                    } else if (viewport_height <= this.model.get('height')) {
                        this.model.set('height', undefined);
                    }
                },

                onStartVerticalResize: function (ev) {
                    if (!converse.allow_dragresize) { return true; }
                    // Record element attributes for mouseMove().
                    this.height = this.$el.children('.box-flyout').height();
                    converse.resizing = {
                        'chatbox': this,
                        'direction': 'top'
                    };
                    this.prev_pageY = ev.pageY;
                },

                onStartHorizontalResize: function (ev) {
                    if (!converse.allow_dragresize) { return true; }
                    this.width = this.$el.children('.box-flyout').width();
                    converse.resizing = {
                        'chatbox': this,
                        'direction': 'left'
                    };
                    this.prev_pageX = ev.pageX;
                },

                onStartDiagonalResize: function (ev) {
                    this.onStartHorizontalResize(ev);
                    this.onStartVerticalResize(ev);
                    converse.resizing.direction = 'topleft';
                },

                resizeChatBox: function (ev) {
                    var diff;
                    if (converse.resizing.direction.indexOf('top') === 0) {
                        diff = ev.pageY - this.prev_pageY;
                        if (diff) {
                            this.height = ((this.height-diff) > (this.model.get('min_height') || 0)) ? (this.height-diff) : this.model.get('min_height');
                            this.prev_pageY = ev.pageY;
                            this.setChatBoxHeight(this.height);
                        }
                    }
                    if (converse.resizing.direction.indexOf('left') !== -1) {
                        diff = this.prev_pageX - ev.pageX;
                        if (diff) {
                            this.width = ((this.width+diff) > (this.model.get('min_width') || 0)) ? (this.width+diff) : this.model.get('min_width');
                            this.prev_pageX = ev.pageX;
                            this.setChatBoxWidth(this.width);
                        }
                    }
                }
            },

            ControlBoxView: {
                events: {
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },

                initialize: function () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this._super.initialize.apply(this, arguments);
                },

                renderLoginPanel: function () {
                    var result = this._super.renderLoginPanel.apply(this, arguments);
                    this.initDragResize().setDimensions();
                    return result;
                },

                renderContactsPanel: function () {
                    var result = this._super.renderContactsPanel.apply(this, arguments);
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

                initialize: function () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this._super.initialize.apply(this, arguments);
                },

                render: function () {
                    var result = this._super.render.apply(this, arguments);
                    this.setWidth();
                    return result;
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            this.updateSettings({
                allow_dragresize: true,
            });
            converse.applyDragResistance = function (value, default_value) {
                /* This method applies some resistance around the
                * default_value. If value is close enough to
                * default_value, then default_value is returned instead.
                */
                if (typeof value === 'undefined') {
                    return undefined;
                } else if (typeof default_value === 'undefined') {
                    return value;
                }
                var resistance = 10;
                if ((value !== default_value) &&
                    (Math.abs(value- default_value) < resistance)) {
                    return default_value;
                }
                return value;
            };
        }
    });
}));
