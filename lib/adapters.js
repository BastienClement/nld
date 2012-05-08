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

// Load nld bundle in a "nld-generic" compliant environment
exports.generic = function() {
	if(typeof __nld_adapter !== "function") {
		throw new Error("nld: generic bundle requires a __nld_adapter function");
	}
	__nld_adapter(__nld);
};

// Load nld bundle in Node.js
exports.node = function() {
	var vm = require("vm");
	var path = require("path");
	
	__nld.load = function(symbol, parent) {
		var sym = __nld._sym[symbol];
		
		var module = {
			id: symbol,
			exports: {},
			parent: (parent || null),
			filename: path.resolve(__dirname, sym.path),
			loaded: false,
			exited: false,
			children: [],
			paths: []
		};
		
		if(parent && parent.children) {
			parent.children.push(module);
		}
		
		var sandbox = {};
		
		for(var k in global) {
			sandbox[k] = global[k];
		}
		
		sandbox.exports = module.exports;
		sandbox.__filename = module.filename;
		sandbox.__dirname = path.dirname(module.filename);
		sandbox.module = module;
		sandbox.global = sandbox;
		sandbox.root = root; // TODO: What's this ?!
		
		// Require inside a bundle
		function local_require(submod) {
			// Resolve local module symbol
			if(submod.slice(0, 1) === ".") {
				submod = path.join(path.dirname(sym.path), submod);

				// Outside bundle
				if(submod.slice(0, 2) === "..") {
					throw null; // Will be catched by the try{} in require
				}
			}
			
			// Try given name, if fails, add ".js" and try again
			var submod_sym;
			try {
				submod_sym = __nld.resolve(submod);
			} catch(e) {
				submod_sym = __nld.resolve(submod + ".js");
			}
			
			// Detect cycles
			function find_cycle_root(leaf) {
				if(leaf.id === submod_sym) {
					return leaf;
				} else if(leaf.parent) {
					return find_cycle_root(leaf.parent);
				} else {
					return false;
				}
			}
			
			var cycle_root = find_cycle_root(module);
			if(cycle_root) {
				return cycle_root.exports;
			}
			
			return __nld(submod_sym, undefined, module);
		}
		
		// Require hook
		sandbox.require = function(submod, weak) {
			var a = weak ? require : local_require;
			var b = weak ? local_require : require;
			
			try {
				return a(submod);
			} catch(e) {}
			
			return b(submod);
		};
		
		// Remove shebang and exec
		vm.runInNewContext(sym.data.replace(/^\#\!.*/, ""), sandbox, sym.path);
		
		return module.exports;
	};
};
