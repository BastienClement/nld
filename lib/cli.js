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

var Bundle = require("./bundle.js");
var compress = require("./compress.js");

// Built-in adapters
var adapters = require("./adapters.js");

var path = require("path");
var fs = require("fs");
var util = require("util");

// Create bundle ---------------------------------------------------------------

function create(opts) {	
	function absolute_path(arg_path) {
		return path.resolve(process.cwd(), arg_path);
	}
	
	// Parse arguments
	function parse_with_flag(flag) {
		return function(arg) {
			var parts = arg.split(":");
			if(parts.length < 2) {
				parts.unshift(null);
			}
			
			return {name: parts[0], path: absolute_path(parts[1]), flag: flag};
		}
	}

	opts.l = ((opts.l && opts.l !== true) ? [].concat(opts.l) : []).map(parse_with_flag("l"));
	opts.b = ((opts.b && opts.b !== true) ? [].concat(opts.b) : []).map(parse_with_flag("b"));
	opts.s = ((opts.s && opts.s !== true) ? [].concat(opts.s) : []).map(parse_with_flag("s"));
	if(!opts.j) {
		opts.x = ((opts.x && opts.x !== true) ? [].concat(opts.x) : []).map(parse_with_flag("x"));
	}
	opts._ = opts._.map(parse_with_flag(""));
	
	// Merge all arguments
	var args;
	if(!opts.j) {
		args = opts.l.concat(opts.b).concat(opts.s).concat(opts._).concat(opts.x);
	} else {
		args = opts._;
	}
	
	if(args.length === 0) {
		throw new Error("no input file");
	}
	
	// Determine link root
	var bundle_root;
	if(args.length < 2) {
		bundle_root = path.dirname(args[0].path);
	} else if(!opts.j) {
		bundle_root = args.reduce(function(arg1, arg2) {
			var path1 = (typeof arg1 === "string") ? arg1 : arg1.path;
			var path2 = arg2.path;
			
			var i = 0;
			for(; i < path1.length && path1.charAt(i) === path2.charAt(i); i++);
			return path1.slice(0, i);
		});
	}

	// Bundle
	var bundle = new Bundle
	
	var symbols_loaded = {};
	var join = [];
	if(typeof opts.j !== "string") {
		opts.j = false;
	}
	
	// Load symbols
	function load_symbol(symbol) {
		// Merge bundle
		if(symbol.flag === "l") {
			var sub = new Bundle(symbol.path);
			for(var subsym_name in sub.symbols()) {
				var subsym = sub.symbol(subsym_name);
				
				// Merge prefix
				if(symbol.name === null) {
					var subpath = path.dirname(symbol.path);
					var prefix = path.relative(bundle_root, subpath);
					if(prefix !== "") {
						prefix += "/";
					}
					symbol.name = prefix;
				}
				
				subsym_name = symbol.name + subsym_name;
				subsym.path = symbol.name + subsym.path;
				
				bundle.addSymbol(subsym_name, subsym.data, subsym.path, subsym.flag);
			}
			return;
		}
		
		var data = fs.readFileSync(symbol.path, (symbol.flag === "b" ? "base64" : "utf8"));
		
		if(opts.c && (symbol.flag === "" || symbol.flag === "x")) {
			// Remove shebang
			data = data.replace(/^\#\!.*/, "");
			if(!opts.j) {
				data = compress(data, {
					debug: opts.d
				});
			}
		}
		
		if(opts.j) {
			join.push(data);
			return;
		}
		
		var sym_path = path.relative(bundle_root, symbol.path);
		if(!symbol.name) {
			symbol.name = opts.f ? path.basename(sym_path) : sym_path;
		}
		
		if(symbols_loaded[symbol.name]) {
			warning("symbol collision on " + symbol.name, opts);
			bundle.removeSymbol(symbol.name);
		} else {
			symbols_loaded[symbol.name] = true;
		}
		
		bundle.addSymbol(symbol.name, data, sym_path, symbol.flag);
	}
	
	args.forEach(load_symbol);
	
	// Handle join
	if(opts.j) {
		var data = join.join(";\n");
		if(opts.c) {
			data = compress(data, {
				debug: opts.d
			});
		}
		bundle.addSymbol(opts.j, data, opts.j, (opts.x ?  "x" : ""));
	}
	
	do_compile(bundle, opts);
}

// Dump bundle -----------------------------------------------------------------

function dump(opts) {
	if(typeof opts.dump !== "string") {
		throw new Error("no input file");
	}
	
	var bundle = new Bundle(opts.dump);
	
	// Dump a single symbol
	if(opts._.length > 0 || opts.b) {
		var symbol = opts._[0] || opts.b;
		process.stdout.write(bundle.load(symbol, true), (opts.b ? "base64" : "utf8"));
		return;
	}
	
	// Dump the whole bundle
	
	console.log("SYMBOLS:");
	for(var symbol in bundle.symbols()) {
		var sym = bundle.symbol(symbol);
		
		var flag = sym.flag;
		if(flag === "") {
			flag = " ";
		}
		
		console.log(util.format("  [%s] %s", flag, symbol));
	}
	
	console.log("\nPATHS-MAP:");
	for(var path in bundle.map()) {
		console.log(util.format("  %s -> %s", path, bundle.resolve(path)));
	}
	
	console.log("\nAUTORUNS:");
	bundle.autoruns().forEach(function(autorun) {
		console.log(util.format("  %s", autorun));
	});
}

// Convert ---------------------------------------------------------------------

function convert(opts) {
	var input = opts.convert || opts.edit;
	if(typeof input !== "string") {
		throw new Error("no input file");
	}
	
	var bundle = new Bundle(input);
	
	do_compile(bundle, opts);
}

// Main ------------------------------------------------------------------------

exports.exec = function(opts) {
	if(opts.dump) {
		return dump(opts);
	}
	
	if(opts.convert || opts.edit) {
		return convert(opts);
	}
	
	return create(opts);
};

function warning(msg, opts) {
	if(!opts.q) {
		console.error("Warning:", msg);
	}
}

function do_compile(bundle, opts) {
	// Load adapter
	var adapter;
	if(opts.a) {
		if(opts.a === true) {
			adapter = adapters.generic;
		} else if(adapters[opts.a]) {
			adapter = adapters[opts.a];
		} else {
			var adapter = require(opts.a);
			if(typeof adapter !== "function") {
				throw new Error("invalid adapter");
			}
		}
	} else {
		adapter = adapters.node;
	}
	
	var compile_options = {
		adapter: adapter,
		debug: opts.d,
		interpreter: (opts.i) ?
			((typeof opts.i === "string") ? opts.i : "/usr/bin/env node") :
			false,
		passive: opts.p,
		unwrapped: opts.u
	};
		
	if(opts.o) {
		bundle.write(opts.o, compile_options, function(err) {
			if(err) {
				console.error("Error: unable to write output file");
			}
		});
	} else {
		bundle.print(compile_options);
	}
}
