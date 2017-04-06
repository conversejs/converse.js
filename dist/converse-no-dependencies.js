/** Converse.js
 *
 *  An XMPP chat client that runs in the browser.
 *
 *  Version: 3.0.1
 */

/* jshint ignore:start */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define([], factory);
    } else {
        //Browser globals case.
        root.converse = factory();
    }
}(this, function () {
    //almond, and your modules will be inlined here
/* jshint ignore:end */
/**
 * @license almond 0.3.3 Copyright jQuery Foundation and other contributors.
 * Released under MIT license, http://github.com/requirejs/almond/LICENSE
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part, normalizedBaseParts,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name) {
            name = name.split('/');
            lastIndex = name.length - 1;

            // If wanting node ID compatibility, strip .js from end
            // of IDs. Have to do this here, and not in nameToUrl
            // because node allows either .js or non .js to map
            // to same file.
            if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
            }

            // Starts with a '.' so need the baseName
            if (name[0].charAt(0) === '.' && baseParts) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that 'directory' and not name of the baseName's
                //module. For instance, baseName of 'one/two/three', maps to
                //'one/two/three.js', but we want the directory, 'one/two' for
                //this normalization.
                normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                name = normalizedBaseParts.concat(name);
            }

            //start trimDots
            for (i = 0; i < name.length; i++) {
                part = name[i];
                if (part === '.') {
                    name.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    // If at the start, or previous value is still ..,
                    // keep them so that when converted to a path it may
                    // still work when converted to a path, even though
                    // as an ID it is less than ideal. In larger point
                    // releases, may be better to just kick out an error.
                    if (i === 0 || (i === 1 && name[2] === '..') || name[i - 1] === '..') {
                        continue;
                    } else if (i > 0) {
                        name.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
            //end trimDots

            name = name.join('/');
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            var args = aps.call(arguments, 0);

            //If first arg is not require('string'), and there is only
            //one arg, it is the array form without a callback. Insert
            //a null so that the following concat is correct.
            if (typeof args[0] !== 'string' && args.length === 1) {
                args.push(null);
            }
            return req.apply(undef, args.concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    //Creates a parts array for a relName where first part is plugin ID,
    //second part is resource ID. Assumes relName has already been normalized.
    function makeRelParts(relName) {
        return relName ? splitPrefix(relName) : [];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relParts) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0],
            relResourceName = relParts[1];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relResourceName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relResourceName));
            } else {
                name = normalize(name, relResourceName);
            }
        } else {
            name = normalize(name, relResourceName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i, relParts,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;
        relParts = makeRelParts(relName);

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relParts);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, makeRelParts(callback)).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {
        if (typeof name !== 'string') {
            throw new Error('See almond README: incorrect module build, no module name');
        }

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("almond", function(){});

/*!
 * Sizzle CSS Selector Engine v2.2.1
 * http://sizzlejs.com/
 *
 * Copyright jQuery Foundation and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2015-10-17
 */
(function( window ) {

var i,
	support,
	Expr,
	getText,
	isXML,
	tokenize,
	compile,
	select,
	outermostContext,
	sortInput,
	hasDuplicate,

	// Local document vars
	setDocument,
	document,
	docElem,
	documentIsHTML,
	rbuggyQSA,
	rbuggyMatches,
	matches,
	contains,

	// Instance-specific data
	expando = "sizzle" + 1 * new Date(),
	preferredDoc = window.document,
	dirruns = 0,
	done = 0,
	classCache = createCache(),
	tokenCache = createCache(),
	compilerCache = createCache(),
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
		}
		return 0;
	},

	// General-purpose constants
	MAX_NEGATIVE = 1 << 31,

	// Instance methods
	hasOwn = ({}).hasOwnProperty,
	arr = [],
	pop = arr.pop,
	push_native = arr.push,
	push = arr.push,
	slice = arr.slice,
	// Use a stripped-down indexOf as it's faster than native
	// http://jsperf.com/thor-indexof-vs-for/5
	indexOf = function( list, elem ) {
		var i = 0,
			len = list.length;
		for ( ; i < len; i++ ) {
			if ( list[i] === elem ) {
				return i;
			}
		}
		return -1;
	},

	booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",

	// Regular expressions

	// http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = "[\\x20\\t\\r\\n\\f]",

	// http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
	identifier = "(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",

	// Attribute selectors: http://www.w3.org/TR/selectors/#attribute-selectors
	attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace +
		// Operator (capture 2)
		"*([*^$|!~]?=)" + whitespace +
		// "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
		"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" + whitespace +
		"*\\]",

	pseudos = ":(" + identifier + ")(?:\\((" +
		// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
		// 1. quoted (capture 3; capture 4 or capture 5)
		"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +
		// 2. simple (capture 6)
		"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +
		// 3. anything else (capture 2)
		".*" +
		")\\)|)",

	// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
	rwhitespace = new RegExp( whitespace + "+", "g" ),
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),

	rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
	rcombinators = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*" ),

	rattributeQuotes = new RegExp( "=" + whitespace + "*([^\\]'\"]*?)" + whitespace + "*\\]", "g" ),

	rpseudo = new RegExp( pseudos ),
	ridentifier = new RegExp( "^" + identifier + "$" ),

	matchExpr = {
		"ID": new RegExp( "^#(" + identifier + ")" ),
		"CLASS": new RegExp( "^\\.(" + identifier + ")" ),
		"TAG": new RegExp( "^(" + identifier + "|[*])" ),
		"ATTR": new RegExp( "^" + attributes ),
		"PSEUDO": new RegExp( "^" + pseudos ),
		"CHILD": new RegExp( "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + whitespace +
			"*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
			"*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
		"bool": new RegExp( "^(?:" + booleans + ")$", "i" ),
		// For use in libraries implementing .is()
		// We use this for POS matching in `select`
		"needsContext": new RegExp( "^" + whitespace + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" +
			whitespace + "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
	},

	rinputs = /^(?:input|select|textarea|button)$/i,
	rheader = /^h\d$/i,

	rnative = /^[^{]+\{\s*\[native \w/,

	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

	rsibling = /[+~]/,
	rescape = /'|\\/g,

	// CSS escapes http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
	runescape = new RegExp( "\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)", "ig" ),
	funescape = function( _, escaped, escapedWhitespace ) {
		var high = "0x" + escaped - 0x10000;
		// NaN means non-codepoint
		// Support: Firefox<24
		// Workaround erroneous numeric interpretation of +"0x"
		return high !== high || escapedWhitespace ?
			escaped :
			high < 0 ?
				// BMP codepoint
				String.fromCharCode( high + 0x10000 ) :
				// Supplemental Plane codepoint (surrogate pair)
				String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
	},

	// Used for iframes
	// See setDocument()
	// Removing the function wrapper causes a "Permission Denied"
	// error in IE
	unloadHandler = function() {
		setDocument();
	};

// Optimize for push.apply( _, NodeList )
try {
	push.apply(
		(arr = slice.call( preferredDoc.childNodes )),
		preferredDoc.childNodes
	);
	// Support: Android<4.0
	// Detect silently failing push.apply
	arr[ preferredDoc.childNodes.length ].nodeType;
} catch ( e ) {
	push = { apply: arr.length ?

		// Leverage slice if possible
		function( target, els ) {
			push_native.apply( target, slice.call(els) );
		} :

		// Support: IE<9
		// Otherwise append directly
		function( target, els ) {
			var j = target.length,
				i = 0;
			// Can't trust NodeList.length
			while ( (target[j++] = els[i++]) ) {}
			target.length = j - 1;
		}
	};
}

function Sizzle( selector, context, results, seed ) {
	var m, i, elem, nid, nidselect, match, groups, newSelector,
		newContext = context && context.ownerDocument,

		// nodeType defaults to 9, since context defaults to document
		nodeType = context ? context.nodeType : 9;

	results = results || [];

	// Return early from calls with invalid selector or context
	if ( typeof selector !== "string" || !selector ||
		nodeType !== 1 && nodeType !== 9 && nodeType !== 11 ) {

		return results;
	}

	// Try to shortcut find operations (as opposed to filters) in HTML documents
	if ( !seed ) {

		if ( ( context ? context.ownerDocument || context : preferredDoc ) !== document ) {
			setDocument( context );
		}
		context = context || document;

		if ( documentIsHTML ) {

			// If the selector is sufficiently simple, try using a "get*By*" DOM method
			// (excepting DocumentFragment context, where the methods don't exist)
			if ( nodeType !== 11 && (match = rquickExpr.exec( selector )) ) {

				// ID selector
				if ( (m = match[1]) ) {

					// Document context
					if ( nodeType === 9 ) {
						if ( (elem = context.getElementById( m )) ) {

							// Support: IE, Opera, Webkit
							// TODO: identify versions
							// getElementById can match elements by name instead of ID
							if ( elem.id === m ) {
								results.push( elem );
								return results;
							}
						} else {
							return results;
						}

					// Element context
					} else {

						// Support: IE, Opera, Webkit
						// TODO: identify versions
						// getElementById can match elements by name instead of ID
						if ( newContext && (elem = newContext.getElementById( m )) &&
							contains( context, elem ) &&
							elem.id === m ) {

							results.push( elem );
							return results;
						}
					}

				// Type selector
				} else if ( match[2] ) {
					push.apply( results, context.getElementsByTagName( selector ) );
					return results;

				// Class selector
				} else if ( (m = match[3]) && support.getElementsByClassName &&
					context.getElementsByClassName ) {

					push.apply( results, context.getElementsByClassName( m ) );
					return results;
				}
			}

			// Take advantage of querySelectorAll
			if ( support.qsa &&
				!compilerCache[ selector + " " ] &&
				(!rbuggyQSA || !rbuggyQSA.test( selector )) ) {

				if ( nodeType !== 1 ) {
					newContext = context;
					newSelector = selector;

				// qSA looks outside Element context, which is not what we want
				// Thanks to Andrew Dupont for this workaround technique
				// Support: IE <=8
				// Exclude object elements
				} else if ( context.nodeName.toLowerCase() !== "object" ) {

					// Capture the context ID, setting it first if necessary
					if ( (nid = context.getAttribute( "id" )) ) {
						nid = nid.replace( rescape, "\\$&" );
					} else {
						context.setAttribute( "id", (nid = expando) );
					}

					// Prefix every selector in the list
					groups = tokenize( selector );
					i = groups.length;
					nidselect = ridentifier.test( nid ) ? "#" + nid : "[id='" + nid + "']";
					while ( i-- ) {
						groups[i] = nidselect + " " + toSelector( groups[i] );
					}
					newSelector = groups.join( "," );

					// Expand context for sibling selectors
					newContext = rsibling.test( selector ) && testContext( context.parentNode ) ||
						context;
				}

				if ( newSelector ) {
					try {
						push.apply( results,
							newContext.querySelectorAll( newSelector )
						);
						return results;
					} catch ( qsaError ) {
					} finally {
						if ( nid === expando ) {
							context.removeAttribute( "id" );
						}
					}
				}
			}
		}
	}

	// All others
	return select( selector.replace( rtrim, "$1" ), context, results, seed );
}

/**
 * Create key-value caches of limited size
 * @returns {function(string, object)} Returns the Object data after storing it on itself with
 *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
 *	deleting the oldest entry
 */
function createCache() {
	var keys = [];

	function cache( key, value ) {
		// Use (key + " ") to avoid collision with native prototype properties (see Issue #157)
		if ( keys.push( key + " " ) > Expr.cacheLength ) {
			// Only keep the most recent entries
			delete cache[ keys.shift() ];
		}
		return (cache[ key + " " ] = value);
	}
	return cache;
}

/**
 * Mark a function for special use by Sizzle
 * @param {Function} fn The function to mark
 */
function markFunction( fn ) {
	fn[ expando ] = true;
	return fn;
}

/**
 * Support testing using an element
 * @param {Function} fn Passed the created div and expects a boolean result
 */
function assert( fn ) {
	var div = document.createElement("div");

	try {
		return !!fn( div );
	} catch (e) {
		return false;
	} finally {
		// Remove from its parent by default
		if ( div.parentNode ) {
			div.parentNode.removeChild( div );
		}
		// release memory in IE
		div = null;
	}
}

/**
 * Adds the same handler for all of the specified attrs
 * @param {String} attrs Pipe-separated list of attributes
 * @param {Function} handler The method that will be applied
 */
function addHandle( attrs, handler ) {
	var arr = attrs.split("|"),
		i = arr.length;

	while ( i-- ) {
		Expr.attrHandle[ arr[i] ] = handler;
	}
}

/**
 * Checks document order of two siblings
 * @param {Element} a
 * @param {Element} b
 * @returns {Number} Returns less than 0 if a precedes b, greater than 0 if a follows b
 */
function siblingCheck( a, b ) {
	var cur = b && a,
		diff = cur && a.nodeType === 1 && b.nodeType === 1 &&
			( ~b.sourceIndex || MAX_NEGATIVE ) -
			( ~a.sourceIndex || MAX_NEGATIVE );

	// Use IE sourceIndex if available on both nodes
	if ( diff ) {
		return diff;
	}

	// Check if b follows a
	if ( cur ) {
		while ( (cur = cur.nextSibling) ) {
			if ( cur === b ) {
				return -1;
			}
		}
	}

	return a ? 1 : -1;
}

/**
 * Returns a function to use in pseudos for input types
 * @param {String} type
 */
function createInputPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return name === "input" && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for buttons
 * @param {String} type
 */
function createButtonPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return (name === "input" || name === "button") && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for positionals
 * @param {Function} fn
 */
function createPositionalPseudo( fn ) {
	return markFunction(function( argument ) {
		argument = +argument;
		return markFunction(function( seed, matches ) {
			var j,
				matchIndexes = fn( [], seed.length, argument ),
				i = matchIndexes.length;

			// Match elements found at the specified indexes
			while ( i-- ) {
				if ( seed[ (j = matchIndexes[i]) ] ) {
					seed[j] = !(matches[j] = seed[j]);
				}
			}
		});
	});
}

/**
 * Checks a node for validity as a Sizzle context
 * @param {Element|Object=} context
 * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
 */
function testContext( context ) {
	return context && typeof context.getElementsByTagName !== "undefined" && context;
}

// Expose support vars for convenience
support = Sizzle.support = {};

/**
 * Detects XML nodes
 * @param {Element|Object} elem An element or a document
 * @returns {Boolean} True iff elem is a non-HTML XML node
 */
isXML = Sizzle.isXML = function( elem ) {
	// documentElement is verified for cases where it doesn't yet exist
	// (such as loading iframes in IE - #4833)
	var documentElement = elem && (elem.ownerDocument || elem).documentElement;
	return documentElement ? documentElement.nodeName !== "HTML" : false;
};

/**
 * Sets document-related variables once based on the current document
 * @param {Element|Object} [doc] An element or document object to use to set the document
 * @returns {Object} Returns the current document
 */
setDocument = Sizzle.setDocument = function( node ) {
	var hasCompare, parent,
		doc = node ? node.ownerDocument || node : preferredDoc;

	// Return early if doc is invalid or already selected
	if ( doc === document || doc.nodeType !== 9 || !doc.documentElement ) {
		return document;
	}

	// Update global variables
	document = doc;
	docElem = document.documentElement;
	documentIsHTML = !isXML( document );

	// Support: IE 9-11, Edge
	// Accessing iframe documents after unload throws "permission denied" errors (jQuery #13936)
	if ( (parent = document.defaultView) && parent.top !== parent ) {
		// Support: IE 11
		if ( parent.addEventListener ) {
			parent.addEventListener( "unload", unloadHandler, false );

		// Support: IE 9 - 10 only
		} else if ( parent.attachEvent ) {
			parent.attachEvent( "onunload", unloadHandler );
		}
	}

	/* Attributes
	---------------------------------------------------------------------- */

	// Support: IE<8
	// Verify that getAttribute really returns attributes and not properties
	// (excepting IE8 booleans)
	support.attributes = assert(function( div ) {
		div.className = "i";
		return !div.getAttribute("className");
	});

	/* getElement(s)By*
	---------------------------------------------------------------------- */

	// Check if getElementsByTagName("*") returns only elements
	support.getElementsByTagName = assert(function( div ) {
		div.appendChild( document.createComment("") );
		return !div.getElementsByTagName("*").length;
	});

	// Support: IE<9
	support.getElementsByClassName = rnative.test( document.getElementsByClassName );

	// Support: IE<10
	// Check if getElementById returns elements by name
	// The broken getElementById methods don't pick up programatically-set names,
	// so use a roundabout getElementsByName test
	support.getById = assert(function( div ) {
		docElem.appendChild( div ).id = expando;
		return !document.getElementsByName || !document.getElementsByName( expando ).length;
	});

	// ID find and filter
	if ( support.getById ) {
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var m = context.getElementById( id );
				return m ? [ m ] : [];
			}
		};
		Expr.filter["ID"] = function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				return elem.getAttribute("id") === attrId;
			};
		};
	} else {
		// Support: IE6/7
		// getElementById is not reliable as a find shortcut
		delete Expr.find["ID"];

		Expr.filter["ID"] =  function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				var node = typeof elem.getAttributeNode !== "undefined" &&
					elem.getAttributeNode("id");
				return node && node.value === attrId;
			};
		};
	}

	// Tag
	Expr.find["TAG"] = support.getElementsByTagName ?
		function( tag, context ) {
			if ( typeof context.getElementsByTagName !== "undefined" ) {
				return context.getElementsByTagName( tag );

			// DocumentFragment nodes don't have gEBTN
			} else if ( support.qsa ) {
				return context.querySelectorAll( tag );
			}
		} :

		function( tag, context ) {
			var elem,
				tmp = [],
				i = 0,
				// By happy coincidence, a (broken) gEBTN appears on DocumentFragment nodes too
				results = context.getElementsByTagName( tag );

			// Filter out possible comments
			if ( tag === "*" ) {
				while ( (elem = results[i++]) ) {
					if ( elem.nodeType === 1 ) {
						tmp.push( elem );
					}
				}

				return tmp;
			}
			return results;
		};

	// Class
	Expr.find["CLASS"] = support.getElementsByClassName && function( className, context ) {
		if ( typeof context.getElementsByClassName !== "undefined" && documentIsHTML ) {
			return context.getElementsByClassName( className );
		}
	};

	/* QSA/matchesSelector
	---------------------------------------------------------------------- */

	// QSA and matchesSelector support

	// matchesSelector(:active) reports false when true (IE9/Opera 11.5)
	rbuggyMatches = [];

	// qSa(:focus) reports false when true (Chrome 21)
	// We allow this because of a bug in IE8/9 that throws an error
	// whenever `document.activeElement` is accessed on an iframe
	// So, we allow :focus to pass through QSA all the time to avoid the IE error
	// See http://bugs.jquery.com/ticket/13378
	rbuggyQSA = [];

	if ( (support.qsa = rnative.test( document.querySelectorAll )) ) {
		// Build QSA regex
		// Regex strategy adopted from Diego Perini
		assert(function( div ) {
			// Select is set to empty string on purpose
			// This is to test IE's treatment of not explicitly
			// setting a boolean content attribute,
			// since its presence should be enough
			// http://bugs.jquery.com/ticket/12359
			docElem.appendChild( div ).innerHTML = "<a id='" + expando + "'></a>" +
				"<select id='" + expando + "-\r\\' msallowcapture=''>" +
				"<option selected=''></option></select>";

			// Support: IE8, Opera 11-12.16
			// Nothing should be selected when empty strings follow ^= or $= or *=
			// The test attribute must be unknown in Opera but "safe" for WinRT
			// http://msdn.microsoft.com/en-us/library/ie/hh465388.aspx#attribute_section
			if ( div.querySelectorAll("[msallowcapture^='']").length ) {
				rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:''|\"\")" );
			}

			// Support: IE8
			// Boolean attributes and "value" are not treated correctly
			if ( !div.querySelectorAll("[selected]").length ) {
				rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
			}

			// Support: Chrome<29, Android<4.4, Safari<7.0+, iOS<7.0+, PhantomJS<1.9.8+
			if ( !div.querySelectorAll( "[id~=" + expando + "-]" ).length ) {
				rbuggyQSA.push("~=");
			}

			// Webkit/Opera - :checked should return selected option elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			// IE8 throws error here and will not see later tests
			if ( !div.querySelectorAll(":checked").length ) {
				rbuggyQSA.push(":checked");
			}

			// Support: Safari 8+, iOS 8+
			// https://bugs.webkit.org/show_bug.cgi?id=136851
			// In-page `selector#id sibing-combinator selector` fails
			if ( !div.querySelectorAll( "a#" + expando + "+*" ).length ) {
				rbuggyQSA.push(".#.+[+~]");
			}
		});

		assert(function( div ) {
			// Support: Windows 8 Native Apps
			// The type and name attributes are restricted during .innerHTML assignment
			var input = document.createElement("input");
			input.setAttribute( "type", "hidden" );
			div.appendChild( input ).setAttribute( "name", "D" );

			// Support: IE8
			// Enforce case-sensitivity of name attribute
			if ( div.querySelectorAll("[name=d]").length ) {
				rbuggyQSA.push( "name" + whitespace + "*[*^$|!~]?=" );
			}

			// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
			// IE8 throws error here and will not see later tests
			if ( !div.querySelectorAll(":enabled").length ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Opera 10-11 does not throw on post-comma invalid pseudos
			div.querySelectorAll("*,:x");
			rbuggyQSA.push(",.*:");
		});
	}

	if ( (support.matchesSelector = rnative.test( (matches = docElem.matches ||
		docElem.webkitMatchesSelector ||
		docElem.mozMatchesSelector ||
		docElem.oMatchesSelector ||
		docElem.msMatchesSelector) )) ) {

		assert(function( div ) {
			// Check to see if it's possible to do matchesSelector
			// on a disconnected node (IE 9)
			support.disconnectedMatch = matches.call( div, "div" );

			// This should fail with an exception
			// Gecko does not error, returns false instead
			matches.call( div, "[s!='']:x" );
			rbuggyMatches.push( "!=", pseudos );
		});
	}

	rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join("|") );
	rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join("|") );

	/* Contains
	---------------------------------------------------------------------- */
	hasCompare = rnative.test( docElem.compareDocumentPosition );

	// Element contains another
	// Purposefully self-exclusive
	// As in, an element does not contain itself
	contains = hasCompare || rnative.test( docElem.contains ) ?
		function( a, b ) {
			var adown = a.nodeType === 9 ? a.documentElement : a,
				bup = b && b.parentNode;
			return a === bup || !!( bup && bup.nodeType === 1 && (
				adown.contains ?
					adown.contains( bup ) :
					a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
			));
		} :
		function( a, b ) {
			if ( b ) {
				while ( (b = b.parentNode) ) {
					if ( b === a ) {
						return true;
					}
				}
			}
			return false;
		};

	/* Sorting
	---------------------------------------------------------------------- */

	// Document order sorting
	sortOrder = hasCompare ?
	function( a, b ) {

		// Flag for duplicate removal
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		// Sort on method existence if only one input has compareDocumentPosition
		var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
		if ( compare ) {
			return compare;
		}

		// Calculate position if both inputs belong to the same document
		compare = ( a.ownerDocument || a ) === ( b.ownerDocument || b ) ?
			a.compareDocumentPosition( b ) :

			// Otherwise we know they are disconnected
			1;

		// Disconnected nodes
		if ( compare & 1 ||
			(!support.sortDetached && b.compareDocumentPosition( a ) === compare) ) {

			// Choose the first element that is related to our preferred document
			if ( a === document || a.ownerDocument === preferredDoc && contains(preferredDoc, a) ) {
				return -1;
			}
			if ( b === document || b.ownerDocument === preferredDoc && contains(preferredDoc, b) ) {
				return 1;
			}

			// Maintain original order
			return sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;
		}

		return compare & 4 ? -1 : 1;
	} :
	function( a, b ) {
		// Exit early if the nodes are identical
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		var cur,
			i = 0,
			aup = a.parentNode,
			bup = b.parentNode,
			ap = [ a ],
			bp = [ b ];

		// Parentless nodes are either documents or disconnected
		if ( !aup || !bup ) {
			return a === document ? -1 :
				b === document ? 1 :
				aup ? -1 :
				bup ? 1 :
				sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;

		// If the nodes are siblings, we can do a quick check
		} else if ( aup === bup ) {
			return siblingCheck( a, b );
		}

		// Otherwise we need full lists of their ancestors for comparison
		cur = a;
		while ( (cur = cur.parentNode) ) {
			ap.unshift( cur );
		}
		cur = b;
		while ( (cur = cur.parentNode) ) {
			bp.unshift( cur );
		}

		// Walk down the tree looking for a discrepancy
		while ( ap[i] === bp[i] ) {
			i++;
		}

		return i ?
			// Do a sibling check if the nodes have a common ancestor
			siblingCheck( ap[i], bp[i] ) :

			// Otherwise nodes in our document sort first
			ap[i] === preferredDoc ? -1 :
			bp[i] === preferredDoc ? 1 :
			0;
	};

	return document;
};

Sizzle.matches = function( expr, elements ) {
	return Sizzle( expr, null, null, elements );
};

Sizzle.matchesSelector = function( elem, expr ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	// Make sure that attribute selectors are quoted
	expr = expr.replace( rattributeQuotes, "='$1']" );

	if ( support.matchesSelector && documentIsHTML &&
		!compilerCache[ expr + " " ] &&
		( !rbuggyMatches || !rbuggyMatches.test( expr ) ) &&
		( !rbuggyQSA     || !rbuggyQSA.test( expr ) ) ) {

		try {
			var ret = matches.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			if ( ret || support.disconnectedMatch ||
					// As well, disconnected nodes are said to be in a document
					// fragment in IE 9
					elem.document && elem.document.nodeType !== 11 ) {
				return ret;
			}
		} catch (e) {}
	}

	return Sizzle( expr, document, null, [ elem ] ).length > 0;
};

Sizzle.contains = function( context, elem ) {
	// Set document vars if needed
	if ( ( context.ownerDocument || context ) !== document ) {
		setDocument( context );
	}
	return contains( context, elem );
};

Sizzle.attr = function( elem, name ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	var fn = Expr.attrHandle[ name.toLowerCase() ],
		// Don't get fooled by Object.prototype properties (jQuery #13807)
		val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
			fn( elem, name, !documentIsHTML ) :
			undefined;

	return val !== undefined ?
		val :
		support.attributes || !documentIsHTML ?
			elem.getAttribute( name ) :
			(val = elem.getAttributeNode(name)) && val.specified ?
				val.value :
				null;
};

Sizzle.error = function( msg ) {
	throw new Error( "Syntax error, unrecognized expression: " + msg );
};

/**
 * Document sorting and removing duplicates
 * @param {ArrayLike} results
 */
Sizzle.uniqueSort = function( results ) {
	var elem,
		duplicates = [],
		j = 0,
		i = 0;

	// Unless we *know* we can detect duplicates, assume their presence
	hasDuplicate = !support.detectDuplicates;
	sortInput = !support.sortStable && results.slice( 0 );
	results.sort( sortOrder );

	if ( hasDuplicate ) {
		while ( (elem = results[i++]) ) {
			if ( elem === results[ i ] ) {
				j = duplicates.push( i );
			}
		}
		while ( j-- ) {
			results.splice( duplicates[ j ], 1 );
		}
	}

	// Clear input after sorting to release objects
	// See https://github.com/jquery/sizzle/pull/225
	sortInput = null;

	return results;
};

/**
 * Utility function for retrieving the text value of an array of DOM nodes
 * @param {Array|Element} elem
 */
getText = Sizzle.getText = function( elem ) {
	var node,
		ret = "",
		i = 0,
		nodeType = elem.nodeType;

	if ( !nodeType ) {
		// If no nodeType, this is expected to be an array
		while ( (node = elem[i++]) ) {
			// Do not traverse comment nodes
			ret += getText( node );
		}
	} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
		// Use textContent for elements
		// innerText usage removed for consistency of new lines (jQuery #11153)
		if ( typeof elem.textContent === "string" ) {
			return elem.textContent;
		} else {
			// Traverse its children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				ret += getText( elem );
			}
		}
	} else if ( nodeType === 3 || nodeType === 4 ) {
		return elem.nodeValue;
	}
	// Do not include comment or processing instruction nodes

	return ret;
};

Expr = Sizzle.selectors = {

	// Can be adjusted by the user
	cacheLength: 50,

	createPseudo: markFunction,

	match: matchExpr,

	attrHandle: {},

	find: {},

	relative: {
		">": { dir: "parentNode", first: true },
		" ": { dir: "parentNode" },
		"+": { dir: "previousSibling", first: true },
		"~": { dir: "previousSibling" }
	},

	preFilter: {
		"ATTR": function( match ) {
			match[1] = match[1].replace( runescape, funescape );

			// Move the given value to match[3] whether quoted or unquoted
			match[3] = ( match[3] || match[4] || match[5] || "" ).replace( runescape, funescape );

			if ( match[2] === "~=" ) {
				match[3] = " " + match[3] + " ";
			}

			return match.slice( 0, 4 );
		},

		"CHILD": function( match ) {
			/* matches from matchExpr["CHILD"]
				1 type (only|nth|...)
				2 what (child|of-type)
				3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
				4 xn-component of xn+y argument ([+-]?\d*n|)
				5 sign of xn-component
				6 x of xn-component
				7 sign of y-component
				8 y of y-component
			*/
			match[1] = match[1].toLowerCase();

			if ( match[1].slice( 0, 3 ) === "nth" ) {
				// nth-* requires argument
				if ( !match[3] ) {
					Sizzle.error( match[0] );
				}

				// numeric x and y parameters for Expr.filter.CHILD
				// remember that false/true cast respectively to 0/1
				match[4] = +( match[4] ? match[5] + (match[6] || 1) : 2 * ( match[3] === "even" || match[3] === "odd" ) );
				match[5] = +( ( match[7] + match[8] ) || match[3] === "odd" );

			// other types prohibit arguments
			} else if ( match[3] ) {
				Sizzle.error( match[0] );
			}

			return match;
		},

		"PSEUDO": function( match ) {
			var excess,
				unquoted = !match[6] && match[2];

			if ( matchExpr["CHILD"].test( match[0] ) ) {
				return null;
			}

			// Accept quoted arguments as-is
			if ( match[3] ) {
				match[2] = match[4] || match[5] || "";

			// Strip excess characters from unquoted arguments
			} else if ( unquoted && rpseudo.test( unquoted ) &&
				// Get excess from tokenize (recursively)
				(excess = tokenize( unquoted, true )) &&
				// advance to the next closing parenthesis
				(excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length) ) {

				// excess is a negative index
				match[0] = match[0].slice( 0, excess );
				match[2] = unquoted.slice( 0, excess );
			}

			// Return only captures needed by the pseudo filter method (type and argument)
			return match.slice( 0, 3 );
		}
	},

	filter: {

		"TAG": function( nodeNameSelector ) {
			var nodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
			return nodeNameSelector === "*" ?
				function() { return true; } :
				function( elem ) {
					return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
				};
		},

		"CLASS": function( className ) {
			var pattern = classCache[ className + " " ];

			return pattern ||
				(pattern = new RegExp( "(^|" + whitespace + ")" + className + "(" + whitespace + "|$)" )) &&
				classCache( className, function( elem ) {
					return pattern.test( typeof elem.className === "string" && elem.className || typeof elem.getAttribute !== "undefined" && elem.getAttribute("class") || "" );
				});
		},

		"ATTR": function( name, operator, check ) {
			return function( elem ) {
				var result = Sizzle.attr( elem, name );

				if ( result == null ) {
					return operator === "!=";
				}
				if ( !operator ) {
					return true;
				}

				result += "";

				return operator === "=" ? result === check :
					operator === "!=" ? result !== check :
					operator === "^=" ? check && result.indexOf( check ) === 0 :
					operator === "*=" ? check && result.indexOf( check ) > -1 :
					operator === "$=" ? check && result.slice( -check.length ) === check :
					operator === "~=" ? ( " " + result.replace( rwhitespace, " " ) + " " ).indexOf( check ) > -1 :
					operator === "|=" ? result === check || result.slice( 0, check.length + 1 ) === check + "-" :
					false;
			};
		},

		"CHILD": function( type, what, argument, first, last ) {
			var simple = type.slice( 0, 3 ) !== "nth",
				forward = type.slice( -4 ) !== "last",
				ofType = what === "of-type";

			return first === 1 && last === 0 ?

				// Shortcut for :nth-*(n)
				function( elem ) {
					return !!elem.parentNode;
				} :

				function( elem, context, xml ) {
					var cache, uniqueCache, outerCache, node, nodeIndex, start,
						dir = simple !== forward ? "nextSibling" : "previousSibling",
						parent = elem.parentNode,
						name = ofType && elem.nodeName.toLowerCase(),
						useCache = !xml && !ofType,
						diff = false;

					if ( parent ) {

						// :(first|last|only)-(child|of-type)
						if ( simple ) {
							while ( dir ) {
								node = elem;
								while ( (node = node[ dir ]) ) {
									if ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) {

										return false;
									}
								}
								// Reverse direction for :only-* (if we haven't yet done so)
								start = dir = type === "only" && !start && "nextSibling";
							}
							return true;
						}

						start = [ forward ? parent.firstChild : parent.lastChild ];

						// non-xml :nth-child(...) stores cache data on `parent`
						if ( forward && useCache ) {

							// Seek `elem` from a previously-cached index

							// ...in a gzip-friendly way
							node = parent;
							outerCache = node[ expando ] || (node[ expando ] = {});

							// Support: IE <9 only
							// Defend against cloned attroperties (jQuery gh-1709)
							uniqueCache = outerCache[ node.uniqueID ] ||
								(outerCache[ node.uniqueID ] = {});

							cache = uniqueCache[ type ] || [];
							nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
							diff = nodeIndex && cache[ 2 ];
							node = nodeIndex && parent.childNodes[ nodeIndex ];

							while ( (node = ++nodeIndex && node && node[ dir ] ||

								// Fallback to seeking `elem` from the start
								(diff = nodeIndex = 0) || start.pop()) ) {

								// When found, cache indexes on `parent` and break
								if ( node.nodeType === 1 && ++diff && node === elem ) {
									uniqueCache[ type ] = [ dirruns, nodeIndex, diff ];
									break;
								}
							}

						} else {
							// Use previously-cached element index if available
							if ( useCache ) {
								// ...in a gzip-friendly way
								node = elem;
								outerCache = node[ expando ] || (node[ expando ] = {});

								// Support: IE <9 only
								// Defend against cloned attroperties (jQuery gh-1709)
								uniqueCache = outerCache[ node.uniqueID ] ||
									(outerCache[ node.uniqueID ] = {});

								cache = uniqueCache[ type ] || [];
								nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
								diff = nodeIndex;
							}

							// xml :nth-child(...)
							// or :nth-last-child(...) or :nth(-last)?-of-type(...)
							if ( diff === false ) {
								// Use the same loop as above to seek `elem` from the start
								while ( (node = ++nodeIndex && node && node[ dir ] ||
									(diff = nodeIndex = 0) || start.pop()) ) {

									if ( ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) &&
										++diff ) {

										// Cache the index of each encountered element
										if ( useCache ) {
											outerCache = node[ expando ] || (node[ expando ] = {});

											// Support: IE <9 only
											// Defend against cloned attroperties (jQuery gh-1709)
											uniqueCache = outerCache[ node.uniqueID ] ||
												(outerCache[ node.uniqueID ] = {});

											uniqueCache[ type ] = [ dirruns, diff ];
										}

										if ( node === elem ) {
											break;
										}
									}
								}
							}
						}

						// Incorporate the offset, then check against cycle size
						diff -= last;
						return diff === first || ( diff % first === 0 && diff / first >= 0 );
					}
				};
		},

		"PSEUDO": function( pseudo, argument ) {
			// pseudo-class names are case-insensitive
			// http://www.w3.org/TR/selectors/#pseudo-classes
			// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
			// Remember that setFilters inherits from pseudos
			var args,
				fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
					Sizzle.error( "unsupported pseudo: " + pseudo );

			// The user may use createPseudo to indicate that
			// arguments are needed to create the filter function
			// just as Sizzle does
			if ( fn[ expando ] ) {
				return fn( argument );
			}

			// But maintain support for old signatures
			if ( fn.length > 1 ) {
				args = [ pseudo, pseudo, "", argument ];
				return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
					markFunction(function( seed, matches ) {
						var idx,
							matched = fn( seed, argument ),
							i = matched.length;
						while ( i-- ) {
							idx = indexOf( seed, matched[i] );
							seed[ idx ] = !( matches[ idx ] = matched[i] );
						}
					}) :
					function( elem ) {
						return fn( elem, 0, args );
					};
			}

			return fn;
		}
	},

	pseudos: {
		// Potentially complex pseudos
		"not": markFunction(function( selector ) {
			// Trim the selector passed to compile
			// to avoid treating leading and trailing
			// spaces as combinators
			var input = [],
				results = [],
				matcher = compile( selector.replace( rtrim, "$1" ) );

			return matcher[ expando ] ?
				markFunction(function( seed, matches, context, xml ) {
					var elem,
						unmatched = matcher( seed, null, xml, [] ),
						i = seed.length;

					// Match elements unmatched by `matcher`
					while ( i-- ) {
						if ( (elem = unmatched[i]) ) {
							seed[i] = !(matches[i] = elem);
						}
					}
				}) :
				function( elem, context, xml ) {
					input[0] = elem;
					matcher( input, null, xml, results );
					// Don't keep the element (issue #299)
					input[0] = null;
					return !results.pop();
				};
		}),

		"has": markFunction(function( selector ) {
			return function( elem ) {
				return Sizzle( selector, elem ).length > 0;
			};
		}),

		"contains": markFunction(function( text ) {
			text = text.replace( runescape, funescape );
			return function( elem ) {
				return ( elem.textContent || elem.innerText || getText( elem ) ).indexOf( text ) > -1;
			};
		}),

		// "Whether an element is represented by a :lang() selector
		// is based solely on the element's language value
		// being equal to the identifier C,
		// or beginning with the identifier C immediately followed by "-".
		// The matching of C against the element's language value is performed case-insensitively.
		// The identifier C does not have to be a valid language name."
		// http://www.w3.org/TR/selectors/#lang-pseudo
		"lang": markFunction( function( lang ) {
			// lang value must be a valid identifier
			if ( !ridentifier.test(lang || "") ) {
				Sizzle.error( "unsupported lang: " + lang );
			}
			lang = lang.replace( runescape, funescape ).toLowerCase();
			return function( elem ) {
				var elemLang;
				do {
					if ( (elemLang = documentIsHTML ?
						elem.lang :
						elem.getAttribute("xml:lang") || elem.getAttribute("lang")) ) {

						elemLang = elemLang.toLowerCase();
						return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
					}
				} while ( (elem = elem.parentNode) && elem.nodeType === 1 );
				return false;
			};
		}),

		// Miscellaneous
		"target": function( elem ) {
			var hash = window.location && window.location.hash;
			return hash && hash.slice( 1 ) === elem.id;
		},

		"root": function( elem ) {
			return elem === docElem;
		},

		"focus": function( elem ) {
			return elem === document.activeElement && (!document.hasFocus || document.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
		},

		// Boolean properties
		"enabled": function( elem ) {
			return elem.disabled === false;
		},

		"disabled": function( elem ) {
			return elem.disabled === true;
		},

		"checked": function( elem ) {
			// In CSS3, :checked should return both checked and selected elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			var nodeName = elem.nodeName.toLowerCase();
			return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
		},

		"selected": function( elem ) {
			// Accessing this property makes selected-by-default
			// options in Safari work properly
			if ( elem.parentNode ) {
				elem.parentNode.selectedIndex;
			}

			return elem.selected === true;
		},

		// Contents
		"empty": function( elem ) {
			// http://www.w3.org/TR/selectors/#empty-pseudo
			// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
			//   but not by others (comment: 8; processing instruction: 7; etc.)
			// nodeType < 6 works because attributes (2) do not appear as children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				if ( elem.nodeType < 6 ) {
					return false;
				}
			}
			return true;
		},

		"parent": function( elem ) {
			return !Expr.pseudos["empty"]( elem );
		},

		// Element/input types
		"header": function( elem ) {
			return rheader.test( elem.nodeName );
		},

		"input": function( elem ) {
			return rinputs.test( elem.nodeName );
		},

		"button": function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return name === "input" && elem.type === "button" || name === "button";
		},

		"text": function( elem ) {
			var attr;
			return elem.nodeName.toLowerCase() === "input" &&
				elem.type === "text" &&

				// Support: IE<8
				// New HTML5 attribute values (e.g., "search") appear with elem.type === "text"
				( (attr = elem.getAttribute("type")) == null || attr.toLowerCase() === "text" );
		},

		// Position-in-collection
		"first": createPositionalPseudo(function() {
			return [ 0 ];
		}),

		"last": createPositionalPseudo(function( matchIndexes, length ) {
			return [ length - 1 ];
		}),

		"eq": createPositionalPseudo(function( matchIndexes, length, argument ) {
			return [ argument < 0 ? argument + length : argument ];
		}),

		"even": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 0;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"odd": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 1;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"lt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; --i >= 0; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"gt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; ++i < length; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		})
	}
};

Expr.pseudos["nth"] = Expr.pseudos["eq"];

// Add button/input type pseudos
for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
	Expr.pseudos[ i ] = createInputPseudo( i );
}
for ( i in { submit: true, reset: true } ) {
	Expr.pseudos[ i ] = createButtonPseudo( i );
}

// Easy API for creating new setFilters
function setFilters() {}
setFilters.prototype = Expr.filters = Expr.pseudos;
Expr.setFilters = new setFilters();

tokenize = Sizzle.tokenize = function( selector, parseOnly ) {
	var matched, match, tokens, type,
		soFar, groups, preFilters,
		cached = tokenCache[ selector + " " ];

	if ( cached ) {
		return parseOnly ? 0 : cached.slice( 0 );
	}

	soFar = selector;
	groups = [];
	preFilters = Expr.preFilter;

	while ( soFar ) {

		// Comma and first run
		if ( !matched || (match = rcomma.exec( soFar )) ) {
			if ( match ) {
				// Don't consume trailing commas as valid
				soFar = soFar.slice( match[0].length ) || soFar;
			}
			groups.push( (tokens = []) );
		}

		matched = false;

		// Combinators
		if ( (match = rcombinators.exec( soFar )) ) {
			matched = match.shift();
			tokens.push({
				value: matched,
				// Cast descendant combinators to space
				type: match[0].replace( rtrim, " " )
			});
			soFar = soFar.slice( matched.length );
		}

		// Filters
		for ( type in Expr.filter ) {
			if ( (match = matchExpr[ type ].exec( soFar )) && (!preFilters[ type ] ||
				(match = preFilters[ type ]( match ))) ) {
				matched = match.shift();
				tokens.push({
					value: matched,
					type: type,
					matches: match
				});
				soFar = soFar.slice( matched.length );
			}
		}

		if ( !matched ) {
			break;
		}
	}

	// Return the length of the invalid excess
	// if we're just parsing
	// Otherwise, throw an error or return tokens
	return parseOnly ?
		soFar.length :
		soFar ?
			Sizzle.error( selector ) :
			// Cache the tokens
			tokenCache( selector, groups ).slice( 0 );
};

function toSelector( tokens ) {
	var i = 0,
		len = tokens.length,
		selector = "";
	for ( ; i < len; i++ ) {
		selector += tokens[i].value;
	}
	return selector;
}

function addCombinator( matcher, combinator, base ) {
	var dir = combinator.dir,
		checkNonElements = base && dir === "parentNode",
		doneName = done++;

	return combinator.first ?
		// Check against closest ancestor/preceding element
		function( elem, context, xml ) {
			while ( (elem = elem[ dir ]) ) {
				if ( elem.nodeType === 1 || checkNonElements ) {
					return matcher( elem, context, xml );
				}
			}
		} :

		// Check against all ancestor/preceding elements
		function( elem, context, xml ) {
			var oldCache, uniqueCache, outerCache,
				newCache = [ dirruns, doneName ];

			// We can't set arbitrary data on XML nodes, so they don't benefit from combinator caching
			if ( xml ) {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						if ( matcher( elem, context, xml ) ) {
							return true;
						}
					}
				}
			} else {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						outerCache = elem[ expando ] || (elem[ expando ] = {});

						// Support: IE <9 only
						// Defend against cloned attroperties (jQuery gh-1709)
						uniqueCache = outerCache[ elem.uniqueID ] || (outerCache[ elem.uniqueID ] = {});

						if ( (oldCache = uniqueCache[ dir ]) &&
							oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

							// Assign to newCache so results back-propagate to previous elements
							return (newCache[ 2 ] = oldCache[ 2 ]);
						} else {
							// Reuse newcache so results back-propagate to previous elements
							uniqueCache[ dir ] = newCache;

							// A match means we're done; a fail means we have to keep checking
							if ( (newCache[ 2 ] = matcher( elem, context, xml )) ) {
								return true;
							}
						}
					}
				}
			}
		};
}

function elementMatcher( matchers ) {
	return matchers.length > 1 ?
		function( elem, context, xml ) {
			var i = matchers.length;
			while ( i-- ) {
				if ( !matchers[i]( elem, context, xml ) ) {
					return false;
				}
			}
			return true;
		} :
		matchers[0];
}

function multipleContexts( selector, contexts, results ) {
	var i = 0,
		len = contexts.length;
	for ( ; i < len; i++ ) {
		Sizzle( selector, contexts[i], results );
	}
	return results;
}

function condense( unmatched, map, filter, context, xml ) {
	var elem,
		newUnmatched = [],
		i = 0,
		len = unmatched.length,
		mapped = map != null;

	for ( ; i < len; i++ ) {
		if ( (elem = unmatched[i]) ) {
			if ( !filter || filter( elem, context, xml ) ) {
				newUnmatched.push( elem );
				if ( mapped ) {
					map.push( i );
				}
			}
		}
	}

	return newUnmatched;
}

function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
	if ( postFilter && !postFilter[ expando ] ) {
		postFilter = setMatcher( postFilter );
	}
	if ( postFinder && !postFinder[ expando ] ) {
		postFinder = setMatcher( postFinder, postSelector );
	}
	return markFunction(function( seed, results, context, xml ) {
		var temp, i, elem,
			preMap = [],
			postMap = [],
			preexisting = results.length,

			// Get initial elements from seed or context
			elems = seed || multipleContexts( selector || "*", context.nodeType ? [ context ] : context, [] ),

			// Prefilter to get matcher input, preserving a map for seed-results synchronization
			matcherIn = preFilter && ( seed || !selector ) ?
				condense( elems, preMap, preFilter, context, xml ) :
				elems,

			matcherOut = matcher ?
				// If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
				postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

					// ...intermediate processing is necessary
					[] :

					// ...otherwise use results directly
					results :
				matcherIn;

		// Find primary matches
		if ( matcher ) {
			matcher( matcherIn, matcherOut, context, xml );
		}

		// Apply postFilter
		if ( postFilter ) {
			temp = condense( matcherOut, postMap );
			postFilter( temp, [], context, xml );

			// Un-match failing elements by moving them back to matcherIn
			i = temp.length;
			while ( i-- ) {
				if ( (elem = temp[i]) ) {
					matcherOut[ postMap[i] ] = !(matcherIn[ postMap[i] ] = elem);
				}
			}
		}

		if ( seed ) {
			if ( postFinder || preFilter ) {
				if ( postFinder ) {
					// Get the final matcherOut by condensing this intermediate into postFinder contexts
					temp = [];
					i = matcherOut.length;
					while ( i-- ) {
						if ( (elem = matcherOut[i]) ) {
							// Restore matcherIn since elem is not yet a final match
							temp.push( (matcherIn[i] = elem) );
						}
					}
					postFinder( null, (matcherOut = []), temp, xml );
				}

				// Move matched elements from seed to results to keep them synchronized
				i = matcherOut.length;
				while ( i-- ) {
					if ( (elem = matcherOut[i]) &&
						(temp = postFinder ? indexOf( seed, elem ) : preMap[i]) > -1 ) {

						seed[temp] = !(results[temp] = elem);
					}
				}
			}

		// Add elements to results, through postFinder if defined
		} else {
			matcherOut = condense(
				matcherOut === results ?
					matcherOut.splice( preexisting, matcherOut.length ) :
					matcherOut
			);
			if ( postFinder ) {
				postFinder( null, results, matcherOut, xml );
			} else {
				push.apply( results, matcherOut );
			}
		}
	});
}

function matcherFromTokens( tokens ) {
	var checkContext, matcher, j,
		len = tokens.length,
		leadingRelative = Expr.relative[ tokens[0].type ],
		implicitRelative = leadingRelative || Expr.relative[" "],
		i = leadingRelative ? 1 : 0,

		// The foundational matcher ensures that elements are reachable from top-level context(s)
		matchContext = addCombinator( function( elem ) {
			return elem === checkContext;
		}, implicitRelative, true ),
		matchAnyContext = addCombinator( function( elem ) {
			return indexOf( checkContext, elem ) > -1;
		}, implicitRelative, true ),
		matchers = [ function( elem, context, xml ) {
			var ret = ( !leadingRelative && ( xml || context !== outermostContext ) ) || (
				(checkContext = context).nodeType ?
					matchContext( elem, context, xml ) :
					matchAnyContext( elem, context, xml ) );
			// Avoid hanging onto element (issue #299)
			checkContext = null;
			return ret;
		} ];

	for ( ; i < len; i++ ) {
		if ( (matcher = Expr.relative[ tokens[i].type ]) ) {
			matchers = [ addCombinator(elementMatcher( matchers ), matcher) ];
		} else {
			matcher = Expr.filter[ tokens[i].type ].apply( null, tokens[i].matches );

			// Return special upon seeing a positional matcher
			if ( matcher[ expando ] ) {
				// Find the next relative operator (if any) for proper handling
				j = ++i;
				for ( ; j < len; j++ ) {
					if ( Expr.relative[ tokens[j].type ] ) {
						break;
					}
				}
				return setMatcher(
					i > 1 && elementMatcher( matchers ),
					i > 1 && toSelector(
						// If the preceding token was a descendant combinator, insert an implicit any-element `*`
						tokens.slice( 0, i - 1 ).concat({ value: tokens[ i - 2 ].type === " " ? "*" : "" })
					).replace( rtrim, "$1" ),
					matcher,
					i < j && matcherFromTokens( tokens.slice( i, j ) ),
					j < len && matcherFromTokens( (tokens = tokens.slice( j )) ),
					j < len && toSelector( tokens )
				);
			}
			matchers.push( matcher );
		}
	}

	return elementMatcher( matchers );
}

function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
	var bySet = setMatchers.length > 0,
		byElement = elementMatchers.length > 0,
		superMatcher = function( seed, context, xml, results, outermost ) {
			var elem, j, matcher,
				matchedCount = 0,
				i = "0",
				unmatched = seed && [],
				setMatched = [],
				contextBackup = outermostContext,
				// We must always have either seed elements or outermost context
				elems = seed || byElement && Expr.find["TAG"]( "*", outermost ),
				// Use integer dirruns iff this is the outermost matcher
				dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.random() || 0.1),
				len = elems.length;

			if ( outermost ) {
				outermostContext = context === document || context || outermost;
			}

			// Add elements passing elementMatchers directly to results
			// Support: IE<9, Safari
			// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching elements by id
			for ( ; i !== len && (elem = elems[i]) != null; i++ ) {
				if ( byElement && elem ) {
					j = 0;
					if ( !context && elem.ownerDocument !== document ) {
						setDocument( elem );
						xml = !documentIsHTML;
					}
					while ( (matcher = elementMatchers[j++]) ) {
						if ( matcher( elem, context || document, xml) ) {
							results.push( elem );
							break;
						}
					}
					if ( outermost ) {
						dirruns = dirrunsUnique;
					}
				}

				// Track unmatched elements for set filters
				if ( bySet ) {
					// They will have gone through all possible matchers
					if ( (elem = !matcher && elem) ) {
						matchedCount--;
					}

					// Lengthen the array for every element, matched or not
					if ( seed ) {
						unmatched.push( elem );
					}
				}
			}

			// `i` is now the count of elements visited above, and adding it to `matchedCount`
			// makes the latter nonnegative.
			matchedCount += i;

			// Apply set filters to unmatched elements
			// NOTE: This can be skipped if there are no unmatched elements (i.e., `matchedCount`
			// equals `i`), unless we didn't visit _any_ elements in the above loop because we have
			// no element matchers and no seed.
			// Incrementing an initially-string "0" `i` allows `i` to remain a string only in that
			// case, which will result in a "00" `matchedCount` that differs from `i` but is also
			// numerically zero.
			if ( bySet && i !== matchedCount ) {
				j = 0;
				while ( (matcher = setMatchers[j++]) ) {
					matcher( unmatched, setMatched, context, xml );
				}

				if ( seed ) {
					// Reintegrate element matches to eliminate the need for sorting
					if ( matchedCount > 0 ) {
						while ( i-- ) {
							if ( !(unmatched[i] || setMatched[i]) ) {
								setMatched[i] = pop.call( results );
							}
						}
					}

					// Discard index placeholder values to get only actual matches
					setMatched = condense( setMatched );
				}

				// Add matches to results
				push.apply( results, setMatched );

				// Seedless set matches succeeding multiple successful matchers stipulate sorting
				if ( outermost && !seed && setMatched.length > 0 &&
					( matchedCount + setMatchers.length ) > 1 ) {

					Sizzle.uniqueSort( results );
				}
			}

			// Override manipulation of globals by nested matchers
			if ( outermost ) {
				dirruns = dirrunsUnique;
				outermostContext = contextBackup;
			}

			return unmatched;
		};

	return bySet ?
		markFunction( superMatcher ) :
		superMatcher;
}

compile = Sizzle.compile = function( selector, match /* Internal Use Only */ ) {
	var i,
		setMatchers = [],
		elementMatchers = [],
		cached = compilerCache[ selector + " " ];

	if ( !cached ) {
		// Generate a function of recursive functions that can be used to check each element
		if ( !match ) {
			match = tokenize( selector );
		}
		i = match.length;
		while ( i-- ) {
			cached = matcherFromTokens( match[i] );
			if ( cached[ expando ] ) {
				setMatchers.push( cached );
			} else {
				elementMatchers.push( cached );
			}
		}

		// Cache the compiled function
		cached = compilerCache( selector, matcherFromGroupMatchers( elementMatchers, setMatchers ) );

		// Save selector and tokenization
		cached.selector = selector;
	}
	return cached;
};

/**
 * A low-level selection function that works with Sizzle's compiled
 *  selector functions
 * @param {String|Function} selector A selector or a pre-compiled
 *  selector function built with Sizzle.compile
 * @param {Element} context
 * @param {Array} [results]
 * @param {Array} [seed] A set of elements to match against
 */
select = Sizzle.select = function( selector, context, results, seed ) {
	var i, tokens, token, type, find,
		compiled = typeof selector === "function" && selector,
		match = !seed && tokenize( (selector = compiled.selector || selector) );

	results = results || [];

	// Try to minimize operations if there is only one selector in the list and no seed
	// (the latter of which guarantees us context)
	if ( match.length === 1 ) {

		// Reduce context if the leading compound selector is an ID
		tokens = match[0] = match[0].slice( 0 );
		if ( tokens.length > 2 && (token = tokens[0]).type === "ID" &&
				support.getById && context.nodeType === 9 && documentIsHTML &&
				Expr.relative[ tokens[1].type ] ) {

			context = ( Expr.find["ID"]( token.matches[0].replace(runescape, funescape), context ) || [] )[0];
			if ( !context ) {
				return results;

			// Precompiled matchers will still verify ancestry, so step up a level
			} else if ( compiled ) {
				context = context.parentNode;
			}

			selector = selector.slice( tokens.shift().value.length );
		}

		// Fetch a seed set for right-to-left matching
		i = matchExpr["needsContext"].test( selector ) ? 0 : tokens.length;
		while ( i-- ) {
			token = tokens[i];

			// Abort if we hit a combinator
			if ( Expr.relative[ (type = token.type) ] ) {
				break;
			}
			if ( (find = Expr.find[ type ]) ) {
				// Search, expanding context for leading sibling combinators
				if ( (seed = find(
					token.matches[0].replace( runescape, funescape ),
					rsibling.test( tokens[0].type ) && testContext( context.parentNode ) || context
				)) ) {

					// If seed is empty or no tokens remain, we can return early
					tokens.splice( i, 1 );
					selector = seed.length && toSelector( tokens );
					if ( !selector ) {
						push.apply( results, seed );
						return results;
					}

					break;
				}
			}
		}
	}

	// Compile and execute a filtering function if one is not provided
	// Provide `match` to avoid retokenization if we modified the selector above
	( compiled || compile( selector, match ) )(
		seed,
		context,
		!documentIsHTML,
		results,
		!context || rsibling.test( selector ) && testContext( context.parentNode ) || context
	);
	return results;
};

// One-time assignments

// Sort stability
support.sortStable = expando.split("").sort( sortOrder ).join("") === expando;

// Support: Chrome 14-35+
// Always assume duplicates if they aren't passed to the comparison function
support.detectDuplicates = !!hasDuplicate;

// Initialize against the default document
setDocument();

// Support: Webkit<537.32 - Safari 6.0.3/Chrome 25 (fixed in Chrome 27)
// Detached nodes confoundingly follow *each other*
support.sortDetached = assert(function( div1 ) {
	// Should return 1, but returns 4 (following)
	return div1.compareDocumentPosition( document.createElement("div") ) & 1;
});

// Support: IE<8
// Prevent attribute/property "interpolation"
// http://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
if ( !assert(function( div ) {
	div.innerHTML = "<a href='#'></a>";
	return div.firstChild.getAttribute("href") === "#" ;
}) ) {
	addHandle( "type|href|height|width", function( elem, name, isXML ) {
		if ( !isXML ) {
			return elem.getAttribute( name, name.toLowerCase() === "type" ? 1 : 2 );
		}
	});
}

// Support: IE<9
// Use defaultValue in place of getAttribute("value")
if ( !support.attributes || !assert(function( div ) {
	div.innerHTML = "<input/>";
	div.firstChild.setAttribute( "value", "" );
	return div.firstChild.getAttribute( "value" ) === "";
}) ) {
	addHandle( "value", function( elem, name, isXML ) {
		if ( !isXML && elem.nodeName.toLowerCase() === "input" ) {
			return elem.defaultValue;
		}
	});
}

// Support: IE<9
// Use getAttributeNode to fetch booleans when getAttribute lies
if ( !assert(function( div ) {
	return div.getAttribute("disabled") == null;
}) ) {
	addHandle( booleans, function( elem, name, isXML ) {
		var val;
		if ( !isXML ) {
			return elem[ name ] === true ? name.toLowerCase() :
					(val = elem.getAttributeNode( name )) && val.specified ?
					val.value :
				null;
		}
	});
}

// EXPOSE
if ( typeof define === "function" && define.amd ) {
	define('sizzle',[],function() { return Sizzle; });
// Sizzle requires that there be a global window in Common-JS like environments
} else if ( typeof module !== "undefined" && module.exports ) {
	module.exports = Sizzle;
} else {
	window.Sizzle = Sizzle;
}
// EXPOSE

})( window );

if (!String.prototype.endsWith) {
  String.prototype.endsWith = function (searchString, position) {
      var subjectString = this.toString();
      if (position === undefined || position > subjectString.length) {
          position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
  };
}

if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (searchString, position) {
        position = position || 0;
        return this.substr(position, searchString.length) === searchString;
    };
}

if (!String.prototype.splitOnce) {
    String.prototype.splitOnce = function (delimiter) {
        var components = this.split(delimiter);
        return [components.shift(), components.join(delimiter)];
    };
}

if (!String.prototype.trim) {
    String.prototype.trim = function () {
        return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    };
}
;
define("polyfill", function(){});

/*
jed.js
v0.5.0beta

https://github.com/SlexAxton/Jed
-----------
A gettext compatible i18n library for modern JavaScript Applications

by Alex Sexton - AlexSexton [at] gmail - @SlexAxton
WTFPL license for use
Dojo CLA for contributions

Jed offers the entire applicable GNU gettext spec'd set of
functions, but also offers some nicer wrappers around them.
The api for gettext was written for a language with no function
overloading, so Jed allows a little more of that.

Many thanks to Joshua I. Miller - unrtst@cpan.org - who wrote
gettext.js back in 2008. I was able to vet a lot of my ideas
against his. I also made sure Jed passed against his tests
in order to offer easy upgrades -- jsgettext.berlios.de
*/
(function (root, undef) {

  // Set up some underscore-style functions, if you already have
  // underscore, feel free to delete this section, and use it
  // directly, however, the amount of functions used doesn't
  // warrant having underscore as a full dependency.
  // Underscore 1.3.0 was used to port and is licensed
  // under the MIT License by Jeremy Ashkenas.
  var ArrayProto    = Array.prototype,
      ObjProto      = Object.prototype,
      slice         = ArrayProto.slice,
      hasOwnProp    = ObjProto.hasOwnProperty,
      nativeForEach = ArrayProto.forEach,
      breaker       = {};

  // We're not using the OOP style _ so we don't need the
  // extra level of indirection. This still means that you
  // sub out for real `_` though.
  var _ = {
    forEach : function( obj, iterator, context ) {
      var i, l, key;
      if ( obj === null ) {
        return;
      }

      if ( nativeForEach && obj.forEach === nativeForEach ) {
        obj.forEach( iterator, context );
      }
      else if ( obj.length === +obj.length ) {
        for ( i = 0, l = obj.length; i < l; i++ ) {
          if ( i in obj && iterator.call( context, obj[i], i, obj ) === breaker ) {
            return;
          }
        }
      }
      else {
        for ( key in obj) {
          if ( hasOwnProp.call( obj, key ) ) {
            if ( iterator.call (context, obj[key], key, obj ) === breaker ) {
              return;
            }
          }
        }
      }
    },
    extend : function( obj ) {
      this.forEach( slice.call( arguments, 1 ), function ( source ) {
        for ( var prop in source ) {
          obj[prop] = source[prop];
        }
      });
      return obj;
    }
  };
  // END Miniature underscore impl

  // Jed is a constructor function
  var Jed = function ( options ) {
    // Some minimal defaults
    this.defaults = {
      "locale_data" : {
        "messages" : {
          "" : {
            "domain"       : "messages",
            "lang"         : "en",
            "plural_forms" : "nplurals=2; plural=(n != 1);"
          }
          // There are no default keys, though
        }
      },
      // The default domain if one is missing
      "domain" : "messages"
    };

    // Mix in the sent options with the default options
    this.options = _.extend( {}, this.defaults, options );
    this.textdomain( this.options.domain );

    if ( options.domain && ! this.options.locale_data[ this.options.domain ] ) {
      throw new Error('Text domain set to non-existent domain: `' + options.domain + '`');
    }
  };

  // The gettext spec sets this character as the default
  // delimiter for context lookups.
  // e.g.: context\u0004key
  // If your translation company uses something different,
  // just change this at any time and it will use that instead.
  Jed.context_delimiter = String.fromCharCode( 4 );

  function getPluralFormFunc ( plural_form_string ) {
    return Jed.PF.compile( plural_form_string || "nplurals=2; plural=(n != 1);");
  }

  function Chain( key, i18n ){
    this._key = key;
    this._i18n = i18n;
  }

  // Create a chainable api for adding args prettily
  _.extend( Chain.prototype, {
    onDomain : function ( domain ) {
      this._domain = domain;
      return this;
    },
    withContext : function ( context ) {
      this._context = context;
      return this;
    },
    ifPlural : function ( num, pkey ) {
      this._val = num;
      this._pkey = pkey;
      return this;
    },
    fetch : function ( sArr ) {
      if ( {}.toString.call( sArr ) != '[object Array]' ) {
        sArr = [].slice.call(arguments);
      }
      return ( sArr && sArr.length ? Jed.sprintf : function(x){ return x; } )(
        this._i18n.dcnpgettext(this._domain, this._context, this._key, this._pkey, this._val),
        sArr
      );
    }
  });

  // Add functions to the Jed prototype.
  // These will be the functions on the object that's returned
  // from creating a `new Jed()`
  // These seem redundant, but they gzip pretty well.
  _.extend( Jed.prototype, {
    // The sexier api start point
    translate : function ( key ) {
      return new Chain( key, this );
    },

    textdomain : function ( domain ) {
      if ( ! domain ) {
        return this._textdomain;
      }
      this._textdomain = domain;
    },

    gettext : function ( key ) {
      return this.dcnpgettext.call( this, undef, undef, key );
    },

    dgettext : function ( domain, key ) {
     return this.dcnpgettext.call( this, domain, undef, key );
    },

    dcgettext : function ( domain , key /*, category */ ) {
      // Ignores the category anyways
      return this.dcnpgettext.call( this, domain, undef, key );
    },

    ngettext : function ( skey, pkey, val ) {
      return this.dcnpgettext.call( this, undef, undef, skey, pkey, val );
    },

    dngettext : function ( domain, skey, pkey, val ) {
      return this.dcnpgettext.call( this, domain, undef, skey, pkey, val );
    },

    dcngettext : function ( domain, skey, pkey, val/*, category */) {
      return this.dcnpgettext.call( this, domain, undef, skey, pkey, val );
    },

    pgettext : function ( context, key ) {
      return this.dcnpgettext.call( this, undef, context, key );
    },

    dpgettext : function ( domain, context, key ) {
      return this.dcnpgettext.call( this, domain, context, key );
    },

    dcpgettext : function ( domain, context, key/*, category */) {
      return this.dcnpgettext.call( this, domain, context, key );
    },

    npgettext : function ( context, skey, pkey, val ) {
      return this.dcnpgettext.call( this, undef, context, skey, pkey, val );
    },

    dnpgettext : function ( domain, context, skey, pkey, val ) {
      return this.dcnpgettext.call( this, domain, context, skey, pkey, val );
    },

    // The most fully qualified gettext function. It has every option.
    // Since it has every option, we can use it from every other method.
    // This is the bread and butter.
    // Technically there should be one more argument in this function for 'Category',
    // but since we never use it, we might as well not waste the bytes to define it.
    dcnpgettext : function ( domain, context, singular_key, plural_key, val ) {
      // Set some defaults

      plural_key = plural_key || singular_key;

      // Use the global domain default if one
      // isn't explicitly passed in
      domain = domain || this._textdomain;

      // Default the value to the singular case
      val = typeof val == 'undefined' ? 1 : val;

      var fallback;

      // Handle special cases

      // No options found
      if ( ! this.options ) {
        // There's likely something wrong, but we'll return the correct key for english
        // We do this by instantiating a brand new Jed instance with the default set
        // for everything that could be broken.
        fallback = new Jed();
        return fallback.dcnpgettext.call( fallback, undefined, undefined, singular_key, plural_key, val );
      }

      // No translation data provided
      if ( ! this.options.locale_data ) {
        throw new Error('No locale data provided.');
      }

      if ( ! this.options.locale_data[ domain ] ) {
        throw new Error('Domain `' + domain + '` was not found.');
      }

      if ( ! this.options.locale_data[ domain ][ "" ] ) {
        throw new Error('No locale meta information provided.');
      }

      // Make sure we have a truthy key. Otherwise we might start looking
      // into the empty string key, which is the options for the locale
      // data.
      if ( ! singular_key ) {
        throw new Error('No translation key found.');
      }

      // Handle invalid numbers, but try casting strings for good measure
      if ( typeof val != 'number' ) {
        val = parseInt( val, 10 );

        if ( isNaN( val ) ) {
          throw new Error('The number that was passed in is not a number.');
        }
      }

      var key  = context ? context + Jed.context_delimiter + singular_key : singular_key,
          locale_data = this.options.locale_data,
          dict = locale_data[ domain ],
          pluralForms = dict[""].plural_forms || (locale_data.messages || this.defaults.locale_data.messages)[""].plural_forms,
          val_idx = getPluralFormFunc(pluralForms)(val) + 1,
          val_list,
          res;

      // Throw an error if a domain isn't found
      if ( ! dict ) {
        throw new Error('No domain named `' + domain + '` could be found.');
      }

      val_list = dict[ key ];

      // If there is no match, then revert back to
      // english style singular/plural with the keys passed in.
      if ( ! val_list || val_idx >= val_list.length ) {
        if (this.options.missing_key_callback) {
          this.options.missing_key_callback(key);
        }
        res = [ null, singular_key, plural_key ];
        return res[ getPluralFormFunc(pluralForms)( val ) + 1 ];
      }

      res = val_list[ val_idx ];

      // This includes empty strings on purpose
      if ( ! res  ) {
        res = [ null, singular_key, plural_key ];
        return res[ getPluralFormFunc(pluralForms)( val ) + 1 ];
      }
      return res;
    }
  });


  // We add in sprintf capabilities for post translation value interolation
  // This is not internally used, so you can remove it if you have this
  // available somewhere else, or want to use a different system.

  // We _slightly_ modify the normal sprintf behavior to more gracefully handle
  // undefined values.

  /**
   sprintf() for JavaScript 0.7-beta1
   http://www.diveintojavascript.com/projects/javascript-sprintf

   Copyright (c) Alexandru Marasteanu <alexaholic [at) gmail (dot] com>
   All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:
       * Redistributions of source code must retain the above copyright
         notice, this list of conditions and the following disclaimer.
       * Redistributions in binary form must reproduce the above copyright
         notice, this list of conditions and the following disclaimer in the
         documentation and/or other materials provided with the distribution.
       * Neither the name of sprintf() for JavaScript nor the
         names of its contributors may be used to endorse or promote products
         derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   DISCLAIMED. IN NO EVENT SHALL Alexandru Marasteanu BE LIABLE FOR ANY
   DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
   (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
   LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
   ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
   (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
   SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  */
  var sprintf = (function() {
    function get_type(variable) {
      return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
    }
    function str_repeat(input, multiplier) {
      for (var output = []; multiplier > 0; output[--multiplier] = input) {/* do nothing */}
      return output.join('');
    }

    var str_format = function() {
      if (!str_format.cache.hasOwnProperty(arguments[0])) {
        str_format.cache[arguments[0]] = str_format.parse(arguments[0]);
      }
      return str_format.format.call(null, str_format.cache[arguments[0]], arguments);
    };

    str_format.format = function(parse_tree, argv) {
      var cursor = 1, tree_length = parse_tree.length, node_type = '', arg, output = [], i, k, match, pad, pad_character, pad_length;
      for (i = 0; i < tree_length; i++) {
        node_type = get_type(parse_tree[i]);
        if (node_type === 'string') {
          output.push(parse_tree[i]);
        }
        else if (node_type === 'array') {
          match = parse_tree[i]; // convenience purposes only
          if (match[2]) { // keyword argument
            arg = argv[cursor];
            for (k = 0; k < match[2].length; k++) {
              if (!arg.hasOwnProperty(match[2][k])) {
                throw(sprintf('[sprintf] property "%s" does not exist', match[2][k]));
              }
              arg = arg[match[2][k]];
            }
          }
          else if (match[1]) { // positional argument (explicit)
            arg = argv[match[1]];
          }
          else { // positional argument (implicit)
            arg = argv[cursor++];
          }

          if (/[^s]/.test(match[8]) && (get_type(arg) != 'number')) {
            throw(sprintf('[sprintf] expecting number but found %s', get_type(arg)));
          }

          // Jed EDIT
          if ( typeof arg == 'undefined' || arg === null ) {
            arg = '';
          }
          // Jed EDIT

          switch (match[8]) {
            case 'b': arg = arg.toString(2); break;
            case 'c': arg = String.fromCharCode(arg); break;
            case 'd': arg = parseInt(arg, 10); break;
            case 'e': arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential(); break;
            case 'f': arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg); break;
            case 'o': arg = arg.toString(8); break;
            case 's': arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg); break;
            case 'u': arg = Math.abs(arg); break;
            case 'x': arg = arg.toString(16); break;
            case 'X': arg = arg.toString(16).toUpperCase(); break;
          }
          arg = (/[def]/.test(match[8]) && match[3] && arg >= 0 ? '+'+ arg : arg);
          pad_character = match[4] ? match[4] == '0' ? '0' : match[4].charAt(1) : ' ';
          pad_length = match[6] - String(arg).length;
          pad = match[6] ? str_repeat(pad_character, pad_length) : '';
          output.push(match[5] ? arg + pad : pad + arg);
        }
      }
      return output.join('');
    };

    str_format.cache = {};

    str_format.parse = function(fmt) {
      var _fmt = fmt, match = [], parse_tree = [], arg_names = 0;
      while (_fmt) {
        if ((match = /^[^\x25]+/.exec(_fmt)) !== null) {
          parse_tree.push(match[0]);
        }
        else if ((match = /^\x25{2}/.exec(_fmt)) !== null) {
          parse_tree.push('%');
        }
        else if ((match = /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(_fmt)) !== null) {
          if (match[2]) {
            arg_names |= 1;
            var field_list = [], replacement_field = match[2], field_match = [];
            if ((field_match = /^([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
              field_list.push(field_match[1]);
              while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
                if ((field_match = /^\.([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
                  field_list.push(field_match[1]);
                }
                else if ((field_match = /^\[(\d+)\]/.exec(replacement_field)) !== null) {
                  field_list.push(field_match[1]);
                }
                else {
                  throw('[sprintf] huh?');
                }
              }
            }
            else {
              throw('[sprintf] huh?');
            }
            match[2] = field_list;
          }
          else {
            arg_names |= 2;
          }
          if (arg_names === 3) {
            throw('[sprintf] mixing positional and named placeholders is not (yet) supported');
          }
          parse_tree.push(match);
        }
        else {
          throw('[sprintf] huh?');
        }
        _fmt = _fmt.substring(match[0].length);
      }
      return parse_tree;
    };

    return str_format;
  })();

  var vsprintf = function(fmt, argv) {
    argv.unshift(fmt);
    return sprintf.apply(null, argv);
  };

  Jed.parse_plural = function ( plural_forms, n ) {
    plural_forms = plural_forms.replace(/n/g, n);
    return Jed.parse_expression(plural_forms);
  };

  Jed.sprintf = function ( fmt, args ) {
    if ( {}.toString.call( args ) == '[object Array]' ) {
      return vsprintf( fmt, [].slice.call(args) );
    }
    return sprintf.apply(this, [].slice.call(arguments) );
  };

  Jed.prototype.sprintf = function () {
    return Jed.sprintf.apply(this, arguments);
  };
  // END sprintf Implementation

  // Start the Plural forms section
  // This is a full plural form expression parser. It is used to avoid
  // running 'eval' or 'new Function' directly against the plural
  // forms.
  //
  // This can be important if you get translations done through a 3rd
  // party vendor. I encourage you to use this instead, however, I
  // also will provide a 'precompiler' that you can use at build time
  // to output valid/safe function representations of the plural form
  // expressions. This means you can build this code out for the most
  // part.
  Jed.PF = {};

  Jed.PF.parse = function ( p ) {
    var plural_str = Jed.PF.extractPluralExpr( p );
    return Jed.PF.parser.parse.call(Jed.PF.parser, plural_str);
  };

  Jed.PF.compile = function ( p ) {
    // Handle trues and falses as 0 and 1
    function imply( val ) {
      return (val === true ? 1 : val ? val : 0);
    }

    var ast = Jed.PF.parse( p );
    return function ( n ) {
      return imply( Jed.PF.interpreter( ast )( n ) );
    };
  };

  Jed.PF.interpreter = function ( ast ) {
    return function ( n ) {
      var res;
      switch ( ast.type ) {
        case 'GROUP':
          return Jed.PF.interpreter( ast.expr )( n );
        case 'TERNARY':
          if ( Jed.PF.interpreter( ast.expr )( n ) ) {
            return Jed.PF.interpreter( ast.truthy )( n );
          }
          return Jed.PF.interpreter( ast.falsey )( n );
        case 'OR':
          return Jed.PF.interpreter( ast.left )( n ) || Jed.PF.interpreter( ast.right )( n );
        case 'AND':
          return Jed.PF.interpreter( ast.left )( n ) && Jed.PF.interpreter( ast.right )( n );
        case 'LT':
          return Jed.PF.interpreter( ast.left )( n ) < Jed.PF.interpreter( ast.right )( n );
        case 'GT':
          return Jed.PF.interpreter( ast.left )( n ) > Jed.PF.interpreter( ast.right )( n );
        case 'LTE':
          return Jed.PF.interpreter( ast.left )( n ) <= Jed.PF.interpreter( ast.right )( n );
        case 'GTE':
          return Jed.PF.interpreter( ast.left )( n ) >= Jed.PF.interpreter( ast.right )( n );
        case 'EQ':
          return Jed.PF.interpreter( ast.left )( n ) == Jed.PF.interpreter( ast.right )( n );
        case 'NEQ':
          return Jed.PF.interpreter( ast.left )( n ) != Jed.PF.interpreter( ast.right )( n );
        case 'MOD':
          return Jed.PF.interpreter( ast.left )( n ) % Jed.PF.interpreter( ast.right )( n );
        case 'VAR':
          return n;
        case 'NUM':
          return ast.val;
        default:
          throw new Error("Invalid Token found.");
      }
    };
  };

  Jed.PF.extractPluralExpr = function ( p ) {
    // trim first
    p = p.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

    if (! /;\s*$/.test(p)) {
      p = p.concat(';');
    }

    var nplurals_re = /nplurals\=(\d+);/,
        plural_re = /plural\=(.*);/,
        nplurals_matches = p.match( nplurals_re ),
        res = {},
        plural_matches;

    // Find the nplurals number
    if ( nplurals_matches.length > 1 ) {
      res.nplurals = nplurals_matches[1];
    }
    else {
      throw new Error('nplurals not found in plural_forms string: ' + p );
    }

    // remove that data to get to the formula
    p = p.replace( nplurals_re, "" );
    plural_matches = p.match( plural_re );

    if (!( plural_matches && plural_matches.length > 1 ) ) {
      throw new Error('`plural` expression not found: ' + p);
    }
    return plural_matches[ 1 ];
  };

  /* Jison generated parser */
  Jed.PF.parser = (function(){

var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"expressions":3,"e":4,"EOF":5,"?":6,":":7,"||":8,"&&":9,"<":10,"<=":11,">":12,">=":13,"!=":14,"==":15,"%":16,"(":17,")":18,"n":19,"NUMBER":20,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",6:"?",7:":",8:"||",9:"&&",10:"<",11:"<=",12:">",13:">=",14:"!=",15:"==",16:"%",17:"(",18:")",19:"n",20:"NUMBER"},
productions_: [0,[3,2],[4,5],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,1],[4,1]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: return { type : 'GROUP', expr: $$[$0-1] }; 
break;
case 2:this.$ = { type: 'TERNARY', expr: $$[$0-4], truthy : $$[$0-2], falsey: $$[$0] }; 
break;
case 3:this.$ = { type: "OR", left: $$[$0-2], right: $$[$0] };
break;
case 4:this.$ = { type: "AND", left: $$[$0-2], right: $$[$0] };
break;
case 5:this.$ = { type: 'LT', left: $$[$0-2], right: $$[$0] }; 
break;
case 6:this.$ = { type: 'LTE', left: $$[$0-2], right: $$[$0] };
break;
case 7:this.$ = { type: 'GT', left: $$[$0-2], right: $$[$0] };
break;
case 8:this.$ = { type: 'GTE', left: $$[$0-2], right: $$[$0] };
break;
case 9:this.$ = { type: 'NEQ', left: $$[$0-2], right: $$[$0] };
break;
case 10:this.$ = { type: 'EQ', left: $$[$0-2], right: $$[$0] };
break;
case 11:this.$ = { type: 'MOD', left: $$[$0-2], right: $$[$0] };
break;
case 12:this.$ = { type: 'GROUP', expr: $$[$0-1] }; 
break;
case 13:this.$ = { type: 'VAR' }; 
break;
case 14:this.$ = { type: 'NUM', val: Number(yytext) }; 
break;
}
},
table: [{3:1,4:2,17:[1,3],19:[1,4],20:[1,5]},{1:[3]},{5:[1,6],6:[1,7],8:[1,8],9:[1,9],10:[1,10],11:[1,11],12:[1,12],13:[1,13],14:[1,14],15:[1,15],16:[1,16]},{4:17,17:[1,3],19:[1,4],20:[1,5]},{5:[2,13],6:[2,13],7:[2,13],8:[2,13],9:[2,13],10:[2,13],11:[2,13],12:[2,13],13:[2,13],14:[2,13],15:[2,13],16:[2,13],18:[2,13]},{5:[2,14],6:[2,14],7:[2,14],8:[2,14],9:[2,14],10:[2,14],11:[2,14],12:[2,14],13:[2,14],14:[2,14],15:[2,14],16:[2,14],18:[2,14]},{1:[2,1]},{4:18,17:[1,3],19:[1,4],20:[1,5]},{4:19,17:[1,3],19:[1,4],20:[1,5]},{4:20,17:[1,3],19:[1,4],20:[1,5]},{4:21,17:[1,3],19:[1,4],20:[1,5]},{4:22,17:[1,3],19:[1,4],20:[1,5]},{4:23,17:[1,3],19:[1,4],20:[1,5]},{4:24,17:[1,3],19:[1,4],20:[1,5]},{4:25,17:[1,3],19:[1,4],20:[1,5]},{4:26,17:[1,3],19:[1,4],20:[1,5]},{4:27,17:[1,3],19:[1,4],20:[1,5]},{6:[1,7],8:[1,8],9:[1,9],10:[1,10],11:[1,11],12:[1,12],13:[1,13],14:[1,14],15:[1,15],16:[1,16],18:[1,28]},{6:[1,7],7:[1,29],8:[1,8],9:[1,9],10:[1,10],11:[1,11],12:[1,12],13:[1,13],14:[1,14],15:[1,15],16:[1,16]},{5:[2,3],6:[2,3],7:[2,3],8:[2,3],9:[1,9],10:[1,10],11:[1,11],12:[1,12],13:[1,13],14:[1,14],15:[1,15],16:[1,16],18:[2,3]},{5:[2,4],6:[2,4],7:[2,4],8:[2,4],9:[2,4],10:[1,10],11:[1,11],12:[1,12],13:[1,13],14:[1,14],15:[1,15],16:[1,16],18:[2,4]},{5:[2,5],6:[2,5],7:[2,5],8:[2,5],9:[2,5],10:[2,5],11:[2,5],12:[2,5],13:[2,5],14:[2,5],15:[2,5],16:[1,16],18:[2,5]},{5:[2,6],6:[2,6],7:[2,6],8:[2,6],9:[2,6],10:[2,6],11:[2,6],12:[2,6],13:[2,6],14:[2,6],15:[2,6],16:[1,16],18:[2,6]},{5:[2,7],6:[2,7],7:[2,7],8:[2,7],9:[2,7],10:[2,7],11:[2,7],12:[2,7],13:[2,7],14:[2,7],15:[2,7],16:[1,16],18:[2,7]},{5:[2,8],6:[2,8],7:[2,8],8:[2,8],9:[2,8],10:[2,8],11:[2,8],12:[2,8],13:[2,8],14:[2,8],15:[2,8],16:[1,16],18:[2,8]},{5:[2,9],6:[2,9],7:[2,9],8:[2,9],9:[2,9],10:[2,9],11:[2,9],12:[2,9],13:[2,9],14:[2,9],15:[2,9],16:[1,16],18:[2,9]},{5:[2,10],6:[2,10],7:[2,10],8:[2,10],9:[2,10],10:[2,10],11:[2,10],12:[2,10],13:[2,10],14:[2,10],15:[2,10],16:[1,16],18:[2,10]},{5:[2,11],6:[2,11],7:[2,11],8:[2,11],9:[2,11],10:[2,11],11:[2,11],12:[2,11],13:[2,11],14:[2,11],15:[2,11],16:[2,11],18:[2,11]},{5:[2,12],6:[2,12],7:[2,12],8:[2,12],9:[2,12],10:[2,12],11:[2,12],12:[2,12],13:[2,12],14:[2,12],15:[2,12],16:[2,12],18:[2,12]},{4:30,17:[1,3],19:[1,4],20:[1,5]},{5:[2,2],6:[1,7],7:[2,2],8:[1,8],9:[1,9],10:[1,10],11:[1,11],12:[1,12],13:[1,13],14:[1,14],15:[1,15],16:[1,16],18:[2,2]}],
defaultActions: {6:[2,1]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        lstack = [], // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    //this.reductionCount = this.shiftCount = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    if (typeof this.lexer.yylloc == 'undefined')
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);

    if (typeof this.yy.parseError === 'function')
        this.parseError = this.yy.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    }

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected;
    while (true) {
        // retreive state number from top of stack
        state = stack[stack.length-1];

        // use default actions if available
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            // read action for current state and first input
            action = table[state] && table[state][symbol];
        }

        // handle parse error
        _handle_error:
        if (typeof action === 'undefined' || !action.length || !action[0]) {

            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                var errStr = '';
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+"\nExpecting "+expected.join(', ') + ", got '" + this.terminals_[symbol]+ "'";
                } else {
                    errStr = 'Parse error on line '+(yylineno+1)+": Unexpected " +
                                  (symbol == 1 /*EOF*/ ? "end of input" :
                                              ("'"+(this.terminals_[symbol] || symbol)+"'"));
                }
                this.parseError(errStr,
                    {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || 'Parsing halted.');
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || 'Parsing halted.');
                }
                popStack(1);
                state = stack[stack.length-1];
            }

            preErrorSymbol = symbol; // save the lookahead token
            symbol = TERROR;         // insert generic error symbol as new lookahead
            state = stack[stack.length-1];
            action = table[state] && table[state][TERROR];
            recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }

        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
        }

        switch (action[0]) {

            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext);
                lstack.push(this.lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    yyloc = this.lexer.yylloc;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                //this.reductionCount++;

                len = this.productions_[action[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                // default location, uses first token for firsts, last for lasts
                yyval._$ = {
                    first_line: lstack[lstack.length-(len||1)].first_line,
                    last_line: lstack[lstack.length-1].last_line,
                    first_column: lstack[lstack.length-(len||1)].first_column,
                    last_column: lstack[lstack.length-1].last_column
                };
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                    lstack = lstack.slice(0, -1*len);
                }

                stack.push(this.productions_[action[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept
                return true;
        }

    }

    return true;
}};/* Jison generated lexer */
var lexer = (function(){

var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parseError) {
            this.yy.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext+=ch;
        this.yyleng++;
        this.match+=ch;
        this.matched+=ch;
        var lines = ch.match(/\n/);
        if (lines) this.yylineno++;
        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        this._input = ch + this._input;
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            match = this._input.match(this.rules[rules[i]]);
            if (match) {
                lines = match[0].match(/\n.*/g);
                if (lines) this.yylineno += lines.length;
                this.yylloc = {first_line: this.yylloc.last_line,
                               last_line: this.yylineno+1,
                               first_column: this.yylloc.last_column,
                               last_column: lines ? lines[lines.length-1].length-1 : this.yylloc.last_column + match[0].length}
                this.yytext += match[0];
                this.match += match[0];
                this.matches = match;
                this.yyleng = this.yytext.length;
                this._more = false;
                this._input = this._input.slice(match[0].length);
                this.matched += match[0];
                token = this.performAction.call(this, this.yy, this, rules[i],this.conditionStack[this.conditionStack.length-1]);
                if (token) return token;
                else return;
            }
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(), 
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    },
topState:function () {
        return this.conditionStack[this.conditionStack.length-2];
    },
pushState:function begin(condition) {
        this.begin(condition);
    }});
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {

var YYSTATE=YY_START;
switch($avoiding_name_collisions) {
case 0:/* skip whitespace */
break;
case 1:return 20
break;
case 2:return 19
break;
case 3:return 8
break;
case 4:return 9
break;
case 5:return 6
break;
case 6:return 7
break;
case 7:return 11
break;
case 8:return 13
break;
case 9:return 10
break;
case 10:return 12
break;
case 11:return 14
break;
case 12:return 15
break;
case 13:return 16
break;
case 14:return 17
break;
case 15:return 18
break;
case 16:return 5
break;
case 17:return 'INVALID'
break;
}
};
lexer.rules = [/^\s+/,/^[0-9]+(\.[0-9]+)?\b/,/^n\b/,/^\|\|/,/^&&/,/^\?/,/^:/,/^<=/,/^>=/,/^</,/^>/,/^!=/,/^==/,/^%/,/^\(/,/^\)/,/^$/,/^./];
lexer.conditions = {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17],"inclusive":true}};return lexer;})()
parser.lexer = lexer;
return parser;
})();
// End parser

  // Handle node, amd, and global systems
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Jed;
    }
    exports.Jed = Jed;
  }
  else {
    if (typeof define === 'function' && define.amd) {
      define('jed', [],function() {
        return Jed;
      });
    }
    // Leak a global regardless of module system
    root['Jed'] = Jed;
  }

})(this);

/**
 * @license text 2.0.15 Copyright jQuery Foundation and other contributors.
 * Released under MIT license, http://github.com/requirejs/text/LICENSE
 */
/*jslint regexp: true */
/*global require, XMLHttpRequest, ActiveXObject,
  define, window, process, Packages,
  java, location, Components, FileUtils */

define('text',['module'], function (module) {
    'use strict';

    var text, fs, Cc, Ci, xpcIsWindows,
        progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
        bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
        hasLocation = typeof location !== 'undefined' && location.href,
        defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
        defaultHostName = hasLocation && location.hostname,
        defaultPort = hasLocation && (location.port || undefined),
        buildMap = {},
        masterConfig = (module.config && module.config()) || {};

    function useDefault(value, defaultValue) {
        return value === undefined || value === '' ? defaultValue : value;
    }

    //Allow for default ports for http and https.
    function isSamePort(protocol1, port1, protocol2, port2) {
        if (port1 === port2) {
            return true;
        } else if (protocol1 === protocol2) {
            if (protocol1 === 'http') {
                return useDefault(port1, '80') === useDefault(port2, '80');
            } else if (protocol1 === 'https') {
                return useDefault(port1, '443') === useDefault(port2, '443');
            }
        }
        return false;
    }

    text = {
        version: '2.0.15',

        strip: function (content) {
            //Strips <?xml ...?> declarations so that external SVG and XML
            //documents can be added to a document without worry. Also, if the string
            //is an HTML document, only the part inside the body tag is returned.
            if (content) {
                content = content.replace(xmlRegExp, "");
                var matches = content.match(bodyRegExp);
                if (matches) {
                    content = matches[1];
                }
            } else {
                content = "";
            }
            return content;
        },

        jsEscape: function (content) {
            return content.replace(/(['\\])/g, '\\$1')
                .replace(/[\f]/g, "\\f")
                .replace(/[\b]/g, "\\b")
                .replace(/[\n]/g, "\\n")
                .replace(/[\t]/g, "\\t")
                .replace(/[\r]/g, "\\r")
                .replace(/[\u2028]/g, "\\u2028")
                .replace(/[\u2029]/g, "\\u2029");
        },

        createXhr: masterConfig.createXhr || function () {
            //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
            var xhr, i, progId;
            if (typeof XMLHttpRequest !== "undefined") {
                return new XMLHttpRequest();
            } else if (typeof ActiveXObject !== "undefined") {
                for (i = 0; i < 3; i += 1) {
                    progId = progIds[i];
                    try {
                        xhr = new ActiveXObject(progId);
                    } catch (e) {}

                    if (xhr) {
                        progIds = [progId];  // so faster next time
                        break;
                    }
                }
            }

            return xhr;
        },

        /**
         * Parses a resource name into its component parts. Resource names
         * look like: module/name.ext!strip, where the !strip part is
         * optional.
         * @param {String} name the resource name
         * @returns {Object} with properties "moduleName", "ext" and "strip"
         * where strip is a boolean.
         */
        parseName: function (name) {
            var modName, ext, temp,
                strip = false,
                index = name.lastIndexOf("."),
                isRelative = name.indexOf('./') === 0 ||
                             name.indexOf('../') === 0;

            if (index !== -1 && (!isRelative || index > 1)) {
                modName = name.substring(0, index);
                ext = name.substring(index + 1);
            } else {
                modName = name;
            }

            temp = ext || modName;
            index = temp.indexOf("!");
            if (index !== -1) {
                //Pull off the strip arg.
                strip = temp.substring(index + 1) === "strip";
                temp = temp.substring(0, index);
                if (ext) {
                    ext = temp;
                } else {
                    modName = temp;
                }
            }

            return {
                moduleName: modName,
                ext: ext,
                strip: strip
            };
        },

        xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

        /**
         * Is an URL on another domain. Only works for browser use, returns
         * false in non-browser environments. Only used to know if an
         * optimized .js version of a text resource should be loaded
         * instead.
         * @param {String} url
         * @returns Boolean
         */
        useXhr: function (url, protocol, hostname, port) {
            var uProtocol, uHostName, uPort,
                match = text.xdRegExp.exec(url);
            if (!match) {
                return true;
            }
            uProtocol = match[2];
            uHostName = match[3];

            uHostName = uHostName.split(':');
            uPort = uHostName[1];
            uHostName = uHostName[0];

            return (!uProtocol || uProtocol === protocol) &&
                   (!uHostName || uHostName.toLowerCase() === hostname.toLowerCase()) &&
                   ((!uPort && !uHostName) || isSamePort(uProtocol, uPort, protocol, port));
        },

        finishLoad: function (name, strip, content, onLoad) {
            content = strip ? text.strip(content) : content;
            if (masterConfig.isBuild) {
                buildMap[name] = content;
            }
            onLoad(content);
        },

        load: function (name, req, onLoad, config) {
            //Name has format: some.module.filext!strip
            //The strip part is optional.
            //if strip is present, then that means only get the string contents
            //inside a body tag in an HTML string. For XML/SVG content it means
            //removing the <?xml ...?> declarations so the content can be inserted
            //into the current doc without problems.

            // Do not bother with the work if a build and text will
            // not be inlined.
            if (config && config.isBuild && !config.inlineText) {
                onLoad();
                return;
            }

            masterConfig.isBuild = config && config.isBuild;

            var parsed = text.parseName(name),
                nonStripName = parsed.moduleName +
                    (parsed.ext ? '.' + parsed.ext : ''),
                url = req.toUrl(nonStripName),
                useXhr = (masterConfig.useXhr) ||
                         text.useXhr;

            // Do not load if it is an empty: url
            if (url.indexOf('empty:') === 0) {
                onLoad();
                return;
            }

            //Load the text. Use XHR if possible and in a browser.
            if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort)) {
                text.get(url, function (content) {
                    text.finishLoad(name, parsed.strip, content, onLoad);
                }, function (err) {
                    if (onLoad.error) {
                        onLoad.error(err);
                    }
                });
            } else {
                //Need to fetch the resource across domains. Assume
                //the resource has been optimized into a JS module. Fetch
                //by the module name + extension, but do not include the
                //!strip part to avoid file system issues.
                req([nonStripName], function (content) {
                    text.finishLoad(parsed.moduleName + '.' + parsed.ext,
                                    parsed.strip, content, onLoad);
                });
            }
        },

        write: function (pluginName, moduleName, write, config) {
            if (buildMap.hasOwnProperty(moduleName)) {
                var content = text.jsEscape(buildMap[moduleName]);
                write.asModule(pluginName + "!" + moduleName,
                               "define(function () { return '" +
                                   content +
                               "';});\n");
            }
        },

        writeFile: function (pluginName, moduleName, req, write, config) {
            var parsed = text.parseName(moduleName),
                extPart = parsed.ext ? '.' + parsed.ext : '',
                nonStripName = parsed.moduleName + extPart,
                //Use a '.js' file name so that it indicates it is a
                //script that can be loaded across domains.
                fileName = req.toUrl(parsed.moduleName + extPart) + '.js';

            //Leverage own load() method to load plugin value, but only
            //write out values that do not have the strip argument,
            //to avoid any potential issues with ! in file names.
            text.load(nonStripName, req, function (value) {
                //Use own write() method to construct full module value.
                //But need to create shell that translates writeFile's
                //write() to the right interface.
                var textWrite = function (contents) {
                    return write(fileName, contents);
                };
                textWrite.asModule = function (moduleName, contents) {
                    return write.asModule(moduleName, fileName, contents);
                };

                text.write(pluginName, nonStripName, textWrite, config);
            }, config);
        }
    };

    if (masterConfig.env === 'node' || (!masterConfig.env &&
            typeof process !== "undefined" &&
            process.versions &&
            !!process.versions.node &&
            !process.versions['node-webkit'] &&
            !process.versions['atom-shell'])) {
        //Using special require.nodeRequire, something added by r.js.
        fs = require.nodeRequire('fs');

        text.get = function (url, callback, errback) {
            try {
                var file = fs.readFileSync(url, 'utf8');
                //Remove BOM (Byte Mark Order) from utf8 files if it is there.
                if (file[0] === '\uFEFF') {
                    file = file.substring(1);
                }
                callback(file);
            } catch (e) {
                if (errback) {
                    errback(e);
                }
            }
        };
    } else if (masterConfig.env === 'xhr' || (!masterConfig.env &&
            text.createXhr())) {
        text.get = function (url, callback, errback, headers) {
            var xhr = text.createXhr(), header;
            xhr.open('GET', url, true);

            //Allow plugins direct access to xhr headers
            if (headers) {
                for (header in headers) {
                    if (headers.hasOwnProperty(header)) {
                        xhr.setRequestHeader(header.toLowerCase(), headers[header]);
                    }
                }
            }

            //Allow overrides specified in config
            if (masterConfig.onXhr) {
                masterConfig.onXhr(xhr, url);
            }

            xhr.onreadystatechange = function (evt) {
                var status, err;
                //Do not explicitly handle errors, those should be
                //visible via console output in the browser.
                if (xhr.readyState === 4) {
                    status = xhr.status || 0;
                    if (status > 399 && status < 600) {
                        //An http 4xx or 5xx error. Signal an error.
                        err = new Error(url + ' HTTP status: ' + status);
                        err.xhr = xhr;
                        if (errback) {
                            errback(err);
                        }
                    } else {
                        callback(xhr.responseText);
                    }

                    if (masterConfig.onXhrComplete) {
                        masterConfig.onXhrComplete(xhr, url);
                    }
                }
            };
            xhr.send(null);
        };
    } else if (masterConfig.env === 'rhino' || (!masterConfig.env &&
            typeof Packages !== 'undefined' && typeof java !== 'undefined')) {
        //Why Java, why is this so awkward?
        text.get = function (url, callback) {
            var stringBuffer, line,
                encoding = "utf-8",
                file = new java.io.File(url),
                lineSeparator = java.lang.System.getProperty("line.separator"),
                input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
                content = '';
            try {
                stringBuffer = new java.lang.StringBuffer();
                line = input.readLine();

                // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
                // http://www.unicode.org/faq/utf_bom.html

                // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
                // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
                if (line && line.length() && line.charAt(0) === 0xfeff) {
                    // Eat the BOM, since we've already found the encoding on this file,
                    // and we plan to concatenating this buffer with others; the BOM should
                    // only appear at the top of a file.
                    line = line.substring(1);
                }

                if (line !== null) {
                    stringBuffer.append(line);
                }

                while ((line = input.readLine()) !== null) {
                    stringBuffer.append(lineSeparator);
                    stringBuffer.append(line);
                }
                //Make sure we return a JavaScript string and not a Java string.
                content = String(stringBuffer.toString()); //String
            } finally {
                input.close();
            }
            callback(content);
        };
    } else if (masterConfig.env === 'xpconnect' || (!masterConfig.env &&
            typeof Components !== 'undefined' && Components.classes &&
            Components.interfaces)) {
        //Avert your gaze!
        Cc = Components.classes;
        Ci = Components.interfaces;
        Components.utils['import']('resource://gre/modules/FileUtils.jsm');
        xpcIsWindows = ('@mozilla.org/windows-registry-key;1' in Cc);

        text.get = function (url, callback) {
            var inStream, convertStream, fileObj,
                readData = {};

            if (xpcIsWindows) {
                url = url.replace(/\//g, '\\');
            }

            fileObj = new FileUtils.File(url);

            //XPCOM, you so crazy
            try {
                inStream = Cc['@mozilla.org/network/file-input-stream;1']
                           .createInstance(Ci.nsIFileInputStream);
                inStream.init(fileObj, 1, 0, false);

                convertStream = Cc['@mozilla.org/intl/converter-input-stream;1']
                                .createInstance(Ci.nsIConverterInputStream);
                convertStream.init(inStream, "utf-8", inStream.available(),
                Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

                convertStream.readString(inStream.available(), readData);
                convertStream.close();
                inStream.close();
                callback(readData.value);
            } catch (e) {
                throw new Error((fileObj && fileObj.path || '') + ': ' + e);
            }
        };
    }
    return text;
});


define('text!ca',[],function () { return '{\n   "domain": "converse",\n   "locale_data": {\n      "converse": {\n         "": {\n            "domain": "converse",\n            "plural_forms": "nplurals=2; plural=(n != 1);",\n            "lang": "ca"\n         },\n         "Bookmark this room": [\n            null,\n            ""\n         ],\n         "The name for this bookmark:": [\n            null,\n            ""\n         ],\n         "Would you like this room to be automatically joined upon startup?": [\n            null,\n            ""\n         ],\n         "What should your nickname for this room be?": [\n            null,\n            ""\n         ],\n         "Save": [\n            null,\n            "Desa"\n         ],\n         "Cancel": [\n            null,\n            "Cancel·la"\n         ],\n         "Bookmarked Rooms": [\n            null,\n            ""\n         ],\n         "Click to open this room": [\n            null,\n            "Feu clic per obrir aquesta sala"\n         ],\n         "Show more information on this room": [\n            null,\n            "Mostra més informació d\'aquesta sala"\n         ],\n         "Remove this bookmark": [\n            null,\n            ""\n         ],\n         "Close this chat box": [\n            null,\n            "Tanca aquest quadre del xat"\n         ],\n         "Personal message": [\n            null,\n            "Missatge personal"\n         ],\n         "me": [\n            null,\n            "jo"\n         ],\n         "A very large message has been received.This might be due to an attack meant to degrade the chat performance.Output has been shortened.": [\n            null,\n            ""\n         ],\n         "Typing from another device": [\n            null,\n            ""\n         ],\n         "is typing": [\n            null,\n            "està escrivint"\n         ],\n         "Stopped typing on the other device": [\n            null,\n            ""\n         ],\n         "has stopped typing": [\n            null,\n            "ha deixat d\'escriure"\n         ],\n         "has gone away": [\n            null,\n            "ha marxat"\n         ],\n         "Show this menu": [\n            null,\n            "Mostra aquest menú"\n         ],\n         "Write in the third person": [\n            null,\n            "Escriu en tercera persona"\n         ],\n         "Remove messages": [\n            null,\n            "Elimina els missatges"\n         ],\n         "Are you sure you want to clear the messages from this chat box?": [\n            null,\n            "Segur que voleu esborrar els missatges d\'aquest quadre del xat?"\n         ],\n         "has gone offline": [\n            null,\n            "s\'ha desconnectat"\n         ],\n         "is busy": [\n            null,\n            "està ocupat"\n         ],\n         "Clear all messages": [\n            null,\n            "Esborra tots els missatges"\n         ],\n         "Insert a smiley": [\n            null,\n            "Insereix una cara somrient"\n         ],\n         "Start a call": [\n            null,\n            "Inicia una trucada"\n         ],\n         "Contacts": [\n            null,\n            "Contactes"\n         ],\n         "XMPP Username:": [\n            null,\n            "Nom d\'usuari XMPP:"\n         ],\n         "Password:": [\n            null,\n            "Contrasenya:"\n         ],\n         "Click here to log in anonymously": [\n            null,\n            "Feu clic aquí per iniciar la sessió de manera anònima"\n         ],\n         "Log In": [\n            null,\n            "Inicia la sessió"\n         ],\n         "user@server": [\n            null,\n            "usuari@servidor"\n         ],\n         "password": [\n            null,\n            "contrasenya"\n         ],\n         "Sign in": [\n            null,\n            "Inicia la sessió"\n         ],\n         "I am %1$s": [\n            null,\n            "Estic %1$s"\n         ],\n         "Click here to write a custom status message": [\n            null,\n            "Feu clic aquí per escriure un missatge d\'estat personalitzat"\n         ],\n         "Click to change your chat status": [\n            null,\n            "Feu clic per canviar l\'estat del xat"\n         ],\n         "Custom status": [\n            null,\n            "Estat personalitzat"\n         ],\n         "online": [\n            null,\n            "en línia"\n         ],\n         "busy": [\n            null,\n            "ocupat"\n         ],\n         "away for long": [\n            null,\n            "absent durant una estona"\n         ],\n         "away": [\n            null,\n            "absent"\n         ],\n         "offline": [\n            null,\n            "desconnectat"\n         ],\n         "Online": [\n            null,\n            "En línia"\n         ],\n         "Busy": [\n            null,\n            "Ocupat"\n         ],\n         "Away": [\n            null,\n            "Absent"\n         ],\n         "Offline": [\n            null,\n            "Desconnectat"\n         ],\n         "Log out": [\n            null,\n            "Tanca la sessió"\n         ],\n         "Contact name": [\n            null,\n            "Nom del contacte"\n         ],\n         "Search": [\n            null,\n            "Cerca"\n         ],\n         "Add": [\n            null,\n            "Afegeix"\n         ],\n         "Click to add new chat contacts": [\n            null,\n            "Feu clic per afegir contactes nous al xat"\n         ],\n         "Add a contact": [\n            null,\n            "Afegeix un contacte"\n         ],\n         "No users found": [\n            null,\n            "No s\'ha trobat cap usuari"\n         ],\n         "Click to add as a chat contact": [\n            null,\n            "Feu clic per afegir com a contacte del xat"\n         ],\n         "Toggle chat": [\n            null,\n            "Canvia de xat"\n         ],\n         "Click to hide these contacts": [\n            null,\n            "Feu clic per amagar aquests contactes"\n         ],\n         "The connection has dropped, attempting to reconnect.": [\n            null,\n            ""\n         ],\n         "Connecting": [\n            null,\n            "S\'està establint la connexió"\n         ],\n         "Authenticating": [\n            null,\n            "S\'està efectuant l\'autenticació"\n         ],\n         "Authentication Failed": [\n            null,\n            "Error d\'autenticació"\n         ],\n         "Sorry, there was an error while trying to add ": [\n            null,\n            "S\'ha produït un error en intentar afegir "\n         ],\n         "This client does not allow presence subscriptions": [\n            null,\n            "Aquest client no admet les subscripcions de presència"\n         ],\n         "Minimize this chat box": [\n            null,\n            "Minimitza aquest quadre del xat"\n         ],\n         "Click to restore this chat": [\n            null,\n            "Feu clic per restaurar aquest xat"\n         ],\n         "Minimized": [\n            null,\n            "Minimitzat"\n         ],\n         "This room is not anonymous": [\n            null,\n            "Aquesta sala no és anònima"\n         ],\n         "This room now shows unavailable members": [\n            null,\n            "Aquesta sala ara mostra membres no disponibles"\n         ],\n         "This room does not show unavailable members": [\n            null,\n            "Aquesta sala no mostra membres no disponibles"\n         ],\n         "Room logging is now enabled": [\n            null,\n            "El registre de la sala està habilitat"\n         ],\n         "Room logging is now disabled": [\n            null,\n            "El registre de la sala està deshabilitat"\n         ],\n         "This room is now semi-anonymous": [\n            null,\n            "Aquesta sala ara és parcialment anònima"\n         ],\n         "This room is now fully-anonymous": [\n            null,\n            "Aquesta sala ara és totalment anònima"\n         ],\n         "A new room has been created": [\n            null,\n            "S\'ha creat una sala nova"\n         ],\n         "You have been banned from this room": [\n            null,\n            "Se us ha expulsat d\'aquesta sala"\n         ],\n         "You have been kicked from this room": [\n            null,\n            "Se us ha expulsat d\'aquesta sala"\n         ],\n         "You have been removed from this room because of an affiliation change": [\n            null,\n            "Se us ha eliminat d\'aquesta sala a causa d\'un canvi d\'afiliació"\n         ],\n         "You have been removed from this room because the room has changed to members-only and you\'re not a member": [\n            null,\n            "Se us ha eliminat d\'aquesta sala perquè ara només permet membres i no en sou membre"\n         ],\n         "You have been removed from this room because the MUC (Multi-user chat) service is being shut down.": [\n            null,\n            "Se us ha eliminat d\'aquesta sala perquè s\'està tancant el servei MUC (xat multiusuari)."\n         ],\n         "Message": [\n            null,\n            "Missatge"\n         ],\n         "Hide the list of occupants": [\n            null,\n            "Amaga la llista d\'ocupants"\n         ],\n         "Error: the \\"": [\n            null,\n            "Error: el \\""\n         ],\n         "Are you sure you want to clear the messages from this room?": [\n            null,\n            "Segur que voleu esborrar els missatges d\'aquesta sala?"\n         ],\n         "Error: could not execute the command": [\n            null,\n            "Error: no s\'ha pogut executar l\'ordre"\n         ],\n         "Change user\'s affiliation to admin": [\n            null,\n            "Canvia l\'afiliació de l\'usuari a administrador"\n         ],\n         "Ban user from room": [\n            null,\n            "Expulsa l\'usuari de la sala"\n         ],\n         "Change user role to occupant": [\n            null,\n            "Canvia el rol de l\'usuari a ocupant"\n         ],\n         "Kick user from room": [\n            null,\n            "Expulsa l\'usuari de la sala"\n         ],\n         "Write in 3rd person": [\n            null,\n            "Escriu en tercera persona"\n         ],\n         "Grant membership to a user": [\n            null,\n            "Atorga una afiliació a un usuari"\n         ],\n         "Remove user\'s ability to post messages": [\n            null,\n            "Elimina la capacitat de l\'usuari de publicar missatges"\n         ],\n         "Change your nickname": [\n            null,\n            "Canvieu el vostre àlies"\n         ],\n         "Grant moderator role to user": [\n            null,\n            "Atorga el rol de moderador a l\'usuari"\n         ],\n         "Grant ownership of this room": [\n            null,\n            "Atorga la propietat d\'aquesta sala"\n         ],\n         "Revoke user\'s membership": [\n            null,\n            "Revoca l\'afiliació de l\'usuari"\n         ],\n         "Set room subject (alias for /subject)": [\n            null,\n            ""\n         ],\n         "Allow muted user to post messages": [\n            null,\n            "Permet que un usuari silenciat publiqui missatges"\n         ],\n         "The nickname you chose is reserved or currently in use, please choose a different one.": [\n            null,\n            ""\n         ],\n         "Nickname": [\n            null,\n            "Àlies"\n         ],\n         "This chatroom requires a password": [\n            null,\n            "Aquesta sala de xat requereix una contrasenya"\n         ],\n         "Password: ": [\n            null,\n            "Contrasenya:"\n         ],\n         "Submit": [\n            null,\n            "Envia"\n         ],\n         "The reason given is: \\"": [\n            null,\n            "El motiu indicat és: \\""\n         ],\n         " has left the room. \\"": [\n            null,\n            ""\n         ],\n         " has joined the room. \\"": [\n            null,\n            ""\n         ],\n         " has joined the room.": [\n            null,\n            ""\n         ],\n         "You are not on the member list of this room": [\n            null,\n            "No sou a la llista de membres d\'aquesta sala"\n         ],\n         "No nickname was specified": [\n            null,\n            "No s\'ha especificat cap àlies"\n         ],\n         "You are not allowed to create new rooms": [\n            null,\n            "No teniu permís per crear sales noves"\n         ],\n         "Your nickname doesn\'t conform to this room\'s policies": [\n            null,\n            "El vostre àlies no s\'ajusta a les polítiques d\'aquesta sala"\n         ],\n         "This room does not (yet) exist": [\n            null,\n            "Aquesta sala (encara) no existeix"\n         ],\n         "Topic set by %1$s to: %2$s": [\n            null,\n            "Tema definit per %1$s en: %2$s"\n         ],\n         "Occupants": [\n            null,\n            "Ocupants"\n         ],\n         "Hidden": [\n            null,\n            "Amagat"\n         ],\n         "Message archiving": [\n            null,\n            ""\n         ],\n         "Members only": [\n            null,\n            ""\n         ],\n         "Moderated": [\n            null,\n            "Moderada"\n         ],\n         "Non-anonymous": [\n            null,\n            "No és anònima"\n         ],\n         "Persistent": [\n            null,\n            ""\n         ],\n         "Public": [\n            null,\n            "Pública"\n         ],\n         "Semi-anonymous": [\n            null,\n            "Semianònima"\n         ],\n         "Unmoderated": [\n            null,\n            "No moderada"\n         ],\n         "Unsecured": [\n            null,\n            ""\n         ],\n         "Messages are archived on the server": [\n            null,\n            ""\n         ],\n         "All other room occupants can see your Jabber ID": [\n            null,\n            ""\n         ],\n         "This room persists even if it\'s unoccupied": [\n            null,\n            ""\n         ],\n         "Only moderators can see your Jabber ID": [\n            null,\n            ""\n         ],\n         "This room will disappear once the last person leaves": [\n            null,\n            ""\n         ],\n         "You are about to invite %1$s to the chat room \\"%2$s\\". ": [\n            null,\n            "Esteu a punt de convidar %1$s a la sala de xat \\"%2$s\\". "\n         ],\n         "You may optionally include a message, explaining the reason for the invitation.": [\n            null,\n            "Teniu l\'opció d\'incloure un missatge per explicar el motiu de la invitació."\n         ],\n         "Room name": [\n            null,\n            "Nom de la sala"\n         ],\n         "Server": [\n            null,\n            "Servidor"\n         ],\n         "Join Room": [\n            null,\n            "Uneix-me a la sala"\n         ],\n         "Show rooms": [\n            null,\n            "Mostra les sales"\n         ],\n         "Rooms": [\n            null,\n            "Sales"\n         ],\n         "No rooms on %1$s": [\n            null,\n            "No hi ha cap sala a %1$s"\n         ],\n         "Rooms on %1$s": [\n            null,\n            "Sales a %1$s"\n         ],\n         "Description:": [\n            null,\n            "Descripció:"\n         ],\n         "Occupants:": [\n            null,\n            "Ocupants:"\n         ],\n         "Features:": [\n            null,\n            "Característiques:"\n         ],\n         "Requires authentication": [\n            null,\n            "Cal autenticar-se"\n         ],\n         "Requires an invitation": [\n            null,\n            "Cal tenir una invitació"\n         ],\n         "Open room": [\n            null,\n            "Obre la sala"\n         ],\n         "Permanent room": [\n            null,\n            "Sala permanent"\n         ],\n         "Temporary room": [\n            null,\n            "Sala temporal"\n         ],\n         "%1$s has invited you to join a chat room: %2$s": [\n            null,\n            "%1$s us ha convidat a unir-vos a una sala de xat: %2$s"\n         ],\n         "%1$s has invited you to join a chat room: %2$s, and left the following reason: \\"%3$s\\"": [\n            null,\n            "%1$s us ha convidat a unir-vos a una sala de xat (%2$s) i ha deixat el següent motiu: \\"%3$s\\""\n         ],\n         "Notification from %1$s": [\n            null,\n            ""\n         ],\n         "%1$s says": [\n            null,\n            ""\n         ],\n         "wants to be your contact": [\n            null,\n            ""\n         ],\n         "Re-establishing encrypted session": [\n            null,\n            "S\'està tornant a establir la sessió xifrada"\n         ],\n         "Generating private key.": [\n            null,\n            "S\'està generant la clau privada"\n         ],\n         "Your browser might become unresponsive.": [\n            null,\n            "És possible que el navegador no respongui."\n         ],\n         "Authentication request from %1$s\\n\\nYour chat contact is attempting to verify your identity, by asking you the question below.\\n\\n%2$s": [\n            null,\n            "Sol·licitud d\'autenticació de %1$s\\n\\nEl contacte del xat està intentant verificar la vostra identitat mitjançant la pregunta següent.\\n\\n%2$s"\n         ],\n         "Could not verify this user\'s identify.": [\n            null,\n            "No s\'ha pogut verificar la identitat d\'aquest usuari."\n         ],\n         "Exchanging private key with contact.": [\n            null,\n            "S\'està intercanviant la clau privada amb el contacte."\n         ],\n         "Your messages are not encrypted anymore": [\n            null,\n            "Els vostres missatges ja no estan xifrats"\n         ],\n         "Your messages are now encrypted but your contact\'s identity has not been verified.": [\n            null,\n            "Ara, els vostres missatges estan xifrats, però no s\'ha verificat la identitat del contacte."\n         ],\n         "Your contact\'s identify has been verified.": [\n            null,\n            "S\'ha verificat la identitat del contacte."\n         ],\n         "Your contact has ended encryption on their end, you should do the same.": [\n            null,\n            "El contacte ha conclòs el xifratge; cal que feu el mateix."\n         ],\n         "Your message could not be sent": [\n            null,\n            "No s\'ha pogut enviar el missatge"\n         ],\n         "We received an unencrypted message": [\n            null,\n            "Hem rebut un missatge sense xifrar"\n         ],\n         "We received an unreadable encrypted message": [\n            null,\n            "Hem rebut un missatge xifrat il·legible"\n         ],\n         "Here are the fingerprints, please confirm them with %1$s, outside of this chat.\\n\\nFingerprint for you, %2$s: %3$s\\n\\nFingerprint for %1$s: %4$s\\n\\nIf you have confirmed that the fingerprints match, click OK, otherwise click Cancel.": [\n            null,\n            "Aquí es mostren les empremtes. Confirmeu-les amb %1$s fora d\'aquest xat.\\n\\nEmpremta de l\'usuari %2$s: %3$s\\n\\nEmpremta de %1$s: %4$s\\n\\nSi heu confirmat que les empremtes coincideixen, feu clic a D\'acord; en cas contrari, feu clic a Cancel·la."\n         ],\n         "You will be prompted to provide a security question and then an answer to that question.\\n\\nYour contact will then be prompted the same question and if they type the exact same answer (case sensitive), their identity will be verified.": [\n            null,\n            "Se us demanarà que indiqueu una pregunta de seguretat i la resposta corresponent.\\n\\nEs farà la mateixa pregunta al vostre contacte i, si escriu exactament la mateixa resposta (es distingeix majúscules de minúscules), se\'n verificarà la identitat."\n         ],\n         "What is your security question?": [\n            null,\n            "Quina és la vostra pregunta de seguretat?"\n         ],\n         "What is the answer to the security question?": [\n            null,\n            "Quina és la resposta a la pregunta de seguretat?"\n         ],\n         "Invalid authentication scheme provided": [\n            null,\n            "S\'ha indicat un esquema d\'autenticació no vàlid"\n         ],\n         "Your messages are not encrypted. Click here to enable OTR encryption.": [\n            null,\n            "Els vostres missatges no estan xifrats. Feu clic aquí per habilitar el xifratge OTR."\n         ],\n         "Your messages are encrypted, but your contact has not been verified.": [\n            null,\n            "Els vostres missatges estan xifrats, però no s\'ha verificat el contacte."\n         ],\n         "Your messages are encrypted and your contact verified.": [\n            null,\n            "Els vostres missatges estan xifrats i s\'ha verificat el contacte."\n         ],\n         "Your contact has closed their end of the private session, you should do the same": [\n            null,\n            "El vostre contacte ha tancat la seva sessió privada; cal que feu el mateix."\n         ],\n         "End encrypted conversation": [\n            null,\n            "Finalitza la conversa xifrada"\n         ],\n         "Refresh encrypted conversation": [\n            null,\n            "Actualitza la conversa xifrada"\n         ],\n         "Start encrypted conversation": [\n            null,\n            "Comença la conversa xifrada"\n         ],\n         "Verify with fingerprints": [\n            null,\n            "Verifica amb empremtes"\n         ],\n         "Verify with SMP": [\n            null,\n            "Verifica amb SMP"\n         ],\n         "What\'s this?": [\n            null,\n            "Què és això?"\n         ],\n         "unencrypted": [\n            null,\n            "sense xifrar"\n         ],\n         "unverified": [\n            null,\n            "sense verificar"\n         ],\n         "verified": [\n            null,\n            "verificat"\n         ],\n         "finished": [\n            null,\n            "acabat"\n         ],\n         " e.g. conversejs.org": [\n            null,\n            "p. ex. conversejs.org"\n         ],\n         "Your XMPP provider\'s domain name:": [\n            null,\n            "Nom de domini del vostre proveïdor XMPP:"\n         ],\n         "Fetch registration form": [\n            null,\n            "Obtingues un formulari de registre"\n         ],\n         "Tip: A list of public XMPP providers is available": [\n            null,\n            "Consell: hi ha disponible una llista de proveïdors XMPP públics"\n         ],\n         "here": [\n            null,\n            "aquí"\n         ],\n         "Register": [\n            null,\n            "Registre"\n         ],\n         "Sorry, the given provider does not support in band account registration. Please try with a different provider.": [\n            null,\n            "El proveïdor indicat no admet el registre del compte. Proveu-ho amb un altre proveïdor."\n         ],\n         "Requesting a registration form from the XMPP server": [\n            null,\n            "S\'està sol·licitant un formulari de registre del servidor XMPP"\n         ],\n         "Something went wrong while establishing a connection with \\"%1$s\\". Are you sure it exists?": [\n            null,\n            "Ha passat alguna cosa mentre s\'establia la connexió amb \\"%1$s\\". Segur que existeix?"\n         ],\n         "Now logging you in": [\n            null,\n            "S\'està iniciant la vostra sessió"\n         ],\n         "Registered successfully": [\n            null,\n            "Registre correcte"\n         ],\n         "Return": [\n            null,\n            "Torna"\n         ],\n         "The provider rejected your registration attempt. Please check the values you entered for correctness.": [\n            null,\n            "El proveïdor ha rebutjat l\'intent de registre. Comproveu que els valors que heu introduït siguin correctes."\n         ],\n         "Retry": [\n            null,\n            ""\n         ],\n         "This contact is busy": [\n            null,\n            "Aquest contacte està ocupat"\n         ],\n         "This contact is online": [\n            null,\n            "Aquest contacte està en línia"\n         ],\n         "This contact is offline": [\n            null,\n            "Aquest contacte està desconnectat"\n         ],\n         "This contact is unavailable": [\n            null,\n            "Aquest contacte no està disponible"\n         ],\n         "This contact is away for an extended period": [\n            null,\n            "Aquest contacte està absent durant un període prolongat"\n         ],\n         "This contact is away": [\n            null,\n            "Aquest contacte està absent"\n         ],\n         "Groups": [\n            null,\n            "Grups"\n         ],\n         "My contacts": [\n            null,\n            "Els meus contactes"\n         ],\n         "Pending contacts": [\n            null,\n            "Contactes pendents"\n         ],\n         "Contact requests": [\n            null,\n            "Sol·licituds de contacte"\n         ],\n         "Ungrouped": [\n            null,\n            "Sense agrupar"\n         ],\n         "Filter": [\n            null,\n            ""\n         ],\n         "State": [\n            null,\n            ""\n         ],\n         "Any": [\n            null,\n            ""\n         ],\n         "Chatty": [\n            null,\n            ""\n         ],\n         "Extended Away": [\n            null,\n            ""\n         ],\n         "Click to remove this contact": [\n            null,\n            "Feu clic per eliminar aquest contacte"\n         ],\n         "Click to accept this contact request": [\n            null,\n            "Feu clic per acceptar aquesta sol·licitud de contacte"\n         ],\n         "Click to decline this contact request": [\n            null,\n            "Feu clic per rebutjar aquesta sol·licitud de contacte"\n         ],\n         "Click to chat with this contact": [\n            null,\n            "Feu clic per conversar amb aquest contacte"\n         ],\n         "Name": [\n            null,\n            "Nom"\n         ],\n         "Are you sure you want to remove this contact?": [\n            null,\n            "Segur que voleu eliminar aquest contacte?"\n         ],\n         "Sorry, there was an error while trying to remove ": [\n            null,\n            "S\'ha produït un error en intentar eliminar "\n         ],\n         "Are you sure you want to decline this contact request?": [\n            null,\n            "Segur que voleu rebutjar aquesta sol·licitud de contacte?"\n         ]\n      }\n   }\n}';});

/*!
 * jQuery Browser Plugin 0.1.0
 * https://github.com/gabceb/jquery-browser-plugin
 *
 * Original jquery-browser code Copyright 2005, 2015 jQuery Foundation, Inc. and other contributors
 * http://jquery.org/license
 *
 * Modifications Copyright 2015 Gabriel Cebrian
 * https://github.com/gabceb
 *
 * Released under the MIT license
 *
 * Date: 05-07-2015
 */
/*global window: false */

(function (factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define('jquery.browser',['jquery'], function ($) {
      return factory($);
    });
  } else if (typeof module === 'object' && typeof module.exports === 'object') {
    // Node-like environment
    module.exports = factory(require('jquery'));
  } else {
    // Browser globals
    factory(window.jQuery);
  }
}(function(jQuery) {
  "use strict";

  function uaMatch( ua ) {
    // If an UA is not provided, default to the current browser UA.
    if ( ua === undefined ) {
      ua = window.navigator.userAgent;
    }
    ua = ua.toLowerCase();

    var match = /(edge)\/([\w.]+)/.exec( ua ) ||
        /(opr)[\/]([\w.]+)/.exec( ua ) ||
        /(chrome)[ \/]([\w.]+)/.exec( ua ) ||
        /(iemobile)[\/]([\w.]+)/.exec( ua ) ||
        /(version)(applewebkit)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.exec( ua ) ||
        /(webkit)[ \/]([\w.]+).*(version)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.exec( ua ) ||
        /(webkit)[ \/]([\w.]+)/.exec( ua ) ||
        /(opera)(?:.*version|)[ \/]([\w.]+)/.exec( ua ) ||
        /(msie) ([\w.]+)/.exec( ua ) ||
        ua.indexOf("trident") >= 0 && /(rv)(?::| )([\w.]+)/.exec( ua ) ||
        ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec( ua ) ||
        [];

    var platform_match = /(ipad)/.exec( ua ) ||
        /(ipod)/.exec( ua ) ||
        /(windows phone)/.exec( ua ) ||
        /(iphone)/.exec( ua ) ||
        /(kindle)/.exec( ua ) ||
        /(silk)/.exec( ua ) ||
        /(android)/.exec( ua ) ||
        /(win)/.exec( ua ) ||
        /(mac)/.exec( ua ) ||
        /(linux)/.exec( ua ) ||
        /(cros)/.exec( ua ) ||
        /(playbook)/.exec( ua ) ||
        /(bb)/.exec( ua ) ||
        /(blackberry)/.exec( ua ) ||
        [];

    var browser = {},
        matched = {
          browser: match[ 5 ] || match[ 3 ] || match[ 1 ] || "",
          version: match[ 2 ] || match[ 4 ] || "0",
          versionNumber: match[ 4 ] || match[ 2 ] || "0",
          platform: platform_match[ 0 ] || ""
        };

    if ( matched.browser ) {
      browser[ matched.browser ] = true;
      browser.version = matched.version;
      browser.versionNumber = parseInt(matched.versionNumber, 10);
    }

    if ( matched.platform ) {
      browser[ matched.platform ] = true;
    }

    // These are all considered mobile platforms, meaning they run a mobile browser
    if ( browser.android || browser.bb || browser.blackberry || browser.ipad || browser.iphone ||
      browser.ipod || browser.kindle || browser.playbook || browser.silk || browser[ "windows phone" ]) {
      browser.mobile = true;
    }

    // These are all considered desktop platforms, meaning they run a desktop browser
    if ( browser.cros || browser.mac || browser.linux || browser.win ) {
      browser.desktop = true;
    }

    // Chrome, Opera 15+ and Safari are webkit based browsers
    if ( browser.chrome || browser.opr || browser.safari ) {
      browser.webkit = true;
    }

    // IE11 has a new token so we will assign it msie to avoid breaking changes
    if ( browser.rv || browser.iemobile) {
      var ie = "msie";

      matched.browser = ie;
      browser[ie] = true;
    }

    // Edge is officially known as Microsoft Edge, so rewrite the key to match
    if ( browser.edge ) {
      delete browser.edge;
      var msedge = "msedge";

      matched.browser = msedge;
      browser[msedge] = true;
    }

    // Blackberry browsers are marked as Safari on BlackBerry
    if ( browser.safari && browser.blackberry ) {
      var blackberry = "blackberry";

      matched.browser = blackberry;
      browser[blackberry] = true;
    }

    // Playbook browsers are marked as Safari on Playbook
    if ( browser.safari && browser.playbook ) {
      var playbook = "playbook";

      matched.browser = playbook;
      browser[playbook] = true;
    }

    // BB10 is a newer OS version of BlackBerry
    if ( browser.bb ) {
      var bb = "blackberry";

      matched.browser = bb;
      browser[bb] = true;
    }

    // Opera 15+ are identified as opr
    if ( browser.opr ) {
      var opera = "opera";

      matched.browser = opera;
      browser[opera] = true;
    }

    // Stock Android browsers are marked as Safari on Android.
    if ( browser.safari && browser.android ) {
      var android = "android";

      matched.browser = android;
      browser[android] = true;
    }

    // Kindle browsers are marked as Safari on Kindle
    if ( browser.safari && browser.kindle ) {
      var kindle = "kindle";

      matched.browser = kindle;
      browser[kindle] = true;
    }

     // Kindle Silk browsers are marked as Safari on Kindle
    if ( browser.safari && browser.silk ) {
      var silk = "silk";

      matched.browser = silk;
      browser[silk] = true;
    }

    // Assign the name and platform variable
    browser.name = matched.browser;
    browser.platform = matched.platform;
    return browser;
  }

  // Run the matching process, also assign the function to the returned object
  // for manual, jQuery-free use if desired
  window.jQBrowser = uaMatch( window.navigator.userAgent );
  window.jQBrowser.uaMatch = uaMatch;

  // Only assign to jQuery.browser if jQuery is loaded
  if ( jQuery ) {
    jQuery.browser = window.jQBrowser;
  }

  return window.jQBrowser;
}));

/* Lo-Dash Template Loader v1.0.1
 * Copyright 2015, Tim Branyen (@tbranyen).
 * loader.js may be freely distributed under the MIT license.
 */
(function(global) {
"use strict";

// Cache used to map configuration options between load and write.
var buildMap = {};

// Alias the correct `nodeRequire` method.
var nodeRequire = typeof requirejs === "function" && requirejs.nodeRequire;

// Strips trailing `/` from url fragments.
var stripTrailing = function(prop) {
  return prop.replace(/(\/$)/, '');
};

// Define the plugin using the CommonJS syntax.
define('tpl',['require','exports','module','lodash'],function(require, exports) {
  var _ = require("lodash");

  exports.version = "1.0.1";

  // Invoked by the AMD builder, passed the path to resolve, the require
  // function, done callback, and the configuration options.
  exports.load = function(name, req, load, config) {
    var isDojo;

    // Dojo provides access to the config object through the req function.
    if (!config) {
      config = require.rawConfig;
      isDojo = true;
    }

    var contents = "";
    var settings = configure(config);

    // If the baseUrl and root are the same, just null out the root.
    if (stripTrailing(config.baseUrl) === stripTrailing(settings.root)) {
      settings.root = '';
    }

    var url = require.toUrl(settings.root + name + settings.ext);

    if (isDojo && url.indexOf(config.baseUrl) !== 0) {
      url = stripTrailing(config.baseUrl) + url;
    }

    // Builds with r.js require Node.js to be installed.
    if (config.isBuild) {
      // If in Node, get access to the filesystem.
      var fs = nodeRequire("fs");

      try {
        // First try reading the filepath as-is.
        contents = String(fs.readFileSync(url));
      } catch(ex) {
        // If it failed, it's most likely because of a leading `/` and not an
        // absolute path.  Remove the leading slash and try again.
        if (url.slice(0, 1) === "/") {
          url = url.slice(1);
        }

        // Try reading again with the leading `/`.
        contents = String(fs.readFileSync(url));
      }

      // Read in the file synchronously, as RequireJS expects, and return the
      // contents.  Process as a Lo-Dash template.
      buildMap[name] = _.template(contents);

      return load();
    }

    // Create a basic XHR.
    var xhr = new XMLHttpRequest();

    // Wait for it to load.
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        var templateSettings = _.clone(settings.templateSettings);

        // Attach the sourceURL.
        templateSettings.sourceURL = url;

        // Process as a Lo-Dash template and cache.
        buildMap[name] = _.template(xhr.responseText, templateSettings);

        // Return the compiled template.
        load(buildMap[name]);
      }
    };

    // Initiate the fetch.
    xhr.open("GET", url, true);
    xhr.send(null);
  };

  // Also invoked by the AMD builder, this writes out a compatible define
  // call that will work with loaders such as almond.js that cannot read
  // the configuration data.
  exports.write = function(pluginName, moduleName, write) {
    var template = buildMap[moduleName].source;

    // Write out the actual definition
    write(strDefine(pluginName, moduleName, template));
  };

  // This is for curl.js/cram.js build-time support.
  exports.compile = function(pluginName, moduleName, req, io, config) {
    configure(config);

    // Ask cram to fetch the template file (resId) and pass it to `write`.
    io.read(moduleName, write, io.error);

    function write(template) {
      // Write-out define(id,function(){return{/* template */}});
      io.write(strDefine(pluginName, moduleName, template));
    }
  };

  // Crafts the written definition form of the module during a build.
  function strDefine(pluginName, moduleName, template) {
    return [
      "define('", pluginName, "!", moduleName, "', ", "['lodash'], ",
        [
          "function(_) {",
            "return ", template, ";",
          "}"
        ].join(""),
      ");\n"
    ].join("");
  }

  function configure(config) {
    // Default settings point to the project root and using html files.
    var settings = _.extend({
      ext: ".html",
      root: config.baseUrl,
      templateSettings: {}
    }, config.lodashLoader);

    // Ensure the root has been properly configured with a trailing slash,
    // unless it's an empty string or undefined, in which case work off the
    // baseUrl.
    if (settings.root && settings.root.slice(-1) !== "/") {
      settings.root += "/";
    }

    // Set the custom passed in template settings.
    _.extend(_.templateSettings, settings.templateSettings);

    return settings;
  }
});

})(typeof global === "object" ? global : this);


define('tpl!field', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<field var="' +
__e(name) +
'">';
 if (_.isArray(value)) { ;
__p += '\n    ';
 _.each(value,function(arrayValue) { ;
__p += '<value>' +
__e(arrayValue) +
'</value>';
 }); ;
__p += '\n';
 } else { ;
__p += '\n    <value>' +
__e(value) +
'</value>\n';
 } ;
__p += '</field>\n';

}
return __p
};});


define('tpl!select_option', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<option value="' +
__e(value) +
'" ';
 if (selected) { ;
__p += ' selected="selected" ';
 } ;
__p += ' >' +
__e(label) +
'</option>\n';

}
return __p
};});


define('tpl!form_select', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<label>' +
__e(label) +
'</label>\n<select name="' +
__e(name) +
'"  ';
 if (multiple) { ;
__p += ' multiple="multiple" ';
 } ;
__p += '>' +
((__t = (options)) == null ? '' : __t) +
'</select>\n';

}
return __p
};});


define('tpl!form_textarea', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<label class="label-ta">' +
__e(label) +
'</label>\n<textarea name="' +
__e(name) +
'">' +
__e(value) +
'</textarea>\n';

}
return __p
};});


define('tpl!form_checkbox', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<label>' +
__e(label) +
'</label>\n<input name="' +
__e(name) +
'" type="' +
__e(type) +
'" ' +
__e(checked) +
'>\n';

}
return __p
};});


define('tpl!form_username', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 if (label) { ;
__p += '\n<label>\n    ' +
__e(label) +
'\n</label>\n';
 } ;
__p += '\n<div class="input-group">\n    <input name="' +
__e(name) +
'" type="' +
__e(type) +
'"\n        ';
 if (value) { ;
__p += ' value="' +
__e(value) +
'" ';
 } ;
__p += '\n        ';
 if (required) { ;
__p += ' class="required" ';
 } ;
__p += ' />\n    <span title="' +
__e(domain) +
'">' +
__e(domain) +
'</span>\n</div>\n';

}
return __p
};});


define('tpl!form_input', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 if (label) { ;
__p += '\n<label>\n    ' +
__e(label) +
'\n</label>\n';
 } ;
__p += '\n<input name="' +
__e(name) +
'" type="' +
__e(type) +
'" \n    ';
 if (value) { ;
__p += ' value="' +
__e(value) +
'" ';
 } ;
__p += '\n    ';
 if (required) { ;
__p += ' class="required" ';
 } ;
__p += ' >\n';

}
return __p
};});


define('tpl!form_captcha', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 if (label) { ;
__p += '\n<label>\n    ' +
__e(label) +
'\n</label>\n';
 } ;
__p += '\n<img src="data:' +
__e(type) +
';base64,' +
__e(data) +
'">\n<input name="' +
__e(name) +
'" type="text" ';
 if (required) { ;
__p += ' class="required" ';
 } ;
__p += ' >\n\n\n';

}
return __p
};});

/*global define, escape, locales, Jed */
(function (root, factory) {
    define('utils',[
        "jquery-private",
        "jquery.browser",
        "lodash",
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
        $, dummy, _,
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

    $.fn.throttledHTML = _.throttle($.fn.html, 500);

    $.fn.addHyperlinks = function () {
        if (this.length > 0) {
            this.each(function (i, obj) {
                var prot, escaped_url;
                var $obj = $(obj);
                var x = $obj.html();
                var list = x.match(/\b(https?:\/\/|www\.|https?:\/\/www\.)[^\s<]{2,200}\b/g );
                if (list) {
                    for (i=0; i<list.length; i++) {
                        prot = list[i].indexOf('http://') === 0 || list[i].indexOf('https://') === 0 ? '' : 'http://';
                        escaped_url = encodeURI(decodeURI(list[i])).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");
                        x = x.replace(list[i], '<a target="_blank" rel="noopener" href="' + prot + escaped_url + '">'+ list[i] + '</a>' );
                    }
                }
                $obj.html(x);
                _.forEach(list, function (url) {
                    isImage(unescapeHTML(url)).then(function (img) {
                        var prot = url.indexOf('http://') === 0 || url.indexOf('https://') === 0 ? '' : 'http://';
                        var escaped_url = encodeURI(decodeURI(url)).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");
                        var new_url = '<a target="_blank" rel="noopener" href="' + prot + escaped_url + '">'+ url + '</a>';
                        img.className = 'chat-image';
                        x = x.replace(new_url, img.outerHTML);
                        $obj.throttledHTML(x);
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
            if (typeof Jed === "undefined" || _.isUndefined(this.i18n) || this.i18n === 'en') {
                return str;
            }
            // Translation factory
            if (typeof this.i18n === "string") {
                this.i18n = window.JSON.parse(this.i18n);
            }
            if (typeof this.jed === "undefined") {
                this.jed = new Jed(this.i18n);
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

        detectLocale: function (library_check) {
            /* Determine which locale is supported by the user's system as well
             * as by the relevant library (e.g. converse.js or moment.js).
             *
             * Parameters:
             *      (Function) library_check - returns a boolean indicating whether the locale is supported
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

        isOTRMessage: function (message) {
            var body = message.querySelector('body'),
                text = (!_.isNull(body) ? body.textNode : undefined);
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

    return utils;
}));

(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define('pluggable',['exports', 'lodash'], factory);
    } else if (typeof exports !== "undefined") {
        factory(exports, require('lodash'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod.exports, global._);
        global.pluggable = mod.exports;
    }
})(this, function (exports, _lodash) {
    'use strict';

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.enable = undefined;

    var _ = _interopRequireWildcard(_lodash);

    function _interopRequireWildcard(obj) {
        if (obj && obj.__esModule) {
            return obj;
        } else {
            var newObj = {};

            if (obj != null) {
                for (var key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
                }
            }

            newObj.default = obj;
            return newObj;
        }
    }

    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
        return typeof obj;
    } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };

    // The `PluginSocket` class contains the plugin architecture, and gets
    // created whenever `pluggable.enable(obj);` is called on the object
    // that you want to make pluggable.
    // You can also see it as the thing into which the plugins are plugged.
    // It takes two parameters, first, the object being made pluggable, and
    // then the name by which the pluggable object may be referenced on the
    // __super__ object (inside overrides).
    function PluginSocket(plugged, name) {
        this.name = name;
        this.plugged = plugged;
        if (typeof this.plugged.__super__ === 'undefined') {
            this.plugged.__super__ = {};
        } else if (typeof this.plugged.__super__ === 'string') {
            this.plugged.__super__ = { '__string__': this.plugged.__super__ };
        }
        this.plugged.__super__[name] = this.plugged;
        this.plugins = {};
        this.initialized_plugins = [];
    }

    // Now we add methods to the PluginSocket by adding them to its
    // prototype.
    _.extend(PluginSocket.prototype, {

        // `wrappedOverride` creates a partially applied wrapper function
        // that makes sure to set the proper super method when the
        // overriding method is called. This is done to enable
        // chaining of plugin methods, all the way up to the
        // original method.
        wrappedOverride: function wrappedOverride(key, value, super_method) {
            if (typeof super_method === "function") {
                if (typeof this.__super__ === "undefined") {
                    /* We're not on the context of the plugged object.
                    * This can happen when the overridden method is called via
                    * an event handler. In this case, we simply tack on the
                    * __super__ obj.
                    */
                    this.__super__ = {};
                }
                this.__super__[key] = super_method.bind(this);
            }
            return value.apply(this, _.drop(arguments, 3));
        },

        // `_overrideAttribute` overrides an attribute on the original object
        // (the thing being plugged into).
        //
        // If the attribute being overridden is a function, then the original
        // function will still be available via the `__super__` attribute.
        //
        // If the same function is being overridden multiple times, then
        // the original function will be available at the end of a chain of
        // functions, starting from the most recent override, all the way
        // back to the original function, each being referenced by the
        // previous' __super__ attribute.
        //
        // For example:
        //
        // `plugin2.MyFunc.__super__.myFunc => plugin1.MyFunc.__super__.myFunc => original.myFunc`
        _overrideAttribute: function _overrideAttribute(key, plugin) {
            var value = plugin.overrides[key];
            if (typeof value === "function") {
                var wrapped_function = _.partial(this.wrappedOverride, key, value, this.plugged[key]);
                this.plugged[key] = wrapped_function;
            } else {
                this.plugged[key] = value;
            }
        },

        _extendObject: function _extendObject(obj, attributes) {
            if (!obj.prototype.__super__) {
                obj.prototype.__super__ = {};
                obj.prototype.__super__[this.name] = this.plugged;
            }
            var that = this;
            _.each(attributes, function (value, key) {
                if (key === 'events') {
                    obj.prototype[key] = _.extend(value, obj.prototype[key]);
                } else if (typeof value === 'function') {
                    // We create a partially applied wrapper function, that
                    // makes sure to set the proper super method when the
                    // overriding method is called. This is done to enable
                    // chaining of plugin methods, all the way up to the
                    // original method.
                    var wrapped_function = _.partial(that.wrappedOverride, key, value, obj.prototype[key]);
                    obj.prototype[key] = wrapped_function;
                } else {
                    obj.prototype[key] = value;
                }
            });
        },

        // Plugins can specify optional dependencies (by means of the
        // `optional_dependencies` list attribute) which refers to dependencies
        // which will be initialized first, before the plugin itself gets initialized.
        // They are optional in the sense that if they aren't available, an
        // error won't be thrown.
        // However, if you want to make these dependencies strict (i.e.
        // non-optional), you can set the `strict_plugin_dependencies` attribute to `true`
        // on the object being made pluggable (i.e. the object passed to
        // `pluggable.enable`).
        loadOptionalDependencies: function loadOptionalDependencies(plugin) {
            var _this = this;

            _.each(plugin.optional_dependencies, function (name) {
                var dep = _this.plugins[name];
                if (dep) {
                    if (_.includes(dep.optional_dependencies, plugin.__name__)) {
                        /* FIXME: circular dependency checking is only one level deep. */
                        throw "Found a circular dependency between the plugins \"" + plugin.__name__ + "\" and \"" + name + "\"";
                    }
                    _this.initializePlugin(dep);
                } else {
                    _this.throwUndefinedDependencyError("Could not find optional dependency \"" + name + "\" " + "for the plugin \"" + plugin.__name__ + "\". " + "If it's needed, make sure it's loaded by require.js");
                }
            });
        },

        throwUndefinedDependencyError: function throwUndefinedDependencyError(msg) {
            if (this.plugged.strict_plugin_dependencies) {
                throw msg;
            } else {
                console.log(msg);
                return;
            }
        },

        // `applyOverrides` is called by initializePlugin. It applies any
        // and all overrides of methods or Backbone views and models that
        // are defined on any of the plugins.
        applyOverrides: function applyOverrides(plugin) {
            var _this2 = this;

            _.each(Object.keys(plugin.overrides || {}), function (key) {
                var override = plugin.overrides[key];
                if ((typeof override === 'undefined' ? 'undefined' : _typeof(override)) === "object") {
                    if (typeof _this2.plugged[key] === 'undefined') {
                        _this2.throwUndefinedDependencyError("Error: Plugin \"" + plugin.__name__ + "\" tried to override " + key + " but it's not found.");
                    } else {
                        _this2._extendObject(_this2.plugged[key], override);
                    }
                } else {
                    _this2._overrideAttribute(key, plugin);
                }
            });
        },

        // `initializePlugin` applies the overrides (if any) defined on all
        // the registered plugins and then calls the initialize method for each plugin.
        initializePlugin: function initializePlugin(plugin) {
            if (!_.includes(_.keys(this.allowed_plugins), plugin.__name__)) {
                /* Don't initialize disallowed plugins. */
                return;
            }
            if (_.includes(this.initialized_plugins, plugin.__name__)) {
                /* Don't initialize plugins twice, otherwise we get
                * infinite recursion in overridden methods.
                */
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

        // `registerPlugin` registers (or inserts, if you'd like) a plugin,
        // by adding it to the `plugins` map on the PluginSocket instance.
        registerPlugin: function registerPlugin(name, plugin) {
            if (name in this.plugins) {
                throw new Error('Error: Plugin name ' + name + ' is already taken');
            }
            plugin.__name__ = name;
            this.plugins[name] = plugin;
        },

        // `initializePlugins` should get called once all plugins have been
        // registered. It will then iterate through all the plugins, calling
        // `initializePlugin` for each.
        // The passed in  properties variable is an object with attributes and methods
        // which will be attached to the plugins.
        initializePlugins: function initializePlugins() {
            var properties = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
            var whitelist = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
            var blacklist = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

            if (!_.size(this.plugins)) {
                return;
            }
            this.properties = properties;
            this.allowed_plugins = _.pickBy(this.plugins, function (plugin, key) {
                return (!whitelist.length || whitelist.length && _.includes(whitelist, key)) && !_.includes(blacklist, key);
            });
            _.each(_.values(this.allowed_plugins), this.initializePlugin.bind(this));
        }
    });

    function enable(object, name, attrname) {
        // Call the `enable` method to make an object pluggable
        //
        // It takes three parameters:
        // - `object`: The object that gets made pluggable.
        // - `name`: The string name by which the now pluggable object
        //     may be referenced on the __super__ obj (in overrides).
        //     The default value is "plugged".
        // - `attrname`: The string name of the attribute on the now
        //     pluggable object, which refers to the PluginSocket instance
        //     that gets created.
        if (typeof attrname === "undefined") {
            attrname = "pluginSocket";
        }
        if (typeof name === 'undefined') {
            name = 'plugged';
        }
        var ref = {};
        ref[attrname] = new PluginSocket(object, name);
        return _.extend(object, ref);
    }

    exports.enable = enable;
    exports.default = {
        enable: enable
    };
});

//# sourceMappingURL=pluggable.js.map;
// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window, document */
(function (root, factory) {
    define('converse-core',["sizzle",
            "jquery-private",
            "lodash",
            "polyfill",
            "locales",
            "utils",
            "moment_with_locales",
            "strophe",
            "pluggable",
            "strophe.disco",
            "backbone.browserStorage",
            "backbone.overview",
    ], factory);
}(this, function (sizzle, $, _, polyfill, locales, utils, moment, Strophe, pluggable) {
    /* Cannot use this due to Safari bug.
     * See https://github.com/jcbrand/converse.js/issues/196
     */
    // "use strict";

    // Strophe globals
    var $build = Strophe.$build;
    var $iq = Strophe.$iq;
    var $msg = Strophe.$msg;
    var $pres = Strophe.$pres;
    var b64_sha1 = Strophe.SHA1.b64_sha1;
    Strophe = Strophe.Strophe;

    // Use Mustache style syntax for variable interpolation
    /* Configuration of Lodash templates (this config is distinct to the
     * config of requirejs-tpl in main.js). This one is for normal inline templates.
     */
    _.templateSettings = {
        evaluate : /\{\[([\s\S]+?)\]\}/g,
        interpolate : /\{\{([\s\S]+?)\}\}/g
    };

    var _converse = {};
    _converse.templates = {};
    _.extend(_converse, Backbone.Events);
    _converse.promises = {
        'cachedRoster': new $.Deferred(),
        'chatBoxesFetched': new $.Deferred(),
        'connected': new $.Deferred(),
        'pluginsInitialized': new $.Deferred(),
        'roster': new $.Deferred(),
        'rosterContactsFetched': new $.Deferred(),
        'rosterGroupsFetched': new $.Deferred(),
        'rosterInitialized': new $.Deferred(),
        'statusInitialized': new $.Deferred()
    };
    _converse.emit = function (name) {
        _converse.trigger.apply(this, arguments);
        var promise = _converse.promises[name];
        if (!_.isUndefined(promise)) {
            promise.resolve();
        }
    };

    _converse.core_plugins = [
        'converse-bookmarks',
        'converse-chatview',
        'converse-controlbox',
        'converse-core',
        'converse-dragresize',
        'converse-headline',
        'converse-mam',
        'converse-minimize',
        'converse-muc',
        'converse-notification',
        'converse-otr',
        'converse-ping',
        'converse-register',
        'converse-rosterview',
        'converse-vcard'
    ];

    // Make converse pluggable
    pluggable.enable(_converse, '_converse', 'pluggable');

    // Module-level constants
    _converse.STATUS_WEIGHTS = {
        'offline':      6,
        'unavailable':  5,
        'xa':           4,
        'away':         3,
        'dnd':          2,
        'chat':         1, // We currently don't differentiate between "chat" and "online"
        'online':       1
    };
    _converse.PRETTY_CHAT_STATUS = {
        'offline':      'Offline',
        'unavailable':  'Unavailable',
        'xa':           'Extended Away',
        'away':         'Away',
        'dnd':          'Do not disturb',
        'chat':         'Chattty',
        'online':       'Online'
    };
    _converse.ANONYMOUS  = "anonymous";
    _converse.CLOSED = 'closed';
    _converse.EXTERNAL = "external";
    _converse.LOGIN = "login";
    _converse.LOGOUT = "logout";
    _converse.OPENED = 'opened';
    _converse.PREBIND = "prebind";

    var PRETTY_CONNECTION_STATUS = {
        0: 'ERROR',
        1: 'CONNECTING',
        2: 'CONNFAIL',
        3: 'AUTHENTICATING',
        4: 'AUTHFAIL',
        5: 'CONNECTED',
        6: 'DISCONNECTED',
        7: 'DISCONNECTING',
        8: 'ATTACHED',
        9: 'REDIRECT'
    };

    var DEFAULT_IMAGE_TYPE = 'image/png';
    var DEFAULT_IMAGE = "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3gwHCy455JBsggAABkJJREFUeNrtnM1PE1sUwHvvTD8otWLHST/Gimi1CEgr6M6FEWuIBo2pujDVsNDEP8GN/4MbN7oxrlipG2OCgZgYlxAbkRYw1KqkIDRCSkM7nXvvW8x7vjyNeQ9m7p1p3z1LQk/v/Dhz7vkEXL161cHl9wI5Ag6IA+KAOCAOiAPigDggLhwQB2S+iNZ+PcYY/SWEEP2HAAAIoSAIoihCCP+ngDDGtVotGAz29/cfOXJEUZSOjg6n06lp2sbGRqlUWlhYyGazS0tLbrdbEASrzgksyeYJId3d3el0uqenRxRFAAAA4KdfIIRgjD9+/Pj8+fOpqSndslofEIQwHA6Pjo4mEon//qmFhYXHjx8vLi4ihBgDEnp7e9l8E0Jo165dQ0NDd+/eDYVC2/qsJElDQ0OEkKWlpa2tLZamxAhQo9EIBoOjo6MXL17csZLe3l5FUT59+lQul5l5JRaAVFWNRqN37tw5ceKEQVWRSOTw4cOFQuHbt2+iKLYCIISQLMu3b99OJpOmKAwEAgcPHszn8+vr6wzsiG6UQQhxuVyXLl0aGBgwUW0sFstkMl6v90fo1KyAMMYDAwPnzp0zXfPg4GAqlWo0Gk0MiBAiy/L58+edTqf5Aa4onj59OhaLYYybFRCEMBaL0fNxBw4cSCQStN0QRUBut3t4eJjq6U+dOiVJElVPRBFQIBDo6+ujCqirqyscDlONGykC2lYyYSR6pBoQQapHZwAoHo/TuARYAOrs7GQASFEUqn6aIiBJkhgA6ujooFpUo6iaTa7koFwnaoWadLNe81tbWwzoaJrWrICWl5cZAFpbW6OabVAEtLi4yABQsVjUNK0pAWWzWQaAcrlcswKanZ1VVZUqHYRQEwOq1Wpv3ryhCmh6erpcLjdrNl+v1ycnJ+l5UELI27dvv3//3qxxEADgy5cvExMT9Mznw4cPtFtAdAPFarU6Pj5eKpVM17yxsfHy5cvV1VXazXu62gVBKBQKT58+rdVqJqrFGL948eLdu3dU8/g/H4FBUaJYLAqC0NPTY9brMD4+PjY25mDSracOCABACJmZmXE6nUePHjWu8NWrV48ePSKEsGlAs7Agfd5nenq6Wq0mk0kjDzY2NvbkyRMIIbP2PLvhBUEQ8vl8NpuNx+M+n29bzhVjvLKycv/+/YmJCcazQuwA6YzW1tYmJyf1SY+2trZ/rRk1Go1SqfT69esHDx4UCgVmNaa/zZ/9ABUhRFXVYDB48uTJeDweiUQkSfL7/T9MA2NcqVTK5fLy8vL8/PzU1FSxWHS5XJaM4wGr9sUwxqqqer3eUCgkSZJuUBBCfTRvc3OzXC6vrKxUKhWn02nhCJ5lM4oQQo/HgxD6+vXr58+fHf8sDOp+HQDg8XgclorFU676dKLlo6yWRdItIBwQB8QBcUCtfosRQjRNQwhhjPUC4w46WXryBSHU1zgEQWBz99EFhDGu1+t+v//48ePxeFxRlD179ng8nh0Efgiher2+vr6ur3HMzMysrq7uTJVdACGEurq6Ll++nEgkPB7Pj9jPoDHqOxyqqubz+WfPnuVyuV9XPeyeagAAAoHArVu3BgcHab8CuVzu4cOHpVKJUnfA5GweY+xyuc6cOXPv3r1IJMLAR8iyPDw8XK/Xi8Wiqqqmm5KZgBBC7e3tN27cuHbtGuPVpf7+/lAoNDs7W61WzfVKpgHSSzw3b95MpVKW3MfRaDQSiczNzVUqFRMZmQOIEOL1eq9fv3727FlL1t50URRFluX5+flqtWpWEGAOIFEUU6nUlStXLKSjy759+xwOx9zcnKZpphzGHMzhcDiTydgk9r1w4YIp7RPTAAmCkMlk2FeLf/tIEKbTab/fbwtAhJBoNGrutpNx6e7uPnTokC1eMU3T0um0DZPMkZER6wERQnw+n/FFSxpy7Nix3bt3WwwIIcRgIWnHkkwmjecfRgGx7DtuV/r6+iwGhDHev3+/bQF1dnYaH6E2CkiWZdsC2rt3r8WAHA5HW1ubbQGZcjajgOwTH/4qNko1Wlg4IA6IA+KAOKBWBUQIsfNojyliKIoRRfH9+/dut9umf3wzpoUNNQ4BAJubmwz+ic+OxefzWWlBhJD29nbug7iT5sIBcUAcEAfEAXFAHBAHxOVn+QMrmWpuPZx12gAAAABJRU5ErkJggg==";

    _converse.log = function (txt, level) {
        var logger;
        if (_.isUndefined(console) || _.isUndefined(console.log)) {
            logger = { log: _.noop, error: _.noop };
        } else {
            logger = console;
        }
        if (_converse.debug) {
            if (level === 'error') {
                logger.log('ERROR: '+txt);
            } else {
                logger.log(txt);
            }
        }
    };


    _converse.initialize = function (settings, callback) {
        "use strict";
        settings = !_.isUndefined(settings) ? settings : {};
        var init_deferred = new $.Deferred();

        if (!_.isUndefined(_converse.chatboxes)) {
            // Looks like _converse.initialized was called again without logging
            // out or disconnecting in the previous session.
            // This happens in tests. We therefore first clean up.
            _converse.connection.reset();
            _converse.off();
            _converse.stopListening();
            _converse._tearDown();
        }

        var unloadevent;
        if ('onpagehide' in window) {
            // Pagehide gets thrown in more cases than unload. Specifically it
            // gets thrown when the page is cached and not just
            // closed/destroyed. It's the only viable event on mobile Safari.
            // https://www.webkit.org/blog/516/webkit-page-cache-ii-the-unload-event/
            unloadevent = 'pagehide';
        } else if ('onbeforeunload' in window) {
            unloadevent = 'beforeunload';
        } else if ('onunload' in window) {
            unloadevent = 'unload';
        }

        // Logging
        Strophe.log = function (level, msg) { _converse.log(level+' '+msg, level); };
        Strophe.error = function (msg) { _converse.log(msg, 'error'); };

        // Add Strophe Namespaces
        Strophe.addNamespace('CARBONS', 'urn:xmpp:carbons:2');
        Strophe.addNamespace('CHATSTATES', 'http://jabber.org/protocol/chatstates');
        Strophe.addNamespace('CSI', 'urn:xmpp:csi:0');
        Strophe.addNamespace('DELAY', 'urn:xmpp:delay');
        Strophe.addNamespace('HINTS', 'urn:xmpp:hints');
        Strophe.addNamespace('NICK', 'http://jabber.org/protocol/nick');
        Strophe.addNamespace('PUBSUB', 'http://jabber.org/protocol/pubsub');
        Strophe.addNamespace('ROSTERX', 'http://jabber.org/protocol/rosterx');
        Strophe.addNamespace('XFORM', 'jabber:x:data');

        // Instance level constants
        this.TIMEOUTS = { // Set as module attr so that we can override in tests.
            'PAUSED':     10000,
            'INACTIVE':   90000
        };

        // XEP-0085 Chat states
        // http://xmpp.org/extensions/xep-0085.html
        this.INACTIVE = 'inactive';
        this.ACTIVE = 'active';
        this.COMPOSING = 'composing';
        this.PAUSED = 'paused';
        this.GONE = 'gone';

        // Detect support for the user's locale
        // ------------------------------------
        locales = _.isUndefined(locales) ? {} : locales;
        this.isConverseLocale = function (locale) {
            return !_.isUndefined(locales[locale]);
        };
        this.isMomentLocale = function (locale) { return moment.locale() !== moment.locale(locale); };
        if (!moment.locale) { //moment.lang is deprecated after 2.8.1, use moment.locale instead
            moment.locale = moment.lang;
        }
        moment.locale(utils.detectLocale(this.isMomentLocale));
        if (_.includes(_.keys(locales), settings.i18n)) {
            settings.i18n = locales[settings.i18n];
        }
        this.i18n = settings.i18n ? settings.i18n : locales[utils.detectLocale(this.isConverseLocale)] || {};

        // Translation machinery
        // ---------------------
        var __ = _converse.__ = utils.__.bind(_converse);
        _converse.___ = utils.___;
        var DESC_GROUP_TOGGLE = __('Click to hide these contacts');

        // Default configuration values
        // ----------------------------
        this.default_settings = {
            allow_contact_requests: true,
            allow_non_roster_messaging: false,
            animate: true,
            authentication: 'login', // Available values are "login", "prebind", "anonymous" and "external".
            auto_away: 0, // Seconds after which user status is set to 'away'
            auto_login: false, // Currently only used in connection with anonymous login
            auto_reconnect: false,
            auto_subscribe: false,
            auto_xa: 0, // Seconds after which user status is set to 'xa'
            blacklisted_plugins: [],
            bosh_service_url: undefined,
            connection_options: {},
            credentials_url: null, // URL from where login credentials can be fetched
            csi_waiting_time: 0, // Support for XEP-0352. Seconds before client is considered idle and CSI is sent out.
            debug: false,
            default_state: 'online',
            expose_rid_and_sid: false,
            filter_by_resource: false,
            forward_messages: false,
            hide_offline_users: false,
            include_offline_state: false,
            jid: undefined,
            keepalive: true,
            locked_domain: undefined,
            message_carbons: true,
            message_storage: 'session',
            password: undefined,
            prebind_url: null,
            priority: 0,
            registration_domain: '',
            rid: undefined,
            roster_groups: true,
            show_only_online_users: false,
            sid: undefined,
            storage: 'session',
            strict_plugin_dependencies: false,
            synchronize_availability: true,
            websocket_url: undefined,
            whitelisted_plugins: [],
            xhr_custom_status: false,
            xhr_custom_status_url: '',
            show_send_button: false
        };
        _.assignIn(this, this.default_settings);
        // Allow only whitelisted configuration attributes to be overwritten
        _.assignIn(this, _.pick(settings, _.keys(this.default_settings)));

        if (this.authentication === _converse.ANONYMOUS) {
            if (this.auto_login && !this.jid) {
                throw new Error("Config Error: you need to provide the server's " +
                      "domain via the 'jid' option when using anonymous " +
                      "authentication with auto_login.");
            }
        }

        $.fx.off = !this.animate;

        // Module-level variables
        // ----------------------
        this.callback = callback || _.noop;
        /* When reloading the page:
         * For new sessions, we need to send out a presence stanza to notify
         * the server/network that we're online.
         * When re-attaching to an existing session (e.g. via the keepalive
         * option), we don't need to again send out a presence stanza, because
         * it's as if "we never left" (see onConnectStatusChanged).
         * https://github.com/jcbrand/converse.js/issues/521
         */
        this.send_initial_presence = true;
        this.msg_counter = 0;
        this.user_settings = settings; // Save the user settings so that they can be used by plugins

        // Module-level functions
        // ----------------------
        this.getViewForChatBox = function (chatbox) {
            if (!chatbox) { return; }
            return _converse.chatboxviews.get(chatbox.get('id'));
        };

        this.generateResource = function () {
            return '/converse.js-' + Math.floor(Math.random()*139749825).toString();
        };

        this.sendCSI = function (stat) {
            /* Send out a Chat Status Notification (XEP-0352)
             *
             * Parameters:
             *  (String) stat: The user's chat status
             */
            /* Send out a Chat Status Notification (XEP-0352) */
            // XXX if (converse.features[Strophe.NS.CSI] || true) {
            _converse.connection.send($build(stat, {xmlns: Strophe.NS.CSI}));
            _converse.inactive = (stat === _converse.INACTIVE) ? true : false;
        };

        this.onUserActivity = function () {
            /* Resets counters and flags relating to CSI and auto_away/auto_xa */
            if (_converse.idle_seconds > 0) {
                _converse.idle_seconds = 0;
            }
            if (!_converse.connection.authenticated) {
                // We can't send out any stanzas when there's no authenticated connection.
                // converse can happen when the connection reconnects.
                return;
            }
            if (_converse.inactive) {
                _converse.sendCSI(_converse.ACTIVE);
            }
            if (_converse.auto_changed_status === true) {
                _converse.auto_changed_status = false;
                // XXX: we should really remember the original state here, and
                // then set it back to that...
                _converse.xmppstatus.setStatus(_converse.default_state);
            }
        };

        this.onEverySecond = function () {
            /* An interval handler running every second.
             * Used for CSI and the auto_away and auto_xa features.
             */
            if (!_converse.connection.authenticated) {
                // We can't send out any stanzas when there's no authenticated connection.
                // This can happen when the connection reconnects.
                return;
            }
            var stat = _converse.xmppstatus.getStatus();
            _converse.idle_seconds++;
            if (_converse.csi_waiting_time > 0 &&
                    _converse.idle_seconds > _converse.csi_waiting_time &&
                    !_converse.inactive) {
                _converse.sendCSI(_converse.INACTIVE);
            }
            if (_converse.auto_away > 0 &&
                    _converse.idle_seconds > _converse.auto_away &&
                    stat !== 'away' && stat !== 'xa' && stat !== 'dnd') {
                _converse.auto_changed_status = true;
                _converse.xmppstatus.setStatus('away');
            } else if (_converse.auto_xa > 0 &&
                    _converse.idle_seconds > _converse.auto_xa &&
                    stat !== 'xa' && stat !== 'dnd') {
                _converse.auto_changed_status = true;
                _converse.xmppstatus.setStatus('xa');
            }
        };

        this.registerIntervalHandler = function () {
            /* Set an interval of one second and register a handler for it.
             * Required for the auto_away, auto_xa and csi_waiting_time features.
             */
            if (_converse.auto_away < 1 && _converse.auto_xa < 1 && _converse.csi_waiting_time < 1) {
                // Waiting time of less then one second means features aren't used.
                return;
            }
            _converse.idle_seconds = 0;
            _converse.auto_changed_status = false; // Was the user's status changed by _converse.js?
            $(window).on('click mousemove keypress focus'+unloadevent, _converse.onUserActivity);
            _converse.everySecondTrigger = window.setInterval(_converse.onEverySecond, 1000);
        };

        this.giveFeedback = function (subject, klass, message) {
            $('.conn-feedback').each(function (idx, el) {
                el.classList.add('conn-feedback');
                el.textContent = subject;
                if (klass) {
                    el.classList.add(klass);
                } else {
                    el.classList.remove('error');
                }
            });
            _converse.emit('feedback', {
                'klass': klass,
                'message': message,
                'subject': subject
            });
        };

        this.rejectPresenceSubscription = function (jid, message) {
            /* Reject or cancel another user's subscription to our presence updates.
             *
             *  Parameters:
             *    (String) jid - The Jabber ID of the user whose subscription
             *      is being canceled.
             *    (String) message - An optional message to the user
             */
            var pres = $pres({to: jid, type: "unsubscribed"});
            if (message && message !== "") { pres.c("status").t(message); }
            _converse.connection.send(pres);
        };

        this.reconnect = _.debounce(function () {
            _converse.log('RECONNECTING');
            _converse.log('The connection has dropped, attempting to reconnect.');
            _converse.giveFeedback(
                __("Reconnecting"),
                'warn',
                __('The connection has dropped, attempting to reconnect.')
            );
            _converse.connection.reconnecting = true;
            _converse._tearDown();
            _converse.logIn(null, true);
        }, 3000, {'leading': true});

        this.disconnect = function () {
            _converse.log('DISCONNECTED');
            delete _converse.connection.reconnecting;
            _converse.connection.reset();
            _converse._tearDown();
            _converse.chatboxviews.closeAllChatBoxes();
            _converse.emit('disconnected');
        };

        this.onDisconnected = function () {
            /* Gets called once strophe's status reaches Strophe.Status.DISCONNECTED.
             * Will either start a teardown process for converse.js or attempt
             * to reconnect.
             */
            if (_converse.disconnection_cause === Strophe.Status.AUTHFAIL) {
                if (_converse.credentials_url && _converse.auto_reconnect) {
                    /* In this case, we reconnect, because we might be receiving
                     * expirable tokens from the credentials_url.
                     */
                    _converse.emit('will-reconnect');
                    return _converse.reconnect();
                } else {
                    return _converse.disconnect();
                }
            } else if (_converse.disconnection_cause === _converse.LOGOUT ||
                    _converse.disconnection_reason === "host-unknown" ||
                    !_converse.auto_reconnect) {
                return _converse.disconnect();
            }
            _converse.emit('will-reconnect');
            _converse.reconnect();
        };

        this.setDisconnectionCause = function (cause, reason, override) {
            /* Used to keep track of why we got disconnected, so that we can
             * decide on what the next appropriate action is (in onDisconnected)
             */
            if (_.isUndefined(cause)) {
                delete _converse.disconnection_cause;
                delete _converse.disconnection_reason;
            } else if (_.isUndefined(_converse.disconnection_cause) || override) {
                _converse.disconnection_cause = cause;
                _converse.disconnection_reason = reason;
            }
        };

        this.onConnectStatusChanged = function (status, condition) {
            /* Callback method called by Strophe as the Strophe.Connection goes
             * through various states while establishing or tearing down a
             * connection.
             */
            _converse.log("Status changed to: "+PRETTY_CONNECTION_STATUS[status]);
            if (status === Strophe.Status.CONNECTED || status === Strophe.Status.ATTACHED) {
                // By default we always want to send out an initial presence stanza.
                _converse.send_initial_presence = true;
                _converse.setDisconnectionCause();
                if (_converse.connection.reconnecting) {
                    _converse.log(status === Strophe.Status.CONNECTED ? 'Reconnected' : 'Reattached');
                    _converse.onConnected(true);
                } else {
                    _converse.log(status === Strophe.Status.CONNECTED ? 'Connected' : 'Attached');
                    if (_converse.connection.restored) {
                        // No need to send an initial presence stanza when
                        // we're restoring an existing session.
                        _converse.send_initial_presence = false;
                    }
                    _converse.onConnected();
                }
            } else if (status === Strophe.Status.DISCONNECTED) {
                _converse.setDisconnectionCause(status, condition);
                _converse.onDisconnected();
            } else if (status === Strophe.Status.ERROR) {
                _converse.giveFeedback(
                    __('Connection error'), 'error',
                    __('An error occurred while connecting to the chat server.')
                );
            } else if (status === Strophe.Status.CONNECTING) {
                _converse.giveFeedback(__('Connecting'));
            } else if (status === Strophe.Status.AUTHENTICATING) {
                _converse.giveFeedback(__('Authenticating'));
            } else if (status === Strophe.Status.AUTHFAIL) {
                _converse.giveFeedback(__('Authentication Failed'), 'error');
                _converse.setDisconnectionCause(status, condition, true);
                _converse.onDisconnected();
            } else if (status === Strophe.Status.CONNFAIL) {
                _converse.giveFeedback(
                    __('Connection failed'), 'error',
                    __('An error occurred while connecting to the chat server: '+condition)
                );
                _converse.setDisconnectionCause(status, condition);
            } else if (status === Strophe.Status.DISCONNECTING) {
                _converse.setDisconnectionCause(status, condition);
            }
        };

        this.updateMsgCounter = function () {
            if (this.msg_counter > 0) {
                if (document.title.search(/^Messages \(\d+\) /) === -1) {
                    document.title = "Messages (" + this.msg_counter + ") " + document.title;
                } else {
                    document.title = document.title.replace(/^Messages \(\d+\) /, "Messages (" + this.msg_counter + ") ");
                }
            } else if (document.title.search(/^Messages \(\d+\) /) !== -1) {
                document.title = document.title.replace(/^Messages \(\d+\) /, "");
            }
        };

        this.incrementMsgCounter = function () {
            this.msg_counter += 1;
            this.updateMsgCounter();
        };

        this.clearMsgCounter = function () {
            this.msg_counter = 0;
            this.updateMsgCounter();
        };

        this.initStatus = function () {
            var deferred = new $.Deferred();
            this.xmppstatus = new this.XMPPStatus();
            var id = b64_sha1('converse.xmppstatus-'+_converse.bare_jid);
            this.xmppstatus.id = id; // Appears to be necessary for backbone.browserStorage
            this.xmppstatus.browserStorage = new Backbone.BrowserStorage[_converse.storage](id);
            this.xmppstatus.fetch({
                success: deferred.resolve,
                error: deferred.resolve
            });
            _converse.emit('statusInitialized');
            return deferred.promise();
        };

        this.initSession = function () {
            this.session = new this.Session();
            var id = b64_sha1('converse.bosh-session');
            this.session.id = id; // Appears to be necessary for backbone.browserStorage
            this.session.browserStorage = new Backbone.BrowserStorage[_converse.storage](id);
            this.session.fetch();
        };

        this.clearSession = function () {
            if (!_.isUndefined(this.roster)) {
                this.roster.browserStorage._clear();
            }
            this.session.browserStorage._clear();
        };

        this.logOut = function () {
            _converse.setDisconnectionCause(_converse.LOGOUT, undefined, true);
            if (!_.isUndefined(_converse.connection)) {
                _converse.connection.disconnect();
            }
            _converse.chatboxviews.closeAllChatBoxes();
            _converse.clearSession();
            _converse._tearDown();
            _converse.emit('logout');
        };

        this.saveWindowState = function (ev, hidden) {
            // XXX: eventually we should be able to just use
            // document.visibilityState (when we drop support for older
            // browsers).
            var state;
            var v = "visible", h = "hidden",
                event_map = {
                    'focus': v,
                    'focusin': v,
                    'pageshow': v,
                    'blur': h,
                    'focusout': h,
                    'pagehide': h
                };
            ev = ev || document.createEvent('Events');
            if (ev.type in event_map) {
                state = event_map[ev.type];
            } else {
                state = document[hidden] ? "hidden" : "visible";
            }
            if (state  === 'visible') {
                _converse.clearMsgCounter();
            }
            _converse.windowState = state;
        };

        this.registerGlobalEventHandlers = function () {
            // Taken from:
            // http://stackoverflow.com/questions/1060008/is-there-a-way-to-detect-if-a-browser-window-is-not-currently-active
            var hidden = "hidden";
            // Standards:
            if (hidden in document) {
                document.addEventListener("visibilitychange", _.partial(_converse.saveWindowState, _, hidden));
            } else if ((hidden = "mozHidden") in document) {
                document.addEventListener("mozvisibilitychange", _.partial(_converse.saveWindowState, _, hidden));
            } else if ((hidden = "webkitHidden") in document) {
                document.addEventListener("webkitvisibilitychange", _.partial(_converse.saveWindowState, _, hidden));
            } else if ((hidden = "msHidden") in document) {
                document.addEventListener("msvisibilitychange", _.partial(_converse.saveWindowState, _, hidden));
            } else if ("onfocusin" in document) {
                // IE 9 and lower:
                document.onfocusin = document.onfocusout = _.partial(_converse.saveWindowState, _, hidden);
            } else {
                // All others:
                window.onpageshow = window.onpagehide = window.onfocus = window.onblur = _.partial(_converse.saveWindowState, _, hidden);
            }
            // set the initial state (but only if browser supports the Page Visibility API)
            if( document[hidden] !== undefined ) {
                _.partial(_converse.saveWindowState, _, hidden)({type: document[hidden] ? "blur" : "focus"});
            }
        };

        this.enableCarbons = function () {
            /* Ask the XMPP server to enable Message Carbons
             * See XEP-0280 https://xmpp.org/extensions/xep-0280.html#enabling
             */
            if (!this.message_carbons || this.session.get('carbons_enabled')) {
                return;
            }
            var carbons_iq = new Strophe.Builder('iq', {
                from: this.connection.jid,
                id: 'enablecarbons',
                type: 'set'
              })
              .c('enable', {xmlns: Strophe.NS.CARBONS});
            this.connection.addHandler(function (iq) {
                if (iq.querySelectorAll('error').length > 0) {
                    _converse.log('ERROR: An error occured while trying to enable message carbons.');
                } else {
                    this.session.save({carbons_enabled: true});
                    _converse.log('Message carbons have been enabled.');
                }
            }.bind(this), null, "iq", null, "enablecarbons");
            this.connection.send(carbons_iq);
        };

        this.initRoster = function () {
            /* Initialize the Bakcbone collections that represent the contats
             * roster and the roster groups.
             */
            _converse.roster = new _converse.RosterContacts();
            _converse.roster.browserStorage = new Backbone.BrowserStorage.session(
                b64_sha1('converse.contacts-'+_converse.bare_jid));
            _converse.rostergroups = new _converse.RosterGroups();
            _converse.rostergroups.browserStorage = new Backbone.BrowserStorage.session(
                b64_sha1('converse.roster.groups'+_converse.bare_jid));
            _converse.emit('rosterInitialized');
        };

        this.populateRoster = function () {
            /* Fetch all the roster groups, and then the roster contacts.
             * Emit an event after fetching is done in each case.
             */
            _converse.rostergroups.fetchRosterGroups().then(function () {
                _converse.emit('rosterGroupsFetched');
                _converse.roster.fetchRosterContacts().then(function () {
                    _converse.emit('rosterContactsFetched');
                    _converse.sendInitialPresence();
                });
            });
        };

        this.unregisterPresenceHandler = function () {
            if (!_.isUndefined(_converse.presence_ref)) {
                _converse.connection.deleteHandler(_converse.presence_ref);
                delete _converse.presence_ref;
            }
        };

        this.registerPresenceHandler = function () {
            _converse.unregisterPresenceHandler();
            _converse.presence_ref = _converse.connection.addHandler(
                function (presence) {
                    _converse.roster.presenceHandler(presence);
                    return true;
                }, null, 'presence', null);
        };


        this.sendInitialPresence = function () {
            if (_converse.send_initial_presence) {
                _converse.xmppstatus.sendPresence();
            }
        };

        this.onStatusInitialized = function (reconnecting) {
            /* Continue with session establishment (e.g. fetching chat boxes,
             * populating the roster etc.) necessary once the connection has
             * been established.
             */
            if (reconnecting) {
                // No need to recreate the roster, otherwise we lose our
                // cached data. However we still emit an event, to give
                // event handlers a chance to register views for the
                // roster and its groups, before we start populating.
                _converse.emit('rosterReadyAfterReconnection');
            } else {
                _converse.registerIntervalHandler();
                _converse.initRoster();
            }
            // First set up chat boxes, before populating the roster, so that
            // the controlbox is properly set up and ready for the rosterview.
            _converse.chatboxes.onConnected();
            _converse.populateRoster();
            _converse.registerPresenceHandler();
            _converse.giveFeedback(__('Contacts'));
            if (reconnecting) {
                _converse.xmppstatus.sendPresence();
            } else {
                init_deferred.resolve();
                _converse.emit('initialized');
            }
        };

        this.setUserJid = function () {
            _converse.jid = _converse.connection.jid;
            _converse.bare_jid = Strophe.getBareJidFromJid(_converse.connection.jid);
            _converse.resource = Strophe.getResourceFromJid(_converse.connection.jid);
            _converse.domain = Strophe.getDomainFromJid(_converse.connection.jid);
        };

        this.onConnected = function (reconnecting) {
            /* Called as soon as a new connection has been established, either
             * by logging in or by attaching to an existing BOSH session.
             */
            // Solves problem of returned PubSub BOSH response not received
            // by browser.
            _converse.connection.flush();

            _converse.setUserJid();
            _converse.enableCarbons();

            // If there's no xmppstatus obj, then we were never connected to
            // begin with, so we set reconnecting to false.
            reconnecting = _.isUndefined(_converse.xmppstatus) ? false : reconnecting;

            if (reconnecting) {
                _converse.onStatusInitialized(true);
                _converse.emit('reconnected');
            } else {
                // There might be some open chat boxes. We don't
                // know whether these boxes are of the same account or not, so we
                // close them now.
                _converse.chatboxviews.closeAllChatBoxes();
                _converse.features = new _converse.Features();
                _converse.initStatus().done(_.partial(_converse.onStatusInitialized, false));
                _converse.emit('connected');
            }
        };

        this.RosterContact = Backbone.Model.extend({

            initialize: function (attributes) {
                var jid = attributes.jid;
                var bare_jid = Strophe.getBareJidFromJid(jid).toLowerCase();
                var resource = Strophe.getResourceFromJid(jid);
                attributes.jid = bare_jid;
                this.set(_.assignIn({
                    'id': bare_jid,
                    'jid': bare_jid,
                    'fullname': bare_jid,
                    'chat_status': 'offline',
                    'user_id': Strophe.getNodeFromJid(jid),
                    'resources': resource ? {'resource':0} : {},
                    'groups': [],
                    'image_type': DEFAULT_IMAGE_TYPE,
                    'image': DEFAULT_IMAGE,
                    'status': ''
                }, attributes));

                this.on('destroy', function () { this.removeFromRoster(); }.bind(this));
                this.on('change:chat_status', function (item) {
                    _converse.emit('contactStatusChanged', item.attributes);
                });
            },

            subscribe: function (message) {
                /* Send a presence subscription request to this roster contact
                 *
                 * Parameters:
                 *    (String) message - An optional message to explain the
                 *      reason for the subscription request.
                 */
                this.save('ask', "subscribe"); // ask === 'subscribe' Means we have ask to subscribe to them.
                var pres = $pres({to: this.get('jid'), type: "subscribe"});
                if (message && message !== "") {
                    pres.c("status").t(message).up();
                }
                var nick = _converse.xmppstatus.get('fullname');
                if (nick && nick !== "") {
                    pres.c('nick', {'xmlns': Strophe.NS.NICK}).t(nick).up();
                }
                _converse.connection.send(pres);
                return this;
            },

            ackSubscribe: function () {
                /* Upon receiving the presence stanza of type "subscribed",
                 * the user SHOULD acknowledge receipt of that subscription
                 * state notification by sending a presence stanza of type
                 * "subscribe" to the contact
                 */
                _converse.connection.send($pres({
                    'type': 'subscribe',
                    'to': this.get('jid')
                }));
            },

            ackUnsubscribe: function () {
                /* Upon receiving the presence stanza of type "unsubscribed",
                 * the user SHOULD acknowledge receipt of that subscription state
                 * notification by sending a presence stanza of type "unsubscribe"
                 * this step lets the user's server know that it MUST no longer
                 * send notification of the subscription state change to the user.
                 *  Parameters:
                 *    (String) jid - The Jabber ID of the user who is unsubscribing
                 */
                _converse.connection.send($pres({'type': 'unsubscribe', 'to': this.get('jid')}));
                this.destroy(); // Will cause removeFromRoster to be called.
            },

            unauthorize: function (message) {
                /* Unauthorize this contact's presence subscription
                 * Parameters:
                 *   (String) message - Optional message to send to the person being unauthorized
                 */
                _converse.rejectPresenceSubscription(this.get('jid'), message);
                return this;
            },

            authorize: function (message) {
                /* Authorize presence subscription
                 * Parameters:
                 *   (String) message - Optional message to send to the person being authorized
                 */
                var pres = $pres({to: this.get('jid'), type: "subscribed"});
                if (message && message !== "") {
                    pres.c("status").t(message);
                }
                _converse.connection.send(pres);
                return this;
            },

            addResource: function (presence) {
                /* Adds a new resource and it's associated attributes as taken
                 * from the passed in presence stanza.
                 *
                 * Also updates the contact's chat_status if the presence has
                 * higher priority (and is newer).
                 */
                var jid = presence.getAttribute('from'),
                    chat_status = _.propertyOf(presence.querySelector('show'))('textContent') || 'online',
                    resource = Strophe.getResourceFromJid(jid),
                    priority = _.propertyOf(presence.querySelector('priority'))('textContent') || 0,
                    delay = presence.querySelector('delay[xmlns="'+Strophe.NS.DELAY+'"]'),
                    timestamp = _.isNull(delay) ? moment().format() : moment(delay.getAttribute('stamp')).format();

                priority = _.isNaN(parseInt(priority, 10)) ? 0 : parseInt(priority, 10);

                var resources = _.isObject(this.get('resources')) ? this.get('resources') : {};
                resources[resource] = {
                    'priority': priority,
                    'status': chat_status,
                    'timestamp': timestamp
                };
                var changed = {'resources': resources};
                var hpr = this.getHighestPriorityResource();
                if (priority == hpr.priority && timestamp == hpr.timestamp) {
                    // Only set the chat status if this is the newest resource
                    // with the highest priority
                    changed.chat_status = chat_status;
                }
                this.save(changed);
                return resources;
            },

            removeResource: function (resource) {
                /* Remove the passed in resource from the contact's resources map.
                 *
                 * Also recomputes the chat_status given that there's one less
                 * resource.
                 */
                var resources = this.get('resources');
                if (!_.isObject(resources)) {
                    resources = {};
                } else {
                    delete resources[resource];
                }
                this.save({
                    'resources': resources,
                    'chat_status': _.propertyOf(
                        this.getHighestPriorityResource())('status') || 'offline'
                });
            },

            getHighestPriorityResource: function () {
                /* Return the resource with the highest priority.
                 *
                 * If multiple resources have the same priority, take the
                 * newest one.
                 */
                var resources = this.get('resources');
                if (_.isObject(resources) && _.size(resources)) {
                    var val = _.flow(
                            _.values,
                            _.partial(_.sortBy, _, ['priority', 'timestamp']),
                            _.reverse
                        )(resources)[0];
                    if (!_.isUndefined(val)) {
                        return val;
                    }
                }
            },

            removeFromRoster: function (callback) {
                /* Instruct the XMPP server to remove this contact from our roster
                 * Parameters:
                 *   (Function) callback
                 */
                var iq = $iq({type: 'set'})
                    .c('query', {xmlns: Strophe.NS.ROSTER})
                    .c('item', {jid: this.get('jid'), subscription: "remove"});
                _converse.connection.sendIQ(iq, callback, callback);
                return this;
            }
        });


        this.RosterContacts = Backbone.Collection.extend({
            model: _converse.RosterContact,

            comparator: function (contact1, contact2) {
                var name1, name2;
                var status1 = contact1.get('chat_status') || 'offline';
                var status2 = contact2.get('chat_status') || 'offline';
                if (_converse.STATUS_WEIGHTS[status1] === _converse.STATUS_WEIGHTS[status2]) {
                    name1 = contact1.get('fullname').toLowerCase();
                    name2 = contact2.get('fullname').toLowerCase();
                    return name1 < name2 ? -1 : (name1 > name2? 1 : 0);
                } else  {
                    return _converse.STATUS_WEIGHTS[status1] < _converse.STATUS_WEIGHTS[status2] ? -1 : 1;
                }
            },

            fetchRosterContacts: function () {
                /* Fetches the roster contacts, first by trying the
                 * sessionStorage cache, and if that's empty, then by querying
                 * the XMPP server.
                 *
                 * Returns a promise which resolves once the contacts have been
                 * fetched.
                 */
                var deferred = new $.Deferred();
                this.fetch({
                    add: true,
                    success: function (collection) {
                        if (collection.length === 0) {
                            /* We don't have any roster contacts stored in sessionStorage,
                             * so lets fetch the roster from the XMPP server. We pass in
                             * 'sendPresence' as callback method, because after initially
                             * fetching the roster we are ready to receive presence
                             * updates from our contacts.
                             */
                            _converse.send_initial_presence = true;
                            _converse.roster.fetchFromServer(deferred.resolve);
                        } else {
                            _converse.emit('cachedRoster', collection);
                            deferred.resolve();
                        }
                    }
                });
                return deferred.promise();
            },

            subscribeToSuggestedItems: function (msg) {
                _.each(msg.querySelectorAll('item'), function (item) {
                    if (item.getAttribute('action') === 'add') {
                        _converse.roster.addAndSubscribe(
                            item.getAttribute('jid'),
                            null,
                            _converse.xmppstatus.get('fullname')
                        );
                    }
                });
                return true;
            },

            isSelf: function (jid) {
                return (Strophe.getBareJidFromJid(jid) === Strophe.getBareJidFromJid(_converse.connection.jid));
            },

            addAndSubscribe: function (jid, name, groups, message, attributes) {
                /* Add a roster contact and then once we have confirmation from
                 * the XMPP server we subscribe to that contact's presence updates.
                 *  Parameters:
                 *    (String) jid - The Jabber ID of the user being added and subscribed to.
                 *    (String) name - The name of that user
                 *    (Array of Strings) groups - Any roster groups the user might belong to
                 *    (String) message - An optional message to explain the
                 *      reason for the subscription request.
                 *    (Object) attributes - Any additional attributes to be stored on the user's model.
                 */
                this.addContact(jid, name, groups, attributes).done(function (contact) {
                    if (contact instanceof _converse.RosterContact) {
                        contact.subscribe(message);
                    }
                });
            },

            sendContactAddIQ: function (jid, name, groups, callback, errback) {
                /*  Send an IQ stanza to the XMPP server to add a new roster contact.
                 *
                 *  Parameters:
                 *    (String) jid - The Jabber ID of the user being added
                 *    (String) name - The name of that user
                 *    (Array of Strings) groups - Any roster groups the user might belong to
                 *    (Function) callback - A function to call once the IQ is returned
                 *    (Function) errback - A function to call if an error occured
                 */
                name = _.isEmpty(name)? jid: name;
                var iq = $iq({type: 'set'})
                    .c('query', {xmlns: Strophe.NS.ROSTER})
                    .c('item', { jid: jid, name: name });
                _.each(groups, function (group) { iq.c('group').t(group).up(); });
                _converse.connection.sendIQ(iq, callback, errback);
            },

            addContact: function (jid, name, groups, attributes) {
                /* Adds a RosterContact instance to _converse.roster and
                 * registers the contact on the XMPP server.
                 * Returns a promise which is resolved once the XMPP server has
                 * responded.
                 *
                 *  Parameters:
                 *    (String) jid - The Jabber ID of the user being added and subscribed to.
                 *    (String) name - The name of that user
                 *    (Array of Strings) groups - Any roster groups the user might belong to
                 *    (Object) attributes - Any additional attributes to be stored on the user's model.
                 */
                var deferred = new $.Deferred();
                groups = groups || [];
                name = _.isEmpty(name)? jid: name;
                this.sendContactAddIQ(jid, name, groups,
                    function () {
                        var contact = this.create(_.assignIn({
                            ask: undefined,
                            fullname: name,
                            groups: groups,
                            jid: jid,
                            requesting: false,
                            subscription: 'none'
                        }, attributes), {sort: false});
                        deferred.resolve(contact);
                    }.bind(this),
                    function (err) {
                        alert(__("Sorry, there was an error while trying to add "+name+" as a contact."));
                        _converse.log(err);
                        deferred.resolve(err);
                    }
                );
                return deferred.promise();
            },

            subscribeBack: function (bare_jid) {
                var contact = this.get(bare_jid);
                if (contact instanceof _converse.RosterContact) {
                    contact.authorize().subscribe();
                } else {
                    // Can happen when a subscription is retried or roster was deleted
                    this.addContact(bare_jid, '', [], { 'subscription': 'from' }).done(function (contact) {
                        if (contact instanceof _converse.RosterContact) {
                            contact.authorize().subscribe();
                        }
                    });
                }
            },

            getNumOnlineContacts: function () {
                var count = 0,
                    ignored = ['offline', 'unavailable'],
                    models = this.models,
                    models_length = models.length,
                    i;
                if (_converse.show_only_online_users) {
                    ignored = _.union(ignored, ['dnd', 'xa', 'away']);
                }
                for (i=0; i<models_length; i++) {
                    if (!_.includes(ignored, models[i].get('chat_status'))) {
                        count++;
                    }
                }
                return count;
            },

            onRosterPush: function (iq) {
                /* Handle roster updates from the XMPP server.
                 * See: https://xmpp.org/rfcs/rfc6121.html#roster-syntax-actions-push
                 *
                 * Parameters:
                 *    (XMLElement) IQ - The IQ stanza received from the XMPP server.
                 */
                var id = iq.getAttribute('id');
                var from = iq.getAttribute('from');
                if (from && from !== "" && Strophe.getBareJidFromJid(from) !== _converse.bare_jid) {
                    // Receiving client MUST ignore stanza unless it has no from or from = user's bare JID.
                    // XXX: Some naughty servers apparently send from a full
                    // JID so we need to explicitly compare bare jids here.
                    // https://github.com/jcbrand/converse.js/issues/493
                    _converse.connection.send(
                        $iq({type: 'error', id: id, from: _converse.connection.jid})
                            .c('error', {'type': 'cancel'})
                            .c('service-unavailable', {'xmlns': Strophe.NS.ROSTER })
                    );
                    return true;
                }
                _converse.connection.send($iq({type: 'result', id: id, from: _converse.connection.jid}));
                // var items = iq.querySelectorAll('query[xmlns="'+Strophe.NS.ROSTER+'"] item');
                var items = sizzle('query[xmlns="'+Strophe.NS.ROSTER+'"] item', iq);
                _.each(items, this.updateContact.bind(this));
                _converse.emit('rosterPush', iq);
                return true;
            },

            fetchFromServer: function (callback) {
                /* Get the roster from the XMPP server */
                var iq = $iq({type: 'get', 'id': _converse.connection.getUniqueId('roster')})
                        .c('query', {xmlns: Strophe.NS.ROSTER});
                return _converse.connection.sendIQ(iq, function () {
                        this.onReceivedFromServer.apply(this, arguments);
                        callback.apply(this, arguments);
                    }.bind(this));
            },

            onReceivedFromServer: function (iq) {
                /* An IQ stanza containing the roster has been received from
                 * the XMPP server.
                 */
                // var items = iq.querySelectorAll('query[xmlns="'+Strophe.NS.ROSTER+'"] item');
                var items = sizzle('query[xmlns="'+Strophe.NS.ROSTER+'"] item', iq);
                _.each(items, this.updateContact.bind(this));
                _converse.emit('roster', iq);
            },

            updateContact: function (item) {
                /* Update or create RosterContact models based on items
                 * received in the IQ from the server.
                 */
                var jid = item.getAttribute('jid');
                if (this.isSelf(jid)) { return; }
                var groups = _.map(item.getElementsByTagName('group'), Strophe.getText),
                    contact = this.get(jid),
                    ask = item.getAttribute("ask"),
                    subscription = item.getAttribute("subscription");
                if (!contact) {
                    if ((subscription === "none" && ask === null) || (subscription === "remove")) {
                        return; // We're lazy when adding contacts.
                    }
                    this.create({
                        ask: ask,
                        fullname: item.getAttribute("name") || jid,
                        groups: groups,
                        jid: jid,
                        subscription: subscription
                    }, {sort: false});
                } else {
                    if (subscription === "remove") {
                        return contact.destroy(); // will trigger removeFromRoster
                    }
                    // We only find out about requesting contacts via the
                    // presence handler, so if we receive a contact
                    // here, we know they aren't requesting anymore.
                    // see docs/DEVELOPER.rst
                    contact.save({
                        subscription: subscription,
                        ask: ask,
                        requesting: null,
                        groups: groups
                    });
                }
            },

            createRequestingContact: function (presence) {
                /* Creates a Requesting Contact.
                 *
                 * Note: this method gets completely overridden by converse-vcard.js
                 */
                var bare_jid = Strophe.getBareJidFromJid(presence.getAttribute('from'));
                var nick_el = presence.querySelector('nick[xmlns="'+Strophe.NS.NICK+'"]');
                var user_data = {
                    jid: bare_jid,
                    subscription: 'none',
                    ask: null,
                    requesting: true,
                    fullname: nick_el && nick_el.textContent || bare_jid,
                };
                this.create(user_data);
                _converse.emit('contactRequest', user_data);
            },

            handleIncomingSubscription: function (presence) {
                var jid = presence.getAttribute('from');
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var contact = this.get(bare_jid);
                if (!_converse.allow_contact_requests) {
                    _converse.rejectPresenceSubscription(
                        jid,
                        __("This client does not allow presence subscriptions")
                    );
                }
                if (_converse.auto_subscribe) {
                    if ((!contact) || (contact.get('subscription') !== 'to')) {
                        this.subscribeBack(bare_jid);
                    } else {
                        contact.authorize();
                    }
                } else {
                    if (contact) {
                        if (contact.get('subscription') !== 'none')  {
                            contact.authorize();
                        } else if (contact.get('ask') === "subscribe") {
                            contact.authorize();
                        }
                    } else if (!contact) {
                        this.createRequestingContact(presence);
                    }
                }
            },

            presenceHandler: function (presence) {
                var presence_type = presence.getAttribute('type');
                if (presence_type === 'error') { return true; }
                var jid = presence.getAttribute('from'),
                    bare_jid = Strophe.getBareJidFromJid(jid),
                    resource = Strophe.getResourceFromJid(jid),
                    chat_status = _.propertyOf(presence.querySelector('show'))('textContent') || 'online',
                    status_message = _.propertyOf(presence.querySelector('status'))('textContent'),
                    contact = this.get(bare_jid);

                if (this.isSelf(bare_jid)) {
                    if ((_converse.connection.jid !== jid) &&
                        (presence_type !== 'unavailable') &&
                        (_converse.synchronize_availability === true ||
                         _converse.synchronize_availability === resource)) {
                        // Another resource has changed its status and
                        // synchronize_availability option set to update,
                        // we'll update ours as well.
                        _converse.xmppstatus.save({'status': chat_status});
                        if (status_message) {
                            _converse.xmppstatus.save({'status_message': status_message});
                        }
                    }
                    return;
                } else if (sizzle('query[xmlns="'+Strophe.NS.MUC+'"]', presence).length) {
                    return; // Ignore MUC
                }
                if (contact && (status_message !== contact.get('status'))) {
                    contact.save({'status': status_message});
                }
                if (presence_type === 'subscribed' && contact) {
                    contact.ackSubscribe();
                } else if (presence_type === 'unsubscribed' && contact) {
                    contact.ackUnsubscribe();
                } else if (presence_type === 'unsubscribe') {
                    return;
                } else if (presence_type === 'subscribe') {
                    this.handleIncomingSubscription(presence);
                } else if (presence_type === 'unavailable' && contact) {
                    contact.removeResource(resource);
                } else if (contact) {
                    // presence_type is undefined
                    contact.addResource(presence);
                }
            }
        });


        this.RosterGroup = Backbone.Model.extend({
            initialize: function (attributes) {
                this.set(_.assignIn({
                    description: DESC_GROUP_TOGGLE,
                    state: _converse.OPENED
                }, attributes));
                // Collection of contacts belonging to this group.
                this.contacts = new _converse.RosterContacts();
            }
        });


        this.RosterGroups = Backbone.Collection.extend({
            model: _converse.RosterGroup,

            fetchRosterGroups: function () {
                /* Fetches all the roster groups from sessionStorage.
                 *
                 * Returns a promise which resolves once the groups have been
                 * returned.
                 */
                var deferred = new $.Deferred();
                this.fetch({
                    silent: true, // We need to first have all groups before
                                  // we can start positioning them, so we set
                                  // 'silent' to true.
                    success: deferred.resolve
                });
                return deferred.promise();
            }
        });


        this.Message = Backbone.Model.extend({
            defaults: function(){
                return {
                    msgid: _converse.connection.getUniqueId()
                };
            }
        });


        this.Messages = Backbone.Collection.extend({
            model: _converse.Message,
            comparator: 'time'
        });


        this.ChatBox = Backbone.Model.extend({

            initialize: function () {
                this.messages = new _converse.Messages();
                this.messages.browserStorage = new Backbone.BrowserStorage[_converse.message_storage](
                    b64_sha1('converse.messages'+this.get('jid')+_converse.bare_jid));
                this.save({
                    // The chat_state will be set to ACTIVE once the chat box is opened
                    // and we listen for change:chat_state, so shouldn't set it to ACTIVE here.
                    'box_id' : b64_sha1(this.get('jid')),
                    'chat_state': undefined,
                    'num_unread': this.get('num_unread') || 0,
                    'time_opened': this.get('time_opened') || moment().valueOf(),
                    'url': '',
                    'user_id' : Strophe.getNodeFromJid(this.get('jid'))
                });
            },

            getMessageAttributes: function (message, delay, original_stanza) {
                delay = delay || message.querySelector('delay');
                var type = message.getAttribute('type'),
                    body, stamp, time, sender, from, fullname;

                if (type === 'error') {
                    body = _.propertyOf(message.querySelector('error text'))('textContent');
                } else {
                    body = _.propertyOf(message.querySelector('body'))('textContent');
                }
                var delayed = !_.isNull(delay),
                    is_groupchat = type === 'groupchat',
                    chat_state = message.getElementsByTagName(_converse.COMPOSING).length && _converse.COMPOSING ||
                        message.getElementsByTagName(_converse.PAUSED).length && _converse.PAUSED ||
                        message.getElementsByTagName(_converse.INACTIVE).length && _converse.INACTIVE ||
                        message.getElementsByTagName(_converse.ACTIVE).length && _converse.ACTIVE ||
                        message.getElementsByTagName(_converse.GONE).length && _converse.GONE;

                if (is_groupchat) {
                    from = Strophe.unescapeNode(Strophe.getResourceFromJid(message.getAttribute('from')));
                } else {
                    from = Strophe.getBareJidFromJid(message.getAttribute('from'));
                }
                if (delayed) {
                    stamp = delay.getAttribute('stamp');
                    time = stamp;
                } else {
                    time = moment().format();
                }
                if ((is_groupchat && from === this.get('nick')) || (!is_groupchat && from === _converse.bare_jid)) {
                    sender = 'me';
                    fullname = _converse.xmppstatus.get('fullname') || from;
                } else {
                    sender = 'them';
                    fullname = this.get('fullname') || from;
                }
                return {
                    'type': type,
                    'chat_state': chat_state,
                    'delayed': delayed,
                    'fullname': fullname,
                    'message': body || undefined,
                    'msgid': message.getAttribute('id'),
                    'sender': sender,
                    'time': time
                };
            },

            createMessage: function (message, delay, original_stanza) {
                return this.messages.create(this.getMessageAttributes.apply(this, arguments));
            }
        });

        this.ChatBoxes = Backbone.Collection.extend({
            model: _converse.ChatBox,
            comparator: 'time_opened',

            registerMessageHandler: function () {
                _converse.connection.addHandler(this.onMessage.bind(this), null, 'message', 'chat');
                _converse.connection.addHandler(this.onErrorMessage.bind(this), null, 'message', 'error');
            },

            chatBoxMayBeShown: function (chatbox) {
                return true;
            },

            onChatBoxesFetched: function (collection) {
                /* Show chat boxes upon receiving them from sessionStorage
                 *
                 * This method gets overridden entirely in src/converse-controlbox.js
                 * if the controlbox plugin is active.
                 */
                var that = this;
                collection.each(function (chatbox) {
                    if (that.chatBoxMayBeShown(chatbox)) {
                        chatbox.trigger('show');
                    }
                });
                _converse.emit('chatBoxesFetched');
            },

            onConnected: function () {
                this.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                    b64_sha1('converse.chatboxes-'+_converse.bare_jid));
                this.registerMessageHandler();
                this.fetch({
                    add: true,
                    success: this.onChatBoxesFetched.bind(this)
                });
            },

            onErrorMessage: function (message) {
                /* Handler method for all incoming error message stanzas
                 */
                // TODO: we can likely just reuse "onMessage" below
                var from_jid =  Strophe.getBareJidFromJid(message.getAttribute('from'));
                if (from_jid === _converse.bare_jid) {
                    return true;
                }
                // Get chat box, but only create a new one when the message has a body.
                var chatbox = this.getChatBox(from_jid);
                if (!chatbox) {
                    return true;
                }
                chatbox.createMessage(message, null, message);
                return true;
            },

            onMessage: function (message) {
                /* Handler method for all incoming single-user chat "message"
                 * stanzas.
                 */
                var original_stanza = message,
                    contact_jid, forwarded, delay, from_bare_jid,
                    from_resource, is_me, msgid,
                    chatbox, resource,
                    from_jid = message.getAttribute('from'),
                    to_jid = message.getAttribute('to'),
                    to_resource = Strophe.getResourceFromJid(to_jid),
                    is_carbon = !_.isNull(message.querySelector('received[xmlns="'+Strophe.NS.CARBONS+'"]'));

                if (_converse.filter_by_resource && (to_resource && to_resource !== _converse.resource)) {
                    _converse.log(
                        'onMessage: Ignoring incoming message intended for a different resource: '+to_jid,
                        'info'
                    );
                    return true;
                } else if (utils.isHeadlineMessage(message)) {
                    // XXX: Ideally we wouldn't have to check for headline
                    // messages, but Prosody sends headline messages with the
                    // wrong type ('chat'), so we need to filter them out here.
                    _converse.log(
                        "onMessage: Ignoring incoming headline message sent with type 'chat' from JID: "+from_jid,
                        'info'
                    );
                    return true;
                }
                forwarded = message.querySelector('forwarded');
                if (!_.isNull(forwarded)) {
                    var forwarded_message = forwarded.querySelector('message');
                    var forwarded_from = forwarded_message.getAttribute('from');
                    if (is_carbon && Strophe.getBareJidFromJid(forwarded_from) !== from_jid) {
                        // Prevent message forging via carbons
                        //
                        // https://xmpp.org/extensions/xep-0280.html#security
                        return true;
                    }
                    message = forwarded_message;
                    delay = forwarded.querySelector('delay');
                    from_jid = message.getAttribute('from');
                    to_jid = message.getAttribute('to');
                }
                from_bare_jid = Strophe.getBareJidFromJid(from_jid);
                from_resource = Strophe.getResourceFromJid(from_jid);
                is_me = from_bare_jid === _converse.bare_jid;
                msgid = message.getAttribute('id');
                if (is_me) {
                    // I am the sender, so this must be a forwarded message...
                    contact_jid = Strophe.getBareJidFromJid(to_jid);
                    resource = Strophe.getResourceFromJid(to_jid);
                } else {
                    contact_jid = from_bare_jid;
                    resource = from_resource;
                }
                _converse.emit('message', original_stanza);
                // Get chat box, but only create a new one when the message has a body.
                chatbox = this.getChatBox(contact_jid, !_.isNull(message.querySelector('body')));
                if (!chatbox) {
                    return true;
                }
                if (msgid && chatbox.messages.findWhere({msgid: msgid})) {
                    return true; // We already have this message stored.
                }
                chatbox.createMessage(message, delay, original_stanza);
                return true;
            },

            getChatBox: function (jid, create, attrs) {
                /* Returns a chat box or optionally return a newly
                 * created one if one doesn't exist.
                 *
                 * Parameters:
                 *    (String) jid - The JID of the user whose chat box we want
                 *    (Boolean) create - Should a new chat box be created if none exists?
                 *    (Object) attrs - Optional chat box atributes.
                 */
                jid = jid.toLowerCase();
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var chatbox = this.get(bare_jid);
                if (!chatbox && create) {
                    var roster_info = {};
                    var roster_item = _converse.roster.get(bare_jid);
                    if (! _.isUndefined(roster_item)) {
                        roster_info = {
                            'fullname': _.isEmpty(roster_item.get('fullname'))? jid: roster_item.get('fullname'),
                            'image_type': roster_item.get('image_type'),
                            'image': roster_item.get('image'),
                            'url': roster_item.get('url'),
                        };
                    } else if (!_converse.allow_non_roster_messaging) {
                        _converse.log('Could not get roster item for JID '+bare_jid+
                                    ' and allow_non_roster_messaging is set to false', 'error');
                        return;
                    }
                    chatbox = this.create(_.assignIn({
                        'id': bare_jid,
                        'jid': bare_jid,
                        'fullname': jid,
                        'image_type': DEFAULT_IMAGE_TYPE,
                        'image': DEFAULT_IMAGE,
                        'url': '',
                    }, roster_info, attrs || {}));
                }
                return chatbox;
            }
        });

        this.ChatBoxViews = Backbone.Overview.extend({

            initialize: function () {
                this.model.on("add", this.onChatBoxAdded, this);
                this.model.on("destroy", this.removeChat, this);
            },

            _ensureElement: function () {
                /* Override method from backbone.js
                 * If the #conversejs element doesn't exist, create it.
                 */
                if (!this.el) {
                    var $el = $('#conversejs');
                    if (!$el.length) {
                        $el = $('<div id="conversejs">');
                        $('body').append($el);
                    }
                    $el.html('');
                    this.setElement($el, false);
                } else {
                    this.setElement(_.result(this, 'el'), false);
                }
            },

            onChatBoxAdded: function (item) {
                // Views aren't created here, since the core code doesn't
                // contain any views. Instead, they're created in overrides in
                // plugins, such as in converse-chatview.js and converse-muc.js
                return this.get(item.get('id'));
            },

            removeChat: function (item) {
                this.remove(item.get('id'));
            },

            closeAllChatBoxes: function () {
                /* This method gets overridden in src/converse-controlbox.js if
                 * the controlbox plugin is active.
                 */
                this.each(function (view) { view.close(); });
                return this;
            },

            chatBoxMayBeShown: function (chatbox) {
                return this.model.chatBoxMayBeShown(chatbox);
            },

            getChatBox: function (attrs, create) {
                var chatbox  = this.model.get(attrs.jid);
                if (!chatbox && create) {
                    chatbox = this.model.create(attrs, {
                        'error': function (model, response) {
                            _converse.log(response.responseText);
                        }
                    });
                }
                return chatbox;
            },

            showChat: function (attrs) {
                /* Find the chat box and show it (if it may be shown).
                 * If it doesn't exist, create it.
                 */
                var chatbox = this.getChatBox(attrs, true);
                if (this.chatBoxMayBeShown(chatbox)) {
                    chatbox.trigger('show', true);
                }
                return chatbox;
            }
        });


        this.XMPPStatus = Backbone.Model.extend({
            initialize: function () {
                this.set({
                    'status' : this.getStatus()
                });
                this.on('change', function (item) {
                    if (_.has(item.changed, 'status')) {
                        _converse.emit('statusChanged', this.get('status'));
                    }
                    if (_.has(item.changed, 'status_message')) {
                        _converse.emit('statusMessageChanged', this.get('status_message'));
                    }
                }.bind(this));
            },

            constructPresence: function (type, status_message) {
                var presence;
                type = _.isString(type) ? type : (this.get('status') || _converse.default_state);
                status_message = _.isString(status_message) ? status_message : undefined;
                // Most of these presence types are actually not explicitly sent,
                // but I add all of them here for reference and future proofing.
                if ((type === 'unavailable') ||
                        (type === 'probe') ||
                        (type === 'error') ||
                        (type === 'unsubscribe') ||
                        (type === 'unsubscribed') ||
                        (type === 'subscribe') ||
                        (type === 'subscribed')) {
                    presence = $pres({'type': type});
                } else if (type === 'offline') {
                    presence = $pres({'type': 'unavailable'});
                } else if (type === 'online') {
                    presence = $pres();
                } else {
                    presence = $pres().c('show').t(type).up();
                }
                if (status_message) {
                    presence.c('status').t(status_message).up();
                }
                presence.c('priority').t(
                    _.isNaN(Number(_converse.priority)) ? 0 : _converse.priority
                );
                return presence;
            },

            sendPresence: function (type, status_message) {
                _converse.connection.send(this.constructPresence(type, status_message));
            },

            setStatus: function (value) {
                this.sendPresence(value);
                this.save({'status': value});
            },

            getStatus: function () {
                return this.get('status') || _converse.default_state;
            },

            setStatusMessage: function (status_message) {
                this.sendPresence(this.getStatus(), status_message);
                var prev_status = this.get('status_message');
                this.save({'status_message': status_message});
                if (this.xhr_custom_status) {
                    $.ajax({
                        url:  this.xhr_custom_status_url,
                        type: 'POST',
                        data: {'msg': status_message}
                    });
                }
                if (prev_status === status_message) {
                    this.trigger("update-status-ui", this);
                }
            }
        });

        this.Session = Backbone.Model; // General session settings to be saved to sessionStorage.
        this.Feature = Backbone.Model;
        this.Features = Backbone.Collection.extend({
            /* Service Discovery
             * -----------------
             * This collection stores Feature Models, representing features
             * provided by available XMPP entities (e.g. servers)
             * See XEP-0030 for more details: http://xmpp.org/extensions/xep-0030.html
             * All features are shown here: http://xmpp.org/registrar/disco-features.html
             */
            model: _converse.Feature,
            initialize: function () {
                this.addClientIdentities().addClientFeatures();
                this.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                    b64_sha1('converse.features'+_converse.bare_jid)
                );
                this.on('add', this.onFeatureAdded, this);
                if (this.browserStorage.records.length === 0) {
                    // browserStorage is empty, so we've likely never queried this
                    // domain for features yet
                    _converse.connection.disco.info(_converse.domain, null, this.onInfo.bind(this));
                    _converse.connection.disco.items(_converse.domain, null, this.onItems.bind(this));
                } else {
                    this.fetch({add:true});
                }
            },

            onFeatureAdded: function (feature) {
                _converse.emit('serviceDiscovered', feature);
            },

            addClientIdentities: function () {
                /* See http://xmpp.org/registrar/disco-categories.html
                 */
                 _converse.connection.disco.addIdentity('client', 'web', 'Converse.js');
                 return this;
            },

            addClientFeatures: function () {
                /* The strophe.disco.js plugin keeps a list of features which
                 * it will advertise to any #info queries made to it.
                 *
                 * See: http://xmpp.org/extensions/xep-0030.html#info
                 */
                _converse.connection.disco.addFeature(Strophe.NS.BOSH);
                _converse.connection.disco.addFeature(Strophe.NS.CHATSTATES);
                _converse.connection.disco.addFeature(Strophe.NS.DISCO_INFO);
                _converse.connection.disco.addFeature(Strophe.NS.ROSTERX); // Limited support
                if (_converse.message_carbons) {
                    _converse.connection.disco.addFeature(Strophe.NS.CARBONS);
                }
                return this;
            },

            onItems: function (stanza) {
                var that = this;
                _.each(stanza.querySelectorAll('query item'), function (item) {
                    _converse.connection.disco.info(
                        item.getAttribute('jid'),
                        null,
                        that.onInfo.bind(that));
                });
            },

            onInfo: function (stanza) {
                var $stanza = $(stanza);
                if (($stanza.find('identity[category=server][type=im]').length === 0) &&
                    ($stanza.find('identity[category=conference][type=text]').length === 0)) {
                    // This isn't an IM server component
                    return;
                }
                $stanza.find('feature').each(function (idx, feature) {
                    var namespace = feature.getAttribute('var');
                    this[namespace] = true;
                    this.create({
                        'var': namespace,
                        'from': stanza.getAttribute('from')
                    });
                }.bind(this));
            }
        });

        this.setUpXMLLogging = function () {
            Strophe.log = function (level, msg) {
                _converse.log(msg, level);
            };
            if (this.debug) {
                this.connection.xmlInput = function (body) { _converse.log(body.outerHTML); };
                this.connection.xmlOutput = function (body) { _converse.log(body.outerHTML); };
            }
        };

        this.fetchLoginCredentials = function () {
            var deferred = new $.Deferred();
            $.ajax({
                url:  _converse.credentials_url,
                type: 'GET',
                dataType: "json",
                success: function (response) {
                    deferred.resolve({
                        'jid': response.jid,
                        'password': response.password
                    });
                },
                error: function (response) {
                    delete _converse.connection;
                    _converse.emit('noResumeableSession');
                    deferred.reject(response);
                }
            });
            return deferred.promise();
        };

        this.startNewBOSHSession = function () {
            var that = this;
            $.ajax({
                url:  this.prebind_url,
                type: 'GET',
                dataType: "json",
                success: function (response) {
                    that.connection.attach(
                            response.jid,
                            response.sid,
                            response.rid,
                            that.onConnectStatusChanged
                    );
                },
                error: function (response) {
                    delete that.connection;
                    that.emit('noResumeableSession');
                }
            });
        };

        this.attemptPreboundSession = function (reconnecting) {
            /* Handle session resumption or initialization when prebind is being used.
             */
            if (!reconnecting && this.keepalive) {
                if (!this.jid) {
                    throw new Error("attemptPreboundSession: when using 'keepalive' with 'prebind, "+
                                    "you must supply the JID of the current user.");
                }
                try {
                    return this.connection.restore(this.jid, this.onConnectStatusChanged);
                } catch (e) {
                    this.log("Could not restore session for jid: "+this.jid+" Error message: "+e.message);
                    this.clearSession(); // If there's a roster, we want to clear it (see #555)
                }
            }

            // No keepalive, or session resumption has failed.
            if (!reconnecting && this.jid && this.sid && this.rid) {
                return this.connection.attach(this.jid, this.sid, this.rid, this.onConnectStatusChanged);
            } else if (this.prebind_url) {
                return this.startNewBOSHSession();
            } else {
                throw new Error("attemptPreboundSession: If you use prebind and not keepalive, "+
                    "then you MUST supply JID, RID and SID values or a prebind_url.");
            }
        };

        this.autoLogin = function (credentials) {
            if (credentials) {
                // If passed in, then they come from credentials_url, so we
                // set them on the _converse object.
                this.jid = credentials.jid;
                this.password = credentials.password;
            }
            if (this.authentication === _converse.ANONYMOUS) {
                if (!this.jid) {
                    throw new Error("Config Error: when using anonymous login " +
                        "you need to provide the server's domain via the 'jid' option. " +
                        "Either when calling converse.initialize, or when calling " +
                        "_converse.api.user.login.");
                }
                this.connection.reset();
                this.connection.connect(this.jid.toLowerCase(), null, this.onConnectStatusChanged);
            } else if (this.authentication === _converse.LOGIN) {
                var password = _converse.connection.pass || this.password;
                if (!password) {
                    if (this.auto_login && !this.password) {
                        throw new Error("initConnection: If you use auto_login and "+
                            "authentication='login' then you also need to provide a password.");
                    }
                    _converse.setDisconnectionCause(Strophe.Status.AUTHFAIL, undefined, true);
                    _converse.disconnect();
                    return;
                }
                var resource = Strophe.getResourceFromJid(this.jid);
                if (!resource) {
                    this.jid = this.jid.toLowerCase() + _converse.generateResource();
                } else {
                    this.jid = Strophe.getBareJidFromJid(this.jid).toLowerCase()+'/'+resource;
                }
                this.connection.reset();
                this.connection.connect(this.jid, password, this.onConnectStatusChanged);
            }
        };

        this.attemptNonPreboundSession = function (credentials, reconnecting) {
            /* Handle session resumption or initialization when prebind is not being used.
             *
             * Two potential options exist and are handled in this method:
             *  1. keepalive
             *  2. auto_login
             */
            if (this.keepalive && !reconnecting) {
                try {
                    return this.connection.restore(this.jid, this.onConnectStatusChanged);
                } catch (e) {
                    this.log("Could not restore session. Error message: "+e.message);
                    this.clearSession(); // If there's a roster, we want to clear it (see #555)
                }
            }
            if (this.auto_login) {
                if (credentials) {
                    // When credentials are passed in, they override prebinding
                    // or credentials fetching via HTTP
                    this.autoLogin(credentials);
                } else if (this.credentials_url) {
                    this.fetchLoginCredentials().done(this.autoLogin.bind(this));
                } else if (!this.jid) {
                    throw new Error(
                        "initConnection: If you use auto_login, you also need"+
                        "to give either a jid value (and if applicable a "+
                        "password) or you need to pass in a URL from where the "+
                        "username and password can be fetched (via credentials_url)."
                    );
                } else {
                    // Probably ANONYMOUS login
                    this.autoLogin();
                }
            } else if (reconnecting) {
                this.autoLogin();
            }
        };

        this.logIn = function (credentials, reconnecting) {
            // We now try to resume or automatically set up a new session.
            // Otherwise the user will be shown a login form.
            if (this.authentication === _converse.PREBIND) {
                this.attemptPreboundSession(reconnecting);
            } else {
                this.attemptNonPreboundSession(credentials, reconnecting);
            }
        };

        this.initConnection = function () {
            if (this.connection) {
                return;
            }
            if (!this.bosh_service_url && ! this.websocket_url) {
                throw new Error("initConnection: you must supply a value for either the bosh_service_url or websocket_url or both.");
            }
            if (('WebSocket' in window || 'MozWebSocket' in window) && this.websocket_url) {
                this.connection = new Strophe.Connection(this.websocket_url, this.connection_options);
            } else if (this.bosh_service_url) {
                this.connection = new Strophe.Connection(
                    this.bosh_service_url,
                    _.assignIn(this.connection_options, {'keepalive': this.keepalive})
                );
            } else {
                throw new Error("initConnection: this browser does not support websockets and bosh_service_url wasn't specified.");
            }
        };

        this._tearDown = function () {
            /* Remove those views which are only allowed with a valid
             * connection.
             */
            this.unregisterPresenceHandler();
            if (this.roster) {
                this.roster.off().reset(); // Removes roster contacts
            }
            this.chatboxes.remove(); // Don't call off(), events won't get re-registered upon reconnect.
            delete this.chatboxes.browserStorage;
            if (this.features) {
                this.features.reset();
            }
            $(window).off('click mousemove keypress focus'+unloadevent, _converse.onUserActivity);
            window.clearInterval(_converse.everySecondTrigger);
            return this;
        };

        this.initChatBoxes = function () {
            this.chatboxes = new this.ChatBoxes();
            this.chatboxviews = new this.ChatBoxViews({model: this.chatboxes});
        };

        var updateSettings = function (settings) {
            /* Helper method which gets put on the plugin and allows it to
             * add more user-facing config settings to converse.js.
             */
            utils.merge(_converse.default_settings, settings);
            utils.merge(_converse, settings);
            utils.applyUserSettings(_converse, settings, _converse.user_settings);
        };

        this.initPlugins = function () {
            // If initialize gets called a second time (e.g. during tests), then we
            // need to re-apply all plugins (for a new converse instance), and we
            // therefore need to clear this array that prevents plugins from being
            // initialized twice.
            // If initialize is called for the first time, then this array is empty
            // in any case.
            _converse.pluggable.initialized_plugins = [];
            var whitelist = _converse.core_plugins.concat(
                _converse.whitelisted_plugins);

            _converse.pluggable.initializePlugins({
                'updateSettings': updateSettings,
                '_converse': _converse
            }, whitelist, _converse.blacklisted_plugins);
            _converse.emit('pluginsInitialized');
        };

        // Initialization
        // --------------
        // This is the end of the initialize method.
        if (settings.connection) {
            this.connection = settings.connection;
        }
        _converse.initPlugins();
        _converse.initChatBoxes();
        _converse.initSession();
        _converse.initConnection();
        _converse.setUpXMLLogging();
        _converse.logIn();
        _converse.registerGlobalEventHandlers();

        if (!_.isUndefined(_converse.connection) &&
            _converse.connection.service === 'jasmine tests') {
            return _converse;
        } else {
            return init_deferred.promise();
        }
    };

    // API methods only available to plugins
    _converse.api = {
        'connection': {
            'connected': function () {
                return _converse.connection && _converse.connection.connected || false;
            },
            'disconnect': function () {
                _converse.connection.disconnect();
            },
        },
        'user': {
            'jid': function () {
                return _converse.connection.jid;
            },
            'login': function (credentials) {
                _converse.initConnection();
                _converse.logIn(credentials);
            },
            'logout': function () {
                _converse.logOut();
            },
            'status': {
                'get': function () {
                    return _converse.xmppstatus.get('status');
                },
                'set': function (value, message) {
                    var data = {'status': value};
                    if (!_.includes(_.keys(_converse.STATUS_WEIGHTS), value)) {
                        throw new Error('Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1');
                    }
                    if (_.isString(message)) {
                        data.status_message = message;
                    }
                    _converse.xmppstatus.sendPresence(value);
                    _converse.xmppstatus.save(data);
                },
                'message': {
                    'get': function () {
                        return _converse.xmppstatus.get('status_message');
                    },
                    'set': function (stat) {
                        _converse.xmppstatus.save({'status_message': stat});
                    }
                }
            },
        },
        'settings': {
            'get': function (key) {
                if (_.includes(_.keys(_converse.default_settings), key)) {
                    return _converse[key];
                }
            },
            'set': function (key, val) {
                var o = {};
                if (_.isObject(key)) {
                    _.assignIn(_converse, _.pick(key, _.keys(_converse.default_settings)));
                } else if (_.isString("string")) {
                    o[key] = val;
                    _.assignIn(_converse, _.pick(o, _.keys(_converse.default_settings)));
                }
            }
        },
        'contacts': {
            'get': function (jids) {
                var _transform = function (jid) {
                    var contact = _converse.roster.get(Strophe.getBareJidFromJid(jid));
                    if (contact) {
                        return contact.attributes;
                    }
                    return null;
                };
                if (_.isUndefined(jids)) {
                    jids = _converse.roster.pluck('jid');
                } else if (_.isString(jids)) {
                    return _transform(jids);
                }
                return _.map(jids, _transform);
            },
            'add': function (jid, name) {
                if (!_.isString(jid) || !_.includes(jid, '@')) {
                    throw new TypeError('contacts.add: invalid jid');
                }
                _converse.roster.addAndSubscribe(jid, _.isEmpty(name)? jid: name);
            }
        },
        'chats': {
            'open': function (jids, attrs) {
                var chatbox;
                if (_.isUndefined(jids)) {
                    _converse.log("chats.open: You need to provide at least one JID", "error");
                    return null;
                } else if (_.isString(jids)) {
                    chatbox = _converse.getViewForChatBox(
                        _converse.chatboxes.getChatBox(jids, true, attrs).trigger('show')
                    );
                    return chatbox;
                }
                return _.map(jids, function (jid) {
                    chatbox = _converse.getViewForChatBox(
                        _converse.chatboxes.getChatBox(jid, true, attrs).trigger('show')
                    );
                    return chatbox;
                });
            },
            'get': function (jids) {
                if (_.isUndefined(jids)) {
                    var result = [];
                    _converse.chatboxes.each(function (chatbox) {
                        // FIXME: Leaky abstraction from MUC. We need to add a
                        // base type for chat boxes, and check for that.
                        if (chatbox.get('type') !== 'chatroom') {
                            result.push(_converse.getViewForChatBox(chatbox));
                        }
                    });
                    return result;
                } else if (_.isString(jids)) {
                    return _converse.getViewForChatBox(_converse.chatboxes.getChatBox(jids));
                }
                return _.map(jids,
                    _.partial(
                        _.flow(
                            _converse.chatboxes.getChatBox.bind(_converse.chatboxes),
                            _converse.getViewForChatBox.bind(_converse)
                        ), _, true
                    )
                );
            }
        },
        'tokens': {
            'get': function (id) {
                if (!_converse.expose_rid_and_sid || _.isUndefined(_converse.connection)) {
                    return null;
                }
                if (id.toLowerCase() === 'rid') {
                    return _converse.connection.rid || _converse.connection._proto.rid;
                } else if (id.toLowerCase() === 'sid') {
                    return _converse.connection.sid || _converse.connection._proto.sid;
                }
            }
        },
        'listen': {
            'once': _converse.once.bind(_converse),
            'on': _converse.on.bind(_converse),
            'not': _converse.off.bind(_converse),
            'stanza': function (name, options, handler) {
                if (_.isFunction(options)) {
                    handler = options;
                    options = {};
                } else {
                    options = options || {};
                }
                _converse.connection.addHandler(
                    handler,
                    options.ns,
                    name,
                    options.type,
                    options.id,
                    options.from,
                    options
                );
            },
        },
        'waitUntil': function (name) {
            var promise = _converse.promises[name];
            if (_.isUndefined(promise)) {
                return null;
            }
            return _converse.promises[name].promise();
        },
        'send': function (stanza) {
            _converse.connection.send(stanza);
        },
    };

    // The public API
    return {
        'initialize': function (settings, callback) {
            return _converse.initialize(settings, callback);
        },
        'plugins': {
            'add': function (name, plugin) {
                plugin.__name__ = name;
                if (!_.isUndefined(_converse.pluggable.plugins[name])) {
                    throw new TypeError(
                        'Error: plugin with name "'+name+'" has already been '+
                        'registered!');
                } else {
                    _converse.pluggable.plugins[name] = plugin;
                }
            }
        },
        'env': {
            '$build': $build,
            '$iq': $iq,
            '$msg': $msg,
            '$pres': $pres,
            'Strophe': Strophe,
            'b64_sha1':  b64_sha1,
            '_': _,
            'jQuery': $,
            'sizzle': sizzle,
            'moment': moment,
            'utils': utils
        }
    };
}));


define('tpl!chatbox', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<div class="flyout box-flyout">\n    <div class="dragresize dragresize-top"></div>\n    <div class="dragresize dragresize-topleft"></div>\n    <div class="dragresize dragresize-left"></div>\n    <div class="chat-head chat-head-chatbox">\n        <a class="chatbox-btn close-chatbox-button icon-close" title="' +
__e(info_close) +
'"></a>\n        <div class="chat-title">\n            ';
 if (url) { ;
__p += '\n                <a href="' +
__e(url) +
'" target="_blank" rel="noopener" class="user">\n            ';
 } ;
__p += '\n                    ' +
__e( title ) +
'\n            ';
 if (url) { ;
__p += '\n                </a>\n            ';
 } ;
__p += '\n            <p class="user-custom-message"><p/>\n        </div>\n    </div>\n    <div class="chat-body">\n        <div class="chat-content ';
 if (show_send_button) { ;
__p += 'chat-content-sendbutton';
 } ;
__p += '"></div>\n        <div class="new-msgs-indicator hidden">▼ ' +
__e( unread_msgs ) +
' ▼</div>\n        ';
 if (show_textarea) { ;
__p += '\n        <form class="sendXMPPMessage" action="" method="post">\n            ';
 if (show_toolbar) { ;
__p += '\n                <ul class="chat-toolbar no-text-select"></ul>\n            ';
 } ;
__p += '\n        <textarea\n            type="text"\n            class="chat-textarea ';
 if (show_send_button) { ;
__p += 'chat-textarea-send-button';
 } ;
__p += '"\n            placeholder="' +
__e(label_personal_message) +
'"/>\n\n        ';
 if (show_send_button) { ;
__p += '\n            <button type="button" class="pure-button send-button">Send</button>\n        ';
 } ;
__p += '\n        </form>\n        ';
 } ;
__p += '\n    </div>\n</div>\n';

}
return __p
};});


define('tpl!new_day', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<time class="chat-info chat-date" data-isodate="' +
__e(isodate) +
'">' +
__e(datestring) +
'</time>\n';

}
return __p
};});


define('tpl!action', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div class="chat-message ' +
__e(extra_classes) +
'" data-isodate="' +
__e(isodate) +
'">\n    <span class="chat-msg-author chat-msg-' +
__e(sender) +
'">' +
__e(time) +
' **' +
__e(username) +
'&nbsp;</span>\n    <span class="chat-msg-content chat-action"><!-- message gets added here via renderMessage --></span>\n</div>\n';

}
return __p
};});


define('tpl!message', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div class="chat-message ' +
__e(extra_classes) +
'" data-isodate="' +
__e(isodate) +
'" data-msgid="' +
__e(msgid) +
'">\n    <span class="chat-msg-author chat-msg-' +
__e(sender) +
'">' +
__e(time) +
' ' +
__e(username) +
':&nbsp;</span>\n    <span class="chat-msg-content"><!-- message gets added here via renderMessage --></span>\n</div>\n';

}
return __p
};});


define('tpl!toolbar', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 if (show_emoticons)  { ;
__p += '\n    <li class="toggle-smiley icon-happy" title="' +
__e(label_insert_smiley) +
'">\n        <ul>\n            <li><a class="icon-smiley" href="#" data-emoticon=":)"></a></li>\n            <li><a class="icon-wink" href="#" data-emoticon=";)"></a></li>\n            <li><a class="icon-grin" href="#" data-emoticon=":D"></a></li>\n            <li><a class="icon-tongue" href="#" data-emoticon=":P"></a></li>\n            <li><a class="icon-cool" href="#" data-emoticon="8)"></a></li>\n            <li><a class="icon-evil" href="#" data-emoticon=">:)"></a></li>\n            <li><a class="icon-confused" href="#" data-emoticon=":S"></a></li>\n            <li><a class="icon-wondering" href="#" data-emoticon=":\\"></a></li>\n            <li><a class="icon-angry" href="#" data-emoticon=">:("></a></li>\n            <li><a class="icon-sad" href="#" data-emoticon=":("></a></li>\n            <li><a class="icon-shocked" href="#" data-emoticon=":O"></a></li>\n            <li><a class="icon-thumbs-up" href="#" data-emoticon="(^.^)b"></a></li>\n            <li><a class="icon-heart" href="#" data-emoticon="<3"></a></li>\n        </ul>\n    </li>\n';
 } ;
__p += '\n';
 if (show_call_button)  { ;
__p += '\n<li class="toggle-call"><a class="icon-phone" title="' +
__e(label_start_call) +
'"></a></li>\n';
 } ;
__p += '\n';
 if (show_clear_button)  { ;
__p += '\n<li class="toggle-clear"><a class="icon-remove" title="' +
__e(label_clear) +
'"></a></li>\n';
 } ;
__p += '\n';

}
return __p
};});


define('tpl!avatar', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '';
with (obj) {
__p += '<canvas height="32px" width="32px" class="avatar"></canvas>\n';

}
return __p
};});

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

(function (root, factory) {
    define('converse-chatview',[
            "converse-core",
            "tpl!chatbox",
            "tpl!new_day",
            "tpl!action",
            "tpl!message",
            "tpl!toolbar",
            "tpl!avatar"
    ], factory);
}(this, function (
            converse,
            tpl_chatbox,
            tpl_new_day,
            tpl_action,
            tpl_message,
            tpl_toolbar,
            tpl_avatar
    ) {
    "use strict";
    var $ = converse.env.jQuery,
        utils = converse.env.utils,
        Strophe = converse.env.Strophe,
        $msg = converse.env.$msg,
        _ = converse.env._,
        moment = converse.env.moment;

    var KEY = {
        ENTER: 13,
        FORWARD_SLASH: 47
    };


    converse.plugins.add('converse-chatview', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var _converse = this.__super__._converse;
                    var view = this.get(item.get('id'));
                    if (!view) {
                        view = new _converse.ChatBoxView({model: item});
                        this.add(item.get('id'), view);
                        return view;
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse,
                __ = _converse.__;

            this.updateSettings({
                chatview_avatar_height: 32,
                chatview_avatar_width: 32,
                show_toolbar: true,
                time_format: 'HH:mm',
                visible_toolbar_buttons: {
                    'emoticons': true,
                    'call': false,
                    'clear': true
                },
            });

            _converse.ChatBoxView = Backbone.View.extend({
                length: 200,
                tagName: 'div',
                className: 'chatbox hidden',
                is_chatroom: false,  // Leaky abstraction from MUC

                events: {
                    'click .close-chatbox-button': 'close',
                    'keypress .chat-textarea': 'keyPressed',
                    'click .send-button': 'onSendButtonClicked',
                    'click .toggle-smiley': 'toggleEmoticonMenu',
                    'click .toggle-smiley ul li': 'insertEmoticon',
                    'click .toggle-clear': 'clearMessages',
                    'click .toggle-call': 'toggleCall',
                    'click .new-msgs-indicator': 'viewUnreadMessages'
                },

                initialize: function () {
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    // TODO check for changed fullname as well
                    this.model.on('change:chat_state', this.sendChatState, this);
                    this.model.on('change:chat_status', this.onChatStatusChanged, this);
                    this.model.on('change:image', this.renderAvatar, this);
                    this.model.on('change:status', this.onStatusChanged, this);
                    this.model.on('showHelpMessages', this.showHelpMessages, this);
                    this.model.on('sendMessage', this.sendMessage, this);
                    this.render().fetchMessages();
                    _converse.emit('chatBoxInitialized', this);
                },

                render: function () {
                    this.$el.attr('id', this.model.get('box_id'))
                        .html(tpl_chatbox(
                                _.extend(this.model.toJSON(), {
                                        show_toolbar: _converse.show_toolbar,
                                        show_textarea: true,
                                        show_send_button: _converse.show_send_button,
                                        title: this.model.get('fullname'),
                                        unread_msgs: __('You have unread messages'),
                                        info_close: __('Close this chat box'),
                                        label_personal_message: __('Personal message')
                                    }
                                )
                            )
                        );
                    this.$content = this.$el.find('.chat-content');
                    this.renderToolbar().renderAvatar();
                    _converse.emit('chatBoxOpened', this);
                    utils.refreshWebkit();
                    return this.showStatusMessage();
                },

                afterMessagesFetched: function () {
                    this.insertIntoDOM();
                    this.scrollDown();
                    // We only start listening for the scroll event after
                    // cached messages have been fetched
                    this.$content.on('scroll', this.markScrolled.bind(this));
                },

                fetchMessages: function () {
                    this.model.messages.fetch({
                        'add': true,
                        'success': this.afterMessagesFetched.bind(this),
                        'error': this.afterMessagesFetched.bind(this),
                    });
                    return this;
                },

                insertIntoDOM: function () {
                    /* This method gets overridden in src/converse-controlbox.js if
                     * the controlbox plugin is active.
                     */
                    var container = document.querySelector('#conversejs');
                    if (this.el.parentNode !== container) {
                        container.insertBefore(this.el, container.firstChild);
                    }
                    return this;
                },

                clearStatusNotification: function () {
                    this.$content.find('div.chat-event').remove();
                },

                showStatusNotification: function (message, keep_old, permanent) {
                    if (!keep_old) {
                        this.clearStatusNotification();
                    }
                    var $el = $('<div class="chat-info"></div>').text(message);
                    if (!permanent) {
                        $el.addClass('chat-event');
                    }
                    this.$content.append($el);
                    this.scrollDown();
                },

                addSpinner: function () {
                    if (_.isNull(this.el.querySelector('.spinner'))) {
                        this.$content.prepend('<span class="spinner"/>');
                    }
                },

                clearSpinner: function () {
                    if (this.$content.children(':first').is('span.spinner')) {
                        this.$content.children(':first').remove();
                    }
                },

                insertDayIndicator: function (date, prepend) {
                    /* Appends (or prepends if "prepend" is truthy) an indicator
                     * into the chat area, showing the day as given by the
                     * passed in date.
                     *
                     * Parameters:
                     *  (String) date - An ISO8601 date string.
                     */
                    var day_date = moment(date).startOf('day');
                    var insert = prepend ? this.$content.prepend: this.$content.append;
                    insert.call(this.$content, tpl_new_day({
                        isodate: day_date.format(),
                        datestring: day_date.format("dddd MMM Do YYYY")
                    }));
                },

                insertMessage: function (attrs, prepend) {
                    /* Helper method which appends a message (or prepends if the
                     * 2nd parameter is set to true) to the end of the chat box's
                     * content area.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message attributes.
                     */
                    var that = this;
                    var insert = prepend ? this.$content.prepend : this.$content.append;
                    _.flow(
                        function ($el) {
                            insert.call(that.$content, $el);
                            return $el;
                        },
                        this.scrollDown.bind(this)
                    )(this.renderMessage(attrs));
                },

                showMessage: function (attrs) {
                    /* Inserts a chat message into the content area of the chat box.
                     * Will also insert a new day indicator if the message is on a
                     * different day.
                     *
                     * The message to show may either be newer than the newest
                     * message, or older than the oldest message.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message
                     *      attributes.
                     */
                    var msg_dates, idx,
                        $first_msg = this.$content.find('.chat-message:first'),
                        first_msg_date = $first_msg.data('isodate'),
                        current_msg_date = moment(attrs.time) || moment,
                        last_msg_date = this.$content.find('.chat-message:last').data('isodate');

                    if (!first_msg_date) {
                        // This is the first received message, so we insert a
                        // date indicator before it.
                        this.insertDayIndicator(current_msg_date);
                        this.insertMessage(attrs);
                        return;
                    }
                    if (current_msg_date.isAfter(last_msg_date) ||
                            current_msg_date.isSame(last_msg_date)) {
                        // The new message is after the last message
                        if (current_msg_date.isAfter(last_msg_date, 'day')) {
                            // Append a new day indicator
                            this.insertDayIndicator(current_msg_date);
                        }
                        this.insertMessage(attrs);
                        return;
                    }
                    if (current_msg_date.isBefore(first_msg_date) ||
                            current_msg_date.isSame(first_msg_date)) {
                        // The message is before the first, but on the same day.
                        // We need to prepend the message immediately before the
                        // first message (so that it'll still be after the day
                        // indicator).
                        this.insertMessage(attrs, 'prepend');
                        if (current_msg_date.isBefore(first_msg_date, 'day')) {
                            // This message is also on a different day, so
                            // we prepend a day indicator.
                            this.insertDayIndicator(current_msg_date, 'prepend');
                        }
                        return;
                    }
                    // Find the correct place to position the message
                    current_msg_date = current_msg_date.format();
                    msg_dates = _.map(this.$content.find('.chat-message'), function (el) {
                        return $(el).data('isodate');
                    });
                    msg_dates.push(current_msg_date);
                    msg_dates.sort();
                    idx = msg_dates.indexOf(current_msg_date)-1;
                    _.flow(
                        function ($el) {
                            $el.insertAfter(
                                this.$content.find('.chat-message[data-isodate="'+msg_dates[idx]+'"]'));
                            return $el;
                        }.bind(this),
                        this.scrollDown.bind(this)
                    )(this.renderMessage(attrs));
                },

                getExtraMessageTemplateAttributes: function () {
                    /* Provides a hook for sending more attributes to the
                     * message template.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing message attributes.
                     */
                    return {};
                },

                getExtraMessageClasses: function (attrs) {
                    return attrs.delayed && 'delayed' || '';
                },

                renderMessage: function (attrs) {
                    /* Renders a chat message based on the passed in attributes.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message attributes.
                     *
                     *  Returns:
                     *      The DOM element representing the message.
                     */
                    var msg_time = moment(attrs.time) || moment,
                        text = attrs.message,
                        match = text.match(/^\/(.*?)(?: (.*))?$/),
                        fullname = this.model.get('fullname') || attrs.fullname,
                        template, username;

                    if ((match) && (match[1] === 'me')) {
                        text = text.replace(/^\/me/, '');
                        template = tpl_action;
                        if (attrs.sender === 'me') {
                            fullname = _converse.xmppstatus.get('fullname') || attrs.fullname;
                            username = _.isNil(fullname)? _converse.bare_jid: fullname;
                        } else {
                            username = attrs.fullname;
                        }
                    } else  {
                        template = tpl_message;
                        username = attrs.sender === 'me' && __('me') || fullname;
                    }
                    this.$content.find('div.chat-event').remove();

                    if (text.length > 8000) {
                        text = text.substring(0, 10) + '...';
                        this.showStatusNotification(
                            __("A very large message has been received."+
                               "This might be due to an attack meant to degrade the chat performance."+
                               "Output has been shortened."),
                            true, true);
                    }
                    var $msg = $(template(
                        _.extend(this.getExtraMessageTemplateAttributes(attrs), {
                            'msgid': attrs.msgid,
                            'sender': attrs.sender,
                            'time': msg_time.format(_converse.time_format),
                            'isodate': msg_time.format(),
                            'username': username,
                            'extra_classes': this.getExtraMessageClasses(attrs)
                        })
                    ));
                    $msg.find('.chat-msg-content').first()
                        .text(text)
                        .addHyperlinks()
                        .addEmoticons(_converse.visible_toolbar_buttons.emoticons);
                    return $msg;
                },

                showHelpMessages: function (msgs, type, spinner) {
                    var i, msgs_length = msgs.length;
                    for (i=0; i<msgs_length; i++) {
                        this.$content.append($('<div class="chat-'+(type||'info')+'">'+msgs[i]+'</div>'));
                    }
                    if (spinner === true) {
                        this.$content.append('<span class="spinner"/>');
                    } else if (spinner === false) {
                        this.$content.find('span.spinner').remove();
                    }
                    return this.scrollDown();
                },

                handleChatStateMessage: function (message) {
                    if (message.get('chat_state') === _converse.COMPOSING) {
                        if (message.get('sender') === 'me') {
                            this.showStatusNotification(__('Typing from another device'));
                        } else {
                            this.showStatusNotification(message.get('fullname')+' '+__('is typing'));
                        }
                        this.clear_status_timeout = window.setTimeout(this.clearStatusNotification.bind(this), 30000);
                    } else if (message.get('chat_state') === _converse.PAUSED) {
                        if (message.get('sender') === 'me') {
                            this.showStatusNotification(__('Stopped typing on the other device'));
                        } else {
                            this.showStatusNotification(message.get('fullname')+' '+__('has stopped typing'));
                        }
                    } else if (_.includes([_converse.INACTIVE, _converse.ACTIVE], message.get('chat_state'))) {
                        this.$content.find('div.chat-event').remove();
                    } else if (message.get('chat_state') === _converse.GONE) {
                        this.showStatusNotification(message.get('fullname')+' '+__('has gone away'));
                    }
                },

                shouldShowOnTextMessage: function () {
                    return !this.$el.is(':visible');
                },

                updateNewMessageIndicators: function (message) {
                    /* We have two indicators of new messages. The unread messages
                     * counter, which shows the number of unread messages in
                     * the document.title, and the "new messages" indicator in
                     * a chat area, if it's scrolled up so that new messages
                     * aren't visible.
                     *
                     * In both cases we ignore MAM messages.
                     */
                    if (!message.get('archive_id')) {
                        if (this.model.get('scrolled', true)) {
                            this.$el.find('.new-msgs-indicator').removeClass('hidden');
                        }
                        if (_converse.windowState === 'hidden' || this.model.get('scrolled', true)) {
                            _converse.incrementMsgCounter();
                        }
                    }
                },

                handleTextMessage: function (message) {
                    this.showMessage(_.clone(message.attributes));
                    if (message.get('sender') !== 'me') {
                        this.updateNewMessageIndicators(message);
                    } else {
                        // We remove the "scrolled" flag so that the chat area
                        // gets scrolled down. We always want to scroll down
                        // when the user writes a message as opposed to when a
                        // message is received.
                        this.model.set('scrolled', false);
                    }
                    if (this.shouldShowOnTextMessage()) {
                        this.show();
                    } else {
                        this.scrollDown();
                    }
                },

                handleErrorMessage: function (message) {
                    var $message = $('[data-msgid='+message.get('msgid')+']');
                    if ($message.length) {
                        $message.after($('<div class="chat-info chat-error"></div>').text(message.get('message')));
                        this.scrollDown();
                    }
                },

                onMessageAdded: function (message) {
                    /* Handler that gets called when a new message object is created.
                     *
                     * Parameters:
                     *    (Object) message - The message Backbone object that was added.
                     */
                    if (!_.isUndefined(this.clear_status_timeout)) {
                        window.clearTimeout(this.clear_status_timeout);
                        delete this.clear_status_timeout;
                    }
                    if (message.get('type') === 'error') {
                        this.handleErrorMessage(message);
                    } else if (!message.get('message')) {
                        this.handleChatStateMessage(message);
                    } else {
                        this.handleTextMessage(message);
                    }
                },

                createMessageStanza: function (message) {
                    return $msg({
                                from: _converse.connection.jid,
                                to: this.model.get('jid'),
                                type: 'chat',
                                id: message.get('msgid')
                        }).c('body').t(message.get('message')).up()
                            .c(_converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).up();
                },

                sendMessage: function (message) {
                    /* Responsible for sending off a text message.
                     *
                     *  Parameters:
                     *    (Message) message - The chat message
                     */
                    // TODO: We might want to send to specfic resources.
                    // Especially in the OTR case.
                    var messageStanza = this.createMessageStanza(message);
                    _converse.connection.send(messageStanza);
                    if (_converse.forward_messages) {
                        // Forward the message, so that other connected resources are also aware of it.
                        _converse.connection.send(
                            $msg({ to: _converse.bare_jid, type: 'chat', id: message.get('msgid') })
                            .c('forwarded', {xmlns:'urn:xmpp:forward:0'})
                            .c('delay', {xmns:'urn:xmpp:delay',stamp:(new Date()).getTime()}).up()
                            .cnode(messageStanza.tree())
                        );
                    }
                },

                onMessageSubmitted: function (text) {
                    /* This method gets called once the user has typed a message
                     * and then pressed enter in a chat box.
                     *
                     *  Parameters:
                     *    (string) text - The chat message text.
                     */
                    if (!_converse.connection.authenticated) {
                        return this.showHelpMessages(
                            ['Sorry, the connection has been lost, '+
                                'and your message could not be sent'],
                            'error'
                        );
                    }
                    var match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/), msgs;
                    if (match) {
                        if (match[1] === "clear") {
                            return this.clearMessages();
                        }
                        else if (match[1] === "help") {
                            msgs = [
                                '<strong>/help</strong>:'+__('Show this menu')+'',
                                '<strong>/me</strong>:'+__('Write in the third person')+'',
                                '<strong>/clear</strong>:'+__('Remove messages')+''
                                ];
                            this.showHelpMessages(msgs);
                            return;
                        }
                    }
                    var fullname = _converse.xmppstatus.get('fullname');
                    fullname = _.isEmpty(fullname)? _converse.bare_jid: fullname;
                    var message = this.model.messages.create({
                        fullname: fullname,
                        sender: 'me',
                        time: moment().format(),
                        message: text
                    });
                    this.sendMessage(message);
                },

                sendChatState: function () {
                    /* Sends a message with the status of the user in this chat session
                     * as taken from the 'chat_state' attribute of the chat box.
                     * See XEP-0085 Chat State Notifications.
                     */
                    _converse.connection.send(
                        $msg({'to':this.model.get('jid'), 'type': 'chat'})
                            .c(this.model.get('chat_state'), {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                            .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                    );
                },

                setChatState: function (state, no_save) {
                    /* Mutator for setting the chat state of this chat session.
                     * Handles clearing of any chat state notification timeouts and
                     * setting new ones if necessary.
                     * Timeouts are set when the  state being set is COMPOSING or PAUSED.
                     * After the timeout, COMPOSING will become PAUSED and PAUSED will become INACTIVE.
                     * See XEP-0085 Chat State Notifications.
                     *
                     *  Parameters:
                     *    (string) state - The chat state (consts ACTIVE, COMPOSING, PAUSED, INACTIVE, GONE)
                     *    (Boolean) no_save - Just do the cleanup or setup but don't actually save the state.
                     */
                    if (!_.isUndefined(this.chat_state_timeout)) {
                        window.clearTimeout(this.chat_state_timeout);
                        delete this.chat_state_timeout;
                    }
                    if (state === _converse.COMPOSING) {
                        this.chat_state_timeout = window.setTimeout(
                                this.setChatState.bind(this), _converse.TIMEOUTS.PAUSED, _converse.PAUSED);
                    } else if (state === _converse.PAUSED) {
                        this.chat_state_timeout = window.setTimeout(
                                this.setChatState.bind(this), _converse.TIMEOUTS.INACTIVE, _converse.INACTIVE);
                    }
                    if (!no_save && this.model.get('chat_state') !== state) {
                        this.model.set('chat_state', state);
                    }
                    return this;
                },

                keyPressed: function (ev) {
                    /* Event handler for when a key is pressed in a chat box textarea.
                     */
                    var textarea = ev.target, message;
                    if (ev.keyCode === KEY.ENTER) {
                        ev.preventDefault();
                        message = textarea.value;
                        textarea.value = '';
                        textarea.focus();
                        if (message !== '') {
                            this.onMessageSubmitted(message);
                            _converse.emit('messageSend', message);
                        }
                        this.setChatState(_converse.ACTIVE);
                    } else {
                        // Set chat state to composing if keyCode is not a forward-slash
                        // (which would imply an internal command and not a message).
                        this.setChatState(_converse.COMPOSING, ev.keyCode === KEY.FORWARD_SLASH);
                    }
                },

                onSendButtonClicked: function(ev) {
                    /* Event handler for when a send button is clicked in a chat box textarea.
                     */
                    ev.preventDefault();
                    var textarea = this.el.querySelector('.chat-textarea'),
                        message = textarea.value;

                    textarea.value = '';
                    textarea.focus();
                    if (message !== '') {
                        this.onMessageSubmitted(message);
                        _converse.emit('messageSend', message);
                    }
                    this.setChatState(_converse.ACTIVE);
                },

                clearMessages: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var result = confirm(__("Are you sure you want to clear the messages from this chat box?"));
                    if (result === true) {
                        this.$content.empty();
                        this.model.messages.reset();
                        this.model.messages.browserStorage._clear();
                    }
                    return this;
                },

                insertIntoTextArea: function (value) {
                    var $textbox = this.$el.find('textarea.chat-textarea');
                    var existing = $textbox.val();
                    if (existing && (existing[existing.length-1] !== ' ')) {
                        existing = existing + ' ';
                    }
                    $textbox.focus().val(existing+value+' ');
                },

                insertEmoticon: function (ev) {
                    ev.stopPropagation();
                    this.$el.find('.toggle-smiley ul').slideToggle(200);
                    var $target = $(ev.target);
                    $target = $target.is('a') ? $target : $target.children('a');
                    this.insertIntoTextArea($target.data('emoticon'));
                },

                toggleEmoticonMenu: function (ev) {
                    ev.stopPropagation();
                    this.$el.find('.toggle-smiley ul').slideToggle(200);
                },

                toggleCall: function (ev) {
                    ev.stopPropagation();
                    _converse.emit('callButtonClicked', {
                        connection: _converse.connection,
                        model: this.model
                    });
                },

                onChatStatusChanged: function (item) {
                    var chat_status = item.get('chat_status'),
                        fullname = item.get('fullname');
                    fullname = _.isEmpty(fullname)? item.get('jid'): fullname;
                    if (this.$el.is(':visible')) {
                        if (chat_status === 'offline') {
                            this.showStatusNotification(fullname+' '+__('has gone offline'));
                        } else if (chat_status === 'away') {
                            this.showStatusNotification(fullname+' '+__('has gone away'));
                        } else if ((chat_status === 'dnd')) {
                            this.showStatusNotification(fullname+' '+__('is busy'));
                        } else if (chat_status === 'online') {
                            this.$el.find('div.chat-event').remove();
                        }
                    }
                },

                onStatusChanged: function (item) {
                    this.showStatusMessage();
                    _converse.emit('contactStatusMessageChanged', {
                        'contact': item.attributes,
                        'message': item.get('status')
                    });
                },

                showStatusMessage: function (msg) {
                    msg = msg || this.model.get('status');
                    if (_.isString(msg)) {
                        this.$el.find('p.user-custom-message').text(msg).attr('title', msg);
                    }
                    return this;
                },

                close: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (_converse.connection.connected) {
                        // Immediately sending the chat state, because the
                        // model is going to be destroyed afterwards.
                        this.model.set('chat_state', _converse.INACTIVE);
                        this.sendChatState();
                    }
                    this.model.destroy();
                    this.remove();
                    _converse.emit('chatBoxClosed', this);
                    return this;
                },

                getToolbarOptions: function (options) {
                    return _.extend(options || {}, {
                        'label_clear': __('Clear all messages'),
                        'label_insert_smiley': __('Insert a smiley'),
                        'label_start_call': __('Start a call'),
                        'show_call_button': _converse.visible_toolbar_buttons.call,
                        'show_clear_button': _converse.visible_toolbar_buttons.clear,
                        'show_emoticons': _converse.visible_toolbar_buttons.emoticons,
                    });
                },

                renderToolbar: function (toolbar, options) {
                    if (!_converse.show_toolbar) { return; }
                    toolbar = toolbar || tpl_toolbar;
                    options = _.extend(
                        this.model.toJSON(),
                        this.getToolbarOptions(options || {})
                    );
                    this.$el.find('.chat-toolbar').html(toolbar(options));
                    return this;
                },

                renderAvatar: function () {
                    if (!this.model.get('image')) {
                        return;
                    }
                    var width = _converse.chatview_avatar_width;
                    var height = _converse.chatview_avatar_height;
                    var img_src = 'data:'+this.model.get('image_type')+';base64,'+this.model.get('image'),
                        canvas = $(tpl_avatar({
                            'width': width,
                            'height': height
                        })).get(0);

                    if (!(canvas.getContext && canvas.getContext('2d'))) {
                        return this;
                    }
                    var ctx = canvas.getContext('2d');
                    var img = new Image();   // Create new Image object
                    img.onload = function () {
                        var ratio = img.width/img.height;
                        if (ratio < 1) {
                            ctx.drawImage(img, 0,0, width, height*(1/ratio));
                        } else {
                            ctx.drawImage(img, 0,0, width, height*ratio);
                        }

                    };
                    img.src = img_src;
                    this.$el.find('.chat-title').before(canvas);
                    return this;
                },

                focus: function () {
                    this.$el.find('.chat-textarea').focus();
                    _converse.emit('chatBoxFocused', this);
                    return this;
                },

                hide: function () {
                    this.el.classList.add('hidden');
                    utils.refreshWebkit();
                    return this;
                },

                afterShown: function (focus) {
                    if (_converse.connection.connected) {
                        // Without a connection, we haven't yet initialized
                        // localstorage
                        this.model.save();
                    }
                    this.setChatState(_converse.ACTIVE);
                    this.scrollDown();
                    if (focus) {
                        this.focus();
                    }
                },

                _show: function (focus) {
                    /* Inner show method that gets debounced */
                    if (this.$el.is(':visible') && this.$el.css('opacity') === "1") {
                        if (focus) { this.focus(); }
                        return;
                    }
                    utils.fadeIn(this.el, _.bind(this.afterShown, this, focus));
                },

                show: function (focus) {
                    if (_.isUndefined(this.debouncedShow)) {
                        /* We wrap the method in a debouncer and set it on the
                         * instance, so that we have it debounced per instance.
                         * Debouncing it on the class-level is too broad.
                         */
                        this.debouncedShow = _.debounce(this._show, 250, {'leading': true});
                    }
                    this.debouncedShow.apply(this, arguments);
                    return this;
                },

                hideNewMessagesIndicator: function () {
                    var new_msgs_indicator = this.el.querySelector('.new-msgs-indicator');
                    if (!_.isNull(new_msgs_indicator)) {
                        new_msgs_indicator.classList.add('hidden');
                    }
                },

                markScrolled: _.debounce(function (ev) {
                    /* Called when the chat content is scrolled up or down.
                     * We want to record when the user has scrolled away from
                     * the bottom, so that we don't automatically scroll away
                     * from what the user is reading when new messages are
                     * received.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (this.model.get('auto_scrolled')) {
                        this.model.set({
                            'scrolled': false,
                            'auto_scrolled': false
                        });
                        return;
                    }
                    var is_at_bottom =
                        (this.$content.scrollTop() + this.$content.innerHeight()) >=
                            this.$content[0].scrollHeight-10;
                    if (is_at_bottom) {
                        this.hideNewMessagesIndicator();
                        this.model.save('scrolled', false);
                    } else {
                        // We're not at the bottom of the chat area, so we mark
                        // that the box is in a scrolled-up state.
                        this.model.save('scrolled', true);
                    }
                }, 150),

                viewUnreadMessages: function () {
                    this.model.save('scrolled', false);
                    this.scrollDown();
                },

                _scrollDown: function () {
                    /* Inner method that gets debounced */
                    if (this.$content.is(':visible') && !this.model.get('scrolled')) {
                        this.$content.scrollTop(this.$content[0].scrollHeight);
                        this.hideNewMessagesIndicator();
                        this.model.save({'auto_scrolled': true});
                    }
                },

                scrollDown: function () {
                    if (_.isUndefined(this.debouncedScrollDown)) {
                        /* We wrap the method in a debouncer and set it on the
                         * instance, so that we have it debounced per instance.
                         * Debouncing it on the class-level is too broad.
                         */
                        this.debouncedScrollDown = _.debounce(this._scrollDown, 250);
                    }
                    this.debouncedScrollDown.apply(this, arguments);
                    return this;
                }
            });
        }
    });

    return converse;
}));


define('tpl!add_contact_dropdown', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<dl class="add-converse-contact dropdown">\n    <dt id="xmpp-contact-search" class="fancy-dropdown">\n        <a class="toggle-xmpp-contact-form icon-plus" href="#" title="' +
__e(label_click_to_chat) +
'"> ' +
__e(label_add_contact) +
'</a>\n    </dt>\n    <dd class="search-xmpp"><ul></ul></dd>\n</dl>\n';

}
return __p
};});


define('tpl!add_contact_form', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<li>\n    <form class="pure-form add-xmpp-contact">\n        <input type="text"\n            name="identifier"\n            class="username"\n            placeholder="' +
__e(label_contact_username) +
'"/>\n        <button class="pure-button button-primary" type="submit">' +
__e(label_add) +
'</button>\n    </form>\n</li>\n';

}
return __p
};});


define('tpl!change_status_message', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<form id="set-custom-xmpp-status" class="pure-form">\n<fieldset>\n    <span class="input-button-group">\n        <input type="text" class="custom-xmpp-status" value="' +
__e(status_message) +
'" placeholder="' +
__e(label_custom_status) +
'"/>\n        <input type="submit" class="pure-button button-primary" value="' +
__e(label_save) +
'"/>\n    </span>\n</fieldset>\n</form>\n';

}
return __p
};});


define('tpl!chat_status', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div class="xmpp-status">\n    <a class="choose-xmpp-status ' +
__e(chat_status) +
' icon-' +
__e(chat_status) +
'" data-value="' +
__e(status_message) +
'" href="#" title="' +
__e(desc_change_status) +
'">\n        ' +
__e(status_message) +
'\n    </a>\n    <a class="change-xmpp-status-message icon-pencil" href="#" title="' +
__e(desc_custom_status) +
'"></a>\n</div>\n';

}
return __p
};});


define('tpl!choose_status', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '';
with (obj) {
__p += '<dl id="target" class="dropdown">\n    <dt id="fancy-xmpp-status-select" class="fancy-dropdown"></dt>\n    <dd><ul class="xmpp-status-menu"></ul></dd>\n</dl>\n';

}
return __p
};});


define('tpl!contacts_panel', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<form class="pure-form set-xmpp-status" action="" method="post">\n    <span id="xmpp-status-holder">\n        <select id="select-xmpp-status" style="display:none">\n            <option value="online">' +
__e(label_online) +
'</option>\n            <option value="dnd">' +
__e(label_busy) +
'</option>\n            <option value="away">' +
__e(label_away) +
'</option>\n            ';
 if (include_offline_state)  { ;
__p += '\n            <option value="offline">' +
__e(label_offline) +
'</option>\n            ';
 } ;
__p += '\n            ';
 if (allow_logout)  { ;
__p += '\n            <option value="logout">' +
__e(label_logout) +
'</option>\n            ';
 } ;
__p += '\n        </select>\n    </span>\n</form>\n';

}
return __p
};});


define('tpl!contacts_tab', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<li><a class="s ';
 if (is_current) { ;
__p += ' current ';
 } ;
__p += '"\n       data-id="users" href="#users">\n    ' +
__e(label_contacts) +
'\n</a></li>\n';

}
return __p
};});


define('tpl!controlbox', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<div class="flyout box-flyout">\n    <div class="dragresize dragresize-top"></div>\n    <div class="dragresize dragresize-topleft"></div>\n    <div class="dragresize dragresize-left"></div>\n    <div class="chat-head controlbox-head">\n        <ul id="controlbox-tabs"></ul>\n        ';
 if (!sticky_controlbox) { ;
__p += '\n            <a class="chatbox-btn close-chatbox-button icon-close"></a>\n        ';
 } ;
__p += '\n    </div>\n    <div class="controlbox-panes"></div>\n</div>\n';

}
return __p
};});


define('tpl!controlbox_toggle', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<span class="conn-feedback">' +
__e(label_toggle) +
'</span>\n';

}
return __p
};});


define('tpl!login_panel', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<form class="pure-form pure-form-stacked converse-form" id="converse-login" method="post">\n    ';
 if (auto_login) { ;
__p += '\n        <span class="spinner login-submit"/>\n    ';
 } ;
__p += '\n    ';
 if (!auto_login) { ;
__p += '\n        ';
 if (authentication == LOGIN || authentication == EXTERNAL) { ;
__p += '\n            <label>' +
__e(label_username) +
'</label>\n            <input type="text" name="jid" placeholder="' +
__e(placeholder_username) +
'">\n            ';
 if (authentication !== EXTERNAL) { ;
__p += '\n                <label>' +
__e(label_password) +
'</label>\n                <input type="password" name="password" placeholder="' +
__e(placeholder_password) +
'">\n            ';
 } ;
__p += '\n            <input class="pure-button button-primary" type="submit" value="' +
__e(label_login) +
'">\n            <span class="conn-feedback"></span>\n        ';
 } ;
__p += '\n        ';
 if (authentication == ANONYMOUS) { ;
__p += '\n            <input class="pure-button button-primary login-anon" type="submit" value="' +
__e(label_anon_login) +
'"/>\n        ';
 } ;
__p += '\n        ';
 if (authentication == PREBIND) { ;
__p += '\n            <p>Disconnected.</p>\n        ';
 } ;
__p += '\n    ';
 } ;
__p += '\n</form>\n';

}
return __p
};});


define('tpl!login_tab', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<li><a class="current" data-id="login" href="#login-dialog">' +
__e(label_sign_in) +
'</a></li>\n';

}
return __p
};});


define('tpl!search_contact', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<li>\n    <form class="search-xmpp-contact">\n        <input type="text"\n            name="identifier"\n            class="username"\n            placeholder="' +
__e(label_contact_name) +
'"/>\n        <button type="submit">' +
__e(label_search) +
'</button>\n    </form>\n</li>\n';

}
return __p
};});


define('tpl!status_option', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<li>\n    <a href="#" class="' +
__e( value ) +
'" data-value="' +
__e( value ) +
'">\n        <span class="icon-' +
__e( value ) +
'"></span>\n        ' +
__e( text ) +
'\n    </a>\n</li>\n';

}
return __p
};});


define('tpl!group_header', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<a href="#" class="group-toggle icon-' +
__e(toggle_state) +
'" title="' +
__e(desc_group_toggle) +
'">' +
__e(label_group) +
'</a>\n';

}
return __p
};});


define('tpl!pending_contact', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 if (allow_chat_pending_contacts)  { ;
__p += '\n<a class="open-chat"href="#">\n';
 } ;
__p += '\n<span class="pending-contact-name" title="Name: ' +
__e(fullname) +
'\nJID: ' +
__e(jid) +
'">' +
__e(fullname) +
'</span> \n';
 if (allow_chat_pending_contacts)  { ;
__p += '\n</a>\n';
 } ;
__p += '\n<a class="remove-xmpp-contact icon-remove" title="' +
__e(desc_remove) +
'" href="#"></a>\n';

}
return __p
};});


define('tpl!requesting_contact', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 if (allow_chat_pending_contacts)  { ;
__p += '\n<a class="open-chat"href="#">\n';
 } ;
__p += '\n<span class="req-contact-name" title="Name: ' +
__e(fullname) +
'\nJID: ' +
__e(jid) +
'">' +
__e(fullname) +
'</span>\n';
 if (allow_chat_pending_contacts)  { ;
__p += '\n</a>\n';
 } ;
__p += '\n<span class="request-actions">\n    <a class="accept-xmpp-request icon-checkmark" aria-label="' +
__e(desc_accept) +
'" title="' +
__e(desc_accept) +
'" href="#"></a>\n    <a class="decline-xmpp-request icon-close" aria-label="' +
__e(desc_decline) +
'" title="' +
__e(desc_decline) +
'" href="#"></a>\n</span>\n';

}
return __p
};});


define('tpl!roster', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '';
with (obj) {
__p += '<dl class="roster-contacts" style="display: none;"></dl>\n';

}
return __p
};});


define('tpl!roster_filter', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<form class="pure-form roster-filter-form input-button-group">\n    <input value="' +
((__t = (filter_text)) == null ? '' : __t) +
'" class="roster-filter"\n           placeholder="' +
((__t = (placeholder)) == null ? '' : __t) +
'"\n           ';
 if (filter_type === 'state') { ;
__p += '  style="display: none" ';
 } ;
__p += ' >\n    <select class="state-type" ';
 if (filter_type !== 'state') { ;
__p += '  style="display: none" ';
 } ;
__p += ' >\n        <option value="">' +
((__t = (label_any)) == null ? '' : __t) +
'</option>\n        <option ';
 if (chat_state === 'online') { ;
__p += ' selected="selected" ';
 } ;
__p += '\n            value="online">' +
((__t = (label_online)) == null ? '' : __t) +
'</option>\n        <option ';
 if (chat_state === 'chat') { ;
__p += ' selected="selected" ';
 } ;
__p += '\n            value="chat">' +
((__t = (label_chatty)) == null ? '' : __t) +
'</option>\n        <option ';
 if (chat_state === 'dnd') { ;
__p += ' selected="selected" ';
 } ;
__p += '\n            value="dnd">' +
((__t = (label_busy)) == null ? '' : __t) +
'</option>\n        <option ';
 if (chat_state === 'away') { ;
__p += ' selected="selected" ';
 } ;
__p += '\n            value="away">' +
((__t = (label_away)) == null ? '' : __t) +
'</option>\n        <option ';
 if (chat_state === 'xa') { ;
__p += ' selected="selected" ';
 } ;
__p += '\n            value="xa">' +
((__t = (label_xa)) == null ? '' : __t) +
'</option>\n        <option ';
 if (chat_state === 'offline') { ;
__p += ' selected="selected" ';
 } ;
__p += '\n            value="offline">' +
((__t = (label_offline)) == null ? '' : __t) +
'</option>\n    </select>\n    <select class="filter-type">\n        <option ';
 if (filter_type === 'contacts') { ;
__p += ' selected="selected" ';
 } ;
__p += '\n                value="contacts">' +
((__t = (label_contacts)) == null ? '' : __t) +
'</option>\n        <option ';
 if (filter_type === 'groups') { ;
__p += ' selected="selected" ';
 } ;
__p += '\n                value="groups">' +
((__t = (label_groups)) == null ? '' : __t) +
'</option>\n        <option ';
 if (filter_type === 'state') { ;
__p += ' selected="selected" ';
 } ;
__p += '\n                value="state">' +
((__t = (label_state)) == null ? '' : __t) +
'</option>\n    </select>\n</form>\n';

}
return __p
};});


define('tpl!roster_item', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<a class="open-chat" title="' +
__e(title_fullname) +
': ' +
__e(fullname) +
'\nJID: ' +
__e(jid) +
'\n' +
__e(desc_chat) +
'" href="#"><span class="icon-' +
__e(chat_status) +
'" title="' +
__e(desc_status) +
'"></span>' +
__e(fullname) +
'</a>\n';
 if (allow_contact_removal) { ;
__p += '\n<a class="remove-xmpp-contact icon-remove" title="' +
__e(desc_remove) +
'" href="#"></a>\n';
 } ;
__p += '\n';

}
return __p
};});

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

(function (root, factory) {
    define('converse-rosterview',["converse-core",
            "tpl!group_header",
            "tpl!pending_contact",
            "tpl!requesting_contact",
            "tpl!roster",
            "tpl!roster_filter",
            "tpl!roster_item"
    ], factory);
}(this, function (
            converse, 
            tpl_group_header,
            tpl_pending_contact,
            tpl_requesting_contact,
            tpl_roster,
            tpl_roster_filter,
            tpl_roster_item) {
    "use strict";
    var $ = converse.env.jQuery,
        utils = converse.env.utils,
        Strophe = converse.env.Strophe,
        $iq = converse.env.$iq,
        b64_sha1 = converse.env.b64_sha1,
        _ = converse.env._;

    converse.plugins.add('converse-rosterview', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.
            afterReconnected: function () {
                this.rosterview.registerRosterXHandler();
                this.__super__.afterReconnected.apply(this, arguments);
            },

            _tearDown: function () {
                /* Remove the rosterview when tearing down. It gets created
                 * anew when reconnecting or logging in.
                 */
                this.__super__._tearDown.apply(this, arguments);
                if (!_.isUndefined(this.rosterview)) {
                    this.rosterview.remove();
                }
            },

            RosterGroups: {
                comparator: function () {
                    // RosterGroupsComparator only gets set later (once i18n is
                    // set up), so we need to wrap it in this nameless function.
                    var _converse = this.__super__._converse;
                    return _converse.RosterGroupsComparator.apply(this, arguments);
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse,
                __ = _converse.__;

            this.updateSettings({
                allow_chat_pending_contacts: true,
                allow_contact_removal: true,
                show_toolbar: true,
            });

            var STATUSES = {
                'dnd': __('This contact is busy'),
                'online': __('This contact is online'),
                'offline': __('This contact is offline'),
                'unavailable': __('This contact is unavailable'),
                'xa': __('This contact is away for an extended period'),
                'away': __('This contact is away')
            };
            var LABEL_CONTACTS = __('Contacts');
            var LABEL_GROUPS = __('Groups');
            var HEADER_CURRENT_CONTACTS =  __('My contacts');
            var HEADER_PENDING_CONTACTS = __('Pending contacts');
            var HEADER_REQUESTING_CONTACTS = __('Contact requests');
            var HEADER_UNGROUPED = __('Ungrouped');
            var HEADER_WEIGHTS = {};
            HEADER_WEIGHTS[HEADER_REQUESTING_CONTACTS] = 0;
            HEADER_WEIGHTS[HEADER_CURRENT_CONTACTS]    = 1;
            HEADER_WEIGHTS[HEADER_UNGROUPED]           = 2;
            HEADER_WEIGHTS[HEADER_PENDING_CONTACTS]    = 3;

            _converse.RosterGroupsComparator = function (a, b) {
                /* Groups are sorted alphabetically, ignoring case.
                 * However, Ungrouped, Requesting Contacts and Pending Contacts
                 * appear last and in that order.
                 */
                a = a.get('name');
                b = b.get('name');
                var special_groups = _.keys(HEADER_WEIGHTS);
                var a_is_special = _.includes(special_groups, a);
                var b_is_special = _.includes(special_groups, b);
                if (!a_is_special && !b_is_special ) {
                    return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0);
                } else if (a_is_special && b_is_special) {
                    return HEADER_WEIGHTS[a] < HEADER_WEIGHTS[b] ? -1 : (HEADER_WEIGHTS[a] > HEADER_WEIGHTS[b] ? 1 : 0);
                } else if (!a_is_special && b_is_special) {
                    return (b === HEADER_REQUESTING_CONTACTS) ? 1 : -1;
                } else if (a_is_special && !b_is_special) {
                    return (a === HEADER_REQUESTING_CONTACTS) ? -1 : 1;
                }
            };


            _converse.RosterFilter = Backbone.Model.extend({
                initialize: function () {
                    this.set({
                        'filter_text': '',
                        'filter_type': 'contacts',
                        'chat_state': ''
                    });
                },
            });

            _converse.RosterFilterView = Backbone.View.extend({
                tagName: 'span',
                events: {
                    "keydown .roster-filter": "liveFilter",
                    "submit form.roster-filter-form": "submitFilter",
                    "click .onX": "clearFilter",
                    "mousemove .x": "toggleX",
                    "change .filter-type": "changeTypeFilter",
                    "change .state-type": "changeChatStateFilter"
                },

                initialize: function () {
                    this.model.on('change:filter_type', this.render, this);
                    this.model.on('change:filter_text', this.render, this);
                },

                render: function () {
                    this.el.innerHTML = tpl_roster_filter(
                        _.extend(this.model.toJSON(), {
                            placeholder: __('Filter'),
                            label_contacts: LABEL_CONTACTS,
                            label_groups: LABEL_GROUPS,
                            label_state: __('State'),
                            label_any: __('Any'),
                            label_online: __('Online'),
                            label_chatty: __('Chatty'),
                            label_busy: __('Busy'),
                            label_away: __('Away'),
                            label_xa: __('Extended Away'),
                            label_offline: __('Offline')
                        }));
                    this.renderClearButton();
                    return this.$el;
                },

                renderClearButton: function () {
                    var $roster_filter = this.$('.roster-filter');
                    $roster_filter[this.tog($roster_filter.val())]('x');
                },

                tog: function (v) {
                    return v?'addClass':'removeClass';
                },

                toggleX: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var el = ev.target;
                    $(el)[this.tog(el.offsetWidth-18 < ev.clientX-el.getBoundingClientRect().left)]('onX');
                },

                changeChatStateFilter: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.model.save({
                        'chat_state': this.el.querySelector('.state-type').value
                    });
                },

                changeTypeFilter: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var type = ev.target.value;
                    if (type === 'state') {
                        this.model.save({
                            'filter_type': type,
                            'chat_state': this.el.querySelector('.state-type').value
                        });
                    } else {
                        this.model.save({
                            'filter_type': type,
                            'filter_text': this.el.querySelector('.roster-filter').value
                        });
                    }
                },

                liveFilter: _.debounce(function (ev) {
                    this.model.save({
                        'filter_type': this.el.querySelector('.filter-type').value,
                        'filter_text': this.el.querySelector('.roster-filter').value
                    });
                }, 250),

                submitFilter: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.liveFilter();
                    this.render();
                },

                isActive: function () {
                    /* Returns true if the filter is enabled (i.e. if the user
                     * has added values to the filter).
                     */
                    if (this.model.get('filter_type') === 'state' ||
                        this.model.get('filter_text')) {
                        return true;
                    }
                    return false;
                },

                show: function () {
                    if (this.$el.is(':visible')) { return this; }
                    this.$el.show();
                    return this;
                },

                hide: function () {
                    if (!this.$el.is(':visible')) { return this; }
                    if (this.el.querySelector('.roster-filter').value.length > 0) {
                        // Don't hide if user is currently filtering.
                        return;
                    }
                    this.model.save({
                        'filter_text': '',
                        'chat_state': ''
                    });
                    this.$el.hide();
                    return this;
                },

                clearFilter: function (ev) {
                    if (ev && ev.preventDefault) {
                        ev.preventDefault();
                        $(ev.target).removeClass('x onX').val('');
                    }
                    this.model.save({
                        'filter_text': ''
                    });
                }
            });

            _converse.RosterView = Backbone.Overview.extend({
                tagName: 'div',
                id: 'converse-roster',

                initialize: function () {
                    this.roster_handler_ref = this.registerRosterHandler();
                    this.rosterx_handler_ref = this.registerRosterXHandler();
                    _converse.roster.on("add", this.onContactAdd, this);
                    _converse.roster.on('change', this.onContactChange, this);
                    _converse.roster.on("destroy", this.update, this);
                    _converse.roster.on("remove", this.update, this);
                    this.model.on("add", this.onGroupAdd, this);
                    this.model.on("reset", this.reset, this);
                    _converse.on('rosterGroupsFetched', this.positionFetchedGroups, this);
                    _converse.on('rosterContactsFetched', this.update, this);
                    this.createRosterFilter();
                },

                render: function () {
                    this.renderRoster();
                    this.$el.html(this.filter_view.render());
                    if (!_converse.allow_contact_requests) {
                        // XXX: if we ever support live editing of config then
                        // we'll need to be able to remove this class on the fly.
                        this.el.classList.add('no-contact-requests');
                    }
                    return this;
                },

                renderRoster: function () {
                    this.$roster = $(tpl_roster());
                    this.roster = this.$roster[0];
                },

                createRosterFilter: function () {
                    // Create a model on which we can store filter properties
                    var model = new _converse.RosterFilter();
                    model.id = b64_sha1('_converse.rosterfilter'+_converse.bare_jid);
                    model.browserStorage = new Backbone.BrowserStorage.local(this.filter.id);
                    this.filter_view = new _converse.RosterFilterView({'model': model});
                    this.filter_view.model.on('change', this.updateFilter, this);
                    this.filter_view.model.fetch();
                },

                updateFilter: _.debounce(function () {
                    /* Filter the roster again.
                     * Called whenever the filter settings have been changed or
                     * when contacts have been added, removed or changed.
                     *
                     * Debounced so that it doesn't get called for every
                     * contact fetched from browser storage.
                     */
                    var type = this.filter_view.model.get('filter_type');
                    if (type === 'state') {
                        this.filter(this.filter_view.model.get('chat_state'), type);
                    } else {
                        this.filter(this.filter_view.model.get('filter_text'), type);
                    }
                }, 100),

                unregisterHandlers: function () {
                    _converse.connection.deleteHandler(this.roster_handler_ref);
                    delete this.roster_handler_ref;
                    _converse.connection.deleteHandler(this.rosterx_handler_ref);
                    delete this.rosterx_handler_ref;
                },

                update: _.debounce(function () {
                    if (_.isNull(this.roster.parentElement)) {
                        this.$el.append(this.$roster.show());
                    }
                    return this.showHideFilter();
                }, _converse.animate ? 100 : 0),

                showHideFilter: function () {
                    if (!this.$el.is(':visible')) {
                        return;
                    }
                    if (this.$roster.hasScrollBar()) {
                        this.filter_view.show();
                    } else if (!this.filter_view.isActive()) {
                        this.filter_view.hide();
                    }
                    return this;
                },

                filter: function (query, type) {
                    // First we make sure the filter is restored to its
                    // original state
                    _.each(this.getAll(), function (view) {
                        if (view.model.contacts.length > 0) {
                            view.show().filter('');
                        }
                    });
                    // Now we can filter
                    query = query.toLowerCase();
                    if (type === 'groups') {
                        _.each(this.getAll(), function (view, idx) {
                            if (!_.includes(view.model.get('name').toLowerCase(), query.toLowerCase())) {
                                view.hide();
                            } else if (view.model.contacts.length > 0) {
                                view.show();
                            }
                        });
                    } else {
                        _.each(this.getAll(), function (view) {
                            view.filter(query, type);
                        });
                    }
                },

                reset: function () {
                    _converse.roster.reset();
                    this.removeAll();
                    this.renderRoster();
                    this.render().update();
                    return this;
                },

                registerRosterHandler: function () {
                    _converse.connection.addHandler(
                        _converse.roster.onRosterPush.bind(_converse.roster),
                        Strophe.NS.ROSTER, 'iq', "set"
                    );
                },

                registerRosterXHandler: function () {
                    var t = 0;
                    _converse.connection.addHandler(
                        function (msg) {
                            window.setTimeout(
                                function () {
                                    _converse.connection.flush();
                                    _converse.roster.subscribeToSuggestedItems.bind(_converse.roster)(msg);
                                },
                                t
                            );
                            t += $(msg).find('item').length*250;
                            return true;
                        },
                        Strophe.NS.ROSTERX, 'message', null
                    );
                },

                onGroupAdd: function (group) {
                    var view = new _converse.RosterGroupView({model: group});
                    this.add(group.get('name'), view.render());
                    this.positionGroup(view);
                },

                onContactAdd: function (contact) {
                    this.addRosterContact(contact).update();
                    this.updateFilter();
                },

                onContactChange: function (contact) {
                    this.updateChatBox(contact).update();
                    if (_.has(contact.changed, 'subscription')) {
                        if (contact.changed.subscription === 'from') {
                            this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                        } else if (_.includes(['both', 'to'], contact.get('subscription'))) {
                            this.addExistingContact(contact);
                        }
                    }
                    if (_.has(contact.changed, 'ask') && contact.changed.ask === 'subscribe') {
                        this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                    }
                    if (_.has(contact.changed, 'subscription') && contact.changed.requesting === 'true') {
                        this.addContactToGroup(contact, HEADER_REQUESTING_CONTACTS);
                    }
                    this.updateFilter();
                },

                updateChatBox: function (contact) {
                    var chatbox = _converse.chatboxes.get(contact.get('jid')),
                        changes = {};
                    if (!chatbox) {
                        return this;
                    }
                    if (_.has(contact.changed, 'chat_status')) {
                        changes.chat_status = contact.get('chat_status');
                    }
                    if (_.has(contact.changed, 'status')) {
                        changes.status = contact.get('status');
                    }
                    chatbox.save(changes);
                    return this;
                },

                positionFetchedGroups: function () {
                    /* Instead of throwing an add event for each group
                     * fetched, we wait until they're all fetched and then
                     * we position them.
                     * Works around the problem of positionGroup not
                     * working when all groups besides the one being
                     * positioned aren't already in inserted into the
                     * roster DOM element.
                     */
                    var that = this;
                    this.model.sort();
                    this.model.each(function (group, idx) {
                        var view = that.get(group.get('name'));
                        if (!view) {
                            view = new _converse.RosterGroupView({model: group});
                            that.add(group.get('name'), view.render());
                        }
                        if (idx === 0) {
                            that.$roster.append(view.$el);
                        } else {
                            that.appendGroup(view);
                        }
                    });
                },

                positionGroup: function (view) {
                    /* Place the group's DOM element in the correct alphabetical
                     * position amongst the other groups in the roster.
                     */
                    var $groups = this.$roster.find('.roster-group'),
                        index = $groups.length ? this.model.indexOf(view.model) : 0;
                    if (index === 0) {
                        this.$roster.prepend(view.$el);
                    } else if (index === (this.model.length-1)) {
                        this.appendGroup(view);
                    } else {
                        $($groups.eq(index)).before(view.$el);
                    }
                    return this;
                },

                appendGroup: function (view) {
                    /* Add the group at the bottom of the roster
                     */
                    var $last = this.$roster.find('.roster-group').last();
                    var $siblings = $last.siblings('dd');
                    if ($siblings.length > 0) {
                        $siblings.last().after(view.$el);
                    } else {
                        $last.after(view.$el);
                    }
                    return this;
                },

                getGroup: function (name) {
                    /* Returns the group as specified by name.
                     * Creates the group if it doesn't exist.
                     */
                    var view =  this.get(name);
                    if (view) {
                        return view.model;
                    }
                    return this.model.create({name: name, id: b64_sha1(name)});
                },

                addContactToGroup: function (contact, name) {
                    this.getGroup(name).contacts.add(contact);
                },

                addExistingContact: function (contact) {
                    var groups;
                    if (_converse.roster_groups) {
                        groups = contact.get('groups');
                        if (groups.length === 0) {
                            groups = [HEADER_UNGROUPED];
                        }
                    } else {
                        groups = [HEADER_CURRENT_CONTACTS];
                    }
                    _.each(groups, _.bind(this.addContactToGroup, this, contact));
                },

                addRosterContact: function (contact) {
                    if (contact.get('subscription') === 'both' || contact.get('subscription') === 'to') {
                        this.addExistingContact(contact);
                    } else {
                        if ((contact.get('ask') === 'subscribe') || (contact.get('subscription') === 'from')) {
                            this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                        } else if (contact.get('requesting') === true) {
                            this.addContactToGroup(contact, HEADER_REQUESTING_CONTACTS);
                        }
                    }
                    return this;
                }
            });


            _converse.RosterContactView = Backbone.View.extend({
                tagName: 'dd',

                events: {
                    "click .accept-xmpp-request": "acceptRequest",
                    "click .decline-xmpp-request": "declineRequest",
                    "click .open-chat": "openChat",
                    "click .remove-xmpp-contact": "removeContact"
                },

                initialize: function () {
                    this.model.on("change", this.render, this);
                    this.model.on("remove", this.remove, this);
                    this.model.on("destroy", this.remove, this);
                    this.model.on("open", this.openChat, this);
                },

                render: function () {
                    var that = this;
                    if (!this.mayBeShown()) {
                        this.$el.hide();
                        return this;
                    }
                    var item = this.model,
                        ask = item.get('ask'),
                        chat_status = item.get('chat_status'),
                        requesting  = item.get('requesting'),
                        subscription = item.get('subscription');

                    var classes_to_remove = [
                        'current-xmpp-contact',
                        'pending-xmpp-contact',
                        'requesting-xmpp-contact'
                        ].concat(_.keys(STATUSES));

                    _.each(classes_to_remove,
                        function (cls) {
                            if (_.includes(that.el.className, cls)) {
                                that.el.classList.remove(cls);
                            }
                        });
                    this.$el.addClass(chat_status).data('status', chat_status);

                    if ((ask === 'subscribe') || (subscription === 'from')) {
                        /* ask === 'subscribe'
                         *      Means we have asked to subscribe to them.
                         *
                         * subscription === 'from'
                         *      They are subscribed to use, but not vice versa.
                         *      We assume that there is a pending subscription
                         *      from us to them (otherwise we're in a state not
                         *      supported by converse.js).
                         *
                         *  So in both cases the user is a "pending" contact.
                         */
                        this.el.classList.add('pending-xmpp-contact');
                        this.$el.html(tpl_pending_contact(
                            _.extend(item.toJSON(), {
                                'desc_remove': __('Click to remove this contact'),
                                'allow_chat_pending_contacts': _converse.allow_chat_pending_contacts
                            })
                        ));
                    } else if (requesting === true) {
                        this.el.classList.add('requesting-xmpp-contact');
                        this.$el.html(tpl_requesting_contact(
                            _.extend(item.toJSON(), {
                                'desc_accept': __("Click to accept this contact request"),
                                'desc_decline': __("Click to decline this contact request"),
                                'allow_chat_pending_contacts': _converse.allow_chat_pending_contacts
                            })
                        ));
                    } else if (subscription === 'both' || subscription === 'to') {
                        this.el.classList.add('current-xmpp-contact');
                        this.$el.removeClass(_.without(['both', 'to'], subscription)[0]).addClass(subscription);
                        this.$el.html(tpl_roster_item(
                            _.extend(item.toJSON(), {
                                'desc_status': STATUSES[chat_status||'offline'],
                                'desc_chat': __('Click to chat with this contact'),
                                'desc_remove': __('Click to remove this contact'),
                                'title_fullname': __('Name'),
                                'allow_contact_removal': _converse.allow_contact_removal
                            })
                        ));
                    }
                    return this;
                },

                isGroupCollapsed: function () {
                    /* Check whether the group in which this contact appears is
                     * collapsed.
                     */
                    // XXX: this sucks and is fragile.
                    // It's because I tried to do the "right thing"
                    // and use definition lists to represent roster groups.
                    // If roster group items were inside the group elements, we
                    // would simplify things by not having to check whether the
                    // group is collapsed or not.
                    var name = this.$el.prevAll('dt:first').data('group');
                    var group = _converse.rosterview.model.where({'name': name})[0];
                    if (group.get('state') === _converse.CLOSED) {
                        return true;
                    }
                    return false;
                },

                mayBeShown: function () {
                    /* Return a boolean indicating whether this contact should
                     * generally be visible in the roster.
                     *
                     * It doesn't check for the more specific case of whether
                     * the group it's in is collapsed (see isGroupCollapsed).
                     */
                    var chatStatus = this.model.get('chat_status');
                    if ((_converse.show_only_online_users && chatStatus !== 'online') ||
                        (_converse.hide_offline_users && chatStatus === 'offline')) {
                        // If pending or requesting, show
                        if ((this.model.get('ask') === 'subscribe') ||
                                (this.model.get('subscription') === 'from') ||
                                (this.model.get('requesting') === true)) {
                            return true;
                        }
                        return false;
                    }
                    return true;
                },

                openChat: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    return _converse.chatboxviews.showChat(this.model.attributes);
                },

                removeContact: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (!_converse.allow_contact_removal) { return; }
                    var result = confirm(__("Are you sure you want to remove this contact?"));
                    if (result === true) {
                        var iq = $iq({type: 'set'})
                            .c('query', {xmlns: Strophe.NS.ROSTER})
                            .c('item', {jid: this.model.get('jid'), subscription: "remove"});
                        _converse.connection.sendIQ(iq,
                            function (iq) {
                                this.model.destroy();
                                this.remove();
                            }.bind(this),
                            function (err) {
                                alert(__("Sorry, there was an error while trying to remove "+name+" as a contact."));
                                _converse.log(err);
                            }
                        );
                    }
                },

                acceptRequest: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    _converse.roster.sendContactAddIQ(
                        this.model.get('jid'),
                        this.model.get('fullname'),
                        [],
                        function () { this.model.authorize().subscribe(); }.bind(this)
                    );
                },

                declineRequest: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var result = confirm(__("Are you sure you want to decline this contact request?"));
                    if (result === true) {
                        this.model.unauthorize().destroy();
                    }
                    return this;
                }
            });


            _converse.RosterGroupView = Backbone.Overview.extend({
                tagName: 'dt',
                className: 'roster-group',
                events: {
                    "click a.group-toggle": "toggle"
                },

                initialize: function () {
                    this.model.contacts.on("add", this.addContact, this);
                    this.model.contacts.on("change:subscription", this.onContactSubscriptionChange, this);
                    this.model.contacts.on("change:requesting", this.onContactRequestChange, this);
                    this.model.contacts.on("change:chat_status", function (contact) {
                        // This might be optimized by instead of first sorting,
                        // finding the correct position in positionContact
                        this.model.contacts.sort();
                        this.positionContact(contact).render();
                    }, this);
                    this.model.contacts.on("destroy", this.onRemove, this);
                    this.model.contacts.on("remove", this.onRemove, this);
                    _converse.roster.on('change:groups', this.onContactGroupChange, this);
                },

                render: function () {
                    this.el.setAttribute('data-group', this.model.get('name'));
                    this.$el.html(
                        $(tpl_group_header({
                            label_group: this.model.get('name'),
                            desc_group_toggle: this.model.get('description'),
                            toggle_state: this.model.get('state')
                        }))
                    );
                    return this;
                },

                addContact: function (contact) {
                    var view = new _converse.RosterContactView({model: contact});
                    this.add(contact.get('id'), view);
                    view = this.positionContact(contact).render();
                    if (view.mayBeShown()) {
                        if (this.model.get('state') === _converse.CLOSED) {
                            if (view.$el[0].style.display !== "none") { view.$el.hide(); }
                            if (!this.$el.is(':visible')) { this.$el.show(); }
                        } else {
                            if (this.$el[0].style.display !== "block") { this.show(); }
                        }
                    }
                },

                positionContact: function (contact) {
                    /* Place the contact's DOM element in the correct alphabetical
                     * position amongst the other contacts in this group.
                     */
                    var view = this.get(contact.get('id'));
                    var index = this.model.contacts.indexOf(contact);
                    view.$el.detach();
                    if (index === 0) {
                        this.$el.after(view.$el);
                    } else if (index === (this.model.contacts.length-1)) {
                        this.$el.nextUntil('dt').last().after(view.$el);
                    } else {
                        this.$el.nextUntil('dt').eq(index).before(view.$el);
                    }
                    return view;
                },

                show: function () {
                    this.$el.show();
                    _.each(this.getAll(), function (view) {
                        if (view.mayBeShown() && !view.isGroupCollapsed()) {
                            view.$el.show();
                        }
                    });
                    return this;
                },

                hide: function () {
                    this.$el.nextUntil('dt').addBack().hide();
                },

                filter: function (q, type) {
                    /* Filter the group's contacts based on the query "q".
                     * The query is matched against the contact's full name.
                     * If all contacts are filtered out (i.e. hidden), then the
                     * group must be filtered out as well.
                     */
                    var matches;
                    if (q.length === 0) {
                        if (this.model.get('state') === _converse.OPENED) {
                            this.model.contacts.each(function (item) {
                                var view = this.get(item.get('id'));
                                if (view.mayBeShown() && !view.isGroupCollapsed()) {
                                    view.$el.show();
                                }
                            }.bind(this));
                        }
                        this.showIfNecessary();
                    } else {
                        q = q.toLowerCase();
                        if (type === 'state') {
                            if (this.model.get('name') === HEADER_REQUESTING_CONTACTS) {
                                // When filtering by chat state, we still want to
                                // show requesting contacts, even though they don't
                                // have the state in question.
                                matches = this.model.contacts.filter(
                                    function (contact) {
                                        return utils.contains.not('chat_status', q)(contact) && !contact.get('requesting');
                                    }
                                );
                            } else {
                                matches = this.model.contacts.filter(
                                    utils.contains.not('chat_status', q)
                                );
                            }
                        } else  {
                            matches = this.model.contacts.filter(
                                utils.contains.not('fullname', q)
                            );
                        }
                        if (matches.length === this.model.contacts.length) {
                            // hide the whole group
                            this.hide();
                        } else {
                            _.each(matches, function (item) {
                                this.get(item.get('id')).$el.hide();
                            }.bind(this));
                            _.each(this.model.contacts.reject(utils.contains.not('fullname', q)), function (item) {
                                this.get(item.get('id')).$el.show();
                            }.bind(this));
                            this.showIfNecessary();
                        }
                    }
                },

                showIfNecessary: function () {
                    if (!this.$el.is(':visible') && this.model.contacts.length > 0) {
                        this.$el.show();
                    }
                },

                toggle: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $el = $(ev.target);
                    if ($el.hasClass("icon-opened")) {
                        this.$el.nextUntil('dt').slideUp();
                        this.model.save({state: _converse.CLOSED});
                        $el.removeClass("icon-opened").addClass("icon-closed");
                    } else {
                        $el.removeClass("icon-closed").addClass("icon-opened");
                        this.model.save({state: _converse.OPENED});
                        this.filter(
                            _converse.rosterview.$('.roster-filter').val() || '',
                            _converse.rosterview.$('.filter-type').val()
                        );
                    }
                },

                onContactGroupChange: function (contact) {
                    var in_this_group = _.includes(contact.get('groups'), this.model.get('name'));
                    var cid = contact.get('id');
                    var in_this_overview = !this.get(cid);
                    if (in_this_group && !in_this_overview) {
                        this.model.contacts.remove(cid);
                    } else if (!in_this_group && in_this_overview) {
                        this.addContact(contact);
                    }
                },

                onContactSubscriptionChange: function (contact) {
                    if ((this.model.get('name') === HEADER_PENDING_CONTACTS) && contact.get('subscription') !== 'from') {
                        this.model.contacts.remove(contact.get('id'));
                    }
                },

                onContactRequestChange: function (contact) {
                    if ((this.model.get('name') === HEADER_REQUESTING_CONTACTS) && !contact.get('requesting')) {
                        /* We suppress events, otherwise the remove event will
                         * also cause the contact's view to be removed from the
                         * "Pending Contacts" group.
                         */
                        this.model.contacts.remove(contact.get('id'), {'silent': true});
                        // Since we suppress events, we make sure the view and
                        // contact are removed from this group.
                        this.get(contact.get('id')).remove();
                        this.onRemove(contact);
                    }
                },

                onRemove: function (contact) {
                    this.remove(contact.get('id'));
                    if (this.model.contacts.length === 0) {
                        this.$el.hide();
                    }
                }
            });

            /* -------- Event Handlers ----------- */

            var initRoster = function () {
                /* Create an instance of RosterView once the RosterGroups
                 * collection has been created (in converse-core.js)
                 */
                _converse.rosterview = new _converse.RosterView({
                    'model': _converse.rostergroups
                });
                _converse.rosterview.render();
            };
            _converse.on('rosterInitialized', initRoster);
            _converse.on('rosterReadyAfterReconnection', initRoster);
        }
    });
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, Backbone */

(function (root, factory) {
    define('converse-controlbox',["converse-core",
            "tpl!add_contact_dropdown",
            "tpl!add_contact_form",
            "tpl!change_status_message",
            "tpl!chat_status",
            "tpl!choose_status",
            "tpl!contacts_panel",
            "tpl!contacts_tab",
            "tpl!controlbox",
            "tpl!controlbox_toggle",
            "tpl!login_panel",
            "tpl!login_tab",
            "tpl!search_contact",
            "tpl!status_option",
            "converse-chatview",
            "converse-rosterview"
    ], factory);
}(this, function (
            converse,
            tpl_add_contact_dropdown,
            tpl_add_contact_form,
            tpl_change_status_message,
            tpl_chat_status,
            tpl_choose_status,
            tpl_contacts_panel,
            tpl_contacts_tab,
            tpl_controlbox,
            tpl_controlbox_toggle,
            tpl_login_panel,
            tpl_login_tab,
            tpl_search_contact,
            tpl_status_option
        ) {
    "use strict";

    var USERS_PANEL_ID = 'users';
    // Strophe methods for building stanzas
    var Strophe = converse.env.Strophe,
        utils = converse.env.utils;
    // Other necessary globals
    var $ = converse.env.jQuery,
        _ = converse.env._,
        moment = converse.env.moment;


    converse.plugins.add('converse-controlbox', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            initSession: function () {
                this.controlboxtoggle = new this.ControlBoxToggle();
                this.__super__.initSession.apply(this, arguments);
            },

            initConnection: function () {
                this.__super__.initConnection.apply(this, arguments);
                if (this.connection) {
                    this.addControlBox();
                }
            },

            _tearDown: function () {
                this.__super__._tearDown.apply(this, arguments);
                if (this.rosterview) {
                    this.rosterview.unregisterHandlers();
                    // Removes roster groups
                    this.rosterview.model.off().reset();
                    this.rosterview.each(function (groupview) {
                        groupview.removeAll();
                        groupview.remove();
                    });
                    this.rosterview.removeAll().remove();
                }
            },

            clearSession: function () {
                this.__super__.clearSession.apply(this, arguments);
                if (_.isUndefined(this.connection) && this.connection.connected) {
                    this.chatboxes.get('controlbox').save({'connected': false});
                }
            },

            ChatBoxes: {
                chatBoxMayBeShown: function (chatbox) {
                    return this.__super__.chatBoxMayBeShown.apply(this, arguments) &&
                           chatbox.get('id') !== 'controlbox';
                },

                onChatBoxesFetched: function (collection, resp) {
                    var _converse = this.__super__._converse;
                    this.__super__.onChatBoxesFetched.apply(this, arguments);
                    if (!_.includes(_.map(collection, 'id'), 'controlbox')) {
                        _converse.addControlBox();
                    }
                    this.get('controlbox').save({connected:true});
                },
            },

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var _converse = this.__super__._converse;
                    if (item.get('box_id') === 'controlbox') {
                        var view = this.get(item.get('id'));
                        if (view) {
                            view.model = item;
                            view.initialize();
                            return view;
                        } else {
                            view = new _converse.ControlBoxView({model: item});
                            return this.add(item.get('id'), view);
                        }
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                },

                closeAllChatBoxes: function () {
                    var _converse = this.__super__._converse;
                    this.each(function (view) {
                        if (view.model.get('id') === 'controlbox' &&
                                (_converse.disconnection_cause !== _converse.LOGOUT || _converse.show_controlbox_by_default)) {
                            return;
                        }
                        view.close();
                    });
                    return this;
                },

                getChatBoxWidth: function (view) {
                    var _converse = this.__super__._converse;
                    var controlbox = this.get('controlbox');
                    if (view.model.get('id') === 'controlbox') {
                        /* We return the width of the controlbox or its toggle,
                         * depending on which is visible.
                         */
                        if (!controlbox || !controlbox.$el.is(':visible')) {
                            return _converse.controlboxtoggle.$el.outerWidth(true);
                        } else {
                            return controlbox.$el.outerWidth(true);
                        }
                    } else {
                        return this.__super__.getChatBoxWidth.apply(this, arguments);
                    }
                }
            },


            ChatBox: {
                initialize: function () {
                    if (this.get('id') === 'controlbox') {
                        this.set({
                            'time_opened': moment(0).valueOf(),
                            'num_unread': 0
                        });
                    } else {
                        this.__super__.initialize.apply(this, arguments);
                    }
                },
            },


            ChatBoxView: {
                insertIntoDOM: function () {
                    var _converse = this.__super__._converse;
                    this.$el.insertAfter(_converse.chatboxviews.get("controlbox").$el);
                    return this;
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse,
                __ = _converse.__;

            this.updateSettings({
                allow_logout: true,
                default_domain: undefined,
                show_controlbox_by_default: false,
                sticky_controlbox: false,
                xhr_user_search: false,
                xhr_user_search_url: ''
            });

            var LABEL_CONTACTS = __('Contacts');

            _converse.addControlBox = function () {
                return _converse.chatboxes.add({
                    id: 'controlbox',
                    box_id: 'controlbox',
                    closed: !_converse.show_controlbox_by_default
                });
            };

            _converse.ControlBoxView = _converse.ChatBoxView.extend({
                tagName: 'div',
                className: 'chatbox',
                id: 'controlbox',
                events: {
                    'click a.close-chatbox-button': 'close',
                    'click ul#controlbox-tabs li a': 'switchTab',
                },

                initialize: function () {
                    this.$el.insertAfter(_converse.controlboxtoggle.$el);
                    this.model.on('change:connected', this.onConnected, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('hide', this.hide, this);
                    this.model.on('show', this.show, this);
                    this.model.on('change:closed', this.ensureClosedState, this);
                    this.render();
                    if (this.model.get('connected')) {
                        this.insertRoster();
                    }
                },

                render: function () {
                    if (this.model.get('connected')) {
                        if (_.isUndefined(this.model.get('closed'))) {
                            this.model.set('closed', !_converse.show_controlbox_by_default);
                        }
                    }
                    if (!this.model.get('closed')) {
                        this.show();
                    } else {
                        this.hide();
                    }
                    this.$el.html(tpl_controlbox(
                        _.extend(this.model.toJSON(), {
                            sticky_controlbox: _converse.sticky_controlbox
                        }))
                    );
                    if (!_converse.connection.connected || !_converse.connection.authenticated || _converse.connection.disconnecting) {
                        this.renderLoginPanel();
                    } else if (!this.contactspanel || !this.contactspanel.$el.is(':visible')) {
                        this.renderContactsPanel();
                    }
                    return this;
                },

                onConnected: function () {
                    if (this.model.get('connected')) {
                        this.render().insertRoster();
                        this.model.save();
                    }
                },

                insertRoster: function () {
                    /* Place the rosterview inside the "Contacts" panel.
                     */
                    this.contactspanel.$el.append(_converse.rosterview.$el);
                    return this;
                },

                renderLoginPanel: function () {
                    this.loginpanel = new _converse.LoginPanel({
                        '$parent': this.$el.find('.controlbox-panes'),
                        'model': this
                    });
                    this.loginpanel.render();
                    return this;
                },

                renderContactsPanel: function () {
                    if (_.isUndefined(this.model.get('active-panel'))) {
                        this.model.save({'active-panel': USERS_PANEL_ID});
                    }
                    this.contactspanel = new _converse.ContactsPanel({
                        '$parent': this.$el.find('.controlbox-panes')
                    });
                    this.contactspanel.render();
                    _converse.xmppstatusview = new _converse.XMPPStatusView({
                        'model': _converse.xmppstatus
                    });
                    _converse.xmppstatusview.render();
                },

                close: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (_converse.connection.connected && !_converse.connection.disconnecting) {
                        this.model.save({'closed': true});
                    } else {
                        this.model.trigger('hide');
                    }
                    _converse.emit('controlBoxClosed', this);
                    return this;
                },

                ensureClosedState: function () {
                    if (this.model.get('closed')) {
                        this.hide();
                    } else {
                        this.show();
                    }
                },

                hide: function (callback) {
                    this.$el.addClass('hidden');
                    utils.refreshWebkit();
                    _converse.emit('chatBoxClosed', this);
                    if (!_converse.connection.connected) {
                        _converse.controlboxtoggle.render();
                    }
                    _converse.controlboxtoggle.show(callback);
                    return this;
                },

                onControlBoxToggleHidden: function () {
                    var that = this;
                    utils.fadeIn(this.el, function () {
                        _converse.controlboxtoggle.updateOnlineCount();
                        utils.refreshWebkit();
                        that.model.set('closed', false);
                        _converse.emit('controlBoxOpened', that);
                    });
                },

                show: function () {
                    _converse.controlboxtoggle.hide(
                        this.onControlBoxToggleHidden.bind(this)
                    );
                    return this;
                },

                switchTab: function (ev) {
                    // TODO: automatically focus the relevant input
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $tab = $(ev.target),
                        $sibling = $tab.parent().siblings('li').children('a'),
                        $tab_panel = $($tab.attr('href'));
                    $($sibling.attr('href')).addClass('hidden');
                    $sibling.removeClass('current');
                    $tab.addClass('current');
                    $tab_panel.removeClass('hidden');
                    if (!_.isUndefined(_converse.chatboxes.browserStorage)) {
                        this.model.save({'active-panel': $tab.data('id')});
                    }
                    return this;
                },

                showHelpMessages: function () {
                    /* Override showHelpMessages in ChatBoxView, for now do nothing.
                     *
                     * Parameters:
                     *  (Array) msgs: Array of messages
                     */
                    return;
                }
            });


            _converse.LoginPanel = Backbone.View.extend({
                tagName: 'div',
                id: "login-dialog",
                className: 'controlbox-pane',
                events: {
                    'submit form#converse-login': 'authenticate'
                },

                initialize: function (cfg) {
                    cfg.$parent.html(this.$el.html(
                        tpl_login_panel({
                            'ANONYMOUS': _converse.ANONYMOUS,
                            'EXTERNAL': _converse.EXTERNAL,
                            'LOGIN': _converse.LOGIN,
                            'PREBIND': _converse.PREBIND,
                            'auto_login': _converse.auto_login,
                            'authentication': _converse.authentication,
                            'label_username': __('XMPP Username:'),
                            'label_password': __('Password:'),
                            'label_anon_login': __('Click here to log in anonymously'),
                            'label_login': __('Log In'),
                            'placeholder_username': (_converse.locked_domain || _converse.default_domain) && __('Username') || __('user@server'),
                            'placeholder_password': __('password')
                        })
                    ));
                    this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
                },

                render: function () {
                    this.$tabs.append(tpl_login_tab({label_sign_in: __('Sign in')}));
                    this.$el.find('input#jid').focus();
                    if (!this.$el.is(':visible')) {
                        this.$el.show();
                    }
                    return this;
                },

                authenticate: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $form = $(ev.target);
                    if (_converse.authentication === _converse.ANONYMOUS) {
                        this.connect($form, _converse.jid, null);
                        return;
                    }
                    var $jid_input = $form.find('input[name=jid]'),
                        jid = $jid_input.val(),
                        $pw_input = $form.find('input[name=password]'),
                        password = $pw_input.val(),
                        errors = false;

                    if (!jid) {
                        errors = true;
                        $jid_input.addClass('error');
                    }
                    if (!password && _converse.authentication !== _converse.EXTERNAL)  {
                        errors = true;
                        $pw_input.addClass('error');
                    }
                    if (errors) { return; }
                    if (_converse.locked_domain) {
                        jid = Strophe.escapeNode(jid) + '@' + _converse.locked_domain;
                    } else if (_converse.default_domain && !_.includes(jid, '@')) {
                        jid = jid + '@' + _converse.default_domain;
                    }
                    this.connect($form, jid, password);
                    return false;
                },

                connect: function ($form, jid, password) {
                    var resource;
                    if ($form) {
                        $form.find('input[type=submit]').hide().after('<span class="spinner login-submit"/>');
                    }
                    if (jid) {
                        resource = Strophe.getResourceFromJid(jid);
                        if (!resource) {
                            jid = jid.toLowerCase() + _converse.generateResource();
                        } else {
                            jid = Strophe.getBareJidFromJid(jid).toLowerCase()+'/'+resource;
                        }
                    }
                    _converse.connection.reset();
                    _converse.connection.connect(jid, password, _converse.onConnectStatusChanged);
                },

                remove: function () {
                    this.$tabs.empty();
                    this.$el.parent().empty();
                }
            });


            _converse.XMPPStatusView = Backbone.View.extend({
                el: "span#xmpp-status-holder",

                events: {
                    "click a.choose-xmpp-status": "toggleOptions",
                    "click #fancy-xmpp-status-select a.change-xmpp-status-message": "renderStatusChangeForm",
                    "submit #set-custom-xmpp-status": "setStatusMessage",
                    "click .dropdown dd ul li a": "setStatus"
                },

                initialize: function () {
                    this.model.on("change:status", this.updateStatusUI, this);
                    this.model.on("change:status_message", this.updateStatusUI, this);
                    this.model.on("update-status-ui", this.updateStatusUI, this);
                },

                render: function () {
                    // Replace the default dropdown with something nicer
                    var $select = this.$el.find('select#select-xmpp-status'),
                        chat_status = this.model.get('status') || 'offline',
                        options = $('option', $select),
                        $options_target,
                        options_list = [];
                    this.$el.html(tpl_choose_status());
                    this.$el.find('#fancy-xmpp-status-select')
                            .html(tpl_chat_status({
                                'status_message': this.model.get('status_message') || __("I am %1$s", this.getPrettyStatus(chat_status)),
                                'chat_status': chat_status,
                                'desc_custom_status': __('Click here to write a custom status message'),
                                'desc_change_status': __('Click to change your chat status')
                                }));
                    // iterate through all the <option> elements and add option values
                    options.each(function () {
                        options_list.push(tpl_status_option({
                            'value': $(this).val(),
                            'text': this.text
                        }));
                    });
                    $options_target = this.$el.find("#target dd ul").hide();
                    $options_target.append(options_list.join(''));
                    $select.remove();
                    return this;
                },

                toggleOptions: function (ev) {
                    ev.preventDefault();
                    $(ev.target).parent().parent().siblings('dd').find('ul').toggle('fast');
                },

                renderStatusChangeForm: function (ev) {
                    ev.preventDefault();
                    var status_message = _converse.xmppstatus.get('status_message') || '';
                    var input = tpl_change_status_message({
                        'status_message': status_message,
                        'label_custom_status': __('Custom status'),
                        'label_save': __('Save')
                    });
                    var $xmppstatus = this.$el.find('.xmpp-status');
                    $xmppstatus.parent().addClass('no-border');
                    $xmppstatus.replaceWith(input);
                    this.$el.find('.custom-xmpp-status').focus().focus();
                },

                setStatusMessage: function (ev) {
                    ev.preventDefault();
                    this.model.setStatusMessage($(ev.target).find('input').val());
                },

                setStatus: function (ev) {
                    ev.preventDefault();
                    var $el = $(ev.currentTarget),
                        value = $el.attr('data-value');
                    if (value === 'logout') {
                        this.$el.find(".dropdown dd ul").hide();
                        _converse.logOut();
                    } else {
                        this.model.setStatus(value);
                        this.$el.find(".dropdown dd ul").hide();
                    }
                },

                getPrettyStatus: function (stat) {
                    if (stat === 'chat') {
                        return __('online');
                    } else if (stat === 'dnd') {
                        return __('busy');
                    } else if (stat === 'xa') {
                        return __('away for long');
                    } else if (stat === 'away') {
                        return __('away');
                    } else if (stat === 'offline') {
                        return __('offline');
                    } else {
                        return __(stat) || __('online');
                    }
                },

                updateStatusUI: function (model) {
                    var stat = model.get('status');
                    // For translators: the %1$s part gets replaced with the status
                    // Example, I am online
                    var status_message = model.get('status_message') || __("I am %1$s", this.getPrettyStatus(stat));
                    this.$el.find('#fancy-xmpp-status-select').removeClass('no-border').html(
                        tpl_chat_status({
                            'chat_status': stat,
                            'status_message': status_message,
                            'desc_custom_status': __('Click here to write a custom status message'),
                            'desc_change_status': __('Click to change your chat status')
                        }));
                }
            });


            _converse.ContactsPanel = Backbone.View.extend({
                tagName: 'div',
                className: 'controlbox-pane',
                id: 'users',
                events: {
                    'click a.toggle-xmpp-contact-form': 'toggleContactForm',
                    'submit form.add-xmpp-contact': 'addContactFromForm',
                    'submit form.search-xmpp-contact': 'searchContacts',
                    'click a.subscribe-to-user': 'addContactFromList'
                },

                initialize: function (cfg) {
                    cfg.$parent.append(this.$el);
                    this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
                },

                render: function () {
                    var markup;
                    var widgets = tpl_contacts_panel({
                        label_online: __('Online'),
                        label_busy: __('Busy'),
                        label_away: __('Away'),
                        label_offline: __('Offline'),
                        label_logout: __('Log out'),
                        include_offline_state: _converse.include_offline_state,
                        allow_logout: _converse.allow_logout
                    });
                    var controlbox = _converse.chatboxes.get('controlbox');
                    this.$tabs.append(tpl_contacts_tab({
                        'label_contacts': LABEL_CONTACTS,
                        'is_current': controlbox.get('active-panel') === USERS_PANEL_ID
                    }));
                    if (_converse.xhr_user_search) {
                        markup = tpl_search_contact({
                            label_contact_name: __('Contact name'),
                            label_search: __('Search')
                        });
                    } else {
                        markup = tpl_add_contact_form({
                            label_contact_username: __('e.g. user@example.org'),
                            label_add: __('Add')
                        });
                    }
                    if (_converse.allow_contact_requests) {
                        widgets += tpl_add_contact_dropdown({
                            label_click_to_chat: __('Click to add new chat contacts'),
                            label_add_contact: __('Add a contact')
                        });
                    }
                    this.$el.html(widgets);
                    this.$el.find('.search-xmpp ul').append(markup);
                    if (controlbox.get('active-panel') !== USERS_PANEL_ID) {
                        this.$el.addClass('hidden');
                    }
                    return this;
                },

                toggleContactForm: function (ev) {
                    ev.preventDefault();
                    this.$el.find('.search-xmpp').toggle('fast', function () {
                        if ($(this).is(':visible')) {
                            $(this).find('input.username').focus();
                        }
                    });
                },

                searchContacts: function (ev) {
                    ev.preventDefault();
                    $.getJSON(_converse.xhr_user_search_url+ "?q=" + $(ev.target).find('input.username').val(), function (data) {
                        var $ul= $('.search-xmpp ul');
                        $ul.find('li.found-user').remove();
                        $ul.find('li.chat-info').remove();
                        if (!data.length) {
                            $ul.append('<li class="chat-info">'+__('No users found')+'</li>');
                        }
                        $(data).each(function (idx, obj) {
                            $ul.append(
                                $('<li class="found-user"></li>')
                                .append(
                                    $('<a class="subscribe-to-user" href="#" title="'+__('Click to add as a chat contact')+'"></a>')
                                    .attr('data-recipient', Strophe.getNodeFromJid(obj.id)+"@"+Strophe.getDomainFromJid(obj.id))
                                    .text(obj.fullname)
                                )
                            );
                        });
                    });
                },

                addContactFromForm: function (ev) {
                    ev.preventDefault();
                    var $input = $(ev.target).find('input');
                    var jid = $input.val();
                    if (! jid) {
                        // this is not a valid JID
                        $input.addClass('error');
                        return;
                    }
                    _converse.roster.addAndSubscribe(jid);
                    $('.search-xmpp').hide();
                },

                addContactFromList: function (ev) {
                    ev.preventDefault();
                    var $target = $(ev.target),
                        jid = $target.attr('data-recipient'),
                        name = $target.text();
                    _converse.roster.addAndSubscribe(jid, name);
                    $target.parent().remove();
                    $('.search-xmpp').hide();
                }
            });


            _converse.ControlBoxToggle = Backbone.View.extend({
                tagName: 'a',
                className: 'toggle-controlbox hidden',
                id: 'toggle-controlbox',
                events: {
                    'click': 'onClick'
                },
                attributes: {
                    'href': "#"
                },

                initialize: function () {
                    _converse.chatboxviews.$el.prepend(this.render());
                    this.updateOnlineCount();
                    var that = this;
                    _converse.on('initialized', function () {
                        _converse.roster.on("add", that.updateOnlineCount, that);
                        _converse.roster.on('change', that.updateOnlineCount, that);
                        _converse.roster.on("destroy", that.updateOnlineCount, that);
                        _converse.roster.on("remove", that.updateOnlineCount, that);
                    });
                },

                render: function () {
                    // We let the render method of ControlBoxView decide whether
                    // the ControlBox or the Toggle must be shown. This prevents
                    // artifacts (i.e. on page load the toggle is shown only to then
                    // seconds later be hidden in favor of the control box).
                    return this.$el.html(
                        tpl_controlbox_toggle({
                            'label_toggle': __('Toggle chat')
                        })
                    );
                },

                updateOnlineCount: _.debounce(function () {
                    if (_.isUndefined(_converse.roster)) {
                        return;
                    }
                    var $count = this.$('#online-count');
                    $count.text('('+_converse.roster.getNumOnlineContacts()+')');
                    if (!$count.is(':visible')) {
                        $count.show();
                    }
                }, _converse.animate ? 100 : 0),

                hide: function (callback) {
                    this.el.classList.add('hidden');
                    callback();
                },

                show: function (callback) {
                    utils.fadeIn(this.el, callback);
                },

                showControlBox: function () {
                    var controlbox = _converse.chatboxes.get('controlbox');
                    if (!controlbox) {
                        controlbox = _converse.addControlBox();
                    }
                    if (_converse.connection.connected) {
                        controlbox.save({closed: false});
                    } else {
                        controlbox.trigger('show');
                    }
                },

                onClick: function (e) {
                    e.preventDefault();
                    if ($("div#controlbox").is(':visible')) {
                        var controlbox = _converse.chatboxes.get('controlbox');
                        if (_converse.connection.connected) {
                            controlbox.save({closed: true});
                        } else {
                            controlbox.trigger('hide');
                        }
                    } else {
                        this.showControlBox();
                    }
                }
            });

            var disconnect =  function () {
                /* Upon disconnection, set connected to `false`, so that if
                 * we reconnect,
                 * "onConnected" will be called, to fetch the roster again and
                 * to send out a presence stanza.
                 */
                var view = _converse.chatboxviews.get('controlbox');
                view.model.set({connected:false});
                view.$('#controlbox-tabs').empty();
                view.renderLoginPanel();
            };
            _converse.on('disconnected', disconnect);

            var afterReconnected = function () {
                /* After reconnection makes sure the controlbox's is aware.
                 */
                var view = _converse.chatboxviews.get('controlbox');
                if (view.model.get('connected')) {
                    _converse.chatboxviews.get("controlbox").onConnected();
                } else {
                    view.model.set({connected:true});
                }
            };
            _converse.on('reconnected', afterReconnected);
        }
    });
}));


define('tpl!chatarea', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<div class="chat-area">\n    <div class="chat-content ';
 if (show_send_button) { ;
__p += 'chat-content-sendbutton';
 } ;
__p += '"></div>\n    <div class="new-msgs-indicator hidden">▼ ' +
__e( unread_msgs ) +
' ▼</div>\n    <form class="sendXMPPMessage" action="" method="post">\n        ';
 if (show_toolbar) { ;
__p += '\n            <ul class="chat-toolbar no-text-select"></ul>\n        ';
 } ;
__p += '\n        <textarea type="text" class="chat-textarea ';
 if (show_send_button) { ;
__p += 'chat-textarea-send-button';
 } ;
__p += '"\n            placeholder="' +
__e(label_message) +
'"/>\n    ';
 if (show_send_button) { ;
__p += '\n        <button type="button" class="pure-button send-button">Send</button>\n    ';
 } ;
__p += '\n    </form>\n</div>\n';

}
return __p
};});


define('tpl!chatroom', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '';
with (obj) {
__p += '<div class="flyout box-flyout">\n    <div class="chat-head chat-head-chatroom"></div>\n    <div class="chat-body chatroom-body"><span class="spinner centered"/></div>\n</div>\n';

}
return __p
};});


define('tpl!chatroom_features', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 if (has_features) { ;
__p += '\n<p class="occupants-heading">' +
__e(label_features) +
'</p>\n';
 } ;
__p += '\n<ul class="features-list">\n';
 if (passwordprotected) { ;
__p += '\n<li class="feature" title="' +
__e( tt_passwordprotected ) +
'"><span class="icon-lock-2"></span>' +
__e( label_passwordprotected ) +
'</li>\n';
 } ;
__p += '\n';
 if (unsecured) { ;
__p += '\n<li class="feature" title="' +
__e( tt_unsecured ) +
'"><span class="icon-unlocked"></span>' +
__e( label_unsecured ) +
'</li>\n';
 } ;
__p += '\n';
 if (hidden) { ;
__p += '\n<li class="feature" title="' +
__e( tt_hidden ) +
'"><span class="icon-eye-blocked"></span>' +
__e( label_hidden ) +
'</li>\n';
 } ;
__p += '\n';
 if (public) { ;
__p += '\n<li class="feature" title="' +
__e( tt_public ) +
'"><span class="icon-eye"></span>' +
__e( label_public ) +
'</li>\n';
 } ;
__p += '\n';
 if (membersonly) { ;
__p += '\n<li class="feature" title="' +
__e( tt_membersonly ) +
'"><span class="icon-address-book"></span>' +
__e( label_membersonly ) +
'</li>\n';
 } ;
__p += '\n';
 if (open) { ;
__p += '\n<li class="feature" title="' +
__e( tt_open ) +
'"><span class="icon-globe"></span>' +
__e( label_open ) +
'</li>\n';
 } ;
__p += '\n';
 if (persistent) { ;
__p += '\n<li class="feature" title="' +
__e( tt_persistent ) +
'"><span class="icon-save"></span>' +
__e( label_persistent ) +
'</li>\n';
 } ;
__p += '\n';
 if (temporary) { ;
__p += '\n<li class="feature" title="' +
__e( tt_temporary ) +
'"><span class="icon-snowflake"></span>' +
__e( label_temporary ) +
'</li>\n';
 } ;
__p += '\n';
 if (nonanonymous) { ;
__p += '\n<li class="feature" title="' +
__e( tt_nonanonymous ) +
'"><span class="icon-idcard-dark"></span>' +
__e( label_nonanonymous ) +
'</li>\n';
 } ;
__p += '\n';
 if (semianonymous) { ;
__p += '\n<li class="feature" title="' +
__e( tt_semianonymous ) +
'"><span class="icon-info"></span>' +
__e( label_semianonymous ) +
'</li>\n';
 } ;
__p += '\n';
 if (moderated) { ;
__p += '\n<li class="feature" title="' +
__e( tt_moderated ) +
'"><span class="icon-legal"></span>' +
__e( label_moderated ) +
'</li>\n';
 } ;
__p += '\n';
 if (unmoderated) { ;
__p += '\n<li class="feature" title="' +
__e( tt_unmoderated ) +
'"><span class="icon-info"></span>' +
__e( label_unmoderated ) +
'</li>\n';
 } ;
__p += '\n';
 if (mam_enabled) { ;
__p += '\n<li class="feature" title="' +
__e( tt_mam_enabled ) +
'"><span class="icon-database"></span>' +
__e( label_mam_enabled ) +
'</li>\n';
 } ;
__p += '\n</ul>\n';

}
return __p
};});


define('tpl!chatroom_form', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '';
with (obj) {
__p += '<div class="chatroom-form-container">\n    <form class="pure-form pure-form-stacked converse-form chatroom-form">\n        <fieldset>\n            <span class="spinner centered"/>\n        </fieldset>\n    </form>\n</div>\n';

}
return __p
};});


define('tpl!chatroom_head', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<a class="chatbox-btn close-chatbox-button icon-close" title="' +
__e(info_close) +
'"></a>\n';
 if (affiliation == 'owner') { ;
__p += '\n    <a class="chatbox-btn configure-chatroom-button icon-wrench" title="' +
__e(info_configure) +
' "></a>\n';
 } ;
__p += '\n<div class="chat-title" title="' +
__e(jid) +
'">\n    ' +
__e( name ) +
'\n    <p class="chatroom-description">' +
__e( description ) +
'<p/>\n</div>\n';

}
return __p
};});


define('tpl!chatroom_invite', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<form class="pure-form room-invite">\n    <input class="invited-contact" placeholder="' +
__e(label_invitation) +
'" type="text"/>\n</form>\n';

}
return __p
};});


define('tpl!chatroom_nickname_form', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div class="chatroom-form-container">\n    <form class="pure-form converse-form chatroom-form converse-centered-form">\n        <fieldset>\n            <label>' +
__e(heading) +
'</label>\n            <p class="validation-message">' +
__e(validation_message) +
'</p>\n            <input type="text" required="required" name="nick" class="new-chatroom-nick" placeholder="' +
__e(label_nickname) +
'"/>\n        </fieldset>\n        <fieldset>\n            <input type="submit" class="pure-button button-primary" name="join" value="' +
__e(label_join) +
'"/>\n        </fieldset>\n    </form>\n</div>\n';

}
return __p
};});


define('tpl!chatroom_password_form', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div class="chatroom-form-container">\n    <form class="pure-form converse-form chatroom-form">\n        <fieldset>\n            <legend>' +
__e(heading) +
'</legend>\n            <label>' +
__e(label_password) +
'</label>\n            <input type="password" name="password"/>\n        </fieldset>\n        <fieldset>\n            <input class="pure-button button-primary" type="submit" value="' +
__e(label_submit) +
'"/>\n        </fieldset>\n    </form>\n</div>\n';

}
return __p
};});


define('tpl!chatroom_sidebar', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<!-- <div class="occupants"> -->\n<p class="occupants-heading">' +
__e(label_occupants) +
'</p>\n<ul class="occupant-list"></ul>\n<div class="chatroom-features"></div>\n<!-- </div> -->\n';

}
return __p
};});


define('tpl!chatroom_toolbar', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 if (show_emoticons)  { ;
__p += '\n    <li class="toggle-smiley icon-happy" title="' +
__e(label_insert_smiley) +
'">\n        <ul>\n            <li><a class="icon-smiley" href="#" data-emoticon=":)"></a></li>\n            <li><a class="icon-wink" href="#" data-emoticon=";)"></a></li>\n            <li><a class="icon-grin" href="#" data-emoticon=":D"></a></li>\n            <li><a class="icon-tongue" href="#" data-emoticon=":P"></a></li>\n            <li><a class="icon-cool" href="#" data-emoticon="8)"></a></li>\n            <li><a class="icon-evil" href="#" data-emoticon=">:)"></a></li>\n            <li><a class="icon-confused" href="#" data-emoticon=":S"></a></li>\n            <li><a class="icon-wondering" href="#" data-emoticon=":\\"></a></li>\n            <li><a class="icon-angry" href="#" data-emoticon=">:("></a></li>\n            <li><a class="icon-sad" href="#" data-emoticon=":("></a></li>\n            <li><a class="icon-shocked" href="#" data-emoticon=":O"></a></li>\n            <li><a class="icon-thumbs-up" href="#" data-emoticon="(^.^)b"></a></li>\n            <li><a class="icon-heart" href="#" data-emoticon="<3"></a></li>\n        </ul>\n    </li>\n';
 } ;
__p += '\n';
 if (show_call_button)  { ;
__p += '\n<li class="toggle-call"><a class="icon-phone" title="' +
__e(label_start_call) +
'"></a></li>\n';
 } ;
__p += '\n';
 if (show_occupants_toggle)  { ;
__p += '\n<li class="toggle-occupants"><a class="icon-hide-users" title="' +
__e(label_hide_occupants) +
'"></a></li>\n';
 } ;
__p += '\n';
 if (show_clear_button)  { ;
__p += '\n<li class="toggle-clear"><a class="icon-remove" title="' +
__e(label_clear) +
'"></a></li>\n';
 } ;
__p += '\n\n';

}
return __p
};});


define('tpl!chatrooms_tab', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<li><a class="s ';
 if (is_current) { ;
__p += ' current ';
 } ;
__p += '"\n       data-id="chatrooms" href="#chatrooms">\n    ' +
((__t = (label_rooms)) == null ? '' : __t) +
'\n</a></li>\n';

}
return __p
};});


define('tpl!info', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div class="chat-info">' +
__e(message) +
'</div>\n';

}
return __p
};});


define('tpl!occupant', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<li class="' +
__e( role ) +
' occupant" id="' +
__e( id ) +
'"\n    ';
 if (role === "moderator") { ;
__p += '\n       title="' +
__e( jid ) +
' ' +
__e( desc_moderator ) +
' ' +
__e( hint_occupant ) +
'"\n    ';
 } ;
__p += '\n    ';
 if (role === "occupant") { ;
__p += '\n       title="' +
__e( jid ) +
' ' +
__e( desc_occupant ) +
' ' +
__e( hint_occupant ) +
'"\n    ';
 } ;
__p += '\n    ';
 if (role === "visitor") { ;
__p += '\n       title="' +
__e( jid ) +
' ' +
__e( desc_visitor ) +
' ' +
__e( hint_occupant ) +
'"\n    ';
 } ;
__p += '\n    ';
 if (!_.includes(["visitor", "occupant", "moderator"], role)) { ;
__p += '\n       title="' +
__e( jid ) +
' ' +
__e( hint_occupant ) +
'"\n       ';
 } ;
__p += '><div class="occupant-status occupant-' +
__e(show) +
' circle" title="' +
__e(hint_show) +
'"></div>' +
__e(nick) +
'</li>\n';

}
return __p
};});


define('tpl!room_description', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<!-- FIXME: check markup in mockup -->\n<div class="room-info">\n<p class="room-info"><strong>' +
__e(label_desc) +
'</strong> ' +
__e(desc) +
'</p>\n<p class="room-info"><strong>' +
__e(label_occ) +
'</strong> ' +
__e(occ) +
'</p>\n<p class="room-info"><strong>' +
__e(label_features) +
'</strong>\n    <ul>\n        ';
 if (passwordprotected) { ;
__p += '\n        <li class="room-info locked">' +
__e(label_requires_auth) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (hidden) { ;
__p += '\n        <li class="room-info">' +
__e(label_hidden) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (membersonly) { ;
__p += '\n        <li class="room-info">' +
__e(label_requires_invite) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (moderated) { ;
__p += '\n        <li class="room-info">' +
__e(label_moderated) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (nonanonymous) { ;
__p += '\n        <li class="room-info">' +
__e(label_non_anon) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (open) { ;
__p += '\n        <li class="room-info">' +
__e(label_open_room) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (persistent) { ;
__p += '\n        <li class="room-info">' +
__e(label_permanent_room) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (publicroom) { ;
__p += '\n        <li class="room-info">' +
__e(label_public) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (semianonymous) { ;
__p += '\n        <li class="room-info">' +
__e(label_semi_anon) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (temporary) { ;
__p += '\n        <li class="room-info">' +
__e(label_temp_room) +
'</li>\n        ';
 } ;
__p += '\n        ';
 if (unmoderated) { ;
__p += '\n        <li class="room-info">' +
__e(label_unmoderated) +
'</li>\n        ';
 } ;
__p += '\n    </ul>\n</p>\n</div>\n';

}
return __p
};});


define('tpl!room_item', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<dd class="available-chatroom">\n<a class="open-room" data-room-jid="' +
__e(jid) +
'"\n   title="' +
__e(open_title) +
'" href="#">' +
__e(_.escape(name)) +
'</a>\n<a class="room-info icon-room-info" data-room-jid="' +
__e(jid) +
'"\n   title="' +
__e(info_title) +
'" href="#">&nbsp;</a>\n</dd>\n';

}
return __p
};});


define('tpl!room_panel', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<form class="pure-form pure-form-stacked converse-form add-chatroom" action="" method="post">\n    <fieldset>\n        <label>' +
((__t = (label_room_name)) == null ? '' : __t) +
'</label>\n        <input type="text" name="chatroom" class="new-chatroom-name" placeholder="' +
((__t = (label_room_name)) == null ? '' : __t) +
'"/>\n        ';
 if (server_input_type != 'hidden') { ;
__p += '\n            <label' +
((__t = (server_label_global_attr)) == null ? '' : __t) +
'>' +
((__t = (label_server)) == null ? '' : __t) +
'</label>\n        ';
 } ;
__p += '\n        <input type="' +
((__t = (server_input_type)) == null ? '' : __t) +
'" name="server" class="new-chatroom-server" placeholder="' +
((__t = (label_server)) == null ? '' : __t) +
'"/>\n        <input type="submit" class="pure-button button-primary" name="join" value="' +
((__t = (label_join)) == null ? '' : __t) +
'"/>\n        <input type="button" class="pure-button button-secondary" name="show" id="show-rooms" value="' +
((__t = (label_show_rooms)) == null ? '' : __t) +
'"/>\n    </fieldset>\n</form>\n<dl id="available-chatrooms" class="rooms-list"></dl>\n';

}
return __p
};});

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

/* This is a Converse.js plugin which add support for multi-user chat rooms, as
 * specified in XEP-0045 Multi-user chat.
 */
(function (root, factory) {
    define('converse-muc',[
            "converse-core",
            "tpl!chatarea",
            "tpl!chatroom",
            "tpl!chatroom_features",
            "tpl!chatroom_form",
            "tpl!chatroom_head",
            "tpl!chatroom_invite",
            "tpl!chatroom_nickname_form",
            "tpl!chatroom_password_form",
            "tpl!chatroom_sidebar",
            "tpl!chatroom_toolbar",
            "tpl!chatrooms_tab",
            "tpl!info",
            "tpl!occupant",
            "tpl!room_description",
            "tpl!room_item",
            "tpl!room_panel",
            "awesomplete",
            "converse-chatview"
    ], factory);
}(this, function (
            converse,
            tpl_chatarea,
            tpl_chatroom,
            tpl_chatroom_features,
            tpl_chatroom_form,
            tpl_chatroom_head,
            tpl_chatroom_invite,
            tpl_chatroom_nickname_form,
            tpl_chatroom_password_form,
            tpl_chatroom_sidebar,
            tpl_chatroom_toolbar,
            tpl_chatrooms_tab,
            tpl_info,
            tpl_occupant,
            tpl_room_description,
            tpl_room_item,
            tpl_room_panel,
            Awesomplete
    ) {
    "use strict";
    var ROOMS_PANEL_ID = 'chatrooms';

    // Strophe methods for building stanzas
    var Strophe = converse.env.Strophe,
        $iq = converse.env.$iq,
        $build = converse.env.$build,
        $msg = converse.env.$msg,
        $pres = converse.env.$pres,
        b64_sha1 = converse.env.b64_sha1,
        sizzle = converse.env.sizzle,
        utils = converse.env.utils;
    // Other necessary globals
    var $ = converse.env.jQuery,
        _ = converse.env._,
        moment = converse.env.moment;

    // Add Strophe Namespaces
    Strophe.addNamespace('MUC_ADMIN', Strophe.NS.MUC + "#admin");
    Strophe.addNamespace('MUC_OWNER', Strophe.NS.MUC + "#owner");
    Strophe.addNamespace('MUC_REGISTER', "jabber:iq:register");
    Strophe.addNamespace('MUC_ROOMCONF', Strophe.NS.MUC + "#roomconfig");
    Strophe.addNamespace('MUC_USER', Strophe.NS.MUC + "#user");

    var ROOM_FEATURES = [
        'passwordprotected', 'unsecured', 'hidden',
        'public', 'membersonly', 'open', 'persistent',
        'temporary', 'nonanonymous', 'semianonymous',
        'moderated', 'unmoderated', 'mam_enabled'
    ];
    var ROOM_FEATURES_MAP = {
        'passwordprotected': 'unsecured',
        'unsecured': 'passwordprotected',
        'hidden': 'public',
        'public': 'hidden',
        'membersonly': 'open',
        'open': 'membersonly',
        'persistent': 'temporary',
        'temporary': 'persistent',
        'nonanonymous': 'semianonymous',
        'semianonymous': 'nonanonymous',
        'moderated': 'unmoderated',
        'unmoderated': 'moderated'
    };
    var ROOMSTATUS = {
        CONNECTED: 0,
        CONNECTING: 1,
        NICKNAME_REQUIRED: 2,
        PASSWORD_REQUIRED: 3,
        DISCONNECTED: 4,
        ENTERED: 5
    };

    converse.plugins.add('converse-muc', {
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
        optional_dependencies: ["converse-controlbox"],

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            Features: {
                addClientFeatures: function () {
                    var _converse = this.__super__._converse;
                    this.__super__.addClientFeatures.apply(this, arguments);
                    if (_converse.allow_muc_invitations) {
                        _converse.connection.disco.addFeature('jabber:x:conference'); // Invites
                    }
                    if (_converse.allow_muc) {
                        _converse.connection.disco.addFeature(Strophe.NS.MUC);
                    }
                }
            },

            ControlBoxView: {
                renderContactsPanel: function () {
                    var _converse = this.__super__._converse;
                    this.__super__.renderContactsPanel.apply(this, arguments);
                    if (_converse.allow_muc) {
                        this.roomspanel = new _converse.RoomsPanel({
                            '$parent': this.$el.find('.controlbox-panes'),
                            'model': new (Backbone.Model.extend({
                                id: b64_sha1('converse.roomspanel'+_converse.bare_jid), // Required by sessionStorage
                                browserStorage: new Backbone.BrowserStorage[_converse.storage](
                                    b64_sha1('converse.roomspanel'+_converse.bare_jid))
                            }))()
                        });
                        this.roomspanel.render().model.fetch();
                        if (!this.roomspanel.model.get('nick')) {
                            this.roomspanel.model.save({
                                nick: Strophe.getNodeFromJid(_converse.bare_jid)
                            });
                        }
                    }
                },

                onConnected: function () {
                    var _converse = this.__super__._converse;
                    this.__super__.onConnected.apply(this, arguments);
                    if (!this.model.get('connected')) {
                        return;
                    }
                    if (_.isUndefined(_converse.muc_domain)) {
                        _converse.features.off('add', this.featureAdded, this);
                        _converse.features.on('add', this.featureAdded, this);
                        // Features could have been added before the controlbox was
                        // initialized. We're only interested in MUC
                        var feature = _converse.features.findWhere({
                            'var': Strophe.NS.MUC
                        });
                        if (feature) {
                            this.featureAdded(feature);
                        }
                    } else {
                        this.setMUCDomain(_converse.muc_domain);
                    }
                },

                setMUCDomain: function (domain) {
                    this.roomspanel.model.save({'muc_domain': domain});
                    var $server= this.$el.find('input.new-chatroom-server');
                    if (!$server.is(':focus')) {
                        $server.val(this.roomspanel.model.get('muc_domain'));
                    }
                },

                featureAdded: function (feature) {
                    var _converse = this.__super__._converse;
                    if ((feature.get('var') === Strophe.NS.MUC) && (_converse.allow_muc)) {
                        this.setMUCDomain(feature.get('from'));
                    }
                }
            },

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var _converse = this.__super__._converse;
                    var view = this.get(item.get('id'));
                    if (!view && item.get('type') === 'chatroom') {
                        view = new _converse.ChatRoomView({'model': item});
                        return this.add(item.get('id'), view);
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse,
                __ = _converse.__,
                ___ = _converse.___;
            // XXX: Inside plugins, all calls to the translation machinery
            // (e.g. utils.__) should only be done in the initialize function.
            // If called before, we won't know what language the user wants,
            // and it'll fall back to English.

            /* http://xmpp.org/extensions/xep-0045.html
             * ----------------------------------------
             * 100 message      Entering a room         Inform user that any occupant is allowed to see the user's full JID
             * 101 message (out of band)                Affiliation change  Inform user that his or her affiliation changed while not in the room
             * 102 message      Configuration change    Inform occupants that room now shows unavailable members
             * 103 message      Configuration change    Inform occupants that room now does not show unavailable members
             * 104 message      Configuration change    Inform occupants that a non-privacy-related room configuration change has occurred
             * 110 presence     Any room presence       Inform user that presence refers to one of its own room occupants
             * 170 message or initial presence          Configuration change    Inform occupants that room logging is now enabled
             * 171 message      Configuration change    Inform occupants that room logging is now disabled
             * 172 message      Configuration change    Inform occupants that the room is now non-anonymous
             * 173 message      Configuration change    Inform occupants that the room is now semi-anonymous
             * 174 message      Configuration change    Inform occupants that the room is now fully-anonymous
             * 201 presence     Entering a room         Inform user that a new room has been created
             * 210 presence     Entering a room         Inform user that the service has assigned or modified the occupant's roomnick
             * 301 presence     Removal from room       Inform user that he or she has been banned from the room
             * 303 presence     Exiting a room          Inform all occupants of new room nickname
             * 307 presence     Removal from room       Inform user that he or she has been kicked from the room
             * 321 presence     Removal from room       Inform user that he or she is being removed from the room because of an affiliation change
             * 322 presence     Removal from room       Inform user that he or she is being removed from the room because the room has been changed to members-only and the user is not a member
             * 332 presence     Removal from room       Inform user that he or she is being removed from the room because of a system shutdown
             */
            _converse.muc = {
                info_messages: {
                    100: __('This room is not anonymous'),
                    102: __('This room now shows unavailable members'),
                    103: __('This room does not show unavailable members'),
                    104: __('The room configuration has changed'),
                    170: __('Room logging is now enabled'),
                    171: __('Room logging is now disabled'),
                    172: __('This room is now no longer anonymous'),
                    173: __('This room is now semi-anonymous'),
                    174: __('This room is now fully-anonymous'),
                    201: __('A new room has been created')
                },

                disconnect_messages: {
                    301: __('You have been banned from this room'),
                    307: __('You have been kicked from this room'),
                    321: __("You have been removed from this room because of an affiliation change"),
                    322: __("You have been removed from this room because the room has changed to members-only and you're not a member"),
                    332: __("You have been removed from this room because the MUC (Multi-user chat) service is being shut down.")
                },

                action_info_messages: {
                    /* XXX: Note the triple underscore function and not double
                    * underscore.
                    *
                    * This is a hack. We can't pass the strings to __ because we
                    * don't yet know what the variable to interpolate is.
                    *
                    * Triple underscore will just return the string again, but we
                    * can then at least tell gettext to scan for it so that these
                    * strings are picked up by the translation machinery.
                    */
                    301: ___("%1$s has been banned"),
                    303: ___("%1$s's nickname has changed"),
                    307: ___("%1$s has been kicked out"),
                    321: ___("%1$s has been removed because of an affiliation change"),
                    322: ___("%1$s has been removed for not being a member")
                },

                new_nickname_messages: {
                    210: ___('Your nickname has been automatically set to: %1$s'),
                    303: ___('Your nickname has been changed to: %1$s')
                }
            };

            // Configuration values for this plugin
            // ====================================
            // Refer to docs/source/configuration.rst for explanations of these
            // configuration settings.
            this.updateSettings({
                allow_muc: true,
                allow_muc_invitations: true,
                auto_join_on_invite: false,
                auto_join_rooms: [],
                auto_list_rooms: false,
                hide_muc_server: false,
                muc_disable_moderator_commands: false,
                muc_domain: undefined,
                muc_history_max_stanzas: undefined,
                muc_instant_rooms: true,
                muc_nickname_from_jid: false,
                muc_show_join_leave: true,
                visible_toolbar_buttons: {
                    'toggle_occupants': true
                },
            });

            _converse.createChatRoom = function (settings) {
                /* Creates a new chat room, making sure that certain attributes
                 * are correct, for example that the "type" is set to
                 * "chatroom".
                 */
                settings = _.extend(
                    _.zipObject(ROOM_FEATURES, _.map(ROOM_FEATURES, _.stubFalse)),
                    settings
                );
                return _converse.chatboxviews.showChat(
                    _.extend({
                        'affiliation': null,
                        'connection_status': ROOMSTATUS.DISCONNECTED,
                        'description': '',
                        'features_fetched': false,
                        'roomconfig': {},
                        'type': 'chatroom',
                    }, settings)
                );
            };

            _converse.ChatRoomView = _converse.ChatBoxView.extend({
                /* Backbone View which renders a chat room, based upon the view
                 * for normal one-on-one chat boxes.
                 */
                length: 300,
                tagName: 'div',
                className: 'chatbox chatroom hidden',
                is_chatroom: true,
                events: {
                    'click .close-chatbox-button': 'close',
                    'click .configure-chatroom-button': 'configureChatRoom',
                    'click .toggle-smiley': 'toggleEmoticonMenu',
                    'click .toggle-smiley ul li': 'insertEmoticon',
                    'click .toggle-clear': 'clearChatRoomMessages',
                    'click .toggle-call': 'toggleCall',
                    'click .toggle-occupants a': 'toggleOccupants',
                    'click .new-msgs-indicator': 'viewUnreadMessages',
                    'click .occupant': 'onOccupantClicked',
                    'keypress .chat-textarea': 'keyPressed',
                    'click .send-button': 'onSendButtonClicked'
                },

                initialize: function () {
                    var that = this;
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('change:connection_status', this.afterConnected, this);
                    this.model.on('change:affiliation', this.renderHeading, this);
                    this.model.on('change:chat_state', this.sendChatState, this);
                    this.model.on('change:description', this.renderHeading, this);
                    this.model.on('change:name', this.renderHeading, this);

                    this.createOccupantsView();
                    this.render().insertIntoDOM();
                    this.registerHandlers();

                    if (this.model.get('connection_status') !==  ROOMSTATUS.ENTERED) {
                        this.getRoomFeatures().always(function () {
                            that.join();
                            that.fetchMessages();
                            _converse.emit('chatRoomOpened', that);
                        });
                    } else {
                        this.fetchMessages();
                        _converse.emit('chatRoomOpened', that);
                    }
                },

                render: function () {
                    this.el.setAttribute('id', this.model.get('box_id'));
                    this.el.innerHTML = tpl_chatroom();
                    this.renderHeading();
                    this.renderChatArea();
                    if (this.model.get('connection_status') !== ROOMSTATUS.ENTERED) {
                        this.showSpinner();
                    }
                    utils.refreshWebkit();
                    return this;
                },

                renderHeading: function () {
                    /* Render the heading UI of the chat room. */
                    this.el.querySelector('.chat-head-chatroom').innerHTML = this.generateHeadingHTML();
                },

                renderChatArea: function () {
                    /* Render the UI container in which chat room messages will
                     * appear.
                     */
                    if (!this.$('.chat-area').length) {
                        this.$('.chatroom-body').empty()
                            .append(tpl_chatarea({
                                    'unread_msgs': __('You have unread messages'),
                                    'show_toolbar': _converse.show_toolbar,
                                    'label_message': __('Message'),
                                    'show_send_button': _converse.show_send_button
                                }))
                            .append(this.occupantsview.$el);
                        this.renderToolbar(tpl_chatroom_toolbar);
                        this.$content = this.$el.find('.chat-content');
                    }
                    this.toggleOccupants(null, true);
                    return this;
                },

                createOccupantsView: function () {
                    /* Create the ChatRoomOccupantsView Backbone.View
                     */
                    var model = new _converse.ChatRoomOccupants();
                    model.chatroomview = this;
                    this.occupantsview = new _converse.ChatRoomOccupantsView({'model': model});
                    var id = b64_sha1('converse.occupants'+_converse.bare_jid+this.model.get('jid'));
                    this.occupantsview.model.browserStorage = new Backbone.BrowserStorage.session(id);
                    this.occupantsview.render();
                    this.occupantsview.model.fetch({add:true});
                    return this;
                },

                insertIntoDOM: function () {
                    if (document.querySelector('body').contains(this.el)) {
                        return;
                    }
                    var view = _converse.chatboxviews.get("controlbox");
                    if (view) {
                        this.$el.insertAfter(view.$el);
                    } else {
                        $('#conversejs').prepend(this.$el);
                    }
                    return this;
                },

                generateHeadingHTML: function () {
                    /* Returns the heading HTML to be rendered.
                     */
                    return tpl_chatroom_head(
                        _.extend(this.model.toJSON(), {
                            info_close: __('Close and leave this room'),
                            info_configure: __('Configure this room'),
                            description: this.model.get('description') || ''
                    }));
                },

                afterShown: function () {
                    /* Override from converse-chatview, specifically to avoid
                     * the 'active' chat state from being sent out prematurely.
                     *
                     * This is instead done in `afterConnected` below.
                     */
                    if (_converse.connection.connected) {
                        // Without a connection, we haven't yet initialized
                        // localstorage
                        this.model.save();
                    }
                    this.occupantsview.setOccupantsHeight();
                },

                afterConnected: function () {
                    if (this.model.get('connection_status') === ROOMSTATUS.ENTERED) {
                        this.setChatState(_converse.ACTIVE);
                        this.scrollDown();
                        this.focus();
                    }
                },

                getExtraMessageClasses: function (attrs) {
                    var extra_classes = _converse.ChatBoxView.prototype
                            .getExtraMessageClasses.apply(this, arguments);

                    if (this.is_chatroom && attrs.sender === 'them' &&
                            (new RegExp("\\b"+this.model.get('nick')+"\\b")).test(attrs.message)
                        ) {
                        // Add special class to mark groupchat messages
                        // in which we are mentioned.
                        extra_classes += ' mentioned';
                    }
                    return extra_classes;
                },

                getToolbarOptions: function () {
                    return _.extend(
                        _converse.ChatBoxView.prototype.getToolbarOptions.apply(this, arguments),
                        {
                          label_hide_occupants: __('Hide the list of occupants'),
                          show_occupants_toggle: this.is_chatroom && _converse.visible_toolbar_buttons.toggle_occupants
                        }
                    );
                },

                close: function (ev) {
                    /* Close this chat box, which implies leaving the room as
                     * well.
                     */
                    this.leave();
                },

                toggleOccupants: function (ev, preserve_state) {
                    /* Show or hide the right sidebar containing the chat
                     * occupants (and the invite widget).
                     */
                    if (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    if (preserve_state) {
                        // Bit of a hack, to make sure that the sidebar's state doesn't change
                        this.model.set({hidden_occupants: !this.model.get('hidden_occupants')});
                    }
                    if (!this.model.get('hidden_occupants')) {
                        this.model.save({hidden_occupants: true});
                        this.$('.icon-hide-users').removeClass('icon-hide-users').addClass('icon-show-users');
                        this.$('.occupants').addClass('hidden');
                        this.$('.chat-area').addClass('full');
                        this.scrollDown();
                    } else {
                        this.model.save({hidden_occupants: false});
                        this.$('.icon-show-users').removeClass('icon-show-users').addClass('icon-hide-users');
                        this.$('.chat-area').removeClass('full');
                        this.$('div.occupants').removeClass('hidden');
                        this.scrollDown();
                    }
                },

                onOccupantClicked: function (ev) {
                    /* When an occupant is clicked, insert their nickname into
                     * the chat textarea input.
                     */
                    this.insertIntoTextArea(ev.target.textContent);
                },

                requestMemberList: function (chatroom_jid, affiliation) {
                    /* Send an IQ stanza to the server, asking it for the
                     * member-list of this room.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * Parameters:
                     *  (String) chatroom_jid: The JID of the chatroom for
                     *      which the member-list is being requested
                     *  (String) affiliation: The specific member list to
                     *      fetch. 'admin', 'owner' or 'member'.
                     *
                     * Returns:
                     *  A promise which resolves once the list has been
                     *  retrieved.
                     */
                    var deferred = new $.Deferred();
                    affiliation = affiliation || 'member';
                    var iq = $iq({to: chatroom_jid, type: "get"})
                        .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                            .c("item", {'affiliation': affiliation});
                    _converse.connection.sendIQ(iq, deferred.resolve, deferred.reject);
                    return deferred.promise();
                },

                parseMemberListIQ: function (iq) {
                    /* Given an IQ stanza with a member list, create an array of member
                     * objects.
                     */
                    return _.map(
                        $(iq).find('query[xmlns="'+Strophe.NS.MUC_ADMIN+'"] item'),
                        function (item) {
                            return {
                                'jid': item.getAttribute('jid'),
                                'affiliation': item.getAttribute('affiliation'),
                            };
                        }
                    );
                },

                computeAffiliationsDelta: function (exclude_existing, remove_absentees, new_list, old_list) {
                    /* Given two lists of objects with 'jid', 'affiliation' and
                     * 'reason' properties, return a new list containing
                     * those objects that are new, changed or removed
                     * (depending on the 'remove_absentees' boolean).
                     *
                     * The affiliations for new and changed members stay the
                     * same, for removed members, the affiliation is set to 'none'.
                     *
                     * The 'reason' property is not taken into account when
                     * comparing whether affiliations have been changed.
                     *
                     * Parameters:
                     *  (Boolean) exclude_existing: Indicates whether JIDs from
                     *      the new list which are also in the old list
                     *      (regardless of affiliation) should be excluded
                     *      from the delta. One reason to do this
                     *      would be when you want to add a JID only if it
                     *      doesn't have *any* existing affiliation at all.
                     *  (Boolean) remove_absentees: Indicates whether JIDs
                     *      from the old list which are not in the new list
                     *      should be considered removed and therefore be
                     *      included in the delta with affiliation set
                     *      to 'none'.
                     *  (Array) new_list: Array containing the new affiliations
                     *  (Array) old_list: Array containing the old affiliations
                     */
                    var new_jids = _.map(new_list, 'jid');
                    var old_jids = _.map(old_list, 'jid');

                    // Get the new affiliations
                    var delta = _.map(_.difference(new_jids, old_jids), function (jid) {
                        return new_list[_.indexOf(new_jids, jid)];
                    });
                    if (!exclude_existing) {
                        // Get the changed affiliations
                        delta = delta.concat(_.filter(new_list, function (item) {
                            var idx = _.indexOf(old_jids, item.jid);
                            if (idx >= 0) {
                                return item.affiliation !== old_list[idx].affiliation;
                            }
                            return false;
                        }));
                    }
                    if (remove_absentees) {
                        // Get the removed affiliations
                        delta = delta.concat(_.map(_.difference(old_jids, new_jids), function (jid) {
                            return {'jid': jid, 'affiliation': 'none'};
                        }));
                    }
                    return delta;
                },

                sendAffiliationIQ: function (chatroom_jid, affiliation, member) {
                    /* Send an IQ stanza specifying an affiliation change.
                     *
                     * Paremeters:
                     *  (String) chatroom_jid: JID of the relevant room
                     *  (String) affiliation: affiliation (could also be stored
                     *      on the member object).
                     *  (Object) member: Map containing the member's jid and
                     *      optionally a reason and affiliation.
                     */
                    var deferred = new $.Deferred();
                    var iq = $iq({to: chatroom_jid, type: "set"})
                        .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                        .c("item", {
                            'affiliation': member.affiliation || affiliation,
                            'jid': member.jid
                        });
                    if (!_.isUndefined(member.reason)) {
                        iq.c("reason", member.reason);
                    }
                    _converse.connection.sendIQ(iq, deferred.resolve, deferred.reject);
                    return deferred;
                },

                setAffiliation: function (affiliation, members) {
                    /* Send IQ stanzas to the server to set an affiliation for
                     * the provided JIDs.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * XXX: Prosody doesn't accept multiple JIDs' affiliations
                     * being set in one IQ stanza, so as a workaround we send
                     * a separate stanza for each JID.
                     * Related ticket: https://prosody.im/issues/issue/795
                     *
                     * Parameters:
                     *  (String) affiliation: The affiliation
                     *  (Object) members: A map of jids, affiliations and
                     *      optionally reasons. Only those entries with the
                     *      same affiliation as being currently set will be
                     *      considered.
                     *
                     * Returns:
                     *  A promise which resolves and fails depending on the
                     *  XMPP server response.
                     */
                    members = _.filter(members, function (member) {
                        // We only want those members who have the right
                        // affiliation (or none, which implies the provided
                        // one).
                        return _.isUndefined(member.affiliation) ||
                                member.affiliation === affiliation;
                    });
                    var promises = _.map(
                        members,
                        _.partial(this.sendAffiliationIQ, this.model.get('jid'), affiliation)
                    );
                    return $.when.apply($, promises);
                },

                setAffiliations: function (members, onSuccess, onError) {
                    /* Send IQ stanzas to the server to modify the
                     * affiliations in this room.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * Parameters:
                     *  (Object) members: A map of jids, affiliations and optionally reasons
                     *  (Function) onSuccess: callback for a succesful response
                     *  (Function) onError: callback for an error response
                     */
                    if (_.isEmpty(members)) {
                        // Succesfully updated with zero affilations :)
                        onSuccess(null);
                        return;
                    }
                    var affiliations = _.uniq(_.map(members, 'affiliation'));
                    var promises = _.map(affiliations, _.partial(this.setAffiliation.bind(this), _, members));
                    $.when.apply($, promises).done(onSuccess).fail(onError);
                },

                marshallAffiliationIQs: function () {
                    /* Marshall a list of IQ stanzas into a map of JIDs and
                     * affiliations.
                     *
                     * Parameters:
                     *  Any amount of XMLElement objects, representing the IQ
                     *  stanzas.
                     */
                    return _.flatMap(arguments, this.parseMemberListIQ);
                },

                getJidsWithAffiliations: function (affiliations) {
                    /* Returns a map of JIDs that have the affiliations
                     * as provided.
                     */
                    if (_.isString(affiliations)) {
                        affiliations = [affiliations];
                    }
                    var deferred = new $.Deferred();
                    var promises = _.map(affiliations, _.partial(this.requestMemberList, this.model.get('jid')));
                    $.when.apply($, promises).always(
                        _.flow(this.marshallAffiliationIQs.bind(this), deferred.resolve)
                    );
                    return deferred.promise();
                },

                updateMemberLists: function (members, affiliations, deltaFunc) {
                    /* Fetch the lists of users with the given affiliations.
                     * Then compute the delta between those users and
                     * the passed in members, and if it exists, send the delta
                     * to the XMPP server to update the member list.
                     *
                     * Parameters:
                     *  (Object) members: Map of member jids and affiliations.
                     *  (String|Array) affiliation: An array of affiliations or
                     *      a string if only one affiliation.
                     *  (Function) deltaFunc: The function to compute the delta
                     *      between old and new member lists.
                     *
                     * Returns:
                     *  A promise which is resolved once the list has been
                     *  updated or once it's been established there's no need
                     *  to update the list.
                     */
                    var that = this;
                    var deferred = new $.Deferred();
                    this.getJidsWithAffiliations(affiliations).then(function (old_members) {
                        that.setAffiliations(
                            deltaFunc(members, old_members),
                            deferred.resolve,
                            deferred.reject
                        );
                    });
                    return deferred.promise();
                },

                directInvite: function (recipient, reason) {
                    /* Send a direct invitation as per XEP-0249
                     *
                     * Parameters:
                     *    (String) recipient - JID of the person being invited
                     *    (String) reason - Optional reason for the invitation
                     */
                    if (this.model.get('membersonly')) {
                        // When inviting to a members-only room, we first add
                        // the person to the member list by giving them an
                        // affiliation of 'member' (if they're not affiliated
                        // already), otherwise they won't be able to join.
                        var map = {}; map[recipient] = 'member';
                        var deltaFunc = _.partial(this.computeAffiliationsDelta, true, false);
                        this.updateMemberLists(
                            [{'jid': recipient, 'affiliation': 'member', 'reason': reason}],
                            ['member', 'owner', 'admin'],
                            deltaFunc
                        );
                    }
                    var attrs = {
                        'xmlns': 'jabber:x:conference',
                        'jid': this.model.get('jid')
                    };
                    if (reason !== null) { attrs.reason = reason; }
                    if (this.model.get('password')) { attrs.password = this.model.get('password'); }
                    var invitation = $msg({
                        from: _converse.connection.jid,
                        to: recipient,
                        id: _converse.connection.getUniqueId()
                    }).c('x', attrs);
                    _converse.connection.send(invitation);
                    _converse.emit('roomInviteSent', {
                        'room': this,
                        'recipient': recipient,
                        'reason': reason
                    });
                },

                handleChatStateMessage: function (message) {
                    /* Override the method on the ChatBoxView base class to
                     * ignore <gone/> notifications in groupchats.
                     *
                     * As laid out in the business rules in XEP-0085
                     * http://xmpp.org/extensions/xep-0085.html#bizrules-groupchat
                     */
                    if (message.get('fullname') === this.model.get('nick')) {
                        // Don't know about other servers, but OpenFire sends
                        // back to you your own chat state notifications.
                        // We ignore them here...
                        return;
                    }
                    if (message.get('chat_state') !== _converse.GONE) {
                        _converse.ChatBoxView.prototype.handleChatStateMessage.apply(this, arguments);
                    }
                },

                sendChatState: function () {
                    /* Sends a message with the status of the user in this chat session
                     * as taken from the 'chat_state' attribute of the chat box.
                     * See XEP-0085 Chat State Notifications.
                     */
                    if (this.model.get('connection_status') !==  ROOMSTATUS.ENTERED) {
                        return;
                    }
                    var chat_state = this.model.get('chat_state');
                    if (chat_state === _converse.GONE) {
                        // <gone/> is not applicable within MUC context
                        return;
                    }
                    _converse.connection.send(
                        $msg({'to':this.model.get('jid'), 'type': 'groupchat'})
                            .c(chat_state, {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                            .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                    );
                },

                sendChatRoomMessage: function (text) {
                    /* Constuct a message stanza to be sent to this chat room,
                     * and send it to the server.
                     *
                     * Parameters:
                     *  (String) text: The message text to be sent.
                     */
                    var msgid = _converse.connection.getUniqueId();
                    var msg = $msg({
                        to: this.model.get('jid'),
                        from: _converse.connection.jid,
                        type: 'groupchat',
                        id: msgid
                    }).c("body").t(text).up()
                    .c("x", {xmlns: "jabber:x:event"}).c(_converse.COMPOSING);
                    _converse.connection.send(msg);
                    this.model.messages.create({
                        fullname: this.model.get('nick'),
                        sender: 'me',
                        time: moment().format(),
                        message: text,
                        msgid: msgid
                    });
                },

                modifyRole: function(room, nick, role, reason, onSuccess, onError) {
                    var item = $build("item", {nick: nick, role: role});
                    var iq = $iq({to: room, type: "set"}).c("query", {xmlns: Strophe.NS.MUC_ADMIN}).cnode(item.node);
                    if (reason !== null) { iq.c("reason", reason); }
                    return _converse.connection.sendIQ(iq.tree(), onSuccess, onError);
                },

                validateRoleChangeCommand: function (command, args) {
                    /* Check that a command to change a chat room user's role or
                     * affiliation has anough arguments.
                     */
                    // TODO check if first argument is valid
                    if (args.length < 1 || args.length > 2) {
                        this.showStatusNotification(
                            __("Error: the \""+command+"\" command takes two arguments, the user's nickname and optionally a reason."),
                            true
                        );
                        return false;
                    }
                    return true;
                },

                clearChatRoomMessages: function (ev) {
                    /* Remove all messages from the chat room UI.
                     */
                    if (!_.isUndefined(ev)) { ev.stopPropagation(); }
                    var result = confirm(__("Are you sure you want to clear the messages from this room?"));
                    if (result === true) {
                        this.$content.empty();
                    }
                    return this;
                },

                onCommandError: function () {
                    this.showStatusNotification(__("Error: could not execute the command"), true);
                },

                onMessageSubmitted: function (text) {
                    /* Gets called when the user presses enter to send off a
                     * message in a chat room.
                     *
                     * Parameters:
                     *    (String) text - The message text.
                     */
                    if (_converse.muc_disable_moderator_commands) {
                        return this.sendChatRoomMessage(text);
                    }
                    var match = text.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false, '', ''],
                        args = match[2] && match[2].splitOnce(' ') || [],
                        command = match[1].toLowerCase();
                    switch (command) {
                        case 'admin':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('admin',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                            break;
                        case 'ban':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('outcast',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                            break;
                        case 'clear':
                            this.clearChatRoomMessages();
                            break;
                        case 'deop':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'occupant', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'help':
                            this.showHelpMessages([
                                '<strong>/admin</strong>: '   +__("Change user's affiliation to admin"),
                                '<strong>/ban</strong>: '     +__('Ban user from room'),
                                '<strong>/clear</strong>: '   +__('Remove messages'),
                                '<strong>/deop</strong>: '    +__('Change user role to occupant'),
                                '<strong>/help</strong>: '    +__('Show this menu'),
                                '<strong>/kick</strong>: '    +__('Kick user from room'),
                                '<strong>/me</strong>: '      +__('Write in 3rd person'),
                                '<strong>/member</strong>: '  +__('Grant membership to a user'),
                                '<strong>/mute</strong>: '    +__("Remove user's ability to post messages"),
                                '<strong>/nick</strong>: '    +__('Change your nickname'),
                                '<strong>/op</strong>: '      +__('Grant moderator role to user'),
                                '<strong>/owner</strong>: '   +__('Grant ownership of this room'),
                                '<strong>/revoke</strong>: '  +__("Revoke user's membership"),
                                '<strong>/subject</strong>: ' +__('Set room subject'),
                                '<strong>/topic</strong>: '   +__('Set room subject (alias for /subject)'),
                                '<strong>/voice</strong>: '   +__('Allow muted user to post messages')
                            ]);
                            break;
                        case 'kick':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'none', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'mute':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'visitor', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'member':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('member',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                            break;
                        case 'nick':
                            _converse.connection.send($pres({
                                from: _converse.connection.jid,
                                to: this.getRoomJIDAndNick(match[2]),
                                id: _converse.connection.getUniqueId()
                            }).tree());
                            break;
                        case 'owner':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('owner',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                            break;
                        case 'op':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'moderator', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'revoke':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.setAffiliation('none',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                            break;
                        case 'topic':
                        case 'subject':
                            _converse.connection.send(
                                $msg({
                                    to: this.model.get('jid'),
                                    from: _converse.connection.jid,
                                    type: "groupchat"
                                }).c("subject", {xmlns: "jabber:client"}).t(match[2]).tree()
                            );
                            break;
                        case 'voice':
                            if (!this.validateRoleChangeCommand(command, args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'occupant', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        default:
                            this.sendChatRoomMessage(text);
                        break;
                    }
                },

                handleMUCMessage: function (stanza) {
                    /* Handler for all MUC messages sent to this chat room.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The message stanza.
                     */
                    var configuration_changed = stanza.querySelector("status[code='104']");
                    var logging_enabled = stanza.querySelector("status[code='170']");
                    var logging_disabled = stanza.querySelector("status[code='171']");
                    var room_no_longer_anon = stanza.querySelector("status[code='172']");
                    var room_now_semi_anon = stanza.querySelector("status[code='173']");
                    var room_now_fully_anon = stanza.querySelector("status[code='173']");
                    if (configuration_changed || logging_enabled || logging_disabled ||
                            room_no_longer_anon || room_now_semi_anon || room_now_fully_anon) {
                        this.getRoomFeatures();
                    }
                    _.flow(this.showStatusMessages.bind(this), this.onChatRoomMessage.bind(this))(stanza);
                    return true;
                },

                getRoomJIDAndNick: function (nick) {
                    /* Utility method to construct the JID for the current user
                     * as occupant of the room.
                     *
                     * This is the room JID, with the user's nick added at the
                     * end.
                     *
                     * For example: room@conference.example.org/nickname
                     */
                    if (nick) {
                        this.model.save({'nick': nick});
                    } else {
                        nick = this.model.get('nick');
                    }
                    var room = this.model.get('jid');
                    var node = Strophe.getNodeFromJid(room);
                    var domain = Strophe.getDomainFromJid(room);
                    return node + "@" + domain + (nick !== null ? "/" + nick : "");
                },

                registerHandlers: function () {
                    /* Register presence and message handlers for this chat
                     * room
                     */
                    var room_jid = this.model.get('jid');
                    this.removeHandlers();
                    this.presence_handler = _converse.connection.addHandler(
                        this.onChatRoomPresence.bind(this),
                        Strophe.NS.MUC, 'presence', null, null, room_jid,
                        {'ignoreNamespaceFragment': true, 'matchBareFromJid': true}
                    );
                    this.message_handler = _converse.connection.addHandler(
                        this.handleMUCMessage.bind(this),
                        null, 'message', null, null, room_jid,
                        {'matchBareFromJid': true}
                    );
                },

                removeHandlers: function () {
                    /* Remove the presence and message handlers that were
                     * registered for this chat room.
                     */
                    if (this.message_handler) {
                        _converse.connection.deleteHandler(this.message_handler);
                        delete this.message_handler;
                    }
                    if (this.presence_handler) {
                        _converse.connection.deleteHandler(this.presence_handler);
                        delete this.presence_handler;
                    }
                    return this;
                },

                join: function (nick, password) {
                    /* Join the chat room.
                     *
                     * Parameters:
                     *  (String) nick: The user's nickname
                     *  (String) password: Optional password, if required by
                     *      the room.
                     */
                    nick = nick ? nick : this.model.get('nick');
                    if (!nick) {
                        return this.checkForReservedNick();
                    }
                    if (this.model.get('connection_status') === ROOMSTATUS.ENTERED) {
                        // We have restored a chat room from session storage,
                        // so we don't send out a presence stanza again.
                        return this;
                    }
                    var stanza = $pres({
                        'from': _converse.connection.jid,
                        'to': this.getRoomJIDAndNick(nick)
                    }).c("x", {'xmlns': Strophe.NS.MUC})
                      .c("history", {'maxstanzas': _converse.muc_history_max_stanzas}).up();
                    if (password) {
                        stanza.cnode(Strophe.xmlElement("password", [], password));
                    }
                    this.model.save('connection_status', ROOMSTATUS.CONNECTING);
                    _converse.connection.send(stanza);
                    return this;
                },

                cleanup: function () {
                    this.model.save('connection_status', ROOMSTATUS.DISCONNECTED);
                    this.removeHandlers();
                    _converse.ChatBoxView.prototype.close.apply(this, arguments);
                },

                leave: function(exit_msg) {
                    /* Leave the chat room.
                     *
                     * Parameters:
                     *  (String) exit_msg: Optional message to indicate your
                     *      reason for leaving.
                     */
                    this.hide();
                    this.occupantsview.model.reset();
                    this.occupantsview.model.browserStorage._clear();
                    if (!_converse.connection.connected ||
                            this.model.get('connection_status') === ROOMSTATUS.DISCONNECTED) {
                        // Don't send out a stanza if we're not connected.
                        this.cleanup();
                        return;
                    }
                    var presence = $pres({
                        type: "unavailable",
                        from: _converse.connection.jid,
                        to: this.getRoomJIDAndNick()
                    });
                    if (exit_msg !== null) {
                        presence.c("status", exit_msg);
                    }
                    _converse.connection.sendPresence(
                        presence,
                        this.cleanup.bind(this),
                        this.cleanup.bind(this),
                        2000
                    );
                },

                renderConfigurationForm: function (stanza) {
                    /* Renders a form given an IQ stanza containing the current
                     * room configuration.
                     *
                     * Returns a promise which resolves once the user has
                     * either submitted the form, or canceled it.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The IQ stanza containing the room config.
                     */
                    var that = this,
                        $body = this.$('.chatroom-body');
                    $body.children().addClass('hidden');
                    // Remove any existing forms
                    $body.find('form.chatroom-form').remove();
                    $body.append(tpl_chatroom_form());

                    var $form = $body.find('form.chatroom-form'),
                        $fieldset = $form.children('fieldset:first'),
                        $stanza = $(stanza),
                        $fields = $stanza.find('field'),
                        title = $stanza.find('title').text(),
                        instructions = $stanza.find('instructions').text();
                    $fieldset.find('span.spinner').remove();
                    $fieldset.append($('<legend>').text(title));
                    if (instructions && instructions !== title) {
                        $fieldset.append($('<p class="instructions">').text(instructions));
                    }
                    _.each($fields, function (field) {
                        $fieldset.append(utils.xForm2webForm($(field), $stanza));
                    });
                    $form.append('<fieldset></fieldset>');
                    $fieldset = $form.children('fieldset:last');
                    $fieldset.append('<input type="submit" class="pure-button button-primary" value="'+__('Save')+'"/>');
                    $fieldset.append('<input type="button" class="pure-button button-cancel" value="'+__('Cancel')+'"/>');
                    $fieldset.find('input[type=button]').on('click', function (ev) {
                        ev.preventDefault();
                        that.cancelConfiguration();
                    });
                    $form.on('submit', function (ev) {
                        ev.preventDefault();
                        that.saveConfiguration(ev.target);
                    });
                },

                sendConfiguration: function(config, onSuccess, onError) {
                    /* Send an IQ stanza with the room configuration.
                     *
                     * Parameters:
                     *  (Array) config: The room configuration
                     *  (Function) onSuccess: Callback upon succesful IQ response
                     *      The first parameter passed in is IQ containing the
                     *      room configuration.
                     *      The second is the response IQ from the server.
                     *  (Function) onError: Callback upon error IQ response
                     *      The first parameter passed in is IQ containing the
                     *      room configuration.
                     *      The second is the response IQ from the server.
                     */
                    var iq = $iq({to: this.model.get('jid'), type: "set"})
                        .c("query", {xmlns: Strophe.NS.MUC_OWNER})
                        .c("x", {xmlns: Strophe.NS.XFORM, type: "submit"});
                    _.each(config || [], function (node) { iq.cnode(node).up(); });
                    onSuccess = _.isUndefined(onSuccess) ? _.noop : _.partial(onSuccess, iq.nodeTree);
                    onError = _.isUndefined(onError) ? _.noop : _.partial(onError, iq.nodeTree);
                    return _converse.connection.sendIQ(iq, onSuccess, onError);
                },

                saveConfiguration: function (form) {
                    /* Submit the room configuration form by sending an IQ
                     * stanza to the server.
                     *
                     * Returns a promise which resolves once the XMPP server
                     * has return a response IQ.
                     *
                     * Parameters:
                     *  (HTMLElement) form: The configuration form DOM element.
                     */
                    var deferred = new $.Deferred();
                    var that = this;
                    var $inputs = $(form).find(':input:not([type=button]):not([type=submit])'),
                        configArray = [];
                    $inputs.each(function () {
                        configArray.push(utils.webForm2xForm(this));
                    });
                    this.sendConfiguration(
                        configArray,
                        deferred.resolve,
                        deferred.reject
                    );
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.renderAfterTransition();
                        });
                    return deferred.promise();
                },

                autoConfigureChatRoom: function (stanza) {
                    /* Automatically configure room based on the
                     * 'roomconfig' data on this view's model.
                     *
                     * Returns a promise which resolves once a response IQ has
                     * been received.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: IQ stanza from the server,
                     *       containing the configuration.
                     */
                    var that = this, configArray = [],
                        $fields = $(stanza).find('field'),
                        count = $fields.length,
                        config = this.model.get('roomconfig');

                    $fields.each(function () {
                        var fieldname = this.getAttribute('var').replace('muc#roomconfig_', ''),
                            type = this.getAttribute('type'),
                            value;
                        if (fieldname in config) {
                            switch (type) {
                                case 'boolean':
                                    value = config[fieldname] ? 1 : 0;
                                    break;
                                case 'list-multi':
                                    // TODO: we don't yet handle "list-multi" types
                                    value = this.innerHTML;
                                    break;
                                default:
                                    value = config[fieldname];
                            }
                            this.innerHTML = $build('value').t(value);
                        }
                        configArray.push(this);
                        if (!--count) {
                            that.sendConfiguration(configArray);
                        }
                    });
                },

                cancelConfiguration: function () {
                    /* Remove the configuration form without submitting and
                     * return to the chat view.
                     */
                    var that = this;
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.renderAfterTransition();
                        });
                },

                fetchRoomConfiguration: function (handler) {
                    /* Send an IQ stanza to fetch the room configuration data.
                     * Returns a promise which resolves once the response IQ
                     * has been received.
                     *
                     * Parameters:
                     *  (Function) handler: The handler for the response IQ
                     */
                    var that = this;
                    var deferred = new $.Deferred();
                    _converse.connection.sendIQ(
                        $iq({
                            'to': this.model.get('jid'),
                            'type': "get"
                        }).c("query", {xmlns: Strophe.NS.MUC_OWNER}),
                        function (iq) {
                            if (handler) {
                                handler.apply(that, arguments);
                            }
                            deferred.resolve(iq);
                        },
                        deferred.reject // errback
                    );
                    return deferred.promise();
                },

                getRoomFeatures: function () {
                    /* Fetch the room disco info, parse it and then
                     * save it on the Backbone.Model of this chat rooms.
                     */
                    var deferred = new $.Deferred();
                    var that = this;
                    _converse.connection.disco.info(this.model.get('jid'), null,
                        function (iq) {
                            /* See http://xmpp.org/extensions/xep-0045.html#disco-roominfo
                             *
                             *  <identity
                             *      category='conference'
                             *      name='A Dark Cave'
                             *      type='text'/>
                             *  <feature var='http://jabber.org/protocol/muc'/>
                             *  <feature var='muc_passwordprotected'/>
                             *  <feature var='muc_hidden'/>
                             *  <feature var='muc_temporary'/>
                             *  <feature var='muc_open'/>
                             *  <feature var='muc_unmoderated'/>
                             *  <feature var='muc_nonanonymous'/>
                             *  <feature var='urn:xmpp:mam:0'/>
                             */
                            var features = {
                                'features_fetched': true
                            };
                            _.each(iq.querySelectorAll('feature'), function (field) {
                                var fieldname = field.getAttribute('var');
                                if (!fieldname.startsWith('muc_')) {
                                    if (fieldname === Strophe.NS.MAM) {
                                        features.mam_enabled = true;
                                    }
                                    return;
                                }
                                features[fieldname.replace('muc_', '')] = true;
                            });
                            var desc_field = iq.querySelector('field[var="muc#roominfo_description"] value');
                            if (!_.isNull(desc_field)) {
                                features.description = desc_field.textContent;
                            }
                            that.model.save(features);
                            return deferred.resolve();
                        },
                        deferred.reject,
                        5000
                    );
                    return deferred.promise();
                },

                configureChatRoom: function (ev) {
                    /* Start the process of configuring a chat room, either by
                     * rendering a configuration form, or by auto-configuring
                     * based on the "roomconfig" data stored on the
                     * Backbone.Model.
                     *
                     * Stores the new configuration on the Backbone.Model once
                     * completed.
                     *
                     * Paremeters:
                     *  (Event) ev: DOM event that might be passed in if this
                     *      method is called due to a user action. In this
                     *      case, auto-configure won't happen, regardless of
                     *      the settings.
                     */
                    if (_.isUndefined(ev) && this.model.get('auto_configure')) {
                        this.fetchRoomConfiguration().then(
                            this.autoConfigureChatRoom.bind(this));
                    } else {
                        if (!_.isUndefined(ev) && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        this.showSpinner();
                        this.fetchRoomConfiguration().then(
                            this.renderConfigurationForm.bind(this));
                    }
                },

                submitNickname: function (ev) {
                    /* Get the nickname value from the form and then join the
                     * chat room with it.
                     */
                    ev.preventDefault();
                    var $nick = this.$el.find('input[name=nick]');
                    var nick = $nick.val();
                    if (!nick) {
                        $nick.addClass('error');
                        return;
                    }
                    else {
                        $nick.removeClass('error');
                    }
                    this.$el.find('.chatroom-form-container')
                            .replaceWith('<span class="spinner centered"/>');
                    this.join(nick);
                },

                checkForReservedNick: function () {
                    /* User service-discovery to ask the XMPP server whether
                     * this user has a reserved nickname for this room.
                     * If so, we'll use that, otherwise we render the nickname
                     * form.
                     */
                    this.showSpinner();
                    _converse.connection.sendIQ(
                        $iq({
                            'to': this.model.get('jid'),
                            'from': _converse.connection.jid,
                            'type': "get"
                        }).c("query", {
                            'xmlns': Strophe.NS.DISCO_INFO,
                            'node': 'x-roomuser-item'
                        }),
                        this.onNickNameFound.bind(this),
                        this.onNickNameNotFound.bind(this)
                    );
                    return this;
                },

                onNickNameFound: function (iq) {
                    /* We've received an IQ response from the server which
                     * might contain the user's reserved nickname.
                     * If no nickname is found we either render a form for
                     * them to specify one, or we try to join the room with the
                     * node of the user's JID.
                     *
                     * Parameters:
                     *  (XMLElement) iq: The received IQ stanza
                     */
                    var nick = $(iq)
                        .find('query[node="x-roomuser-item"] identity')
                        .attr('name');
                    if (!nick) {
                        this.onNickNameNotFound();
                    } else {
                        this.join(nick);
                    }
                },

                onNickNameNotFound: function (message) {
                    if (_converse.muc_nickname_from_jid) {
                        // We try to enter the room with the node part of
                        // the user's JID.
                        this.join(Strophe.unescapeNode(Strophe.getNodeFromJid(_converse.bare_jid)));
                    } else {
                        this.renderNicknameForm(message);
                    }
                },

                getDefaultNickName: function () {
                    /* The default nickname (used when muc_nickname_from_jid is true)
                     * is the node part of the user's JID.
                     * We put this in a separate method so that it can be
                     * overridden by plugins.
                     */
                    return Strophe.unescapeNode(Strophe.getNodeFromJid(_converse.bare_jid));
                },

                onNicknameClash: function (presence) {
                    /* When the nickname is already taken, we either render a
                     * form for the user to choose a new nickname, or we
                     * try to make the nickname unique by adding an integer to
                     * it. So john will become john-2, and then john-3 and so on.
                     *
                     * Which option is take depends on the value of
                     * muc_nickname_from_jid.
                     */
                    if (_converse.muc_nickname_from_jid) {
                        var nick = presence.getAttribute('from').split('/')[1];
                        if (nick === this.getDefaultNickName()) {
                            this.join(nick + '-2');
                        } else {
                            var del= nick.lastIndexOf("-");
                            var num = nick.substring(del+1, nick.length);
                            this.join(nick.substring(0, del+1) + String(Number(num)+1));
                        }
                    } else {
                        this.renderNicknameForm(
                            __("The nickname you chose is reserved or "+
                               "currently in use, please choose a different one.")
                        );
                    }
                },

                renderNicknameForm: function (message) {
                    /* Render a form which allows the user to choose their
                     * nickname.
                     */
                    this.$('.chatroom-body').children().addClass('hidden');
                    this.$('span.centered.spinner').remove();
                    if (!_.isString(message)) {
                        message = '';
                    }
                    this.$('.chatroom-body').append(
                        tpl_chatroom_nickname_form({
                            heading: __('Please choose your nickname'),
                            label_nickname: __('Nickname'),
                            label_join: __('Enter room'),
                            validation_message: message
                        }));
                    this.model.save('connection_status', ROOMSTATUS.NICKNAME_REQUIRED);
                    this.$('.chatroom-form').on('submit', this.submitNickname.bind(this));
                },

                submitPassword: function (ev) {
                    ev.preventDefault();
                    var password = this.$el.find('.chatroom-form').find('input[type=password]').val();
                    this.$el.find('.chatroom-form-container').replaceWith('<span class="spinner centered"/>');
                    this.join(this.model.get('nick'), password);
                },

                renderPasswordForm: function () {
                    this.$('.chatroom-body').children().addClass('hidden');
                    this.$('span.centered.spinner').remove();
                    this.$('.chatroom-body').append(
                        tpl_chatroom_password_form({
                            heading: __('This chatroom requires a password'),
                            label_password: __('Password: '),
                            label_submit: __('Submit')
                        }));
                    this.model.save('connection_status', ROOMSTATUS.PASSWORD_REQUIRED);
                    this.$('.chatroom-form').on('submit', this.submitPassword.bind(this));
                },

                showDisconnectMessage: function (msg) {
                    this.$('.chat-area').addClass('hidden');
                    this.$('.occupants').addClass('hidden');
                    this.$('span.centered.spinner').remove();
                    this.$('.chatroom-body').append($('<p>'+msg+'</p>'));
                },

                getMessageFromStatus: function (stat, stanza, is_self) {
                    /* Parameters:
                     *  (XMLElement) stat: A <status> element.
                     *  (Boolean) is_self: Whether the element refers to the
                     *                     current user.
                     *  (XMLElement) stanza: The original stanza received.
                     */
                    var code = stat.getAttribute('code'), nick;
                    if (code === '110') { return; }
                    if (code in _converse.muc.info_messages) {
                        return _converse.muc.info_messages[code];
                    }
                    if (!is_self) {
                        if (code in _converse.muc.action_info_messages) {
                            nick = Strophe.getResourceFromJid(stanza.getAttribute('from'));
                            return __(_converse.muc.action_info_messages[code], nick);
                        }
                    } else if (code in _converse.muc.new_nickname_messages) {
                        if (is_self && code === "210") {
                            nick = Strophe.getResourceFromJid(stanza.getAttribute('from'));
                        } else if (is_self && code === "303") {
                            nick = stanza.querySelector('x item').getAttribute('nick');
                        }
                        return __(_converse.muc.new_nickname_messages[code], nick);
                    }
                    return;
                },

                saveAffiliationAndRole: function (pres) {
                    /* Parse the presence stanza for the current user's
                     * affiliation.
                     *
                     * Parameters:
                     *  (XMLElement) pres: A <presence> stanza.
                     */
                    var item = sizzle('x[xmlns="'+Strophe.NS.MUC_USER+'"] item', pres).pop();
                    if (_.isNil(item)) { return; }
                    var jid = item.getAttribute('jid');
                    if (Strophe.getBareJidFromJid(jid) === _converse.bare_jid) {
                        var affiliation = item.getAttribute('affiliation');
                        var role = item.getAttribute('role');
                        if (affiliation) {
                            this.model.save({'affiliation': affiliation});
                        }
                        if (role) {
                            this.model.save({'role': role});
                        }
                    }
                },

                parseXUserElement: function (x, stanza, is_self) {
                    /* Parse the passed-in <x xmlns='http://jabber.org/protocol/muc#user'>
                     * element and construct a map containing relevant
                     * information.
                     */
                    // 1. Get notification messages based on the <status> elements.
                    var statuses = x.querySelectorAll('status');
                    var mapper = _.partial(this.getMessageFromStatus, _, stanza, is_self);
                    var notification = {};
                    var messages = _.reject(_.map(statuses, mapper), _.isUndefined);
                    if (messages.length) {
                        notification.messages = messages;
                    }
                    // 2. Get disconnection messages based on the <status> elements
                    var codes = _.invokeMap(statuses, Element.prototype.getAttribute, 'code');
                    var disconnection_codes = _.intersection(codes, _.keys(_converse.muc.disconnect_messages));
                    var disconnected = is_self && disconnection_codes.length > 0;
                    if (disconnected) {
                        notification.disconnected = true;
                        notification.disconnection_message = _converse.muc.disconnect_messages[disconnection_codes[0]];
                    }
                    // 3. Find the reason and actor from the <item> element
                    var item = x.querySelector('item');
                    // By using querySelector above, we assume here there is
                    // one <item> per <x xmlns='http://jabber.org/protocol/muc#user'>
                    // element. This appears to be a safe assumption, since
                    // each <x/> element pertains to a single user.
                    if (!_.isNull(item)) {
                        var reason = item.querySelector('reason');
                        if (reason) {
                            notification.reason = reason ? reason.textContent : undefined;
                        }
                        var actor = item.querySelector('actor');
                        if (actor) {
                            notification.actor = actor ? actor.getAttribute('nick') : undefined;
                        }
                    }
                    return notification;
                },

                displayNotificationsforUser: function (notification) {
                    /* Given the notification object generated by
                     * parseXUserElement, display any relevant messages and
                     * information to the user.
                     */
                    var that = this;
                    if (notification.disconnected) {
                        this.showDisconnectMessage(notification.disconnection_message);
                        if (notification.actor) {
                            this.showDisconnectMessage(__(___('This action was done by %1$s.'), notification.actor));
                        }
                        if (notification.reason) {
                            this.showDisconnectMessage(__(___('The reason given is: "%1$s".'), notification.reason));
                        }
                        this.model.save('connection_status', ROOMSTATUS.DISCONNECTED);
                        return;
                    }
                    _.each(notification.messages, function (message) {
                        that.$content.append(tpl_info({'message': message}));
                    });
                    if (notification.reason) {
                        this.showStatusNotification(__('The reason given is: "'+notification.reason+'"'), true);
                    }
                    if (notification.messages.length) {
                        this.scrollDown();
                    }
                },

                getJoinLeaveMessages: function (stanza) {
                    /* Parse the given stanza and return notification messages
                     * for join/leave events.
                     */
                    // XXX: some mangling required to make the returned
                    // result look like the structure returned by
                    // parseXUserElement. Not nice...
                    var nick = Strophe.getResourceFromJid(stanza.getAttribute('from'));
                    var stat = stanza.querySelector('status');
                    if (stanza.getAttribute('type') === 'unavailable') {
                        if (!_.isNull(stat) && stat.textContent) {
                            return [{'messages': [__(nick+' has left the room. "'+stat.textContent+'"')]}];
                        } else {
                            return [{'messages': [__(nick+' has left the room')]}];
                        }
                    }
                    if (!this.occupantsview.model.find({'nick': nick})) {
                        // Only show join message if we don't already have the
                        // occupant model. Doing so avoids showing duplicate
                        // join messages.
                        if (!_.isNull(stat) && stat.textContent) {
                            return [{'messages': [__(nick+' has joined the room. "'+stat.textContent+'"')]}];
                        } else {
                            return [{'messages': [__(nick+' has joined the room.')]}];
                        }
                    }
                },

                showStatusMessages: function (stanza) {
                    /* Check for status codes and communicate their purpose to the user.
                     * See: http://xmpp.org/registrar/mucstatus.html
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The message or presence stanza
                     *      containing the status codes.
                     */
                    var elements = sizzle('x[xmlns="'+Strophe.NS.MUC_USER+'"]', stanza);
                    var is_self = stanza.querySelectorAll("status[code='110']").length;
                    var iteratee = _.partial(this.parseXUserElement.bind(this), _, stanza, is_self);
                    var notifications = _.reject(_.map(elements, iteratee), _.isEmpty);
                    if (_.isEmpty(notifications) &&
                            _converse.muc_show_join_leave &&
                            stanza.nodeName === 'presence' &&
                            this.model.get('connection_status') === ROOMSTATUS.ENTERED
                        ) {
                        notifications = this.getJoinLeaveMessages(stanza);
                    }
                    _.each(notifications, this.displayNotificationsforUser.bind(this));
                    return stanza;
                },

                showErrorMessage: function (presence) {
                    // We didn't enter the room, so we must remove it from the MUC add-on
                    var error = presence.querySelector('error');
                    if (error.getAttribute('type') === 'auth') {
                        if (!_.isNull(error.querySelector('not-authorized'))) {
                            this.renderPasswordForm();
                        } else if (!_.isNull(error.querySelector('registration-required'))) {
                            this.showDisconnectMessage(__('You are not on the member list of this room'));
                        } else if (!_.isNull(error.querySelector('forbidden'))) {
                            this.showDisconnectMessage(__('You have been banned from this room'));
                        }
                    } else if (error.getAttribute('type') === 'modify') {
                        if (!_.isNull(error.querySelector('jid-malformed'))) {
                            this.showDisconnectMessage(__('No nickname was specified'));
                        }
                    } else if (error.getAttribute('type') === 'cancel') {
                        if (!_.isNull(error.querySelector('not-allowed'))) {
                            this.showDisconnectMessage(__('You are not allowed to create new rooms'));
                        } else if (!_.isNull(error.querySelector('not-acceptable'))) {
                            this.showDisconnectMessage(__("Your nickname doesn't conform to this room's policies"));
                        } else if (!_.isNull(error.querySelector('conflict'))) {
                            this.onNicknameClash(presence);
                        } else if (!_.isNull(error.querySelector('item-not-found'))) {
                            this.showDisconnectMessage(__("This room does not (yet) exist"));
                        } else if (!_.isNull(error.querySelector('service-unavailable'))) {
                            this.showDisconnectMessage(__("This room has reached its maximum number of occupants"));
                        }
                    }
                },

                renderAfterTransition: function () {
                    /* Rerender the room after some kind of transition. For
                     * example after the spinner has been removed or after a
                     * form has been submitted and removed.
                     */
                    if (this.model.get('connection_status') == ROOMSTATUS.NICKNAME_REQUIRED) {
                        this.renderNicknameForm();
                    } else if (this.model.get('connection_status') == ROOMSTATUS.PASSWORD_REQUIRED) {
                        this.renderPasswordForm();
                    } else {
                        this.$el.find('.chat-area').removeClass('hidden');
                        this.$el.find('.occupants').removeClass('hidden');
                        this.occupantsview.setOccupantsHeight();
                        this.scrollDown();
                    }
                },

                showSpinner: function () {
                    this.$('.chatroom-body').children().addClass('hidden');
                    this.$el.find('.chatroom-body').prepend('<span class="spinner centered"/>');
                },

                hideSpinner: function () {
                    /* Check if the spinner is being shown and if so, hide it.
                     * Also make sure then that the chat area and occupants
                     * list are both visible.
                     */
                    var spinner = this.el.querySelector('.spinner');
                    if (!_.isNull(spinner)) {
                        spinner.parentNode.removeChild(spinner);
                        this.renderAfterTransition();
                    }
                    return this;
                },

                createInstantRoom: function () {
                    /* Sends an empty IQ config stanza to inform the server that the
                     * room should be created with its default configuration.
                     *
                     * See http://xmpp.org/extensions/xep-0045.html#createroom-instant
                     */
                    this.saveConfiguration().then(this.getRoomFeatures.bind(this));
                },

                onChatRoomPresence: function (pres) {
                    /* Handles all MUC presence stanzas.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The stanza
                     */
                    if (pres.getAttribute('type') === 'error') {
                        this.model.save('connection_status', ROOMSTATUS.DISCONNECTED);
                        this.showErrorMessage(pres);
                        return true;
                    }
                    var is_self = pres.querySelector("status[code='110']");
                    var locked_room = pres.querySelector("status[code='201']");
                    if (is_self) {
                        this.saveAffiliationAndRole(pres);
                        if (locked_room) {
                            // This is a new room. It will now be configured
                            // and the configuration cached on the Backbone.Model.
                            if (_converse.muc_instant_rooms) {
                                this.createInstantRoom(); // Accept default configuration
                            } else {
                                this.configureChatRoom();
                                if (!this.model.get('auto_configure')) {
                                    return;
                                }
                            }
                        }
                        this.model.save('connection_status', ROOMSTATUS.ENTERED);
                        this.hideSpinner();
                    }
                    if (!locked_room && !this.model.get('features_fetched') &&
                            this.model.get('connection_status') !== ROOMSTATUS.CONNECTED) {
                        // The features for this room weren't fetched yet, perhaps
                        // because it's a new room without locking (in which
                        // case Prosody doesn't send a 201 status).
                        // This is the first presence received for the room,
                        // so a good time to fetch the features.
                        this.getRoomFeatures();
                    }
                    this.hideSpinner().showStatusMessages(pres);
                    // This must be called after showStatusMessages so that
                    // "join" messages are correctly shown.
                    this.occupantsview.updateOccupantsOnPresence(pres);
                    if (this.model.get('role') !== 'none' &&
                            this.model.get('connection_status') === ROOMSTATUS.CONNECTING) {
                        this.model.save('connection_status', ROOMSTATUS.CONNECTED);
                    }
                    return true;
                },

                setChatRoomSubject: function (sender, subject) {
                    // For translators: the %1$s and %2$s parts will get
                    // replaced by the user and topic text respectively
                    // Example: Topic set by JC Brand to: Hello World!
                    this.$content.append(
                        tpl_info({'message': __('Topic set by %1$s to: %2$s', sender, subject)}));
                    this.scrollDown();
                },

                onChatRoomMessage: function (message) {
                    /* Given a <message> stanza, create a message
                     * Backbone.Model if appropriate.
                     *
                     * Parameters:
                     *  (XMLElement) msg: The received message stanza
                     */
                    var original_stanza = message,
                        forwarded = message.querySelector('forwarded'),
                        delay;
                    if (!_.isNull(forwarded)) {
                        message = forwarded.querySelector('message');
                        delay = forwarded.querySelector('delay');
                    }
                    var jid = message.getAttribute('from'),
                        msgid = message.getAttribute('id'),
                        resource = Strophe.getResourceFromJid(jid),
                        sender = resource && Strophe.unescapeNode(resource) || '',
                        subject = _.propertyOf(message.querySelector('subject'))('textContent'),
                        dupes = msgid && this.model.messages.filter(function (msg) {
                            // Find duplicates.
                            // Some bots (like HAL in the prosody chatroom)
                            // respond to commands with the same ID as the
                            // original message. So we also check the sender.
                            return msg.get('msgid') === msgid && msg.get('fullname') === sender;
                        });
                    if (dupes && dupes.length) {
                        return true;
                    }
                    if (subject) {
                        this.setChatRoomSubject(sender, subject);
                    }
                    if (sender === '') {
                        return true;
                    }
                    this.model.createMessage(message, delay, original_stanza);
                    if (sender !== this.model.get('nick')) {
                        // We only emit an event if it's not our own message
                        _converse.emit('message', original_stanza);
                    }
                    return true;
                }
            });

            _converse.ChatRoomOccupant = Backbone.Model.extend({
                initialize: function (attributes) {
                    this.set(_.extend({
                        'id': _converse.connection.getUniqueId(),
                    }, attributes));
                }
            });

            _converse.ChatRoomOccupantView = Backbone.View.extend({
                tagName: 'li',
                initialize: function () {
                    this.model.on('change', this.render, this);
                    this.model.on('destroy', this.destroy, this);
                },

                render: function () {
                    var show = this.model.get('show') || 'online';
                    var new_el = tpl_occupant(
                        _.extend(
                            { 'jid': '',
                              'show': show,
                              'hint_show': _converse.PRETTY_CHAT_STATUS[show],
                              'hint_occupant': __('Click to mention '+this.model.get('nick')+' in your message.'),
                              'desc_moderator': __('This user is a moderator.'),
                              'desc_occupant': __('This user can send messages in this room.'),
                              'desc_visitor': __('This user can NOT send messages in this room.')
                            }, this.model.toJSON()
                        )
                    );
                    var $parents = this.$el.parents();
                    if ($parents.length) {
                        this.$el.replaceWith(new_el);
                        this.setElement($parents.first().children('#'+this.model.get('id')), true);
                        this.delegateEvents();
                    } else {
                        this.$el.replaceWith(new_el);
                        this.setElement(new_el, true);
                    }
                    return this;
                },

                destroy: function () {
                    this.$el.remove();
                }
            });

            _converse.ChatRoomOccupants = Backbone.Collection.extend({
                model: _converse.ChatRoomOccupant
            });

            _converse.ChatRoomOccupantsView = Backbone.Overview.extend({
                tagName: 'div',
                className: 'occupants',

                initialize: function () {
                    this.model.on("add", this.onOccupantAdded, this);
                    this.chatroomview = this.model.chatroomview;
                    this.chatroomview.model.on('change:open', this.renderInviteWidget, this);
                    this.chatroomview.model.on('change:affiliation', this.renderInviteWidget, this);
                    this.chatroomview.model.on('change:hidden', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:mam_enabled', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:membersonly', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:moderated', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:nonanonymous', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:open', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:passwordprotected', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:persistent', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:public', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:semianonymous', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:temporary', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:unmoderated', this.onFeatureChanged, this);
                    this.chatroomview.model.on('change:unsecured', this.onFeatureChanged, this);
                },

                render: function () {
                    this.el.innerHTML = tpl_chatroom_sidebar(
                        _.extend(this.chatroomview.model.toJSON(), {
                            'allow_muc_invitations': _converse.allow_muc_invitations,
                            'label_occupants': __('Occupants')
                        })
                    );
                    if (_converse.allow_muc_invitations) {
                        _converse.api.waitUntil('rosterContactsFetched').then(
                            this.renderInviteWidget.bind(this)
                        );
                    }
                    return this.renderRoomFeatures();
                },

                renderInviteWidget: function () {
                    var form = this.el.querySelector('form.room-invite');
                    if (this.shouldInviteWidgetBeShown()) {
                        if (_.isNull(form)) {
                            var heading = this.el.querySelector('.occupants-heading');
                            form = tpl_chatroom_invite({
                                'label_invitation': __('Invite'),
                            });
                            heading.insertAdjacentHTML('afterend', form);
                            this.initInviteWidget();
                        }
                    } else {
                        if (!_.isNull(form)) {
                            form.remove();
                        }
                    }
                    return this;
                },

                renderRoomFeatures: function () {
                    var picks = _.pick(this.chatroomview.model.attributes, ROOM_FEATURES),
                        iteratee = function (a, v) { return a || v; },
                        el = this.el.querySelector('.chatroom-features');

                    el.innerHTML = tpl_chatroom_features(
                            _.extend(this.chatroomview.model.toJSON(), {
                                'has_features': _.reduce(_.values(picks), iteratee),
                                'label_features': __('Features'),
                                'label_hidden': __('Hidden'),
                                'label_mam_enabled': __('Message archiving'),
                                'label_membersonly': __('Members only'),
                                'label_moderated': __('Moderated'),
                                'label_nonanonymous': __('Non-anonymous'),
                                'label_open': __('Open'),
                                'label_passwordprotected': __('Password protected'),
                                'label_persistent': __('Persistent'),
                                'label_public': __('Public'),
                                'label_semianonymous': __('Semi-anonymous'),
                                'label_temporary': __('Temporary'),
                                'label_unmoderated': __('Unmoderated'),
                                'label_unsecured': __('Unsecured'),
                                'tt_hidden': __('This room is not publicly searchable'),
                                'tt_mam_enabled': __('Messages are archived on the server'),
                                'tt_membersonly': __('This room is restricted to members only'),
                                'tt_moderated': __('This room is being moderated'),
                                'tt_nonanonymous': __('All other room occupants can see your Jabber ID'),
                                'tt_open': __('Anyone can join this room'),
                                'tt_passwordprotected': __('This room requires a password before entry'),
                                'tt_persistent': __('This room persists even if it\'s unoccupied'),
                                'tt_public': __('This room is publicly searchable'),
                                'tt_semianonymous': __('Only moderators can see your Jabber ID'),
                                'tt_temporary': __('This room will disappear once the last person leaves'),
                                'tt_unmoderated': __('This room is not being moderated'),
                                'tt_unsecured': __('This room does not require a password upon entry')
                            }));
                    this.setOccupantsHeight();
                    return this;
                },

                onFeatureChanged: function (model) {
                    /* When a feature has been changed, it's logical opposite
                     * must be set to the opposite value.
                     *
                     * So for example, if "temporary" was set to "false", then
                     * "persistent" will be set to "true" in this method.
                     *
                     * Additionally a debounced render method is called to make
                     * sure the features widget gets updated.
                     */
                    if (_.isUndefined(this.debouncedRenderRoomFeatures)) {
                        this.debouncedRenderRoomFeatures = _.debounce(
                            this.renderRoomFeatures, 100, {'leading': false}
                        );
                    }
                    var changed_features = {}
                    _.each(_.keys(model.changed), function (k) {
                        if (!_.isNil(ROOM_FEATURES_MAP[k])) {
                            changed_features[ROOM_FEATURES_MAP[k]] = !model.changed[k];
                        }
                    });
                    this.chatroomview.model.save(changed_features, {'silent': true});
                    this.debouncedRenderRoomFeatures();
                },


                setOccupantsHeight: function () {
                    var el = this.el.querySelector('.chatroom-features');
                    this.el.querySelector('.occupant-list').style.cssText =
                        'height: calc(100% - '+el.offsetHeight+'px - 5em);';
                },

                onOccupantAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view) {
                        view = this.add(item.get('id'), new _converse.ChatRoomOccupantView({model: item}));
                    } else {
                        delete view.model; // Remove ref to old model to help garbage collection
                        view.model = item;
                        view.initialize();
                    }
                    this.$('.occupant-list').append(view.render().$el);
                },

                parsePresence: function (pres) {
                    var id = Strophe.getResourceFromJid(pres.getAttribute("from"));
                    var data = {
                        nick: id,
                        type: pres.getAttribute("type"),
                        states: []
                    };
                    _.each(pres.childNodes, function (child) {
                        switch (child.nodeName) {
                            case "status":
                                data.status = child.textContent || null;
                                break;
                            case "show":
                                data.show = child.textContent || 'online';
                                break;
                            case "x":
                                if (child.getAttribute("xmlns") === Strophe.NS.MUC_USER) {
                                    _.each(child.childNodes, function (item) {
                                        switch (item.nodeName) {
                                            case "item":
                                                data.affiliation = item.getAttribute("affiliation");
                                                data.role = item.getAttribute("role");
                                                data.jid = item.getAttribute("jid");
                                                data.nick = item.getAttribute("nick") || data.nick;
                                                break;
                                            case "status":
                                                if (item.getAttribute("code")) {
                                                    data.states.push(item.getAttribute("code"));
                                                }
                                        }
                                    });
                                }
                        }
                    });
                    return data;
                },

                findOccupant: function (data) {
                    /* Try to find an existing occupant based on the passed in
                     * data object.
                     *
                     * If we have a JID, we use that as lookup variable,
                     * otherwise we use the nick. We don't always have both,
                     * but should have at least one or the other.
                     */
                    var jid = Strophe.getBareJidFromJid(data.jid);
                    if (jid !== null) {
                        return this.model.where({'jid': jid}).pop();
                    } else {
                        return this.model.where({'nick': data.nick}).pop();
                    }
                },

                updateOccupantsOnPresence: function (pres) {
                    /* Given a presence stanza, update the occupant models
                     * based on its contents.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The presence stanza
                     */
                    var data = this.parsePresence(pres);
                    if (data.type === 'error') {
                        return true;
                    }
                    var occupant = this.findOccupant(data);
                    switch (data.type) {
                        case 'unavailable':
                            if (occupant) { occupant.destroy(); }
                            break;
                        default:
                            var jid = Strophe.getBareJidFromJid(data.jid);
                            var attributes = _.extend(data, {
                                'jid': jid ? jid : undefined,
                                'resource': data.jid ? Strophe.getResourceFromJid(data.jid) : undefined
                            });
                            if (occupant) {
                                occupant.save(attributes);
                            } else {
                                this.model.create(attributes);
                            }
                    }
                },

                promptForInvite: function (suggestion) {
                    var reason = prompt(
                        __(___('You are about to invite %1$s to the chat room "%2$s". '), suggestion.text.label, this.model.get('id')) +
                        __("You may optionally include a message, explaining the reason for the invitation.")
                    );
                    if (reason !== null) {
                        this.chatroomview.directInvite(suggestion.text.value, reason);
                    }
                    suggestion.target.value = '';
                },

                inviteFormSubmitted: function (evt) {
                    evt.preventDefault();
                    var el = evt.target.querySelector('input.invited-contact');
                    this.promptForInvite({
                        'target': el,
                        'text': {
                            'label': el.value,
                            'value': el.value
                        }});
                },

                shouldInviteWidgetBeShown: function () {
                    return _converse.allow_muc_invitations &&
                        (this.chatroomview.model.get('open') ||
                            this.chatroomview.model.get('affiliation') === "owner"
                        );
                },

                initInviteWidget: function () {
                    var form = this.el.querySelector('form.room-invite');
                    if (_.isNull(form)) {
                        return;
                    }
                    form.addEventListener('submit', this.inviteFormSubmitted.bind(this));
                    var el = this.el.querySelector('input.invited-contact');
                    var list = _converse.roster.map(function (item) {
                            var label = item.get('fullname') || item.get('jid');
                            return {'label': label, 'value':item.get('jid')};
                        });
                    var awesomplete = new Awesomplete(el, {
                        'minChars': 1,
                        'list': list
                    });
                    el.addEventListener('awesomplete-selectcomplete', this.promptForInvite.bind(this));
                }
            });

            _converse.RoomsPanel = Backbone.View.extend({
                /* Backbone View which renders the "Rooms" tab and accompanying
                 * panel in the control box.
                 *
                 * In this panel, chat rooms can be listed, joined and new rooms
                 * can be created.
                 */
                tagName: 'div',
                className: 'controlbox-pane',
                id: 'chatrooms',
                events: {
                    'submit form.add-chatroom': 'createChatRoom',
                    'click input#show-rooms': 'showRooms',
                    'click a.open-room': 'createChatRoom',
                    'click a.room-info': 'toggleRoomInfo',
                    'change input[name=server]': 'setDomain',
                    'change input[name=nick]': 'setNick'
                },

                initialize: function (cfg) {
                    this.$parent = cfg.$parent;
                    this.model.on('change:muc_domain', this.onDomainChange, this);
                    this.model.on('change:nick', this.onNickChange, this);
                },

                render: function () {
                    this.$parent.append(
                        this.$el.html(
                            tpl_room_panel({
                                'server_input_type': _converse.hide_muc_server && 'hidden' || 'text',
                                'server_label_global_attr': _converse.hide_muc_server && ' hidden' || '',
                                'label_room_name': __('Room name'),
                                'label_nickname': __('Nickname'),
                                'label_server': __('Server'),
                                'label_join': __('Join Room'),
                                'label_show_rooms': __('Show rooms')
                            })
                        ));
                    this.$tabs = this.$parent.parent().find('#controlbox-tabs');

                    var controlbox = _converse.chatboxes.get('controlbox');
                    this.$tabs.append(tpl_chatrooms_tab({
                        'label_rooms': __('Rooms'),
                        'is_current': controlbox.get('active-panel') === ROOMS_PANEL_ID
                    }));
                    if (controlbox.get('active-panel') !== ROOMS_PANEL_ID) {
                        this.$el.addClass('hidden');
                    }
                    return this;
                },

                onDomainChange: function (model) {
                    var $server = this.$el.find('input.new-chatroom-server');
                    $server.val(model.get('muc_domain'));
                    if (_converse.auto_list_rooms) {
                        this.updateRoomsList();
                    }
                },

                onNickChange: function (model) {
                    var $nick = this.$el.find('input.new-chatroom-nick');
                    $nick.val(model.get('nick'));
                },

                informNoRoomsFound: function () {
                    var $available_chatrooms = this.$el.find('#available-chatrooms');
                    // For translators: %1$s is a variable and will be replaced with the XMPP server name
                    $available_chatrooms.html('<dt>'+__('No rooms on %1$s',this.model.get('muc_domain'))+'</dt>');
                    $('input#show-rooms').show().siblings('span.spinner').remove();
                },

                onRoomsFound: function (iq) {
                    /* Handle the IQ stanza returned from the server, containing
                     * all its public rooms.
                     */
                    var name, jid, i, fragment,
                        $available_chatrooms = this.$el.find('#available-chatrooms');
                    this.rooms = $(iq).find('query').find('item');
                    if (this.rooms.length) {
                        // For translators: %1$s is a variable and will be
                        // replaced with the XMPP server name
                        $available_chatrooms.html('<dt>'+__('Rooms on %1$s',this.model.get('muc_domain'))+'</dt>');
                        fragment = document.createDocumentFragment();
                        for (i=0; i<this.rooms.length; i++) {
                            name = Strophe.unescapeNode($(this.rooms[i]).attr('name')||$(this.rooms[i]).attr('jid'));
                            jid = $(this.rooms[i]).attr('jid');
                            fragment.appendChild($(
                                tpl_room_item({
                                    'name':name,
                                    'jid':jid,
                                    'open_title': __('Click to open this room'),
                                    'info_title': __('Show more information on this room')
                                    })
                                )[0]);
                        }
                        $available_chatrooms.append(fragment);
                        $('input#show-rooms').show().siblings('span.spinner').remove();
                    } else {
                        this.informNoRoomsFound();
                    }
                    return true;
                },

                updateRoomsList: function () {
                    /* Send and IQ stanza to the server asking for all rooms
                     */
                    _converse.connection.sendIQ(
                        $iq({
                            to: this.model.get('muc_domain'),
                            from: _converse.connection.jid,
                            type: "get"
                        }).c("query", {xmlns: Strophe.NS.DISCO_ITEMS}),
                        this.onRoomsFound.bind(this),
                        this.informNoRoomsFound.bind(this)
                    );
                },

                showRooms: function () {
                    var $available_chatrooms = this.$el.find('#available-chatrooms');
                    var $server = this.$el.find('input.new-chatroom-server');
                    var server = $server.val();
                    if (!server) {
                        $server.addClass('error');
                        return;
                    }
                    this.$el.find('input.new-chatroom-name').removeClass('error');
                    $server.removeClass('error');
                    $available_chatrooms.empty();
                    $('input#show-rooms').hide().after('<span class="spinner"/>');
                    this.model.save({muc_domain: server});
                    this.updateRoomsList();
                },

                insertRoomInfo: function (el, stanza) {
                    /* Insert room info (based on returned #disco IQ stanza)
                     *
                     * Parameters:
                     *  (HTMLElement) el: The HTML DOM element that should
                     *      contain the info.
                     *  (XMLElement) stanza: The IQ stanza containing the room
                     *      info.
                     */
                    var $stanza = $(stanza);
                    // All MUC features found here: http://xmpp.org/registrar/disco-features.html
                    $(el).find('span.spinner').replaceWith(
                        tpl_room_description({
                            'desc': $stanza.find('field[var="muc#roominfo_description"] value').text(),
                            'occ': $stanza.find('field[var="muc#roominfo_occupants"] value').text(),
                            'hidden': $stanza.find('feature[var="muc_hidden"]').length,
                            'membersonly': $stanza.find('feature[var="muc_membersonly"]').length,
                            'moderated': $stanza.find('feature[var="muc_moderated"]').length,
                            'nonanonymous': $stanza.find('feature[var="muc_nonanonymous"]').length,
                            'open': $stanza.find('feature[var="muc_open"]').length,
                            'passwordprotected': $stanza.find('feature[var="muc_passwordprotected"]').length,
                            'persistent': $stanza.find('feature[var="muc_persistent"]').length,
                            'publicroom': $stanza.find('feature[var="muc_public"]').length,
                            'semianonymous': $stanza.find('feature[var="muc_semianonymous"]').length,
                            'temporary': $stanza.find('feature[var="muc_temporary"]').length,
                            'unmoderated': $stanza.find('feature[var="muc_unmoderated"]').length,
                            'label_desc': __('Description:'),
                            'label_occ': __('Occupants:'),
                            'label_features': __('Features:'),
                            'label_requires_auth': __('Requires authentication'),
                            'label_hidden': __('Hidden'),
                            'label_requires_invite': __('Requires an invitation'),
                            'label_moderated': __('Moderated'),
                            'label_non_anon': __('Non-anonymous'),
                            'label_open_room': __('Open room'),
                            'label_permanent_room': __('Permanent room'),
                            'label_public': __('Public'),
                            'label_semi_anon':  __('Semi-anonymous'),
                            'label_temp_room':  __('Temporary room'),
                            'label_unmoderated': __('Unmoderated')
                        })
                    );
                },

                toggleRoomInfo: function (ev) {
                    /* Show/hide extra information about a room in the listing.
                     */
                    var target = ev.target,
                        $parent = $(target).parent('dd'),
                        $div = $parent.find('div.room-info');
                    if ($div.length) {
                        $div.remove();
                    } else {
                        $parent.find('span.spinner').remove();
                        $parent.append('<span class="spinner hor_centered"/>');
                        _converse.connection.disco.info(
                            $(target).attr('data-room-jid'), null, _.partial(this.insertRoomInfo, $parent[0])
                        );
                    }
                },

                createChatRoom: function (ev) {
                    ev.preventDefault();
                    var name, $name, server, $server, jid;
                    if (ev.type === 'click') {
                        name = $(ev.target).text();
                        jid = $(ev.target).attr('data-room-jid');
                    } else {
                        $name = this.$el.find('input.new-chatroom-name');
                        $server= this.$el.find('input.new-chatroom-server');
                        server = $server.val();
                        name = $name.val().trim();
                        $name.val(''); // Clear the input
                        if (name && server) {
                            jid = Strophe.escapeNode(name.toLowerCase()) + '@' + server.toLowerCase();
                            $name.removeClass('error');
                            $server.removeClass('error');
                            this.model.save({muc_domain: server});
                        } else {
                            if (!name) { $name.addClass('error'); }
                            if (!server) { $server.addClass('error'); }
                            return;
                        }
                    }
                    _converse.createChatRoom({
                        'id': jid,
                        'jid': jid,
                        'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                        'type': 'chatroom',
                        'box_id': b64_sha1(jid)
                    });
                },

                setDomain: function (ev) {
                    this.model.save({muc_domain: ev.target.value});
                },

                setNick: function (ev) {
                    this.model.save({nick: ev.target.value});
                }
            });
            /************************ End of ChatRoomView **********************/


            _converse.onDirectMUCInvitation = function (message) {
                /* A direct MUC invitation to join a room has been received
                 * See XEP-0249: Direct MUC invitations.
                 *
                 * Parameters:
                 *  (XMLElement) message: The message stanza containing the
                 *        invitation.
                 */
                var $message = $(message),
                    $x = $message.children('x[xmlns="jabber:x:conference"]'),
                    from = Strophe.getBareJidFromJid($message.attr('from')),
                    room_jid = $x.attr('jid'),
                    reason = $x.attr('reason'),
                    contact = _converse.roster.get(from),
                    result;

                if (_converse.auto_join_on_invite) {
                    result = true;
                } else {
                    // Invite request might come from someone not your roster list
                    contact = contact? contact.get('fullname'): Strophe.getNodeFromJid(from);
                    if (!reason) {
                        result = confirm(
                            __(___("%1$s has invited you to join a chat room: %2$s"),
                                contact, room_jid)
                        );
                    } else {
                        result = confirm(
                            __(___('%1$s has invited you to join a chat room: %2$s, and left the following reason: "%3$s"'),
                                contact, room_jid, reason)
                        );
                    }
                }
                if (result === true) {
                    var chatroom = _converse.createChatRoom({
                        'id': room_jid,
                        'jid': room_jid,
                        'name': Strophe.unescapeNode(Strophe.getNodeFromJid(room_jid)),
                        'nick': Strophe.unescapeNode(Strophe.getNodeFromJid(_converse.connection.jid)),
                        'type': 'chatroom',
                        'box_id': b64_sha1(room_jid),
                        'password': $x.attr('password')
                    });
                    if (chatroom.get('connection_status') === ROOMSTATUS.DISCONNECTED) {
                        _converse.chatboxviews.get(room_jid).join();
                    }
                }
            };

            if (_converse.allow_muc_invitations) {
                var registerDirectInvitationHandler = function () {
                    _converse.connection.addHandler(
                        function (message) {
                            _converse.onDirectMUCInvitation(message);
                            return true;
                        }, 'jabber:x:conference', 'message');
                };
                _converse.on('connected', registerDirectInvitationHandler);
                _converse.on('reconnected', registerDirectInvitationHandler);
            }

            var autoJoinRooms = function () {
                /* Automatically join chat rooms, based on the
                 * "auto_join_rooms" configuration setting, which is an array
                 * of strings (room JIDs) or objects (with room JID and other
                 * settings).
                 */
                _.each(_converse.auto_join_rooms, function (room) {
                    if (_.isString(room)) {
                        _converse.api.rooms.open(room);
                    } else if (_.isObject(room)) {
                        _converse.api.rooms.open(room.jid, room.nick);
                    } else {
                        _converse.log('Invalid room criteria specified for "auto_join_rooms"', 'error');
                    }
                });
            };
            _converse.on('chatBoxesFetched', autoJoinRooms);

            _converse.getChatRoom = function (jid, attrs, fetcher) {
                jid = jid.toLowerCase();
                return _converse.getViewForChatBox(fetcher(_.extend({
                    'id': jid,
                    'jid': jid,
                    'name': Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                    'type': 'chatroom',
                    'box_id': b64_sha1(jid)
                }, attrs)));
            };

            /* We extend the default converse.js API to add methods specific to MUC
             * chat rooms.
             */
            _.extend(_converse.api, {
                'rooms': {
                    'close': function (jids) {
                        if (_.isUndefined(jids)) {
                            _converse.chatboxviews.each(function (view) {
                                if (view.is_chatroom && view.model) {
                                    view.close();
                                }
                            });
                        } else if (_.isString(jids)) {
                            var view = _converse.chatboxviews.get(jids);
                            if (view) { view.close(); }
                        } else {
                            _.each(jids, function (jid) {
                                var view = _converse.chatboxviews.get(jid);
                                if (view) { view.close(); }
                            });
                        }
                    },
                    'open': function (jids, attrs) {
                        if (_.isString(attrs)) {
                            attrs = {'nick': attrs};
                        } else if (_.isUndefined(attrs)) {
                            attrs = {};
                        }
                        if (_.isUndefined(attrs.maximize)) {
                            attrs.maximize = false;
                        }
                        if (!attrs.nick && _converse.muc_nickname_from_jid) {
                            attrs.nick = Strophe.getNodeFromJid(_converse.bare_jid);
                        }
                        if (_.isUndefined(jids)) {
                            throw new TypeError('rooms.open: You need to provide at least one JID');
                        } else if (_.isString(jids)) {
                            return _converse.getChatRoom(jids, attrs, _converse.createChatRoom);
                        }
                        return _.map(jids, _.partial(_converse.getChatRoom, _, attrs, _converse.createChatRoom));
                    },
                    'get': function (jids, attrs, create) {
                        if (_.isString(attrs)) {
                            attrs = {'nick': attrs};
                        } else if (_.isUndefined(attrs)) {
                            attrs = {};
                        }
                        if (_.isUndefined(jids)) {
                            var result = [];
                            _converse.chatboxes.each(function (chatbox) {
                                if (chatbox.get('type') === 'chatroom') {
                                    result.push(_converse.getViewForChatBox(chatbox));
                                }
                            });
                            return result;
                        }
                        var fetcher = _.partial(_converse.chatboxviews.getChatBox.bind(_converse.chatboxviews), _, create);
                        if (!attrs.nick) {
                            attrs.nick = Strophe.getNodeFromJid(_converse.bare_jid);
                        }
                        if (_.isString(jids)) {
                            return _converse.getChatRoom(jids, attrs, fetcher);
                        }
                        return _.map(jids, _.partial(_converse.getChatRoom, _, attrs, fetcher));
                    }
                }
            });

            var reconnectToChatRooms = function () {
                /* Upon a reconnection event from converse, join again
                 * all the open chat rooms.
                 */
                _converse.chatboxviews.each(function (view) {
                    if (view.model.get('type') === 'chatroom') {
                        view.model.save('connection_status', ROOMSTATUS.DISCONNECTED);
                        view.join();
                    }
                });
            };
            _converse.on('reconnected', reconnectToChatRooms);

            var disconnectChatRooms = function () {
                /* When disconnecting, or reconnecting, mark all chat rooms as
                 * disconnected, so that they will be properly entered again
                 * when fetched from session storage.
                 */
                _converse.chatboxes.each(function (model) {
                    if (model.get('type') === 'chatroom') {
                        model.save('connection_status', ROOMSTATUS.DISCONNECTED);
                    }
                });
            };
            _converse.on('reconnecting', disconnectChatRooms);
            _converse.on('disconnecting', disconnectChatRooms);
        }
    });
}));


define('tpl!chatroom_bookmark_form', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<div class="chatroom-form-container">\n    <form class="pure-form converse-form chatroom-form">\n        <fieldset>\n            <legend>' +
__e(heading) +
'</legend>\n            <label>' +
__e(label_name) +
'</label>\n            <input type="text" name="name" required="required"/>\n            <label>' +
__e(label_autojoin) +
'</label>\n            <input type="checkbox" name="autojoin"/>\n            <label>' +
__e(label_nick) +
'</label>\n            <input type="text" name="nick" value="' +
__e(default_nick) +
'"/>\n        </fieldset>\n        <fieldset>\n            <input class="pure-button button-primary" type="submit" value="' +
__e(label_submit) +
'"/>\n            <input class="pure-button button-cancel" type="button" value="' +
__e(label_cancel) +
'"/>\n        </fieldset>\n    </form>\n</div>\n';

}
return __p
};});


define('tpl!chatroom_bookmark_toggle', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<a class="chatbox-btn toggle-bookmark icon-pushpin\n   ';
 if (bookmarked) {;
__p += '\n    button-on\n   ';
 } ;
__p += '" title="' +
__e(info_toggle_bookmark) +
'"></a>\n';

}
return __p
};});


define('tpl!bookmark', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<dd class="available-chatroom">\n    <a class="open-room" data-room-jid="' +
__e(jid) +
'" title="' +
__e(open_title) +
'" href="#">' +
__e(name) +
'</a>\n    <a class="remove-bookmark icon-close" data-room-jid="' +
__e(jid) +
'" data-bookmark-name="' +
__e(name) +
'"\n       title="' +
__e(info_remove) +
'" href="#">&nbsp;</a>\n    <a class="room-info icon-room-info" data-room-jid="' +
__e(jid) +
'"\n       title="' +
__e(info_title) +
'" href="#">&nbsp;</a>\n</dd>\n';

}
return __p
};});


define('tpl!bookmarks_list', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<a href="#" class="bookmarks-toggle icon-' +
__e(toggle_state) +
'" title="' +
__e(desc_bookmarks) +
'">' +
__e(label_bookmarks) +
'</a>\n<dl class="bookmarks rooms-list"></dl>\n';

}
return __p
};});

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

/* This is a Converse.js plugin which add support for bookmarks specified
 * in XEP-0048.
 */
(function (root, factory) {
    define('converse-bookmarks',[ "utils",
            "converse-core",
            "converse-muc",
            "tpl!chatroom_bookmark_form",
            "tpl!chatroom_bookmark_toggle",
            "tpl!bookmark",
            "tpl!bookmarks_list"
        ],
        factory);
}(this, function (
        utils,
        converse,
        muc,
        tpl_chatroom_bookmark_form,
        tpl_chatroom_bookmark_toggle,
        tpl_bookmark,
        tpl_bookmarks_list
    ) {

    var $ = converse.env.jQuery,
        Strophe = converse.env.Strophe,
        $iq = converse.env.$iq,
        b64_sha1 = converse.env.b64_sha1,
        _ = converse.env._;

    converse.plugins.add('converse-bookmarks', {
        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            clearSession: function () {
                this.__super__.clearSession.apply(this, arguments);
                if (!_.isUndefined(this.bookmarks)) {
                    this.bookmarks.browserStorage._clear();
                }
            },

            ChatRoomView: {
                events: {
                    'click .toggle-bookmark': 'toggleBookmark'
                },

                initialize: function () {
                    this.__super__.initialize.apply(this, arguments);
                    this.model.on('change:bookmarked', this.onBookmarked, this);
                    this.setBookmarkState();
                },

                generateHeadingHTML: function () {
                    var _converse = this.__super__._converse,
                        __ = _converse.__,
                        html = this.__super__.generateHeadingHTML.apply(this, arguments);
                    if (_converse.allow_bookmarks) {
                        var div = document.createElement('div');
                        div.innerHTML = html;
                        var bookmark_button = tpl_chatroom_bookmark_toggle(
                            _.assignIn(
                                this.model.toJSON(),
                                {
                                    info_toggle_bookmark: __('Bookmark this room'),
                                    bookmarked: this.model.get('bookmarked')
                                }
                            ));
                        var close_button = div.querySelector('.close-chatbox-button');
                        close_button.insertAdjacentHTML('afterend', bookmark_button);
                        return div.innerHTML;
                    }
                    return html;
                },

                checkForReservedNick: function () {
                    /* Check if the user has a bookmark with a saved nickanme
                     * for this room, and if so use it.
                     * Otherwise delegate to the super method.
                     */
                    var _converse = this.__super__._converse;
                    if (_.isUndefined(_converse.bookmarks) || !_converse.allow_bookmarks) {
                        return this.__super__.checkForReservedNick.apply(this, arguments);
                    }
                    var model = _converse.bookmarks.findWhere({'jid': this.model.get('jid')});
                    if (!_.isUndefined(model) && model.get('nick')) {
                        this.join(model.get('nick'));
                    } else {
                        return this.__super__.checkForReservedNick.apply(this, arguments);
                    }
                },

                onBookmarked: function () {
                    if (this.model.get('bookmarked')) {
                        this.$('.icon-pushpin').addClass('button-on');
                    } else {
                        this.$('.icon-pushpin').removeClass('button-on');
                    }
                },

                setBookmarkState: function () {
                    /* Set whether the room is bookmarked or not.
                     */
                    var _converse = this.__super__._converse;
                    if (!_.isUndefined(_converse.bookmarks)) {
                        var models = _converse.bookmarks.where({'jid': this.model.get('jid')});
                        if (!models.length) {
                            this.model.save('bookmarked', false);
                        } else {
                            this.model.save('bookmarked', true);
                        }
                    }
                },

                renderBookmarkForm: function () {
                    var _converse = this.__super__._converse,
                        __ = _converse.__,
                        $body = this.$('.chatroom-body');
                    $body.children().addClass('hidden');
                    // Remove any existing forms
                    $body.find('form.chatroom-form').remove();
                    $body.append(
                        tpl_chatroom_bookmark_form({
                            heading: __('Bookmark this room'),
                            label_name: __('The name for this bookmark:'),
                            label_autojoin: __('Would you like this room to be automatically joined upon startup?'),
                            label_nick: __('What should your nickname for this room be?'),
                            default_nick: this.model.get('nick'),
                            label_submit: __('Save'),
                            label_cancel: __('Cancel')
                        }));
                    this.$('.chatroom-form').submit(this.onBookmarkFormSubmitted.bind(this));
                    this.$('.chatroom-form .button-cancel').on('click', this.cancelConfiguration.bind(this));
                },

                onBookmarkFormSubmitted: function (ev) {
                    ev.preventDefault();
                    var _converse = this.__super__._converse;
                    var $form = $(ev.target), that = this;
                    _converse.bookmarks.createBookmark({
                        'jid': this.model.get('jid'),
                        'autojoin': $form.find('input[name="autojoin"]').prop('checked'),
                        'name':  $form.find('input[name=name]').val(),
                        'nick':  $form.find('input[name=nick]').val()
                    });
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.renderAfterTransition();
                        });
                },

                toggleBookmark: function (ev) {
                    if (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    var _converse = this.__super__._converse;
                    var models = _converse.bookmarks.where({'jid': this.model.get('jid')});
                    if (!models.length) {
                        this.renderBookmarkForm();
                    } else {
                        _.forEach(models, function (model) {
                            model.destroy();
                        });
                        this.$('.icon-pushpin').removeClass('button-on');
                    }
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse,
                __ = _converse.__,
                ___ = _converse.___;

            // Configuration values for this plugin
            // ====================================
            // Refer to docs/source/configuration.rst for explanations of these
            // configuration settings.
            this.updateSettings({
                allow_bookmarks: true
            });

            _converse.Bookmark = Backbone.Model;

            _converse.BookmarksList = Backbone.Model.extend({
                defaults: {
                    "toggle-state":  _converse.OPENED
                }
            });

            _converse.Bookmarks = Backbone.Collection.extend({
                model: _converse.Bookmark,

                initialize: function () {
                    this.on('add', _.flow(this.openBookmarkedRoom, this.markRoomAsBookmarked));
                    this.on('remove', this.markRoomAsUnbookmarked, this);
                    this.on('remove', this.sendBookmarkStanza, this);

                    var cache_key = 'converse.room-bookmarks'+_converse.bare_jid;
                    this.cached_flag = b64_sha1(cache_key+'fetched');
                    this.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(cache_key)
                    );
                },

                openBookmarkedRoom: function (bookmark) {
                    if (bookmark.get('autojoin')) {
                        _converse.api.rooms.open(bookmark.get('jid'), bookmark.get('nick'));
                    }
                    return bookmark;
                },

                fetchBookmarks: function () {
                    var deferred = new $.Deferred();
                    var promise = deferred.promise();
                    if (window.sessionStorage.getItem(this.browserStorage.name)) {
                        this.fetch({
                            'success': _.bind(this.onCachedBookmarksFetched, this, deferred),
                            'error':  _.bind(this.onCachedBookmarksFetched, this, deferred)
                        });
                    } else if (! window.sessionStorage.getItem(this.cached_flag)) {
                        // There aren't any cached bookmarks, and the cache is
                        // not set to null. So we query the XMPP server.
                        // If nothing is returned from the XMPP server, we set
                        // the cache to null to avoid calling the server again.
                        this.fetchBookmarksFromServer(deferred);
                    } else {
                        deferred.resolve();
                    }
                    return promise;
                },

                onCachedBookmarksFetched: function (deferred) {
                    return deferred.resolve();
                },

                createBookmark: function (options) {
                    _converse.bookmarks.create(options);
                    _converse.bookmarks.sendBookmarkStanza();
                },

                sendBookmarkStanza: function () {
                    var stanza = $iq({
                            'type': 'set',
                            'from': _converse.connection.jid,
                        })
                        .c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                            .c('publish', {'node': 'storage:bookmarks'})
                                .c('item', {'id': 'current'})
                                    .c('storage', {'xmlns':'storage:bookmarks'});
                    this.each(function (model) {
                        stanza = stanza.c('conference', {
                            'name': model.get('name'),
                            'autojoin': model.get('autojoin'),
                            'jid': model.get('jid'),
                        }).c('nick').t(model.get('nick')).up().up();
                    });
                    stanza.up().up().up();
                    stanza.c('publish-options')
                        .c('x', {'xmlns': Strophe.NS.XFORM, 'type':'submit'})
                            .c('field', {'var':'FORM_TYPE', 'type':'hidden'})
                                .c('value').t('http://jabber.org/protocol/pubsub#publish-options').up().up()
                            .c('field', {'var':'pubsub#persist_items'})
                                .c('value').t('true').up().up()
                            .c('field', {'var':'pubsub#access_model'})
                                .c('value').t('whitelist');
                    _converse.connection.sendIQ(stanza, null, this.onBookmarkError.bind(this));
                },

                onBookmarkError: function (iq) {
                    _converse.log("Error while trying to add bookmark", "error");
                    _converse.log(iq);
                    // We remove all locally cached bookmarks and fetch them
                    // again from the server.
                    this.reset();
                    this.fetchBookmarksFromServer(null);
                    window.alert(__("Sorry, something went wrong while trying to save your bookmark."));
                },

                fetchBookmarksFromServer: function (deferred) {
                    var stanza = $iq({
                        'from': _converse.connection.jid,
                        'type': 'get',
                    }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('items', {'node': 'storage:bookmarks'});
                    _converse.connection.sendIQ(
                        stanza,
                        _.bind(this.onBookmarksReceived, this, deferred),
                        _.bind(this.onBookmarksReceivedError, this, deferred)
                    );
                },

                markRoomAsBookmarked: function (bookmark) {
                    var room = _converse.chatboxes.get(bookmark.get('jid'));
                    if (!_.isUndefined(room)) {
                        room.save('bookmarked', true);
                    }
                },

                markRoomAsUnbookmarked: function (bookmark) {
                    var room = _converse.chatboxes.get(bookmark.get('jid'));
                    if (!_.isUndefined(room)) {
                        room.save('bookmarked', false);
                    }
                },

                onBookmarksReceived: function (deferred, iq) {
                    var bookmarks = $(iq).find(
                        'items[node="storage:bookmarks"] item[id="current"] storage conference'
                    );
                    var that = this;
                    _.forEach(bookmarks, function (bookmark) {
                        that.create({
                            'jid': bookmark.getAttribute('jid'),
                            'name': bookmark.getAttribute('name'),
                            'autojoin': bookmark.getAttribute('autojoin') === 'true',
                            'nick': bookmark.querySelector('nick').textContent
                        });
                    });
                    if (!_.isUndefined(deferred)) {
                        return deferred.resolve();
                    }
                },

                onBookmarksReceivedError: function (deferred, iq) {
                    window.sessionStorage.setItem(this.cached_flag, true);
                    _converse.log('Error while fetching bookmarks');
                    _converse.log(iq);
                    if (!_.isUndefined(deferred)) {
                        return deferred.reject();
                    }
                }
            });

            _converse.BookmarksView = Backbone.View.extend({
                tagName: 'div',
                className: 'bookmarks-list',
                events: {
                    'click .remove-bookmark': 'removeBookmark',
                    'click .bookmarks-toggle': 'toggleBookmarksList'
                },

                initialize: function () {
                    this.model.on('add', this.renderBookmarkListElement, this);
                    this.model.on('remove', this.removeBookmarkListElement, this);

                    var cachekey = 'converse.room-bookmarks'+_converse.bare_jid+'-list-model';
                    this.list_model = new _converse.BookmarksList();
                    this.list_model.id = cachekey;
                    this.list_model.browserStorage = new Backbone.BrowserStorage[_converse.storage](
                        b64_sha1(cachekey)
                    );
                    this.list_model.fetch();
                    this.render();
                },

                render: function () {
                    this.$el.html(tpl_bookmarks_list({
                        'toggle_state': this.list_model.get('toggle-state'),
                        'desc_bookmarks': __('Click to toggle the bookmarks list'),
                        'label_bookmarks': __('Bookmarked Rooms')
                    })).hide();
                    if (this.list_model.get('toggle-state') !== _converse.OPENED) {
                        this.$('.bookmarks').hide();
                    }
                    this.model.each(this.renderBookmarkListElement.bind(this));
                    var controlboxview = _converse.chatboxviews.get('controlbox');
                    if (!_.isUndefined(controlboxview)) {
                        this.$el.prependTo(controlboxview.$('#chatrooms'));
                    }
                    return this.$el;
                },

                removeBookmark: function (ev) {
                    ev.preventDefault();
                    var name = $(ev.target).data('bookmarkName');
                    var jid = $(ev.target).data('roomJid');
                    if (confirm(__(___("Are you sure you want to remove the bookmark \"%1$s\"?"), name))) {
                        _.invokeMap(_converse.bookmarks.where({'jid': jid}), Backbone.Model.prototype.destroy);
                    }
                },

                renderBookmarkListElement: function (item) {
                    var $bookmark = $(tpl_bookmark({
                            'name': item.get('name'),
                            'jid': item.get('jid'),
                            'open_title': __('Click to open this room'),
                            'info_title': __('Show more information on this room'),
                            'info_remove': __('Remove this bookmark')
                        }));
                    this.$('.bookmarks').append($bookmark);
                    if (!this.$el.is(':visible')) {
                        this.$el.show();
                    }
                },

                removeBookmarkListElement: function (item) {
                    this.$('[data-room-jid="'+item.get('jid')+'"]:first').parent().remove();
                    if (this.model.length === 0) {
                        this.$el.hide();
                    }
                },

                toggleBookmarksList: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $el = $(ev.target);
                    if ($el.hasClass("icon-opened")) {
                        this.$('.bookmarks').slideUp('fast');
                        this.list_model.save({'toggle-state': _converse.CLOSED});
                        $el.removeClass("icon-opened").addClass("icon-closed");
                    } else {
                        $el.removeClass("icon-closed").addClass("icon-opened");
                        this.$('.bookmarks').slideDown('fast');
                        this.list_model.save({'toggle-state': _converse.OPENED});
                    }
                }
            });

            var initBookmarks = function () {
                if (!_converse.allow_bookmarks) {
                    return;
                }
                _converse.bookmarks = new _converse.Bookmarks();
                _converse.bookmarks.fetchBookmarks().always(function () {
                    _converse.bookmarksview = new _converse.BookmarksView(
                        {'model': _converse.bookmarks}
                    );
                });
            };
            _converse.on('chatBoxesFetched', initBookmarks);

            var afterReconnection = function () {
                if (!_converse.allow_bookmarks) {
                    return;
                }
                if (_.isUndefined(_converse.bookmarksview)) {
                    initBookmarks();
                } else {
                    _converse.bookmarksview.render();
                }
            };
            _converse.on('reconnected', afterReconnection);
        }
    });
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

// XEP-0059 Result Set Management

(function (root, factory) {
    define('converse-mam',[
            "converse-core",
            "converse-chatview", // Could be made a soft dependency
            "converse-muc", // Could be made a soft dependency
            "strophe.rsm"
    ], factory);
}(this, function (converse) {
    "use strict";
    var $ = converse.env.jQuery,
        Strophe = converse.env.Strophe,
        $iq = converse.env.$iq,
        _ = converse.env._,
        moment = converse.env.moment;

    var RSM_ATTRIBUTES = ['max', 'first', 'last', 'after', 'before', 'index', 'count'];
    // XEP-0313 Message Archive Management
    var MAM_ATTRIBUTES = ['with', 'start', 'end'];

    Strophe.addNamespace('MAM', 'urn:xmpp:mam:0');
    Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');

    converse.plugins.add('converse-mam', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            Features: {
                addClientFeatures: function () {
                    var _converse = this.__super__._converse;
                    _converse.connection.disco.addFeature(Strophe.NS.MAM);
                    return this.__super__.addClientFeatures.apply(this, arguments);
                }
            },

            ChatBox: {
                getMessageAttributes: function ($message, $delay, original_stanza) {
                    var attrs = this.__super__.getMessageAttributes.apply(this, arguments);
                    attrs.archive_id = $(original_stanza).find('result[xmlns="'+Strophe.NS.MAM+'"]').attr('id');
                    return attrs;
                }
            },

            ChatBoxView: {
                render: function () {
                    var result = this.__super__.render.apply(this, arguments);
                    if (!this.disable_mam) {
                        this.$content.on('scroll', _.debounce(this.onScroll.bind(this), 100));
                    }
                    return result;
                },

                afterMessagesFetched: function () {
                    var _converse = this.__super__._converse;
                    if (this.disable_mam ||
                            !_converse.features.findWhere({'var': Strophe.NS.MAM})) {
                        return this.__super__.afterMessagesFetched.apply(this, arguments);
                    }
                    if (!this.model.get('mam_initialized') &&
                            this.model.messages.length < _converse.archived_messages_page_size) {

                        this.fetchArchivedMessages({
                            'before': '', // Page backwards from the most recent message
                            'with': this.model.get('jid'),
                            'max': _converse.archived_messages_page_size
                        });
                        this.model.save({'mam_initialized': true});
                    }
                    return this.__super__.afterMessagesFetched.apply(this, arguments);
                },

                fetchArchivedMessages: function (options) {
                    /* Fetch archived chat messages from the XMPP server.
                     *
                     * Then, upon receiving them, call onMessage on the chat
                     * box, so that they are displayed inside it.
                     */
                    var _converse = this.__super__._converse;
                    if (!_converse.features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.log(
                            "Attempted to fetch archived messages but this "+
                            "user's server doesn't support XEP-0313");
                        return;
                    }
                    if (this.disable_mam) {
                        return;
                    }
                    this.addSpinner();
                    _converse.queryForArchivedMessages(options, function (messages) {
                            this.clearSpinner();
                            if (messages.length) {
                                _.each(messages, _converse.chatboxes.onMessage.bind(_converse.chatboxes));
                            }
                        }.bind(this),
                        function () {
                            this.clearSpinner();
                            _converse.log(
                                "Error or timeout while trying to fetch "+
                                "archived messages", "error");
                        }.bind(this)
                    );
                },

                onScroll: function (ev) {
                    var _converse = this.__super__._converse;
                    if ($(ev.target).scrollTop() === 0 && this.model.messages.length) {
                        this.fetchArchivedMessages({
                            'before': this.model.messages.at(0).get('archive_id'),
                            'with': this.model.get('jid'),
                            'max': _converse.archived_messages_page_size
                        });
                    }
                },
            },

            ChatRoomView: {
                render: function () {
                    var result = this.__super__.render.apply(this, arguments);
                    if (!this.disable_mam) {
                        this.$content.on('scroll', _.debounce(this.onScroll.bind(this), 100));
                    }
                    return result;
                },

                handleMUCMessage: function (stanza) {
                    /* MAM (message archive management XEP-0313) messages are
                     * ignored, since they're handled separately.
                     */
                    var is_mam = $(stanza).find('[xmlns="'+Strophe.NS.MAM+'"]').length > 0;
                    if (is_mam) {
                        return true;
                    }
                    return this.__super__.handleMUCMessage.apply(this, arguments);
                },

                fetchArchivedMessages: function (options) {
                    /* Fetch archived chat messages from the XMPP server.
                     *
                     * Then, upon receiving them, call onChatRoomMessage
                     * so that they are displayed inside it.
                     */
                    var that = this;
                    var _converse = this.__super__._converse;
                    if (!_converse.features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.log(
                            "Attempted to fetch archived messages but this "+
                            "user's server doesn't support XEP-0313");
                        return;
                    }
                    if (!this.model.get('mam_enabled')) {
                        return;
                    }
                    this.addSpinner();
                    _converse.api.archive.query(_.extend(options, {'groupchat': true}),
                        function (messages) {
                            that.clearSpinner();
                            if (messages.length) {
                                _.each(messages, that.onChatRoomMessage.bind(that));
                            }
                        },
                        function () {
                            that.clearSpinner();
                            _converse.log(
                                "Error while trying to fetch archived messages",
                                "error");
                        }
                    );
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by Converse.js's plugin machinery.
             */
            var _converse = this._converse;

            this.updateSettings({
                archived_messages_page_size: '50',
                message_archiving: undefined, // Supported values are 'always', 'never', 'roster' (https://xmpp.org/extensions/xep-0313.html#prefs)
                message_archiving_timeout: 8000, // Time (in milliseconds) to wait before aborting MAM request
            });

            _converse.queryForArchivedMessages = function (options, callback, errback) {
                /* Do a MAM (XEP-0313) query for archived messages.
                 *
                 * Parameters:
                 *    (Object) options - Query parameters, either MAM-specific or also for Result Set Management.
                 *    (Function) callback - A function to call whenever we receive query-relevant stanza.
                 *    (Function) errback - A function to call when an error stanza is received.
                 *
                 * The options parameter can also be an instance of
                 * Strophe.RSM to enable easy querying between results pages.
                 *
                 * The callback function may be called multiple times, first
                 * for the initial IQ result and then for each message
                 * returned. The last time the callback is called, a
                 * Strophe.RSM object is returned on which "next" or "previous"
                 * can be called before passing it in again to this method, to
                 * get the next or previous page in the result set.
                 */
                var date, messages = [];
                if (_.isFunction(options)) {
                    callback = options;
                    errback = callback;
                }
                /*
                if (!_converse.features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.log('This server does not support XEP-0313, Message Archive Management');
                    errback(null);
                    return;
                }
                */
                var queryid = _converse.connection.getUniqueId();
                var attrs = {'type':'set'};
                if (!_.isUndefined(options) && options.groupchat) {
                    if (!options['with']) {
                        throw new Error('You need to specify a "with" value containing the chat room JID, when querying groupchat messages.');
                    }
                    attrs.to = options['with'];
                }
                var stanza = $iq(attrs).c('query', {'xmlns':Strophe.NS.MAM, 'queryid':queryid});
                if (!_.isUndefined(options)) {
                    stanza.c('x', {'xmlns':Strophe.NS.XFORM, 'type': 'submit'})
                            .c('field', {'var':'FORM_TYPE', 'type': 'hidden'})
                            .c('value').t(Strophe.NS.MAM).up().up();

                    if (options['with'] && !options.groupchat) {
                        stanza.c('field', {'var':'with'}).c('value').t(options['with']).up().up();
                    }
                    _.each(['start', 'end'], function (t) {
                        if (options[t]) {
                            date = moment(options[t]);
                            if (date.isValid()) {
                                stanza.c('field', {'var':t}).c('value').t(date.format()).up().up();
                            } else {
                                throw new TypeError('archive.query: invalid date provided for: '+t);
                            }
                        }
                    });
                    stanza.up();
                    if (options instanceof Strophe.RSM) {
                        stanza.cnode(options.toXML());
                    } else if (_.intersection(RSM_ATTRIBUTES, _.keys(options)).length) {
                        stanza.cnode(new Strophe.RSM(options).toXML());
                    }
                }

                if (_.isFunction(callback)) {
                    _converse.connection.addHandler(function (message) {
                        var $msg = $(message), rsm,
                            $fin = $msg.find('fin[xmlns="'+Strophe.NS.MAM+'"]');
                        if ($fin.length && $fin.attr('queryid') === queryid) {
                            rsm = new Strophe.RSM({xml: $fin.find('set')[0]});
                            _.extend(rsm, _.pick(options, ['max']));
                            _.extend(rsm, _.pick(options, MAM_ATTRIBUTES));
                            callback(messages, rsm);
                            return false; // We've received all messages, decommission this handler
                        } else if (queryid === $msg.find('result').attr('queryid')) {
                            messages.push(message);
                        }
                        return true;
                    }, Strophe.NS.MAM);
                }
                _converse.connection.sendIQ(stanza, null, errback, _converse.message_archiving_timeout);
            };

            _.extend(_converse.api, {
                /* Extend default converse.js API to add methods specific to MAM
                 */
                'archive': {
                    'query': _converse.queryForArchivedMessages.bind(_converse)
                }
            });

            _converse.onMAMError = function (iq) {
                if ($(iq).find('feature-not-implemented').length) {
                    _converse.log("Message Archive Management (XEP-0313) not supported by this browser");
                } else {
                    _converse.log("An error occured while trying to set archiving preferences.");
                    _converse.log(iq);
                }
            };

            _converse.onMAMPreferences = function (feature, iq) {
                /* Handle returned IQ stanza containing Message Archive
                 * Management (XEP-0313) preferences.
                 *
                 * XXX: For now we only handle the global default preference.
                 * The XEP also provides for per-JID preferences, which is
                 * currently not supported in converse.js.
                 *
                 * Per JID preferences will be set in chat boxes, so it'll
                 * probbaly be handled elsewhere in any case.
                 */
                var $prefs = $(iq).find('prefs[xmlns="'+Strophe.NS.MAM+'"]');
                var default_pref = $prefs.attr('default');
                var stanza;
                if (default_pref !== _converse.message_archiving) {
                    stanza = $iq({'type': 'set'}).c('prefs', {'xmlns':Strophe.NS.MAM, 'default':_converse.message_archiving});
                    $prefs.children().each(function (idx, child) {
                        stanza.cnode(child).up();
                    });
                    _converse.connection.sendIQ(stanza, _.partial(function (feature, iq) {
                            // XXX: Strictly speaking, the server should respond with the updated prefs
                            // (see example 18: https://xmpp.org/extensions/xep-0313.html#config)
                            // but Prosody doesn't do this, so we don't rely on it.
                            feature.save({'preferences': {'default':_converse.message_archiving}});
                        }, feature),
                        _converse.onMAMError
                    );
                } else {
                    feature.save({'preferences': {'default':_converse.message_archiving}});
                }
            };


            var onFeatureAdded = function (feature) {
                var prefs = feature.get('preferences') || {};
                if (feature.get('var') === Strophe.NS.MAM &&
                        prefs['default'] !== _converse.message_archiving &&
                        !_.isUndefined(_converse.message_archiving) ) {
                    // Ask the server for archiving preferences
                    _converse.connection.sendIQ(
                        $iq({'type': 'get'}).c('prefs', {'xmlns': Strophe.NS.MAM}),
                        _.partial(_converse.onMAMPreferences, feature),
                        _.partial(_converse.onMAMError, feature)
                    );
                }
            };
            _converse.on('serviceDiscovered', onFeatureAdded.bind(_converse.features));
        }
    });
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define('converse-vcard',["converse-core", "strophe.vcard"], factory);
}(this, function (converse) {
    "use strict";
    var Strophe = converse.env.Strophe,
        $ = converse.env.jQuery,
        _ = converse.env._,
        moment = converse.env.moment;

    converse.plugins.add('converse-vcard', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            Features: {
                addClientFeatures: function () {
                    var _converse = this.__super__._converse;
                    this.__super__.addClientFeatures.apply(this, arguments);
                    if (_converse.use_vcards) {
                        _converse.connection.disco.addFeature(Strophe.NS.VCARD);
                    }
                }
            },

            RosterContacts: {
                createRequestingContact: function (presence) {
                    var _converse = this.__super__._converse;
                    var bare_jid = Strophe.getBareJidFromJid(presence.getAttribute('from'));
                    _converse.getVCard(
                        bare_jid,
                        _.partial(_converse.createRequestingContactFromVCard, presence),
                        function (iq, jid) {
                            _converse.log("Error while retrieving vcard for "+jid);
                            _converse.createRequestingContactFromVCard(presence, iq, jid);
                        }
                    );
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse;
            this.updateSettings({
                use_vcards: true,
            });

            _converse.createRequestingContactFromVCard = function (presence, iq, jid, fullname, img, img_type, url) {
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var nick = $(presence).children('nick[xmlns="'+Strophe.NS.NICK+'"]').text();
                var user_data = {
                    jid: bare_jid,
                    subscription: 'none',
                    ask: null,
                    requesting: true,
                    fullname: fullname || nick || bare_jid,
                    image: img,
                    image_type: img_type,
                    url: url,
                    vcard_updated: moment().format()
                };
                _converse.roster.create(user_data);
                _converse.emit('contactRequest', user_data);
            };

            _converse.onVCardError = function (jid, iq, errback) {
                var contact = _converse.roster.get(jid);
                if (contact) {
                    contact.save({ 'vcard_updated': moment().format() });
                }
                if (errback) { errback(iq, jid); }
            };

            _converse.onVCardData = function (jid, iq, callback) {
                var $vcard = $(iq).find('vCard'),
                    fullname = $vcard.find('FN').text(),
                    img = $vcard.find('BINVAL').text(),
                    img_type = $vcard.find('TYPE').text(),
                    url = $vcard.find('URL').text();
                if (jid) {
                    var contact = _converse.roster.get(jid);
                    if (contact) {
                        fullname = _.isEmpty(fullname)? contact.get('fullname') || jid: fullname;
                        contact.save({
                            'fullname': fullname,
                            'image_type': img_type,
                            'image': img,
                            'url': url,
                            'vcard_updated': moment().format()
                        });
                    }
                }
                if (callback) {
                    callback(iq, jid, fullname, img, img_type, url);
                }
            };

            _converse.getVCard = function (jid, callback, errback) {
                /* Request the VCard of another user.
                 *
                 * Parameters:
                 *    (String) jid - The Jabber ID of the user whose VCard
                 *      is being requested.
                 *    (Function) callback - A function to call once the VCard is
                 *      returned.
                 *    (Function) errback - A function to call if an error occured
                 *      while trying to fetch the VCard.
                 */
                if (!_converse.use_vcards) {
                    if (callback) { callback(null, jid); }
                } else {
                    _converse.connection.vcard.get(
                        _.partial(_converse.onVCardData, jid, _, callback),
                        jid,
                        _.partial(_converse.onVCardError, jid, _, errback));
                }
            };

            var updateVCardForChatBox = function (chatbox) {
                if (!_converse.use_vcards) { return; }
                var jid = chatbox.model.get('jid'),
                    contact = _converse.roster.get(jid);
                if ((contact) && (!contact.get('vcard_updated'))) {
                    _converse.getVCard(
                        jid,
                        function (iq, jid, fullname, image, image_type, url) {
                            chatbox.model.save({
                                'fullname' : fullname || jid,
                                'url': url,
                                'image_type': image_type,
                                'image': image
                            });
                        },
                        function () {
                            _converse.log(
                                "updateVCardForChatBox: Error occured while fetching vcard"
                            );
                        }
                    );
                }
            };
            _converse.on('chatBoxInitialized', updateVCardForChatBox);


            var onContactAdd = function (contact) {
                if (!contact.get('vcard_updated')) {
                    // This will update the vcard, which triggers a change
                    // request which will rerender the roster contact.
                    _converse.getVCard(contact.get('jid'));
                }
            };
            _converse.on('initialized', function () {
                _converse.roster.on("add", onContactAdd);
            });

            var fetchOwnVCard = function () {
                if (_converse.xmppstatus.get('fullname') === undefined) {
                    _converse.getVCard(
                        null, // No 'to' attr when getting one's own vCard
                        function (iq, jid, fullname) {
                            _converse.xmppstatus.save({'fullname': fullname});
                        }
                    );
                }
            };
            _converse.on('statusInitialized', fetchOwnVCard);
        }
    });
}));


define('tpl!toolbar_otr', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {

 if (allow_otr)  { ;
__p += '\n    <li class="toggle-otr ' +
__e(otr_status_class) +
'" title="' +
__e(otr_tooltip) +
'">\n        <span class="chat-toolbar-text">' +
__e(otr_translated_status) +
'</span>\n        ';
 if (otr_status == UNENCRYPTED) { ;
__p += '\n            <span class="icon-unlocked"></span>\n        ';
 } ;
__p += '\n        ';
 if (otr_status == UNVERIFIED) { ;
__p += '\n            <span class="icon-lock"></span>\n        ';
 } ;
__p += '\n        ';
 if (otr_status == VERIFIED) { ;
__p += '\n            <span class="icon-lock"></span>\n        ';
 } ;
__p += '\n        ';
 if (otr_status == FINISHED) { ;
__p += '\n            <span class="icon-unlocked"></span>\n        ';
 } ;
__p += '\n        <ul>\n            ';
 if (otr_status == UNENCRYPTED) { ;
__p += '\n               <li><a class="start-otr" href="#">' +
__e(label_start_encrypted_conversation) +
'</a></li>\n            ';
 } ;
__p += '\n            ';
 if (otr_status != UNENCRYPTED) { ;
__p += '\n               <li><a class="start-otr" href="#">' +
__e(label_refresh_encrypted_conversation) +
'</a></li>\n               <li><a class="end-otr" href="#">' +
__e(label_end_encrypted_conversation) +
'</a></li>\n               <li><a class="auth-otr" data-scheme="smp" href="#">' +
__e(label_verify_with_smp) +
'</a></li>\n            ';
 } ;
__p += '\n            ';
 if (otr_status == UNVERIFIED) { ;
__p += '\n               <li><a class="auth-otr" data-scheme="fingerprint" href="#">' +
__e(label_verify_with_fingerprints) +
'</a></li>\n            ';
 } ;
__p += '\n            <li><a href="http://www.cypherpunks.ca/otr/help/3.2.0/levels.php" target="_blank" rel="noopener">' +
__e(label_whats_this) +
'</a></li>\n        </ul>\n    </li>\n';
 } ;
__p += '\n';

}
return __p
};});

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window, crypto, CryptoJS */

/* This is a Converse.js plugin which add support Off-the-record (OTR)
 * encryption of one-on-one chat messages.
 */
(function (root, factory) {

    define('converse-otr',["converse-chatview",
            "tpl!toolbar_otr",
            'otr'
    ], factory);
}(this, function (converse, tpl_toolbar_otr, otr) {
    "use strict";

    // Strophe methods for building stanzas
    var Strophe = converse.env.Strophe,
        utils = converse.env.utils,
        b64_sha1 = converse.env.b64_sha1;
    // Other necessary globals
    var $ = converse.env.jQuery,
        _ = converse.env._;

    var HAS_CSPRNG = ((!_.isUndefined(crypto)) &&
        ((_.isFunction(crypto.randomBytes)) || (_.isFunction(crypto.getRandomValues))
    ));

    var HAS_CRYPTO = HAS_CSPRNG && (
        (!_.isUndefined(otr.OTR)) &&
        (!_.isUndefined(otr.DSA))
    );

    var UNENCRYPTED = 0;
    var UNVERIFIED= 1;
    var VERIFIED= 2;
    var FINISHED = 3;

    var OTR_TRANSLATED_MAPPING  = {}; // Populated in initialize
    var OTR_CLASS_MAPPING = {};
    OTR_CLASS_MAPPING[UNENCRYPTED] = 'unencrypted';
    OTR_CLASS_MAPPING[UNVERIFIED] = 'unverified';
    OTR_CLASS_MAPPING[VERIFIED] = 'verified';
    OTR_CLASS_MAPPING[FINISHED] = 'finished';

    converse.plugins.add('converse-otr', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.
 
            registerGlobalEventHandlers: function () {
                this.__super__.registerGlobalEventHandlers();
                $(document).click(function () {
                    if ($('.toggle-otr ul').is(':visible')) {
                        $('.toggle-otr ul', this).slideUp();
                    }
                    if ($('.toggle-smiley ul').is(':visible')) {
                        $('.toggle-smiley ul', this).slideUp();
                    }
                });
            },

            ChatBox: {
                initialize: function () {
                    this.__super__.initialize.apply(this, arguments);
                    if (this.get('box_id') !== 'controlbox') {
                        this.save({'otr_status': this.get('otr_status') || UNENCRYPTED});
                    }
                },

                shouldPlayNotification: function ($message) {
                    /* Don't play a notification if this is an OTR message but
                     * encryption is not yet set up. That would mean that the
                     * OTR session is still being established, so there are no
                     * "visible" OTR messages being exchanged.
                     */
                    return this.__super__.shouldPlayNotification.apply(this, arguments) &&
                        !(utils.isOTRMessage($message[0]) && !_.includes([UNVERIFIED, VERIFIED], this.get('otr_status')));
                },

                createMessage: function (message, delay, original_stanza) {
                    var _converse = this.__super__._converse,
                        text = _.propertyOf(message.querySelector('body'))('textContent');

                    if ((!text) || (!_converse.allow_otr)) {
                        return this.__super__.createMessage.apply(this, arguments);
                    }
                    if (text.match(/^\?OTRv23?/)) {
                        this.initiateOTR(text);
                    } else {
                        if (_.includes([UNVERIFIED, VERIFIED], this.get('otr_status'))) {
                            this.otr.receiveMsg(text);
                        } else {
                            if (text.match(/^\?OTR/)) {
                                if (!this.otr) {
                                    this.initiateOTR(text);
                                } else {
                                    this.otr.receiveMsg(text);
                                }
                            } else {
                                // Normal unencrypted message.
                                return this.__super__.createMessage.apply(this, arguments);
                            }
                        }
                    }
                },

                generatePrivateKey: function (instance_tag) {
                    var _converse = this.__super__._converse;
                    var key = new otr.DSA();
                    var jid = _converse.connection.jid;
                    if (_converse.cache_otr_key) {
                        this.save({
                            'otr_priv_key': key.packPrivate(),
                            'otr_instance_tag': instance_tag
                        });
                    }
                    return key;
                },
                
                getSession: function (callback) {
                    var _converse = this.__super__._converse,
                        __ = _converse.__;
                    var instance_tag, saved_key;
                    if (_converse.cache_otr_key) {
                        instance_tag = this.get('otr_instance_tag');
                        saved_key = otr.DSA.parsePrivate(this.get('otr_priv_key'));
                        if (saved_key && instance_tag) {
                            this.trigger('showHelpMessages', [__('Re-establishing encrypted session')]);
                            callback({
                                'key': saved_key,
                                'instance_tag': instance_tag
                            });
                            return; // Our work is done here
                        }
                    }
                    // We need to generate a new key and instance tag
                    this.trigger('showHelpMessages', [
                        __('Generating private key.'),
                        __('Your browser might become unresponsive.')],
                        null,
                        true // show spinner
                    );
                    var that = this;
                    window.setTimeout(function () {
                        var instance_tag = otr.OTR.makeInstanceTag();
                        callback({
                            'key': that.generatePrivateKey(instance_tag),
                            'instance_tag': instance_tag
                        });
                    }, 500);
                },

                updateOTRStatus: function (state) {
                    switch (state) {
                        case otr.OTR.CONST.STATUS_AKE_SUCCESS:
                            if (this.otr.msgstate === otr.OTR.CONST.MSGSTATE_ENCRYPTED) {
                                this.save({'otr_status': UNVERIFIED});
                            }
                            break;
                        case otr.OTR.CONST.STATUS_END_OTR:
                            if (this.otr.msgstate === otr.OTR.CONST.MSGSTATE_FINISHED) {
                                this.save({'otr_status': FINISHED});
                            } else if (this.otr.msgstate === otr.OTR.CONST.MSGSTATE_PLAINTEXT) {
                                this.save({'otr_status': UNENCRYPTED});
                            }
                            break;
                    }
                },

                onSMP: function (type, data) {
                    // Event handler for SMP (Socialist's Millionaire Protocol)
                    // used by OTR (off-the-record).
                    var _converse = this.__super__._converse,
                        __ = _converse.__;
                    switch (type) {
                        case 'question':
                            this.otr.smpSecret(prompt(__(
                                'Authentication request from %1$s\n\nYour chat contact is attempting to verify your identity, by asking you the question below.\n\n%2$s',
                                [this.get('fullname'), data])));
                            break;
                        case 'trust':
                            if (data === true) {
                                this.save({'otr_status': VERIFIED});
                            } else {
                                this.trigger(
                                    'showHelpMessages',
                                    [__("Could not verify this user's identify.")],
                                    'error');
                                this.save({'otr_status': UNVERIFIED});
                            }
                            break;
                        default:
                            throw new TypeError('ChatBox.onSMP: Unknown type for SMP');
                    }
                },

                initiateOTR: function (query_msg) {
                    // Sets up an OTR object through which we can send and receive
                    // encrypted messages.
                    //
                    // If 'query_msg' is passed in, it means there is an alread incoming
                    // query message from our contact. Otherwise, it is us who will
                    // send the query message to them.
                    var _converse = this.__super__._converse,
                        __ = _converse.__;
                    this.save({'otr_status': UNENCRYPTED});
                    this.getSession(function (session) {
                        var _converse = this.__super__._converse;
                        this.otr = new otr.OTR({
                            fragment_size: 140,
                            send_interval: 200,
                            priv: session.key,
                            instance_tag: session.instance_tag,
                            debug: this.debug
                        });
                        this.otr.on('status', this.updateOTRStatus.bind(this));
                        this.otr.on('smp', this.onSMP.bind(this));

                        this.otr.on('ui', function (msg) {
                            this.trigger('showReceivedOTRMessage', msg);
                        }.bind(this));
                        this.otr.on('io', function (msg) {
                            this.trigger('sendMessage', new _converse.Message({ message: msg }));
                        }.bind(this));
                        this.otr.on('error', function (msg) {
                            this.trigger('showOTRError', msg);
                        }.bind(this));

                        this.trigger('showHelpMessages', [__('Exchanging private key with contact.')]);
                        if (query_msg) {
                            this.otr.receiveMsg(query_msg);
                        } else {
                            this.otr.sendQueryMsg();
                        }
                    }.bind(this));
                },

                endOTR: function () {
                    if (this.otr) {
                        this.otr.endOtr();
                    }
                    this.save({'otr_status': UNENCRYPTED});
                }
            },

            ChatBoxView:  {
                events: {
                    'click .toggle-otr': 'toggleOTRMenu',
                    'click .start-otr': 'startOTRFromToolbar',
                    'click .end-otr': 'endOTR',
                    'click .auth-otr': 'authOTR'
                },

                initialize: function () {
                    var _converse = this.__super__._converse;
                    this.__super__.initialize.apply(this, arguments);
                    this.model.on('change:otr_status', this.onOTRStatusChanged, this);
                    this.model.on('showOTRError', this.showOTRError, this);
                    this.model.on('showSentOTRMessage', function (text) {
                        this.showMessage({'message': text, 'sender': 'me'});
                    }, this);
                    this.model.on('showReceivedOTRMessage', function (text) {
                        this.showMessage({'message': text, 'sender': 'them'});
                    }, this);
                    if ((_.includes([UNVERIFIED, VERIFIED], this.model.get('otr_status'))) || _converse.use_otr_by_default) {
                        this.model.initiateOTR();
                    }
                },

                createMessageStanza: function () {
                    var stanza = this.__super__.createMessageStanza.apply(this, arguments);
                    if (this.model.get('otr_status') !== UNENCRYPTED || utils.isOTRMessage(stanza.nodeTree)) {
                        // OTR messages aren't carbon copied
                        stanza.c('private', {'xmlns': Strophe.NS.CARBONS}).up()
                              .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                              .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS}).up()
                              .c('no-copy', {'xmlns': Strophe.NS.HINTS});
                    }
                    return stanza;
                },

                onMessageSubmitted: function (text) {
                    var _converse = this.__super__._converse;
                    if (!_converse.connection.authenticated) {
                        return this.showHelpMessages(
                            ['Sorry, the connection has been lost, '+
                              'and your message could not be sent'],
                            'error'
                        );
                    }
                    var match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/);
                    if (match) {
                        if ((_converse.allow_otr) && (match[1] === "endotr")) {
                            return this.endOTR();
                        } else if ((_converse.allow_otr) && (match[1] === "otr")) {
                            return this.model.initiateOTR();
                        }
                    }
                    if (_.includes([UNVERIFIED, VERIFIED], this.model.get('otr_status'))) {
                        // Off-the-record encryption is active
                        this.model.otr.sendMsg(text);
                        this.model.trigger('showSentOTRMessage', text);
                    } else {
                        this.__super__.onMessageSubmitted.apply(this, arguments);
                    }
                },

                onOTRStatusChanged: function () {
                    this.renderToolbar().informOTRChange();
                },

                informOTRChange: function () {
                    var _converse = this.__super__._converse,
                        __ = _converse.__,
                        data = this.model.toJSON(),
                        msgs = [];
                    if (data.otr_status === UNENCRYPTED) {
                        msgs.push(__("Your messages are not encrypted anymore"));
                    } else if (data.otr_status === UNVERIFIED) {
                        msgs.push(__("Your messages are now encrypted but your contact's identity has not been verified."));
                    } else if (data.otr_status === VERIFIED) {
                        msgs.push(__("Your contact's identify has been verified."));
                    } else if (data.otr_status === FINISHED) {
                        msgs.push(__("Your contact has ended encryption on their end, you should do the same."));
                    }
                    return this.showHelpMessages(msgs, 'info', false);
                },

                showOTRError: function (msg) {
                    var _converse = this.__super__._converse,
                        __ = _converse.__;
                    if (msg === 'Message cannot be sent at this time.') {
                        this.showHelpMessages(
                            [__('Your message could not be sent')], 'error');
                    } else if (msg === 'Received an unencrypted message.') {
                        this.showHelpMessages(
                            [__('We received an unencrypted message')], 'error');
                    } else if (msg === 'Received an unreadable encrypted message.') {
                        this.showHelpMessages(
                            [__('We received an unreadable encrypted message')],
                            'error');
                    } else {
                        this.showHelpMessages(['Encryption error occured: '+msg], 'error');
                    }
                    _converse.log("OTR ERROR:"+msg);
                },

                startOTRFromToolbar: function (ev) {
                    $(ev.target).parent().parent().slideUp();
                    ev.stopPropagation();
                    this.model.initiateOTR();
                },

                endOTR: function (ev) {
                    if (!_.isUndefined(ev)) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    this.model.endOTR();
                },

                authOTR: function (ev) {
                    var _converse = this.__super__._converse,
                        __ = _converse.__,
                        scheme = $(ev.target).data().scheme,
                        result, question, answer;
                    if (scheme === 'fingerprint') {
                        result = confirm(__('Here are the fingerprints, please confirm them with %1$s, outside of this chat.\n\nFingerprint for you, %2$s: %3$s\n\nFingerprint for %1$s: %4$s\n\nIf you have confirmed that the fingerprints match, click OK, otherwise click Cancel.', [
                                this.model.get('fullname'),
                                _converse.xmppstatus.get('fullname')||_converse.bare_jid,
                                this.model.otr.priv.fingerprint(),
                                this.model.otr.their_priv_pk.fingerprint()
                            ]
                        ));
                        if (result === true) {
                            this.model.save({'otr_status': VERIFIED});
                        } else {
                            this.model.save({'otr_status': UNVERIFIED});
                        }
                    } else if (scheme === 'smp') {
                        alert(__('You will be prompted to provide a security question and then an answer to that question.\n\nYour contact will then be prompted the same question and if they type the exact same answer (case sensitive), their identity will be verified.'));
                        question = prompt(__('What is your security question?'));
                        if (question) {
                            answer = prompt(__('What is the answer to the security question?'));
                            this.model.otr.smpSecret(answer, question);
                        }
                    } else {
                        this.showHelpMessages([__('Invalid authentication scheme provided')], 'error');
                    }
                },

                toggleOTRMenu: function (ev) {
                    ev.stopPropagation();
                    this.$el.find('.toggle-otr ul').slideToggle(200);
                },
                
                getOTRTooltip: function () {
                    var _converse = this.__super__._converse,
                        __ = _converse.__,
                        data = this.model.toJSON();
                    if (data.otr_status === UNENCRYPTED) {
                        return __('Your messages are not encrypted. Click here to enable OTR encryption.');
                    } else if (data.otr_status === UNVERIFIED) {
                        return __('Your messages are encrypted, but your contact has not been verified.');
                    } else if (data.otr_status === VERIFIED) {
                        return __('Your messages are encrypted and your contact verified.');
                    } else if (data.otr_status === FINISHED) {
                        return __('Your contact has closed their end of the private session, you should do the same');
                    }
                },

                renderToolbar: function (toolbar, options) {
                    var _converse = this.__super__._converse,
                        __ = _converse.__;
                    if (!_converse.show_toolbar) {
                        return;
                    }
                    var data = this.model.toJSON();
                    options = _.extend(options || {}, {
                        FINISHED: FINISHED,
                        UNENCRYPTED: UNENCRYPTED,
                        UNVERIFIED: UNVERIFIED,
                        VERIFIED: VERIFIED,
                        // FIXME: Leaky abstraction MUC
                        allow_otr: _converse.allow_otr && !this.is_chatroom,
                        label_end_encrypted_conversation: __('End encrypted conversation'),
                        label_refresh_encrypted_conversation: __('Refresh encrypted conversation'),
                        label_start_encrypted_conversation: __('Start encrypted conversation'),
                        label_verify_with_fingerprints: __('Verify with fingerprints'),
                        label_verify_with_smp: __('Verify with SMP'),
                        label_whats_this: __("What\'s this?"),
                        otr_status_class: OTR_CLASS_MAPPING[data.otr_status],
                        otr_tooltip: this.getOTRTooltip(),
                        otr_translated_status: OTR_TRANSLATED_MAPPING[data.otr_status],
                    });
                    this.__super__.renderToolbar.apply(this, arguments);
                    this.$el.find('.chat-toolbar').append(
                            tpl_toolbar_otr(
                                _.extend(this.model.toJSON(), options || {})
                            ));
                    return this;
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse,
                __ = _converse.__;

            this.updateSettings({
                allow_otr: true,
                cache_otr_key: false,
                use_otr_by_default: false
            });

            // Translation aware constants
            // ---------------------------
            // We can only call the __ translation method *after* converse.js
            // has been initialized and with it the i18n machinery. That's why
            // we do it here in the "initialize" method and not at the top of
            // the module.
            OTR_TRANSLATED_MAPPING[UNENCRYPTED] = __('unencrypted');
            OTR_TRANSLATED_MAPPING[UNVERIFIED] = __('unverified');
            OTR_TRANSLATED_MAPPING[VERIFIED] = __('verified');
            OTR_TRANSLATED_MAPPING[FINISHED] = __('finished');

            // Only allow OTR if we have the capability
            _converse.allow_otr = _converse.allow_otr && HAS_CRYPTO;
            // Only use OTR by default if allow OTR is enabled to begin with
            _converse.use_otr_by_default = _converse.use_otr_by_default && _converse.allow_otr;
        }
    });
}));


define('tpl!register_panel', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<form id="converse-register" class="pure-form converse-form">\n    <span class="reg-feedback"></span>\n    <label>' +
__e(label_domain) +
'</label>\n    ';
 if (default_domain) { ;
__p += '\n    	' +
__e(default_domain) +
'\n    ';
 } ;
__p += '\n    ';
 if (!default_domain) { ;
__p += '\n    	<input type="text" name="domain" placeholder="' +
__e(domain_placeholder) +
'">\n        <p class="form-help">' +
__e(help_providers) +
' <a href="' +
__e(href_providers) +
'" class="url" target="_blank" rel="noopener">' +
__e(help_providers_link) +
'</a>.</p>\n        <input class="pure-button button-primary" type="submit" value="' +
__e(label_register) +
'">\n    ';
 } ;
__p += '\n</form>\n';

}
return __p
};});


define('tpl!register_tab', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<li><a class="s" data-id="register" href="#register">' +
__e(label_register) +
'</a></li>\n';

}
return __p
};});


define('tpl!registration_form', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<p class="provider-title">' +
__e(domain) +
'</p>\n<a href=\'https://xmpp.net/result.php?domain=' +
__e(domain) +
'&amp;type=client\'>\n    <img class="provider-score" src=\'https://xmpp.net/badge.php?domain=' +
__e(domain) +
'\' alt=\'xmpp.net score\' />\n</a>\n<p class="title">' +
__e(title) +
'</p>\n<p class="instructions">' +
__e(instructions) +
'</p>\n';

}
return __p
};});


define('tpl!registration_request', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<span class="spinner login-submit"></span>\n<p class="info">' +
__e(info_message) +
'</p>\n';
 if (cancel) { ;
__p += '\n	<button class="pure-button button-cancel hor_centered">' +
__e(cancel) +
'</button>\n';
 } ;
__p += '\n';

}
return __p
};});

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

/* This is a Converse.js plugin which add support for in-band registration
 * as specified in XEP-0077.
 */
(function (root, factory) {
    define('converse-register',["converse-core",
            "tpl!form_username",
            "tpl!register_panel",
            "tpl!register_tab",
            "tpl!registration_form",
            "tpl!registration_request",
            "converse-controlbox"
    ], factory);
}(this, function (
            converse,
            tpl_form_username,
            tpl_register_panel,
            tpl_register_tab,
            tpl_registration_form,
            tpl_registration_request) {

    "use strict";

    // Strophe methods for building stanzas
    var Strophe = converse.env.Strophe,
        utils = converse.env.utils,
        $iq = converse.env.$iq;
    // Other necessary globals
    var $ = converse.env.jQuery,
        _ = converse.env._;

    // Add Strophe Namespaces
    Strophe.addNamespace('REGISTER', 'jabber:iq:register');

    // Add Strophe Statuses
    var i = 0;
    _.each(_.keys(Strophe.Status), function (key) {
        i = Math.max(i, Strophe.Status[key]);
    });
    Strophe.Status.REGIFAIL        = i + 1;
    Strophe.Status.REGISTERED      = i + 2;
    Strophe.Status.CONFLICT        = i + 3;
    Strophe.Status.NOTACCEPTABLE   = i + 5;

    converse.plugins.add('converse-register', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ControlBoxView: {

                switchTab: function (ev) {
                    var _converse = this.__super__._converse;
                    var result = this.__super__.switchTab.apply(this, arguments);
                    if (_converse.registration_domain &&
                            ev.target.getAttribute('data-id') === "register" &&
                            !this.model.get('registration_form_rendered')) {
                        this.registerpanel.fetchRegistrationForm(_converse.registration_domain);
                    }
                    return result;
                },

                renderLoginPanel: function () {
                    /* Also render a registration panel, when rendering the
                     * login panel.
                     */
                    this.__super__.renderLoginPanel.apply(this, arguments);
                    var _converse = this.__super__._converse;
                    if (_converse.allow_registration) {
                        this.registerpanel = new _converse.RegisterPanel({
                            '$parent': this.$el.find('.controlbox-panes'),
                            'model': this.model
                        });
                        this.registerpanel.render().$el.addClass('hidden');
                    }
                    return this;
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse,
                __ = _converse.__;

            // Add new templates
            _converse.templates.form_username = tpl_form_username;
            _converse.templates.register_panel = tpl_register_panel;
            _converse.templates.register_tab = tpl_register_tab;
            _converse.templates.registration_form = tpl_registration_form;
            _converse.templates.registration_request = tpl_registration_request;

            this.updateSettings({
                allow_registration: true,
                domain_placeholder: __(" e.g. conversejs.org"),  // Placeholder text shown in the domain input on the registration form
                providers_link: 'https://xmpp.net/directory.php', // Link to XMPP providers shown on registration page
            });

            _converse.RegisterPanel = Backbone.View.extend({
                tagName: 'div',
                id: "register",
                className: 'controlbox-pane',
                events: {
                    'submit form#converse-register': 'onProviderChosen'
                },

                initialize: function (cfg) {
                    this.reset();
                    this.$parent = cfg.$parent;
                    this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
                    this.registerHooks();
                },

                render: function () {
                    this.model.set('registration_form_rendered', false);
                    this.$parent.append(this.$el.html(
                        tpl_register_panel({
                            'default_domain': _converse.registration_domain,
                            'label_domain': __("Your XMPP provider's domain name:"),
                            'label_register': __('Fetch registration form'),
                            'help_providers': __('Tip: A list of public XMPP providers is available'),
                            'help_providers_link': __('here'),
                            'href_providers': _converse.providers_link,
                            'domain_placeholder': _converse.domain_placeholder
                        })
                    ));
                    this.$tabs.append(tpl_register_tab({label_register: __('Register')}));
                    return this;
                },

                registerHooks: function () {
                    /* Hook into Strophe's _connect_cb, so that we can send an IQ
                     * requesting the registration fields.
                     */
                    var conn = _converse.connection;
                    var connect_cb = conn._connect_cb.bind(conn);
                    conn._connect_cb = function (req, callback, raw) {
                        if (!this._registering) {
                            connect_cb(req, callback, raw);
                        } else {
                            if (this.getRegistrationFields(req, callback, raw)) {
                                this._registering = false;
                            }
                        }
                    }.bind(this);
                },

                getRegistrationFields: function (req, _callback, raw) {
                    /*  Send an IQ stanza to the XMPP server asking for the
                     *  registration fields.
                     *  Parameters:
                     *    (Strophe.Request) req - The current request
                     *    (Function) callback
                     */
                    var conn = _converse.connection;
                    conn.connected = true;

                    var body = conn._proto._reqToData(req);
                    if (!body) { return; }
                    if (conn._proto._connect_cb(body) === Strophe.Status.CONNFAIL) {
                        return false;
                    }
                    var register = body.getElementsByTagName("register");
                    var mechanisms = body.getElementsByTagName("mechanism");
                    if (register.length === 0 && mechanisms.length === 0) {
                        conn._proto._no_auth_received(_callback);
                        return false;
                    }
                    if (register.length === 0) {
                        conn._changeConnectStatus(
                            Strophe.Status.REGIFAIL,
                            __("Sorry, the given provider does not support in "+
                               "band account registration. Please try with a "+
                               "different provider.")
                        );
                        return true;
                    }
                    // Send an IQ stanza to get all required data fields
                    conn._addSysHandler(this.onRegistrationFields.bind(this), null, "iq", null, null);
                    conn.send($iq({type: "get"}).c("query", {xmlns: Strophe.NS.REGISTER}).tree());
                    conn.connected = false;
                    return true;
                },

                onRegistrationFields: function (stanza) {
                    /*  Handler for Registration Fields Request.
                     *
                     *  Parameters:
                     *    (XMLElement) elem - The query stanza.
                     */
                    if (stanza.getElementsByTagName("query").length !== 1) {
                        _converse.connection._changeConnectStatus(Strophe.Status.REGIFAIL, "unknown");
                        return false;
                    }
                    this.setFields(stanza);
                    this.renderRegistrationForm(stanza);
                    return false;
                },

                reset: function (settings) {
                    var defaults = {
                        fields: {},
                        urls: [],
                        title: "",
                        instructions: "",
                        registered: false,
                        _registering: false,
                        domain: null,
                        form_type: null
                    };
                    _.extend(this, defaults);
                    if (settings) {
                        _.extend(this, _.pick(settings, _.keys(defaults)));
                    }
                },

                onProviderChosen: function (ev) {
                    /* Callback method that gets called when the user has chosen an
                     * XMPP provider.
                     *
                     * Parameters:
                     *      (Submit Event) ev - Form submission event.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $form = $(ev.target),
                        $domain_input = $form.find('input[name=domain]'),
                        domain = $domain_input.val();
                    if (!domain) {
                        $domain_input.addClass('error');
                        return;
                    }
                    $form.find('input[type=submit]').hide();
                    this.fetchRegistrationForm(domain, __('Cancel'));
                },

                fetchRegistrationForm: function (domain_name, cancel_label) {
                    /* This is called with a domain name based on which, it fetches a
                     * registration form from the requested domain.
                     *
                     * Parameters:
                     *      (Domain name) domain_name - XMPP server domain
                     */
                    this.renderRegistrationRequest(cancel_label);
                    this.reset({
                        domain: Strophe.getDomainFromJid(domain_name),
                        _registering: true
                    });
                    _converse.connection.connect(this.domain, "", this.onRegistering.bind(this));
                    return false;
                },

                renderRegistrationRequest: function (cancel_label) {
                    var form = this.el.querySelector('#converse-register');
                    utils.createElementsFromString(
                        form,
                        tpl_registration_request({
                            cancel: cancel_label,
                            info_message: _converse.__('Requesting a registration form from the XMPP server')
                        })
                    );
                    if (!_converse.registration_domain) {
                        var cancel_button = document.querySelector('button.button-cancel');
                        cancel_button.addEventListener('click', this.cancelRegistration.bind(this));
                    }
                },

                giveFeedback: function (message, klass) {
                    this.$('.reg-feedback').attr('class', 'reg-feedback').text(message);
                    if (klass) {
                        $('.reg-feedback').addClass(klass);
                    }
                },

                onRegistering: function (status, error) {
                    var that;
                    _converse.log('onRegistering');
                    if (_.includes([
                                Strophe.Status.DISCONNECTED,
                                Strophe.Status.CONNFAIL,
                                Strophe.Status.REGIFAIL,
                                Strophe.Status.NOTACCEPTABLE,
                                Strophe.Status.CONFLICT
                            ], status)) {

                        _converse.log('Problem during registration: Strophe.Status is: '+status);
                        this.cancelRegistration();
                        if (error) {
                            this.giveFeedback(error, 'error');
                        } else {
                            this.giveFeedback(__(
                                'Something went wrong while establishing a connection with "%1$s". Are you sure it exists?',
                                this.domain
                            ), 'error');
                        }
                    } else if (status === Strophe.Status.REGISTERED) {
                        _converse.log("Registered successfully.");
                        _converse.connection.reset();
                        that = this;
                        this.$('form').hide(function () {
                            $(this).replaceWith('<span class="spinner centered"/>');
                            if (that.fields.password && that.fields.username) {
                                // automatically log the user in
                                _converse.connection.connect(
                                    that.fields.username.toLowerCase()+'@'+that.domain.toLowerCase(),
                                    that.fields.password,
                                    _converse.onConnectStatusChanged
                                );
                                _converse.chatboxviews.get('controlbox')
                                    .switchTab({'target': that.$tabs.find('.current')});
                                _converse.giveFeedback(__('Now logging you in'));
                            } else {
                                _converse.chatboxviews.get('controlbox').renderLoginPanel();
                                _converse.giveFeedback(__('Registered successfully'));
                            }
                            that.reset();
                        });
                    }
                },

                renderRegistrationForm: function (stanza) {
                    /* Renders the registration form based on the XForm fields
                     * received from the XMPP server.
                     *
                     * Parameters:
                     *      (XMLElement) stanza - The IQ stanza received from the XMPP server.
                     */
                    this.model.set('registration_form_rendered', true);

                    var $form = this.$('form'),
                        $stanza = $(stanza),
                        $fields, $input;
                    $form.empty().append(tpl_registration_form({
                        'domain': this.domain,
                        'title': this.title,
                        'instructions': this.instructions
                    }));
                    if (this.form_type === 'xform') {
                        $fields = $stanza.find('field');
                        _.each($fields, function (field) {
                            $form.append(utils.xForm2webForm.bind(this, $(field), $stanza));
                        }.bind(this));
                    } else {
                        // Show fields
                        _.each(_.keys(this.fields), function (key) {
                            if (key === "username") {
                                $input = tpl_form_username({
                                    domain: ' @'+this.domain,
                                    name: key,
                                    type: "text",
                                    label: key,
                                    value: '',
                                    required: 1
                                });
                            } else {
                                $form.append('<label>'+key+'</label>');
                                $input = $('<input placeholder="'+key+'" name="'+key+'"></input>');
                                if (key === 'password' || key === 'email') {
                                    $input.attr('type', key);
                                }
                            }
                            $form.append($input);
                        }.bind(this));
                        // Show urls
                        _.each(this.urls, function (url) {
                            $form.append($('<a target="blank"></a>').attr('href', url).text(url));
                        }.bind(this));
                    }
                    if (this.fields) {
                        $form.append('<input type="submit" class="pure-button button-primary" value="'+__('Register')+'"/>');
                        $form.on('submit', this.submitRegistrationForm.bind(this));
                        $form.append('<input type="button" class="pure-button button-cancel" value="'+__('Cancel')+'"/>');
                        $form.find('input[type=button]').on('click', this.cancelRegistration.bind(this));
                    } else {
                        $form.append('<input type="button" class="submit" value="'+__('Return')+'"/>');
                        $form.find('input[type=button]').on('click', this.cancelRegistration.bind(this));
                    }
                    if (_converse.registration_domain) {
                        $form.find('input[type=button]').hide();
                    }
                },

                reportErrors: function (stanza) {
                    /* Report back to the user any error messages received from the
                     * XMPP server after attempted registration.
                     *
                     * Parameters:
                     *      (XMLElement) stanza - The IQ stanza received from the
                     *      XMPP server.
                     */
                    var $form= this.$('form'), flash;
                    var $errmsgs = $(stanza).find('error text');
                    var $flash = $form.find('.form-errors');
                    if (!$flash.length) {
                    flash = '<legend class="form-errors"></legend>';
                        if ($form.find('p.instructions').length) {
                            $form.find('p.instructions').append(flash);
                        } else {
                            $form.prepend(flash);
                        }
                        $flash = $form.find('.form-errors');
                    } else {
                        $flash.empty();
                    }
                    $errmsgs.each(function (idx, txt) {
                        $flash.append($('<p>').text($(txt).text()));
                    });
                    if (!$errmsgs.length) {
                        $flash.append($('<p>').text(
                            __('The provider rejected your registration attempt. '+
                            'Please check the values you entered for correctness.')));
                    }
                    $flash.show();
                },

                cancelRegistration: function (ev) {
                    /* Handler, when the user cancels the registration form.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    _converse.connection.reset();
                    this.model.set('registration_form_rendered', false);
                    this.render();
                    if (_converse.registration_domain) {
                        document.querySelector('button.button-cancel').onclick = 
                            _.bind(
                                this.fetchRegistrationForm, this,
                                _converse.registration_domain, __('Retry')
                            );
                    }
                },

                submitRegistrationForm: function (ev) {
                    /* Handler, when the user submits the registration form.
                     * Provides form error feedback or starts the registration
                     * process.
                     *
                     * Parameters:
                     *      (Event) ev - the submit event.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var has_empty_inputs = _.reduce(this.el.querySelectorAll('input.required'),
                        function (result, input) {
                            if (input.value === '') {
                                input.classList.add('error');
                                return result + 1;
                            }
                            return result;
                        }, 0);
                    if (has_empty_inputs) { return; }
                    var $inputs = $(ev.target).find(':input:not([type=button]):not([type=submit])'),
                        iq = $iq({type: "set"}).c("query", {xmlns:Strophe.NS.REGISTER});

                    if (this.form_type === 'xform') {
                        iq.c("x", {xmlns: Strophe.NS.XFORM, type: 'submit'});
                        $inputs.each(function () {
                            iq.cnode(utils.webForm2xForm(this)).up();
                        });
                    } else {
                        $inputs.each(function () {
                            var $input = $(this);
                            iq.c($input.attr('name'), {}, $input.val());
                        });
                    }
                    this.model.set('registration_form_rendered', false);
                    _converse.connection._addSysHandler(this._onRegisterIQ.bind(this), null, "iq", null, null);
                    _converse.connection.send(iq);
                    this.setFields(iq.tree());
                },

                setFields: function (stanza) {
                    /* Stores the values that will be sent to the XMPP server
                     * during attempted registration.
                     *
                     * Parameters:
                     *      (XMLElement) stanza - the IQ stanza that will be sent to the XMPP server.
                     */
                    var $query = $(stanza).find('query'), $xform;
                    if ($query.length > 0) {
                        $xform = $query.find('x[xmlns="'+Strophe.NS.XFORM+'"]');
                        if ($xform.length > 0) {
                            this._setFieldsFromXForm($xform);
                        } else {
                            this._setFieldsFromLegacy($query);
                        }
                    }
                },

                _setFieldsFromLegacy: function ($query) {
                    $query.children().each(function (idx, field) {
                        var $field = $(field);
                        if (field.tagName.toLowerCase() === 'instructions') {
                            this.instructions = Strophe.getText(field);
                            return;
                        } else if (field.tagName.toLowerCase() === 'x') {
                            if ($field.attr('xmlns') === 'jabber:x:oob') {
                                $field.find('url').each(function (idx, url) {
                                    this.urls.push($(url).text());
                                }.bind(this));
                            }
                            return;
                        }
                        this.fields[field.tagName.toLowerCase()] = Strophe.getText(field);
                    }.bind(this));
                    this.form_type = 'legacy';
                },

                _setFieldsFromXForm: function ($xform) {
                    this.title = $xform.find('title').text();
                    this.instructions = $xform.find('instructions').text();
                    $xform.find('field').each(function (idx, field) {
                        var _var = field.getAttribute('var');
                        if (_var) {
                            this.fields[_var.toLowerCase()] = $(field).children('value').text();
                        } else {
                            // TODO: other option seems to be type="fixed"
                            _converse.log("WARNING: Found field we couldn't parse");
                        }
                    }.bind(this));
                    this.form_type = 'xform';
                },

                _onRegisterIQ: function (stanza) {
                    /* Callback method that gets called when a return IQ stanza
                     * is received from the XMPP server, after attempting to
                     * register a new user.
                     *
                     * Parameters:
                     *      (XMLElement) stanza - The IQ stanza.
                     */
                    var error = null,
                        query = stanza.getElementsByTagName("query");
                    if (query.length > 0) {
                        query = query[0];
                    }
                    if (stanza.getAttribute("type") === "error") {
                        _converse.log("Registration failed.");
                        error = stanza.getElementsByTagName("error");
                        if (error.length !== 1) {
                            _converse.connection._changeConnectStatus(Strophe.Status.REGIFAIL, "unknown");
                            return false;
                        }
                        error = error[0].firstChild.tagName.toLowerCase();
                        if (error === 'conflict') {
                            _converse.connection._changeConnectStatus(Strophe.Status.CONFLICT, error);
                        } else if (error === 'not-acceptable') {
                            _converse.connection._changeConnectStatus(Strophe.Status.NOTACCEPTABLE, error);
                        } else {
                            _converse.connection._changeConnectStatus(Strophe.Status.REGIFAIL, error);
                        }
                        this.reportErrors(stanza);
                    } else {
                        _converse.connection._changeConnectStatus(Strophe.Status.REGISTERED, null);
                    }
                    return false;
                },

                remove: function () {
                    this.$tabs.empty();
                    this.$el.parent().empty();
                }
            });
        }
    });
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

/* This is a Converse.js plugin which add support for application-level pings
 * as specified in XEP-0199 XMPP Ping.
 */
(function (root, factory) {
    define('converse-ping',["converse-core", "strophe.ping"], factory);
}(this, function (converse) {
    "use strict";
    // Strophe methods for building stanzas
    var Strophe = converse.env.Strophe,
        _ = converse.env._;
    
    converse.plugins.add('converse-ping', {

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse;

            this.updateSettings({
                ping_interval: 180 //in seconds
            });

            _converse.ping = function (jid, success, error, timeout) {
                // XXX: We could first check here if the server advertised that
                // it supports PING.
                // However, some servers don't advertise while still keeping the
                // connection option due to pings.
                //
                // var feature = _converse.features.findWhere({'var': Strophe.NS.PING});
                _converse.lastStanzaDate = new Date();
                if (_.isNil(jid)) {
                    jid = Strophe.getDomainFromJid(_converse.bare_jid);
                }
                if (_.isUndefined(timeout) ) { timeout = null; }
                if (_.isUndefined(success) ) { success = null; }
                if (_.isUndefined(error) ) { error = null; }
                if (_converse.connection) {
                    _converse.connection.ping.ping(jid, success, error, timeout);
                    return true;
                }
                return false;
            };

            _converse.pong = function (ping) {
                _converse.lastStanzaDate = new Date();
                _converse.connection.ping.pong(ping);
                return true;
            };

            _converse.registerPongHandler = function () {
                _converse.connection.disco.addFeature(Strophe.NS.PING);
                _converse.connection.ping.addPingHandler(_converse.pong);
            };

            _converse.registerPingHandler = function () {
                _converse.registerPongHandler();
                if (_converse.ping_interval > 0) {
                    _converse.connection.addHandler(function () {
                        /* Handler on each stanza, saves the received date
                         * in order to ping only when needed.
                         */
                        _converse.lastStanzaDate = new Date();
                        return true;
                    });
                    _converse.connection.addTimedHandler(1000, function () {
                        var now = new Date();
                        if (!_converse.lastStanzaDate) {
                            _converse.lastStanzaDate = now;
                        }
                        if ((now - _converse.lastStanzaDate)/1000 > _converse.ping_interval) {
                            return _converse.ping();
                        }
                        return true;
                    });
                }
            };

            var onConnected = function () {
                // Wrapper so that we can spy on registerPingHandler in tests
                _converse.registerPingHandler();
            };
            _converse.on('connected', onConnected);
            _converse.on('reconnected', onConnected);
        }
    });
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define('converse-notification',["converse-core"], factory);
}(this, function (converse) {
    "use strict";
    var utils = converse.env.utils,
        Strophe = converse.env.Strophe,
        _ = converse.env._;

    converse.plugins.add('converse-notification', {

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse;

            // For translations
            var __ = _converse.__;
            var ___ = _converse.___;

            _converse.supports_html5_notification = "Notification" in window;

            this.updateSettings({
                notify_all_room_messages: false,
                show_desktop_notifications: true,
                show_chatstate_notifications: false,
                chatstate_notification_blacklist: [],
                // ^ a list of JIDs to ignore concerning chat state notifications
                play_sounds: true,
                sounds_path: '/sounds/',
                notification_icon: '/logo/conversejs128.png'
            });

            _converse.isOnlyChatStateNotification = function (msg) {
                // See XEP-0085 Chat State Notification
                return (
                    _.isNull(msg.querySelector('body')) && (
                        _.isNull(msg.querySelector(_converse.ACTIVE)) ||
                        _.isNull(msg.querySelector(_converse.COMPOSING)) ||
                        _.isNull(msg.querySelector(_converse.INACTIVE)) ||
                        _.isNull(msg.querySelector(_converse.PAUSED)) ||
                        _.isNull(msg.querySelector(_converse.GONE))
                    )
                );
            };

            _converse.shouldNotifyOfGroupMessage = function (message) {
                /* Is this a group message worthy of notification?
                 */
                var notify_all = _converse.notify_all_room_messages,
                    jid = message.getAttribute('from'),
                    resource = Strophe.getResourceFromJid(jid),
                    room_jid = Strophe.getBareJidFromJid(jid),
                    sender = resource && Strophe.unescapeNode(resource) || '';
                if (sender === '' || message.querySelectorAll('delay').length > 0) {
                    return false;
                }
                var room = _converse.chatboxes.get(room_jid);
                var body = message.querySelector('body');
                if (_.isNull(body)) {
                    return false;
                }
                var mentioned = (new RegExp("\\b"+room.get('nick')+"\\b")).test(body.textContent);
                notify_all = notify_all === true ||
                    (_.isArray(notify_all) && _.includes(notify_all, room_jid));
                if (sender === room.get('nick') || (!notify_all && !mentioned)) {
                    return false;
                }
                return true;
            };

            _converse.shouldNotifyOfMessage = function (message) {
                /* Is this a message worthy of notification?
                 */
                if (utils.isOTRMessage(message)) {
                    return false;
                }
                var forwarded = message.querySelector('forwarded');
                if (!_.isNull(forwarded)) {
                    return false;
                } else if (message.getAttribute('type') === 'groupchat') {
                    return _converse.shouldNotifyOfGroupMessage(message);
                } else if (utils.isHeadlineMessage(message)) {
                    // We want to show notifications for headline messages.
                    return true;
                }
                var is_me = Strophe.getBareJidFromJid(
                        message.getAttribute('from')) === _converse.bare_jid;
                return !_converse.isOnlyChatStateNotification(message) && !is_me;
            };

            _converse.playSoundNotification = function () {
                /* Plays a sound to notify that a new message was recieved.
                 */
                // XXX Eventually this can be refactored to use Notification's sound
                // feature, but no browser currently supports it.
                // https://developer.mozilla.org/en-US/docs/Web/API/notification/sound
                var audio;
                if (_converse.play_sounds && !_.isUndefined(window.Audio)) {
                    audio = new Audio(_converse.sounds_path+"msg_received.ogg");
                    if (audio.canPlayType('/audio/ogg')) {
                        audio.play();
                    } else {
                        audio = new Audio(_converse.sounds_path+"msg_received.mp3");
                        audio.play();
                    }
                }
            };

            _converse.areDesktopNotificationsEnabled = function (ignore_hidden) {
                var enabled = _converse.supports_html5_notification &&
                    _converse.show_desktop_notifications &&
                    Notification.permission === "granted";
                if (ignore_hidden) {
                    return enabled;
                } else {
                    return enabled && _converse.windowState === 'hidden';
                }
            };

            _converse.showMessageNotification = function (message) {
                /* Shows an HTML5 Notification to indicate that a new chat
                 * message was received.
                 */
                var title, roster_item,
                    from_jid = Strophe.getBareJidFromJid(message.getAttribute('from'));
                if (message.getAttribute('type') === 'headline') {
                    if (!_.includes(from_jid, '@') || _converse.allow_non_roster_messaging) {
                        title = __(___("Notification from %1$s"), from_jid);
                    } else {
                        return;
                    }
                } else if (!_.includes(from_jid, '@')) {
                    // XXX: workaround for Prosody which doesn't give type "headline"
                    title = __(___("Notification from %1$s"), from_jid);
                } else if (message.getAttribute('type') === 'groupchat') {
                    title = __(___("%1$s says"), Strophe.getResourceFromJid(from_jid));
                } else {
                    if (_.isUndefined(_converse.roster)) {
                        _converse.log(
                            "Could not send notification, because roster is undefined",
                            "error");
                        return;
                    }
                    roster_item = _converse.roster.get(from_jid);
                    if (!_.isUndefined(roster_item)) {
                        title = __(___("%1$s says"), roster_item.get('fullname'));
                    } else {
                        if (_converse.allow_non_roster_messaging) {
                            title = __(___("%1$s says"), from_jid);
                        } else {
                            return;
                        }
                    }
                }
                var n = new Notification(title, {
                        body: message.querySelector('body').textContent,
                        lang: _.isEmpty(converse.i18n) ? 'en' : _converse.i18n.locale_data.converse[""].lang,
                        icon: _converse.notification_icon
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            _converse.showChatStateNotification = function (contact) {
                /* Creates an HTML5 Notification to inform of a change in a
                 * contact's chat state.
                 */
                if (_.includes(_converse.chatstate_notification_blacklist, contact.jid)) {
                    // Don't notify if the user is being ignored.
                    return;
                }
                var chat_state = contact.chat_status,
                    message = null;
                if (chat_state === 'offline') {
                    message = __('has gone offline');
                } else if (chat_state === 'away') {
                    message = __('has gone away');
                } else if ((chat_state === 'dnd')) {
                    message = __('is busy');
                } else if (chat_state === 'online') {
                    message = __('has come online');
                }
                if (message === null) {
                    return;
                }
                var n = new Notification(contact.fullname, {
                        body: message,
                        lang: _converse.i18n.locale_data.converse[""].lang,
                        icon: _converse.notification_icon
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            _converse.showContactRequestNotification = function (contact) {
                var n = new Notification(contact.fullname, {
                        body: __('wants to be your contact'),
                        lang: _converse.i18n.locale_data.converse[""].lang,
                        icon: _converse.notification_icon
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            _converse.showFeedbackNotification = function (data) {
                if (data.klass === 'error' || data.klass === 'warn') {
                    var n = new Notification(data.subject, {
                            body: data.message,
                            lang: _converse.i18n.locale_data.converse[""].lang,
                            icon: _converse.notification_icon
                        });
                    setTimeout(n.close.bind(n), 5000);
                }
            };

            _converse.handleChatStateNotification = function (contact) {
                /* Event handler for on('contactStatusChanged').
                 * Will show an HTML5 notification to indicate that the chat
                 * status has changed.
                 */
                if (_converse.areDesktopNotificationsEnabled() &&
                        _converse.show_chatstate_notifications) {
                    _converse.showChatStateNotification(contact);
                }
            };

            _converse.handleMessageNotification = function (message) {
                /* Event handler for the on('message') event. Will call methods
                 * to play sounds and show HTML5 notifications.
                 */
                if (!_converse.shouldNotifyOfMessage(message)) {
                    return false;
                }
                _converse.playSoundNotification();
                if (_converse.areDesktopNotificationsEnabled()) {
                    _converse.showMessageNotification(message);
                }
            };

            _converse.handleContactRequestNotification = function (contact) {
                if (_converse.areDesktopNotificationsEnabled(true)) {
                    _converse.showContactRequestNotification(contact);
                }
            };

            _converse.handleFeedback = function (data) {
                if (_converse.areDesktopNotificationsEnabled(true)) {
                    _converse.showFeedbackNotification(data);
                }
            };

            _converse.requestPermission = function () {
                if (_converse.supports_html5_notification &&
                    ! _.includes(['denied', 'granted'], Notification.permission)) {
                    // Ask user to enable HTML5 notifications
                    Notification.requestPermission();
                }
            };

            _converse.on('pluginsInitialized', function () {
                // We only register event handlers after all plugins are
                // registered, because other plugins might override some of our
                // handlers.
                _converse.on('contactRequest',  _converse.handleContactRequestNotification);
                _converse.on('contactStatusChanged',  _converse.handleChatStateNotification);
                _converse.on('message',  _converse.handleMessageNotification);
                _converse.on('feedback', _converse.handleFeedback);
                _converse.on('connected', _converse.requestPermission);
            });
        }
    });
}));


define('tpl!chatbox_minimize', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape;
with (obj) {
__p += '<a class="chatbox-btn toggle-chatbox-button icon-minus" title="' +
__e(info_minimize) +
'"></a>\n';

}
return __p
};});


define('tpl!toggle_chats', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p +=
__e(Minimized) +
' <span id="minimized-count">(' +
__e(num_minimized) +
')</span>\n<span class="unread-message-count"\n    ';
 if (!num_unread) { ;
__p += ' style="display: none" ';
 } ;
__p += '\n    href="#">' +
__e(num_unread) +
'</span>\n';

}
return __p
};});


define('tpl!trimmed_chat', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '', __e = _.escape, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
with (obj) {
__p += '<a class="chatbox-btn close-chatbox-button icon-close"></a>\n<a class="chat-head-message-count" \n    ';
 if (!num_unread) { ;
__p += ' style="display: none" ';
 } ;
__p += '\n    href="#">' +
__e(num_unread) +
'</a>\n<a href="#" class="restore-chat" title="' +
__e(tooltip) +
'">\n    ' +
__e( title ) +
'\n</a>\n';

}
return __p
};});


define('tpl!chats_panel', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '';
with (obj) {
__p += '<a id="toggle-minimized-chats" href="#"></a>\n<div class="flyout minimized-chats-flyout"></div>\n';

}
return __p
};});

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window */

(function (root, factory) {
    define('converse-minimize',["converse-core",
            "tpl!chatbox_minimize",
            "tpl!toggle_chats",
            "tpl!trimmed_chat",
            "tpl!chats_panel",
            "converse-controlbox",
            "converse-chatview",
            "converse-muc"
    ], factory);
}(this, function (
        converse,
        tpl_chatbox_minimize,
        tpl_toggle_chats,
        tpl_trimmed_chat,
        tpl_chats_panel
    ) {
    "use strict";
    var $ = converse.env.jQuery,
        _ = converse.env._,
        b64_sha1 = converse.env.b64_sha1,
        moment = converse.env.moment;

    converse.plugins.add('converse-minimize', {
        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            initChatBoxes: function () {
                var _converse = this.__super__._converse;
                var result = this.__super__.initChatBoxes.apply(this, arguments);
                _converse.minimized_chats = new _converse.MinimizedChats({
                    model: _converse.chatboxes
                });
                return result;
            },

            registerGlobalEventHandlers: function () {
                var _converse = this.__super__._converse;
                $(window).on("resize", _.debounce(function (ev) {
                    if (_converse.connection.connected) {
                        _converse.chatboxviews.trimChats();
                    }
                }, 200));
                return this.__super__.registerGlobalEventHandlers.apply(this, arguments);
            },

            ChatBox: {
                initialize: function () {
                    this.__super__.initialize.apply(this, arguments);
                    if (this.get('id') === 'controlbox') {
                        return;
                    }
                    this.save({
                        'minimized': this.get('minimized') || false,
                        'time_minimized': this.get('time_minimized') || moment(),
                    });
                },

                maximize: function () {
                    this.save({
                        'minimized': false,
                        'time_opened': moment().valueOf()
                    });
                },

                minimize: function () {
                    this.save({
                        'minimized': true,
                        'time_minimized': moment().format()
                    });
                },
            },

            ChatBoxView: {
                events: {
                    'click .toggle-chatbox-button': 'minimize',
                },

                initialize: function () {
                    this.model.on('change:minimized', this.onMinimizedChanged, this);
                    return this.__super__.initialize.apply(this, arguments);
                },

                _show: function () {
                    var _converse = this.__super__._converse;
                    this.__super__._show.apply(this, arguments);
                    if (!this.model.get('minimized')) {
                        _converse.chatboxviews.trimChats(this);
                    }
                },

                shouldShowOnTextMessage: function () {
                    return !this.model.get('minimized') &&
                        this.__super__.shouldShowOnTextMessage.apply(this, arguments);
                },

                setChatBoxHeight: function (height) {
                    if (!this.model.get('minimized')) {
                        return this.__super__.setChatBoxHeight.apply(this, arguments);
                    }
                },

                setChatBoxWidth: function (width) {
                    if (!this.model.get('minimized')) {
                        return this.__super__.setChatBoxWidth.apply(this, arguments);
                    }
                },

                onMinimizedChanged: function (item) {
                    if (item.get('minimized')) {
                        this.minimize();
                    } else {
                        this.maximize();
                    }
                },

                maximize: function () {
                    // Restores a minimized chat box
                    var _converse = this.__super__._converse;
                    this.$el.insertAfter(_converse.chatboxviews.get("controlbox").$el);
                    this.show();
                    _converse.emit('chatBoxMaximized', this);
                    return this;
                },

                minimize: function (ev) {
                    var _converse = this.__super__._converse;
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    // save the scroll position to restore it on maximize
                    this.model.save({'scroll': this.$content.scrollTop()});
                    this.setChatState(_converse.INACTIVE).model.minimize();
                    this.hide();
                    _converse.emit('chatBoxMinimized', this);
                },
            },

            ChatRoomView: {
                events: {
                    'click .toggle-chatbox-button': 'minimize',
                },

                initialize: function () {
                    this.model.on('change:minimized', function (item) {
                        if (item.get('minimized')) {
                            this.hide();
                        } else {
                            this.maximize();
                        }
                    }, this);
                    var result = this.__super__.initialize.apply(this, arguments);
                    if (this.model.get('minimized')) {
                        this.hide();
                    }
                    return result;
                },

                generateHeadingHTML: function () {
                    var _converse = this.__super__._converse,
                        __ = _converse.__;
                    var html = this.__super__.generateHeadingHTML.apply(this, arguments);
                    var div = document.createElement('div');
                    div.innerHTML = html;
                    var el = tpl_chatbox_minimize(
                        {info_minimize: __('Minimize this chat box')}
                    );
                    var button = div.querySelector('.close-chatbox-button');
                    button.insertAdjacentHTML('afterend', el);
                    return div.innerHTML;
                }
            },

            ChatBoxes: {
                chatBoxMayBeShown: function (chatbox) {
                    return this.__super__.chatBoxMayBeShown.apply(this, arguments) &&
                           !chatbox.get('minimized');
                },
            },

            ChatBoxViews: {
                showChat: function (attrs) {
                    /* Find the chat box and show it. If it doesn't exist, create it.
                     */
                    var chatbox = this.__super__.showChat.apply(this, arguments);
                    var maximize = _.isUndefined(attrs.maximize) ? true : attrs.maximize;
                    if (chatbox.get('minimized') && maximize) {
                        chatbox.maximize();
                    }
                    return chatbox;
                },

                getChatBoxWidth: function (view) {
                    if (!view.model.get('minimized') && view.$el.is(':visible')) {
                        return view.$el.outerWidth(true);
                    }
                    return 0;
                },

                getShownChats: function () {
                    return this.filter(function (view) {
                        // The controlbox can take a while to close,
                        // so we need to check its state. That's why we checked
                        // the 'closed' state.
                        return (
                            !view.model.get('minimized') &&
                            !view.model.get('closed') &&
                            view.$el.is(':visible')
                        );
                    });
                },

                trimChats: function (newchat) {
                    /* This method is called when a newly created chat box will
                     * be shown.
                     *
                     * It checks whether there is enough space on the page to show
                     * another chat box. Otherwise it minimizes the oldest chat box
                     * to create space.
                     */
                    var _converse = this.__super__._converse;
                    var shown_chats = this.getShownChats();
                    if (_converse.no_trimming || shown_chats.length <= 1) {
                        return;
                    }
                    if (this.getChatBoxWidth(shown_chats[0]) === $('body').outerWidth(true)) {
                        // If the chats shown are the same width as the body,
                        // then we're in responsive mode and the chats are
                        // fullscreen. In this case we don't trim.
                        return;
                    }
                    var oldest_chat, boxes_width, view,
                        $minimized = _converse.minimized_chats.$el,
                        minimized_width = _.includes(this.model.pluck('minimized'), true) ? $minimized.outerWidth(true) : 0,
                        new_id = newchat ? newchat.model.get('id') : null;

                    boxes_width = _.reduce(this.xget(new_id), function (memo, view) {
                        return memo + this.getChatBoxWidth(view);
                    }.bind(this), newchat ? newchat.$el.outerWidth(true) : 0);

                    if ((minimized_width + boxes_width) > $('body').outerWidth(true)) {
                        oldest_chat = this.getOldestMaximizedChat([new_id]);
                        if (oldest_chat) {
                            // We hide the chat immediately, because waiting
                            // for the event to fire (and letting the
                            // ChatBoxView hide it then) causes race
                            // conditions.
                            view = this.get(oldest_chat.get('id'));
                            if (view) {
                                view.hide();
                            }
                            oldest_chat.minimize();
                        }
                    }
                },

                getOldestMaximizedChat: function (exclude_ids) {
                    // Get oldest view (if its id is not excluded)
                    exclude_ids.push('controlbox');
                    var i = 0;
                    var model = this.model.sort().at(i);
                    while (_.includes(exclude_ids, model.get('id')) ||
                        model.get('minimized') === true) {
                        i++;
                        model = this.model.at(i);
                        if (!model) {
                            return null;
                        }
                    }
                    return model;
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by Converse.js's plugin machinery.
             */
            var _converse = this._converse,
                __ = _converse.__;

            // Add new HTML templates.
            _converse.templates.chatbox_minimize = tpl_chatbox_minimize;
            _converse.templates.toggle_chats = tpl_toggle_chats;
            _converse.templates.trimmed_chat = tpl_trimmed_chat;
            _converse.templates.chats_panel = tpl_chats_panel;

            this.updateSettings({
                no_trimming: false, // Set to true for phantomjs tests (where browser apparently has no width)
            });

            _converse.MinimizedChatBoxView = Backbone.View.extend({
                tagName: 'div',
                className: 'chat-head',
                events: {
                    'click .close-chatbox-button': 'close',
                    'click .restore-chat': 'restore'
                },

                initialize: function () {
                    this.model.messages.on('add', function (m) {
                        if (m.get('message')) {
                            this.updateUnreadMessagesCounter();
                        }
                    }, this);
                    this.model.on('change:minimized', this.clearUnreadMessagesCounter, this);
                    // OTR stuff, doesn't require this module to depend on OTR.
                    this.model.on('showReceivedOTRMessage', this.updateUnreadMessagesCounter, this);
                    this.model.on('showSentOTRMessage', this.updateUnreadMessagesCounter, this);
                },

                render: function () {
                    var data = _.extend(
                        this.model.toJSON(),
                        { 'tooltip': __('Click to restore this chat') }
                    );
                    if (this.model.get('type') === 'chatroom') {
                        data.title = this.model.get('name');
                        this.$el.addClass('chat-head-chatroom');
                    } else {
                        data.title = this.model.get('fullname');
                        this.$el.addClass('chat-head-chatbox');
                    }
                    return this.$el.html(tpl_trimmed_chat(data));
                },

                clearUnreadMessagesCounter: function () {
                    this.model.set({'num_unread': 0});
                    this.render();
                },

                updateUnreadMessagesCounter: function () {
                    this.model.set({'num_unread': this.model.get('num_unread') + 1});
                    this.render();
                },

                close: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.remove();
                    var view = _converse.chatboxviews.get(this.model.get('id'));
                    if (view) {
                        // This will call model.destroy(), removing it from the
                        // collection and will also emit 'chatBoxClosed'
                        view.close();
                    } else {
                        this.model.destroy();
                        _converse.emit('chatBoxClosed', this);
                    }
                    return this;
                },

                restore: _.debounce(function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.model.messages.off('add',null,this);
                    this.remove();
                    this.model.maximize();
                }, 200, {'leading': true})
            });


            _converse.MinimizedChats = Backbone.Overview.extend({
                tagName: 'div',
                id: "minimized-chats",
                className: 'hidden',
                events: {
                    "click #toggle-minimized-chats": "toggle"
                },

                initialize: function () {
                    this.render();
                    this.initToggle();
                    this.model.on("add", this.onChanged, this);
                    this.model.on("destroy", this.removeChat, this);
                    this.model.on("change:minimized", this.onChanged, this);
                    this.model.on('change:num_unread', this.updateUnreadMessagesCounter, this);
                },

                tearDown: function () {
                    this.model.off("add", this.onChanged);
                    this.model.off("destroy", this.removeChat);
                    this.model.off("change:minimized", this.onChanged);
                    this.model.off('change:num_unread', this.updateUnreadMessagesCounter);
                    return this;
                },

                initToggle: function () {
                    this.toggleview = new _converse.MinimizedChatsToggleView({
                        model: new _converse.MinimizedChatsToggle()
                    });
                    var id = b64_sha1('converse.minchatstoggle'+_converse.bare_jid);
                    this.toggleview.model.id = id; // Appears to be necessary for backbone.browserStorage
                    this.toggleview.model.browserStorage = new Backbone.BrowserStorage[_converse.storage](id);
                    this.toggleview.model.fetch();
                },

                render: function () {
                    if (!this.el.parentElement) {
                        this.el.innerHTML = tpl_chats_panel();
                        _converse.chatboxviews.el.appendChild(this.el);
                    }
                    if (this.keys().length === 0) {
                        this.el.classList.add('hidden');
                        _converse.chatboxviews.trimChats.bind(_converse.chatboxviews);
                    } else if (this.keys().length > 0 && !this.$el.is(':visible')) {
                        this.el.classList.remove('hidden');
                        _converse.chatboxviews.trimChats();
                    }
                    return this.$el;
                },

                toggle: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.toggleview.model.save({'collapsed': !this.toggleview.model.get('collapsed')});
                    this.$('.minimized-chats-flyout').toggle();
                },

                onChanged: function (item) {
                    if (item.get('id') === 'controlbox')  {
                        // The ControlBox has it's own minimize toggle
                        return;
                    }
                    if (item.get('minimized')) {
                        this.addChat(item);
                    } else if (this.get(item.get('id'))) {
                        this.removeChat(item);
                    }
                },

                addChat: function (item) {
                    var existing = this.get(item.get('id'));
                    if (existing && existing.$el.parent().length !== 0) {
                        return;
                    }
                    var view = new _converse.MinimizedChatBoxView({model: item});
                    this.$('.minimized-chats-flyout').append(view.render());
                    this.add(item.get('id'), view);
                    this.toggleview.model.set({'num_minimized': this.keys().length});
                    this.render();
                },

                removeChat: function (item) {
                    this.remove(item.get('id'));
                    this.toggleview.model.set({'num_minimized': this.keys().length});
                    this.render();
                },

                updateUnreadMessagesCounter: function () {
                    var ls = this.model.pluck('num_unread'),
                        count = 0, i;
                    for (i=0; i<ls.length; i++) { count += ls[i]; }
                    this.toggleview.model.set({'num_unread': count});
                    this.render();
                }
            });


            _converse.MinimizedChatsToggle = Backbone.Model.extend({
                initialize: function () {
                    this.set({
                        'collapsed': this.get('collapsed') || false,
                        'num_minimized': this.get('num_minimized') || 0,
                        'num_unread':  this.get('num_unread') || 0
                    });
                }
            });


            _converse.MinimizedChatsToggleView = Backbone.View.extend({
                el: '#toggle-minimized-chats',

                initialize: function () {
                    this.model.on('change:num_minimized', this.render, this);
                    this.model.on('change:num_unread', this.render, this);
                    this.$flyout = this.$el.siblings('.minimized-chats-flyout');
                },

                render: function () {
                    this.$el.html(tpl_toggle_chats(
                        _.extend(this.model.toJSON(), {
                            'Minimized': __('Minimized')
                        })
                    ));
                    if (this.model.get('collapsed')) {
                        this.$flyout.hide();
                    } else {
                        this.$flyout.show();
                    }
                    return this.$el;
                }
            });

            var renderMinimizeButton = function (view) {
                // Inserts a "minimize" button in the chatview's header
                var $el = view.$el.find('.toggle-chatbox-button');
                var $new_el = tpl_chatbox_minimize(
                    {info_minimize: __('Minimize this chat box')}
                );
                if ($el.length) {
                    $el.replaceWith($new_el);
                } else {
                    view.$el.find('.close-chatbox-button').after($new_el);
                }
            };
            _converse.on('chatBoxOpened', renderMinimizeButton);

            _converse.on('controlBoxOpened', function (chatbox) {
                // Wrapped in anon method because at scan time, chatboxviews
                // attr not set yet.
                if (_converse.connection.connected) {
                    _converse.chatboxviews.trimChats(chatbox);
                }
            });

            var logOut = function () {
                _converse.minimized_chats.remove();
            };
            _converse.on('logout', logOut);
        }
    });
}));


define('tpl!dragresize', ['lodash'], function(_) {return function(obj) {
obj || (obj = {});
var __t, __p = '';
with (obj) {
__p += '<div class="dragresize dragresize-top"></div>\n<div class="dragresize dragresize-topleft"></div>\n<div class="dragresize dragresize-left"></div>\n';

}
return __p
};});

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, window */

(function (root, factory) {
    define('converse-dragresize',[
            "converse-core",
            "tpl!dragresize",
            "converse-chatview",
            "converse-muc", // XXX: would like to remove this
            "converse-controlbox"
    ], factory);
}(this, function (converse, tpl_dragresize) {
    "use strict";
    var $ = converse.env.jQuery,
        _ = converse.env._;

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

            registerGlobalEventHandlers: function () {
                var that = this;
                
                $(document).on('mousemove', function (ev) {
                    if (!that.resizing || !that.allow_dragresize) { return true; }
                    ev.preventDefault();
                    that.resizing.chatbox.resizeChatBox(ev);
                });

                $(document).on('mouseup', function (ev) {
                    if (!that.resizing || !that.allow_dragresize) { return true; }
                    ev.preventDefault();
                    var height = that.applyDragResistance(
                            that.resizing.chatbox.height,
                            that.resizing.chatbox.model.get('default_height')
                    );
                    var width = that.applyDragResistance(
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
                initialize: function () {
                    var _converse = this.__super__._converse;
                    var result = this.__super__.initialize.apply(this, arguments),
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

                initialize: function () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this.__super__.initialize.apply(this, arguments);
                },

                render: function () {
                    var result = this.__super__.render.apply(this, arguments);
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
                    this.__super__._show.apply(this, arguments);
                },

                initDragResize: function () {
                    /* Determine and store the default box size.
                     * We need this information for the drag-resizing feature.
                     */
                    var _converse = this.__super__._converse;
                    var $flyout = this.$el.find('.box-flyout');
                    if (_.isUndefined(this.model.get('height'))) {
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
                    if (_converse.connection.connected) {
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
                    var _converse = this.__super__._converse;
                    if (height) {
                        height = _converse.applyDragResistance(height, this.model.get('default_height'))+'px';
                    } else {
                        height = "";
                    }
                    this.$el.children('.box-flyout')[0].style.height = height;
                },

                setChatBoxWidth: function (width) {
                    var _converse = this.__super__._converse;
                    if (width) {
                        width = _converse.applyDragResistance(width, this.model.get('default_width'))+'px';
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
                    var _converse = this.__super__._converse;
                    if (!_converse.allow_dragresize) { return true; }
                    // Record element attributes for mouseMove().
                    this.height = this.$el.children('.box-flyout').height();
                    _converse.resizing = {
                        'chatbox': this,
                        'direction': 'top'
                    };
                    this.prev_pageY = ev.pageY;
                },

                onStartHorizontalResize: function (ev) {
                    var _converse = this.__super__._converse;
                    if (!_converse.allow_dragresize) { return true; }
                    this.width = this.$el.children('.box-flyout').width();
                    _converse.resizing = {
                        'chatbox': this,
                        'direction': 'left'
                    };
                    this.prev_pageX = ev.pageX;
                },

                onStartDiagonalResize: function (ev) {
                    var _converse = this.__super__._converse;
                    this.onStartHorizontalResize(ev);
                    this.onStartVerticalResize(ev);
                    _converse.resizing.direction = 'topleft';
                },

                resizeChatBox: function (ev) {
                    var diff;
                    var _converse = this.__super__._converse;
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

                initialize: function () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    return this.__super__.initialize.apply(this, arguments);
                },

                render: function () {
                    $(window).on('resize', _.debounce(this.setWidth.bind(this), 100));
                    return this.__super__.render.apply(this, arguments);
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
                    this.__super__.initialize.apply(this, arguments);
                },

                renderLoginPanel: function () {
                    var result = this.__super__.renderLoginPanel.apply(this, arguments);
                    this.initDragResize().setDimensions();
                    return result;
                },

                renderContactsPanel: function () {
                    var result = this.__super__.renderContactsPanel.apply(this, arguments);
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
                    this.__super__.initialize.apply(this, arguments);
                },

                render: function () {
                    var result = this.__super__.render.apply(this, arguments);
                    this.renderDragResizeHandles();
                    this.setWidth();
                    return result;
                },

                renderDragResizeHandles: function () {
                    var _converse = this.__super__._converse;
                    var flyout = this.el.querySelector('.box-flyout');
                    var div = document.createElement('div');
                    div.innerHTML = tpl_dragresize();
                    flyout.insertBefore(
                        div,
                        flyout.firstChild
                    );
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse;

            this.updateSettings({
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

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define('converse-headline',[
            "converse-core",
            "tpl!chatbox",
            "converse-chatview",
    ], factory);
}(this, function (converse, tpl_chatbox) {
    "use strict";
    var _ = converse.env._,
        utils = converse.env.utils;

    converse.plugins.add('converse-headline', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var _converse = this.__super__._converse;
                    var view = this.get(item.get('id'));
                    if (!view && item.get('type') === 'headline') {
                        view = new _converse.HeadlinesBoxView({model: item});
                        this.add(item.get('id'), view);
                        return view;
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this._converse,
                __ = _converse.__;

            _converse.HeadlinesBoxView = _converse.ChatBoxView.extend({
                className: 'chatbox headlines',

                events: {
                    'click .close-chatbox-button': 'close',
                    'click .toggle-chatbox-button': 'minimize',
                    'keypress textarea.chat-textarea': 'keyPressed'
                },

                initialize: function () {
                    this.disable_mam = true; // Don't do MAM queries for this box
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('change:minimized', this.onMinimizedChanged, this);
                    this.render().fetchMessages().insertIntoDOM().hide();
                    _converse.emit('chatBoxInitialized', this);
                },

                render: function () {
                    this.$el.attr('id', this.model.get('box_id'))
                        .html(tpl_chatbox(
                                _.extend(this.model.toJSON(), {
                                        show_toolbar: _converse.show_toolbar,
                                        show_textarea: false,
                                        show_send_button: _converse.show_send_button,
                                        title: this.model.get('fullname'),
                                        unread_msgs: __('You have unread messages'),
                                        info_close: __('Close this box'),
                                        label_personal_message: ''
                                    }
                                )
                            )
                        );
                    this.$content = this.$el.find('.chat-content');
                    _converse.emit('chatBoxOpened', this);
                    utils.refreshWebkit();
                    return this;
                }
            });

            var onHeadlineMessage = function (message) {
                /* Handler method for all incoming messages of type "headline". */
                var from_jid = message.getAttribute('from');
                if (utils.isHeadlineMessage(message)) {
                    if (_.includes(from_jid, '@') && !_converse.allow_non_roster_messaging) {
                        return;
                    }
                    _converse.chatboxes.create({
                        'id': from_jid,
                        'jid': from_jid,
                        'fullname':  from_jid,
                        'type': 'headline'
                    }).createMessage(message, undefined, message);
                    _converse.emit('message', message);
                }
                return true;
            };

            var registerHeadlineHandler = function () {
                _converse.connection.addHandler(
                        onHeadlineMessage, null, 'message');
            };
            _converse.on('connected', registerHeadlineHandler);
            _converse.on('reconnected', registerHeadlineHandler);
        }
    });
}));

/*global define */
if (typeof define !== 'undefined') {
    // The section below determines which plugins will be included in a build
    define('converse',[
        "converse-core",
        // PLEASE NOTE: By default all translations are included.
        // You can modify the file src/locales.js to include only those
        // translations that you care about.

        /* START: Removable components
         * --------------------
         * Any of the following components may be removed if they're not needed.
         */
        "converse-chatview",    // Renders standalone chat boxes for single user chat
        "converse-controlbox",  // The control box
        "converse-bookmarks",   // XEP-0048 Bookmarks
        "converse-mam",         // XEP-0313 Message Archive Management
        "converse-muc",         // XEP-0045 Multi-user chat
        "converse-vcard",       // XEP-0054 VCard-temp
        "converse-otr",         // Off-the-record encryption for one-on-one messages
        "converse-register",    // XEP-0077 In-band registration
        "converse-ping",        // XEP-0199 XMPP Ping
        "converse-notification",// HTML5 Notifications
        "converse-minimize",    // Allows chat boxes to be minimized
        "converse-dragresize",  // Allows chat boxes to be resized by dragging them
        "converse-headline",    // Support for headline messages
        /* END: Removable components */
    ], function (converse) {
        return converse;
    });
}
;
    
    define('jquery', [], function () { return jQuery; });
    define('jquery-private', [], function () { return jQuery; });
    define('jquery.browser', [], function () { return jQuery; });
    define('awesomplete', [], function () { return jQuery; });
    define('lodash', [], function () { return _; });
    define('moment_with_locales', [], function () { return moment; });
    define('strophe', [], function () {
        return {
            'Strophe':         Strophe,
            '$build':          $build,
            '$iq':             $iq,
            '$msg':            $msg,
            '$pres':           $pres,
            'SHA1':            SHA1,
            'MD5':             MD5,
            'b64_hmac_sha1':   SHA1.b64_hmac_sha1,
            'b64_sha1':        SHA1.b64_sha1,
            'str_hmac_sha1':   SHA1.str_hmac_sha1,
            'str_sha1':        SHA1.str_sha1
        };
    });
    var strophePlugin = function () { return Strophe; };
    var emptyFunction = function () { };
    define('strophe.disco', ['strophe'], strophePlugin);
    define('strophe.ping', ['strophe'], strophePlugin);
    define('strophe.rsm', ['strophe'], strophePlugin);
    define('strophe.vcard', ['strophe'], strophePlugin);
    define('backbone', [], emptyFunction);
    define('backbone.browserStorage', ['backbone'], emptyFunction);
    define('backbone.overview', ['backbone'], emptyFunction);
    define('otr', [], function () { return { 'DSA': DSA, 'OTR': OTR };});
    define("locales", [], emptyFunction);
    return require('converse');
}));
