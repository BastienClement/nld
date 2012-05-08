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

var path = require("path");
var fs = require("fs");

// Constructor -----------------------------------------------------------------

var Bundle = module.exports = function(path) {
	this._sym = {};
	this._map = {};
	this._run = [];
	
	if(path) {
		this.open(path);
	}
};

Bundle.serializable = ["_sym", "_map", "_run"];

// Opener ----------------------------------------------------------------------

// Open a base bundle and import it inside this bundle
Bundle.prototype.open = function(mod_path) {
	var bundle = require(path.resolve(mod_path));
	
	var self = this;
	Bundle.serializable.forEach(function(property) {
		if(!bundle[property]) {
			throw new Error("Unable to read bundle file");
		}
		
		self[property] = bundle[property];
	});
	
	this.load = bundle;
}

// Viewer ----------------------------------------------------------------------

Bundle.prototype.symbol = function(symbol) {
	return this._sym[symbol];
}

Bundle.prototype.symbols = function() {
	return this._sym;
}

Bundle.prototype.map = function() {
	return this._map;
}

Bundle.prototype.autoruns = function() {
	return this._run;
}

Bundle.prototype.resolve = function(symbol) {
	if(!this._sym[symbol]) {
		if(this._map[symbol]) {
			symbol = this._map[symbol];
		} else {
			return false;
		}
	}
	
	return symbol;
}

// Editor ----------------------------------------------------------------------

Bundle.prototype.addSymbol = function(name, data, sym_path, flag) {
	this._sym[name] = {data: data, path: sym_path, flag: flag};
	this._map[sym_path] = name;
	
	if(flag === "x") {
		this._run.push(name);
	}
};


Bundle.prototype.removeSymbol = function(name) {
	if(!this._sym[name]) {
		return false;
	}
	
	delete this._map[this._sym[name].path];
	delete this._sym[name];
	
	this._run = this._run.filter(function(sym, sym_name) { return sym_name !== name; });
	
	return true;
};

// Compiler --------------------------------------------------------------------

var compile = require("./compile.js");

Bundle.prototype.compile = function(opts) {
	return compile(this, opts);
};

// Compile & Print to stdout
Bundle.prototype.print = function(opts) {
	console.log(compile(this, opts));
};

// Compile & Write to path
Bundle.prototype.write = function(path, opts, fn) {
	if(typeof path !== "string") {
		throw new Error("Bundle.write: invalid output path given");
	}
	
	fs.writeFile(path, compile(this, opts), "utf8", fn);
};
