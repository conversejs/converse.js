/*
 *     ____  __                        __    __         _
 *    / __ \/ /_  __ ___   ___  ____ _/ /_  / /__      (_)____
 *   / /_/ / / / / / __ \/ __ \/ __/ / __ \/ / _ \    / / ___/
 *  / ____/ / /_/ / /_/ / /_/ / /_/ / /_/ / /  __/   / (__  )
 * /_/   /_/\__,_/\__, /\__, /\__/_/_.___/_/\___(_)_/ /____/
 *               /____//____/                    /___/
 *
 */
(function (root, factory) {
    define("converse-pluggable", ["jquery", "underscore"], factory);
}(this, function ($, _) {
    "use strict";

    function Pluggable (plugged) {
        this.plugged = plugged;
        this.plugged._super = {};
        this.plugins = {};
        this.initialized_plugins = [];
    }
    _.extend(Pluggable.prototype, {
        wrappedOverride: function (key, value, super_method) {
            /* We create a partially applied wrapper function, that
             * makes sure to set the proper super method when the
             * overriding method is called. This is done to enable
             * chaining of plugin methods, all the way up to the
             * original method.
             */
            if (typeof super_method === "function") {
                this._super[key] = super_method.bind(this);
            }
            return value.apply(this, _.rest(arguments, 3));
        },

        _overrideAttribute: function (key, plugin) {
            /* Overrides an attribute on the original object (the thing being
             * plugged into).
             *
             * If the attribute being overridden is a function, then the original
             * function will still be available via the _super attribute.
             *
             * If the same function is being overridden multiple times, then
             * the original function will be available at the end of a chain of
             * functions, starting from the most recent override, all the way
             * back to the original function, each being referenced by the
             * previous' _super attribute.
             *
             * For example:
             *
             * plugin2.MyFunc._super.myFunc => * plugin1.MyFunc._super.myFunc => original.myFunc
             */
            var value = plugin.overrides[key];
            if (typeof value === "function") {
                var wrapped_function = _.partial(
                    this.wrappedOverride, key, value, this.plugged[key]
                );
                this.plugged[key] = wrapped_function;
            } else {
                this.plugged[key] = value;
            }
        },

        _extendObject: function (obj, attributes) {
            if (!obj.prototype._super) {
                // FIXME: make generic
                obj.prototype._super = {'converse': this.plugged };
            }
            _.each(attributes, function (value, key) {
                if (key === 'events') {
                    obj.prototype[key] = _.extend(value, obj.prototype[key]);
                } else if (typeof value === 'function') {
                    // We create a partially applied wrapper function, that
                    // makes sure to set the proper super method when the
                    // overriding method is called. This is done to enable
                    // chaining of plugin methods, all the way up to the
                    // original method.
                    var wrapped_function = _.partial(
                        this.wrappedOverride, key, value, obj.prototype[key]
                    );
                    obj.prototype[key] = wrapped_function;
                } else {
                    obj.prototype[key] = value;
                }
            }.bind(this));
        },

        loadOptionalDependencies: function (plugin) {
            _.each(plugin.optional_dependencies, function (name) {
                var dep = this.plugins[name];
                if (dep) {
                    if (_.contains(dep.optional_dependencies, plugin.__name__)) {
                        // FIXME: circular dependency checking is only one level deep.
                        throw "Found a circular dependency between the plugins \""+
                              plugin.__name__+"\" and \""+name+"\"";
                    }
                    this.initializePlugin(dep);
                } else {
                    this.throwUndefinedDependencyError(
                        "Could not find optional dependency \""+name+"\" "+
                        "for the plugin \""+plugin.__name__+"\". "+
                        "If it's needed, make sure it's loaded by require.js");
                }
            }.bind(this));
        },

        throwUndefinedDependencyError: function (msg) {
            if (this.plugged.strict_plugin_dependencies) {
                throw msg;
            } else {
                console.log(msg);
                return;
            }
        },

        applyOverrides: function (plugin) {
            _.each(Object.keys(plugin.overrides || {}), function (key) {
                /* We automatically override all methods and Backbone views and
                 * models that are in the "overrides" namespace.
                 */
                var override = plugin.overrides[key];
                if (typeof override === "object") {
                    if (typeof this.plugged[key] === 'undefined') {
                        this.throwUndefinedDependencyError("Error: Plugin \""+plugin.__name__+"\" tried to override "+key+" but it's not found.");
                    } else {
                        this._extendObject(this.plugged[key], override);
                    }
                } else {
                    this._overrideAttribute(key, plugin);
                }
            }.bind(this));
        },

        initializePlugin: function (plugin) {
            if (_.contains(this.initialized_plugins, plugin.__name__)) {
                // Don't initialize plugins twice, otherwise we get
                // infinite recursion in overridden methods.
                return;
            }
            _.extend(plugin, this.properties);
            if (plugin.optional_dependencies) {
                this.loadOptionalDependencies(plugin);
            }
            this.applyOverrides(plugin);
            if (typeof plugin.initialize === "function") {
                plugin.initialize.bind(plugin)(this);
            }
            this.initialized_plugins.push(plugin.__name__);
        },

        initializePlugins: function (properties) {
            /* The properties variable is an object of attributes and methods
             * which will be attached to the plugins.
             */
            if (!_.size(this.plugins)) {
                return;
            }
            this.properties = properties;
            _.each(_.values(this.plugins), this.initializePlugin.bind(this));
        }
    });
    return {
        'enable': function (object) {
            /* Call this method to make an object pluggable */
            return _.extend(object, {'pluggable': new Pluggable(object)});
        }
    };
}));
