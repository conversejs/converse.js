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

        setOptionalDependencies: function (plugin, dependencies) {
            plugin.optional_dependencies = dependencies;
            return plugin;
        },

        loadOptionalDependencies: function (plugins) {
            var deferred = new $.Deferred();
            require(plugins, 
                function () {
                    _.each(plugins, function (name) {
                        var plugin = this.plugins[name];
                        if (plugin) {
                            this.initializePlugin(plugin).then(
                                deferred.resolve.bind(this, plugins)
                            );
                        }
                    }.bind(this));
                }.bind(this),
                function () {
                    if (this.plugged.strict_plugin_dependencies) {
                        deferred.fail.apply(this, arguments);
                        this.throwUndefinedDependencyError(arguments[0]);
                    } else {
                        deferred.resolve.apply(this, [plugins]);
                    }
                }.bind(this));
            return deferred.promise();
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

        _initializePlugin: function (plugin) {
            this.applyOverrides(plugin);
            if (typeof plugin.initialize === "function") {
                plugin.initialize.bind(plugin)(this);
            }
            this.initialized_plugins.push(plugin.__name__);
        },

        asyncInitializePlugin: function (plugin) {
            var deferred = new $.Deferred();
            this.loadOptionalDependencies(plugin.optional_dependencies).then(
                _.compose(
                    deferred.resolve,
                    this._initializePlugin.bind(this),
                    _.partial(this.setOptionalDependencies, plugin)
                ));
            return deferred.promise();
        },

        initializePlugin: function (plugin) {
            var deferred = new $.Deferred();
            if (_.contains(this.initialized_plugins, plugin.__name__)) {
                // Don't initialize plugins twice, otherwise we get
                // infinite recursion in overridden methods.
                return deferred.resolve().promise();
            }
            _.extend(plugin, this.properties);
            if (plugin.optional_dependencies) {
                this.asyncInitializePlugin(plugin).then(deferred.resolve);
            } else {
                this._initializePlugin(plugin);
                deferred.resolve();
            }
            return deferred.promise();
        },

        initNextPlugin: function (remaining, deferred) {
            if (remaining.length === 0) {
                deferred.resolve();
                return;
            }
            var plugin = remaining.pop();
            this.initializePlugin(plugin).then(
                this.initNextPlugin.bind(this, remaining, deferred));
        },

        initializePlugins: function (properties) {
            /* The properties variable is an object of attributes and methods
             * which will be attached to the plugins.
             */
            var deferred = new $.Deferred();
            if (!_.size(this.plugins)) {
                return deferred.promise();
            }
            this.properties = properties;
            this.initNextPlugin(_.values(this.plugins).reverse(), deferred);
            return deferred;
        }
    });
    return {
        'enable': function (object) {
            /* Call this method to make an object pluggable */
            return _.extend(object, {'pluggable': new Pluggable(object)});
        }
    };
}));
