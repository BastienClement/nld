//
//	Copyright (C) 2012 Bastien Clément <g@ledric.me>
//
//	Permission is hereby granted, free of charge, to any person obtaining
//	a copy of this software and associated documentation files (the
//	"Software"), to deal in the Software without restriction, including
//	without limitation the rights to use, copy, modify, merge, publish,
//	distribute, sublicense, and/or sell copies of the Software, and to
//	permit persons to whom the Software is furnished to do so, subject to
//	the following conditions:
//
//	The above copyright notice and this permission notice shall be included
//	in all copies or substantial portions of the Software.
//
//	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//	EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//	MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//	IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//	CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//	TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//	SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//

var util = require("util");

var compress = require("./compress.js");

// Properties to serialize
var serializable = require("./bundle.js").serializable;

// Compiler --------------------------------------------------------------------

module.exports = function compile(bundle, opts) {
	var out = [];
	
	// Wrapper
	if(!opts.unwrapped) {
		if(opts.passive && opts.passive !== true) {
			out.push("(function(" + opts.passive + "){");
		} else {
			out.push("(function(){");
		}
	}
	
	// Loader
	out.push(util.format("var __nld = %s;", function(symbol, statically, loadOpts) {
		// Resolve the symbol
		symbol = __nld.resolve(symbol);
		
		// If we ask the symbol statically or this symbol is static...
		if(statically || __nld._sym[symbol].flag === "s" || __nld._sym[symbol].flag === "b") {
			// ... simply return symbol's data.
			return __nld._sym[symbol].data;
		}
		
		// Else, we execute it. But not if already done.
		if(__nld.cache[symbol]) {
			return __nld.cache[symbol];
		}
		
		// Executing and caching
		return (__nld.cache[symbol] = __nld.load(symbol, loadOpts));
	}));
	
	// Loader cache
	out.push("__nld.cache = [];");
	
	// Resolver
	out.push(util.format("__nld.resolve = %s;", function(symbol) {
		// This symbol is not defined
		if(!__nld._sym[symbol]) {
			// Lookup the paths-map to resolve the symbol
			if(__nld._map[symbol]) {
				symbol = __nld._map[symbol];
			} else {
				throw new Error("nld: undefined symbol '" + symbol + "'");
			}
		}
		
		return symbol;
	}));
	
	// Bundle serialization
	serializable.forEach(function(property) {
		out.push(util.format("__nld.%s = %j;", property, bundle[property]));
	});
	
	// Catching bad adapters
	out.push("__nld.load = function() { throw new Error(\"nld: invalid adapter, load unavailable\"); };");
	
	// Bundle Init
	out.push("if(typeof require !== \"undefined\" && typeof module !== \"undefined\" && require.main !== module) {");
		// nld trap, exports bundle without running
		out.push("module.exports = __nld;");
	out.push("} else {");
		// Adapter	
		if(typeof opts.adapter !== "function") {
			throw new Error("nld compiler: invalid adapter");
		}
		out.push(util.format("(%s)();", opts.adapter));
		
		// Auto run
		if(bundle._run.length > 0) {
			out.push(util.format("__nld._run.forEach(%s);", function(symbol) {
				__nld(symbol);
			}));
		}
	out.push("}");
	
	// End wrapper
	if(!opts.unwrapped) {
		// Passive bundle doesn't run
		if(opts.passive) {
			out.push("})");
		} else {
			out.push("})();");
		}
	}
	
	// Compile
	out = out.join("");
	
	// Compress
	out = compress(out, opts);
	
	// Add shebang if needed
	if(opts.interpreter) {
		out = "#!" + opts.interpreter + "\n" + out;
	}
	
	return out;
};
