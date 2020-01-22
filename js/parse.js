// Parsing regular expressions
// Using standard precedence order: parenthesis > star > concat > or
function parseRegex(stringo) {
	var stream = {
		string: stringo,
		pos: 0,
		cur: (function() { return this.string[this.pos]; }),
		done: (function() { return this.pos == this.string.length; })
	};
	var tree = parseExpr(stream);
	if (!stream.done())
		throw "Non-empty stream";
	console.log(tree);
	return tree;
}

function parseExpr(stream) {
	var terms = []
	while (!stream.done()) {
		terms.push(parseTerm(stream));
		if (!stream.done() && stream.cur() == '|')
			stream.pos++;
		else
			break;
	}
	if (terms.length == 0)
		throw "Empty expression";
	else if (terms.length == 1)
		return terms[0];
	else {
		return {
			type: "or",
			value: terms
		}
	}
}

function parseTerm(stream) {
	var concats = []
	while (!stream.done()) {
		concat = parseConcat(stream);
		if (concat != undefined)
			concats.push(concat);
		else
			break;
	}
	if (concats.length == 0)
		throw "Empty term";
	else if (concats.length == 1)
		return concats[0];
	else {
		return {
			type: "concat",
			value: concats
		}
	}
}

function parseConcat(stream) {
	var atom = parseAtom(stream);
	if (atom != undefined && !stream.done() && stream.cur() == "*") {
		stream.pos++;
		return {
			type: "star",
			value: atom
		}
	}
	else {
		return atom;
	}
}

function parseAtom(stream) {
	if (stream.done())
		throw "Missing atom";
	else if (stream.cur().toUpperCase() != stream.cur().toLowerCase()) { // Is letter
		stream.pos++;
		return {
			type: "letter",
			value: stream.string[stream.pos-1]
		}
	}
	else if (stream.cur() == '0') {
		stream.pos++;
		return {
			type: "lambda",
			value: undefined
		}
	}
	else if (stream.cur() == '(') {
		stream.pos++;
		var expr = parseExpr(stream);
		if (!stream.done() && stream.cur() == ')') {
			stream.pos++;
			return expr;
		}
		else {
			throw "Missing )"
		}
	}
	else {
		return undefined;
	}
}