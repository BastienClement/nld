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

var jsp = require("uglify-js").parser;
var pro = require("uglify-js").uglify;
//var con = require("uglify-js").consolidator;

// JS Compressor built on Uglify-JS
module.exports = function(code, opts) {
	if(!(opts.debug > 2)) {
		var ast = jsp.parse(code);
		
		if(!(opts.debug > 1)) {
			//ast = con.ast_consolidate(ast);
			ast = pro.ast_lift_variables(ast);
			ast = pro.ast_mangle(ast, {except: ["__nld"]});
			ast = pro.ast_squeeze(ast);
		}
		
		code = pro.gen_code(ast, {beautify: opts.debug});
	}
	
	return code;
};
