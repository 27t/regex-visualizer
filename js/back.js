/*
	------
	File containing all the backend algorithms
	Parsing expression, constructing NFAl, converting it to
	NFA, DFA and DFAm, simplifying automata and other utils
	------
*/

"use strict";

/*
	Parsing regular expressions
	Using standard precedence order: parenthesis > star > concat > or
	Return an operation tree
*/
function parseRegex(stringo) {
	var stream = {
		string: stringo,
		pos: 0,
		cur: (function() { return this.string[this.pos]; }),
		done: (function() { return this.pos == this.string.length; })
	};
	try {
		var tree = parseExpr(stream);
		if (!stream.done())
			throw "Non-empty stream";
		console.log(tree);
		return tree;
	}
	catch (err) {
		return -1;
	}
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
		var concat = parseConcat(stream);
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

/*
	Functions for NFAl: Construct NFAl from regular expression tree
	and a function to remove states with only 1 incoming or outgoing lambda transition
*/
function constructNFAl(tree) {
	var NFAl = { // Initialize as empty NFA
		alphabet: new Set([]), // Set containing letters used in expression
		states: 0,             // Amount of states
		start: 0,              // Index of starting state
		edges: [],             // List of map of outgoing edges for each state
		outgoing: [],          // Amount of outgoing edges for each state
		incoming: [],          // Amount of incoming edges for each state
		accepting: new Set([]) // Set of accepting states
	}

	switch(tree.type) {
		case "or":
			NFAl.states++; // Add starting state
			var oldaccepting = new Set([]);
			for (var i = 0; i < tree.value.length; i++) {
				var NFAltemp = constructNFAl(tree.value[i]); // Build NFA's for all parts
				NFAltemp.alphabet.forEach(function(val) {
					NFAl.alphabet.add(val);
				});
				mergeEdges(NFAl, NFAltemp);
				addTransition(0,NFAltemp.start+NFAl.states,"0",NFAl.outgoing,NFAl.incoming,NFAl.edges);
				oldaccepting.add(NFAltemp.accepting.values().next().value + NFAl.states);
				NFAl.states += NFAltemp.states;
			}
			NFAl.states++; // Add accepting state
			oldaccepting.forEach(function(val) {
				addTransition(val,NFAl.states-1,"0",NFAl.outgoing,NFAl.incoming,NFAl.edges);
			});
			NFAl.accepting.add(NFAl.states-1);
			return NFAl;

		case "concat":
			for (var i = 0; i < tree.value.length; i++) {
				var NFAltemp = constructNFAl(tree.value[i]); // Build NFA's for all parts
				NFAltemp.alphabet.forEach(function(val) {
					NFAl.alphabet.add(val);
				});
				mergeEdges(NFAl, NFAltemp);
				if (i == 0)
					NFAl.start = NFAltemp.start;
				else
					addTransition(prev,NFAltemp.start+NFAl.states,"0",NFAl.outgoing,NFAl.incoming,NFAl.edges);
				if (i == tree.value.length-1)
					NFAl.accepting.add(NFAltemp.accepting.values().next().value+NFAl.states);
				var prev = NFAltemp.accepting.values().next().value+NFAl.states;
				NFAl.states += NFAltemp.states;
			}
			return NFAl

		case "star":
			var NFAltemp = constructNFAl(tree.value); // Build NFA for part to be starred
			addTransition(NFAltemp.states,NFAltemp.start,"0",NFAltemp.outgoing,NFAltemp.incoming,NFAltemp.edges);
			addTransition(NFAltemp.accepting.values().next().value,NFAltemp.states,"0",NFAltemp.outgoing,NFAltemp.incoming,NFAltemp.edges);
			NFAltemp.states++;
			NFAltemp.accepting = new Set([NFAltemp.states-1]);
			NFAltemp.start = NFAltemp.states-1;
			return NFAltemp;

		case "letter":
			NFAl.alphabet.add(tree.value);
			NFAl.states = 2;
			addTransition(0,1,tree.value,NFAl.outgoing,NFAl.incoming,NFAl.edges);
			NFAl.accepting.add(1);
			return NFAl;

		case "lambda":
			NFAl.states = 1;
			NFAl.accepting.add(0);
			return NFAl;

		default:
			console.log("Unknown type");
	}

}

// Merge edges and incoming and outgoing arrays of two NFAl's
function mergeEdges(orig, temp) {
	for (var i = 0; i < temp.states; i++) {
		if (temp.edges[i] != undefined) {
			for (var symbol in temp.edges[i]) {
				temp.edges[i][symbol].forEach(function(value) {
					addTransition(i+orig.states, value+orig.states, symbol, orig.outgoing, orig.incoming, orig.edges);
				});
			}
		}

	}
}

// Find and remove trivial states (states that have only 1 outgoing or 1 incoming lambda-edge)
function trivialStates(NFAl) {
	for (var i = NFAl.states-1; i >= 0; i--) {
		var removed = false;
		if (NFAl.outgoing[i] == 1) {
			for (var symbol in NFAl.edges[i]) {
				if (symbol == "0" && !NFAl.edges[i][symbol].has(i) && NFAl.edges[i][symbol] != undefined && NFAl.edges[i][symbol].size != 0) {
					removeTrivialState(NFAl, i, NFAl.edges[i][symbol].values().next().value, false);
					removed = true;
					break;
				}
			}
		}
		if (NFAl.incoming[i] == 1 && !removed) {
			for (var j = 0; j < NFAl.states; j++) {
				if (removed)
					break;
				if (NFAl.edges[j] == undefined || NFAl.edges[j]["0"] == undefined)
					continue;
				var it = NFAl.edges[j]["0"].values();
				for (var val = it.next().value; val !== undefined; val = it.next().value) {
					if (val == i) {
						removeTrivialState(NFAl, i, j, true);
						removed = true;
						break;
					}
				};
			}
		}
	}
	return NFAl;
}

function removeTrivialState(NFAl, state, tofr, tag) {
	if (NFAl.accepting.has(state) || NFAl.start == state)
		return;
	if (!tag) { // Trivial outgoing
		for (var i = 0; i < NFAl.states; i++) {
			for (var symbol in NFAl.edges[i]) {
				NFAl.edges[i][symbol].forEach(function(value) {
					if (value == state) {
						addTransition(i, tofr, symbol, NFAl.outgoing, NFAl.incoming, NFAl.edges);
						removeTransition(i, state, symbol, NFAl.outgoing, NFAl.incoming, NFAl.edges);
					}
				});
			}
		}
		removeTransition(state, tofr, "0", NFAl.outgoing, NFAl.incoming, NFAl.edges);
	}
	else { // Trivial incoming
		for (var symbol in NFAl.edges[state]) {
			NFAl.edges[state][symbol].forEach(function(value) {
				addTransition(tofr, value, symbol, NFAl.outgoing, NFAl.incoming, NFAl.edges);
				removeTransition(state, value, symbol, NFAl.outgoing, NFAl.incoming, NFAl.edges);
			});
		}
		removeTransition(tofr, state, "0", NFAl.outgoing, NFAl.incoming, NFAl.edges);
	}

	// Update edges array number now that a state has been deleted
	for (var i = 0; i < NFAl.states; i++) {
		for (var symbol in NFAl.edges[i]) {
			var newSet = new Set([]);
			NFAl.edges[i][symbol].forEach(function(value) {
				if (value >= state)
					newSet.add(value-1);
				else
					newSet.add(value);
			});
			NFAl.edges[i][symbol] = newSet;
		}
	}

	if (NFAl.start >= state)
		NFAl.start--;

	var newAccepting = new Set([]);
	var it = NFAl.accepting.values();
	for (var val = it.next().value; val !== undefined; val = it.next().value) {
		if (val >= state)
			newAccepting.add(val-1);
		else
			newAccepting.add(val);
	}
	NFAl.accepting = newAccepting;

	for (var i = state; i < NFAl.states; i++) {
		NFAl.edges[i] = NFAl.edges[i+1];
		NFAl.outgoing[i] = NFAl.outgoing[i+1];
		NFAl.incoming[i] = NFAl.incoming[i+1];
	}
	NFAl.states--;
}

/*
	Functions for NFA: Construct NFA from NFAl by removing lambda transitions
	and a function to compute lambda closure of states
*/

function removelTransitions(NFAl, ledges, newedges) {
	var closure = lClosure(NFAl); // Calculate which states can be reached from which states using only lambda transitions
	for (var i = 0; i < NFAl.states; i++) {
		closure[i].forEach(function(val) {
			if (NFAl.edges[val] != undefined) {
				for (var symbol in NFAl.edges[val]) {
					if (symbol != "0" && NFAl.edges[val][symbol] != undefined) {
						NFAl.edges[val][symbol].forEach(function(val2) {
							if (NFAl.edges[i] == undefined || NFAl.edges[i][symbol] == undefined || !NFAl.edges[i][symbol].has(val2)) {
								newedges.add([i,val2,symbol]);
								addTransition(i, val2, symbol, NFAl.outgoing, NFAl.incoming, NFAl.edges);
							}
						});
					}
				}
			}
			if (NFAl.accepting.has(val))
				NFAl.accepting.add(i);
		});
	}
	for (var i = 0; i < NFAl.states; i++) {
		if (NFAl.edges[i] == undefined || NFAl.edges[i]["0"] == undefined)
			continue;
		NFAl.edges[i]["0"].forEach(function(val) {
			removeTransition(i, val, "0", NFAl.outgoing, NFAl.incoming, NFAl.edges);
			ledges.add([i,val,"0"]);
		});
	}
	return NFAl;
}

function lClosure(NFAl) {
	var closure = []
	for (var i = NFAl.states-1; i >= 0; i--) {
		closure[i] = new Set([i]); // State can reach itself using only lambda transitions
		closure[i].forEach(function(val) {
			if (NFAl.edges[val] != undefined && NFAl.edges[val]["0"] != undefined) {
				NFAl.edges[val]["0"].forEach(function(val2) {
					if (val2 > i) {
						closure[val2].forEach(function(val3) {
							closure[i].add(val3);
						});
					}
					else {
						closure[i].add(val2);
					}
				});
			}
		});
	}
	return closure;
}

function animatelTransitions(NFAl) {
	var normaledges = new Set();
	var ledges = new Set();
	var newedges = new Set();
	var NFA = removelTransitions(deepCopyAutomaton(NFAl), ledges, newedges);
	for (var i = 0; i < NFAl.states; i++) {
		if (NFAl.edges[i] == undefined)
			continue;
		for (var symbol in NFAl.edges[i]) {
			if (symbol != "0" && NFAl.edges[i][symbol] != undefined) {
				NFAl.edges[i][symbol].forEach(function(val) {
					normaledges.add([i,val,symbol]);
				});
			}
		}
	}

	dotstring = "digraph automaton {\n"
	dotstring += "rankdir=LR\n"
	dotstring += "qi [shape=point, style=invis]; qi\n"
	NFAl.accepting.forEach(function(val) {
		dotstring += "node [shape = doublecircle]; " + val + " ;\n";
	});
	dotstring += "node [shape=circle];\n";
	dotstring += "qi -> " + NFAl.start + "[style=bold];\n";
	newedges.forEach(function(val) {
		dotstring += val[0] + " -> " + val[1] + " [label = \"" + val[2] + "\"];\n";
	});
	normaledges.forEach(function(val) {
		dotstring += val[0] + " -> " + val[1] + " [label = \"" + val[2] + "\"];\n";
	})
	dotstring += "}";
	console.log(dotstring);
	return dotstring;
}

/*
	General functions
*/

function generateAutomata(regex) {
	instance = { NFAl: constructNFAl(parseRegex(regex_global)) }
	instance.NFA = {
		normaledges: new Set(),
		ledges: new Set(),
		newedges: new Set()
	}
	instance.NFA.NFA = removelTransitions(deepCopyAutomaton(instance.NFAl), instance.NFA.ledges, instance.NFA.newedges)
}

function addTransition(from, to, symbol, outgoing, incoming, edges) {
	if (edges[from] == undefined)
		edges[from] = {};
	if (edges[from][symbol] == undefined)
		edges[from][symbol] = new Set([to]);
	else {
		if (edges[from][symbol].has(to))
			return; // Transition already exists
		edges[from][symbol].add(to);
	}
	if (outgoing[from] == undefined)
		outgoing[from] = 1;
	else
		outgoing[from]++;
	if (incoming[to] == undefined)
		incoming[to] = 1;
	else
		incoming[to]++;
}

function removeTransition(from, to, symbol, outgoing, incoming, edges) {
	if (edges[from][symbol].has(to)) {
		outgoing[from]--;
		incoming[to]--;
		edges[from][symbol].delete(to);
	}
}

function deepCopyAutomaton(FA) {
	var copy = {
		alphabet: new Set(FA.alphabet),         // Set containing letters used in expression
		states: FA.states,                      // Amount of states
		start: FA.start,                        // Index of starting state
		edges: [],                              // List of map of outgoing edges for each state
		outgoing: new Array(FA.outgoing),       // Amount of outgoing edges for each state
		incoming: new Array(FA.incoming),       // Amount of incoming edges for each state
		accepting: new Set(FA.accepting)        // Set of accepting states
	}
	for (var i = 0; i < FA.states; i++) {
		if (FA.edges[i] != undefined) {
			copy.edges[i] = {};
			for (var symbol in FA.edges[i]) {
				copy.edges[i][symbol] = new Set(FA.edges[i][symbol]);
			}
		}
	}
	return copy;
}
