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
		if (concat != undefined) {
			if (concat.length == 2) { // In case of +, count as 2 concatsx
				concats.push(concat[0]);
				concats.push(concat[1]);
			}
			else {
				concats.push(concat);
			}
		}
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
	else if (atom != undefined && !stream.done() && stream.cur() == "+") {
		stream.pos++;
		return [ // At least 1, concat of atom and atom*
			atom, {
				type: "star",
				value: atom
			}
		]
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
				addTransition(NFAl, 0, NFAltemp.start+NFAl.states, "0");
				oldaccepting.add(NFAltemp.accepting.values().next().value + NFAl.states);
				NFAl.states += NFAltemp.states;
			}
			NFAl.states++; // Add accepting state
			oldaccepting.forEach(function(val) {
				addTransition(NFAl, val, NFAl.states-1, "0");
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
					addTransition(NFAl,prev,NFAltemp.start+NFAl.states,"0");
				if (i == tree.value.length-1)
					NFAl.accepting.add(NFAltemp.accepting.values().next().value+NFAl.states);
				var prev = NFAltemp.accepting.values().next().value+NFAl.states;
				NFAl.states += NFAltemp.states;
			}
			return NFAl

		case "star":
			var NFAltemp = constructNFAl(tree.value); // Build NFA for part to be starred
			addTransition(NFAltemp,NFAltemp.states,NFAltemp.start,"0");
			addTransition(NFAltemp,NFAltemp.accepting.values().next().value,NFAltemp.states,"0");
			NFAltemp.states++;
			NFAltemp.accepting = new Set([NFAltemp.states-1]);
			NFAltemp.start = NFAltemp.states-1;
			return NFAltemp;

		case "letter":
			NFAl.alphabet.add(tree.value);
			NFAl.states = 2;
			addTransition(NFAl,0,1,tree.value);
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
					addTransition(orig,i+orig.states, value+orig.states, symbol);
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
						addTransition(NFAl, i, tofr, symbol);
						removeTransition(NFAl, i, state, symbol);
					}
				});
			}
		}
		removeTransition(NFAl, state, tofr, "0");
	}
	else { // Trivial incoming
		for (var symbol in NFAl.edges[state]) {
			NFAl.edges[state][symbol].forEach(function(value) {
				addTransition(NFAl, tofr, value, symbol);
				removeTransition(NFAl, state, value, symbol);
			});
		}
		removeTransition(NFAl, tofr, state, "0");
	}

	removeState(NFAl, state);
	// Update edges array number now that a state has been deleted
	/*for (var i = 0; i < NFAl.states; i++) {
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

	var newaccepting = new Set([]);
	var it = NFAl.accepting.values();
	for (var val = it.next().value; val !== undefined; val = it.next().value) {
		if (val >= state)
			newaccepting.add(val-1);
		else
			newaccepting.add(val);
	}
	NFAl.accepting = newaccepting;

	for (var i = state; i < NFAl.states; i++) {
		NFAl.edges[i] = NFAl.edges[i+1];
		NFAl.outgoing[i] = NFAl.outgoing[i+1];
		NFAl.incoming[i] = NFAl.incoming[i+1];
	}
	NFAl.states--;*/
}

/*
	Functions for NFA: Construct NFA from NFAl by removing lambda transitions,
  a function to compute lambda closure of states and a function for removing unreachable states
*/
function removelTransitions(NFAl) {
	var closure = lClosure(NFAl); // Calculate which states can be reached from which states using only lambda transitions
	NFAl.ledges = new Set();
	NFAl.newedges = new Set();
	NFAl.normaledges = new Set();
	NFAl.newaccepting = [];
	for (var i = 0; i < NFAl.states; i++) {
		if (NFAl.edges[i] == undefined)
			continue;
		for (var symbol in NFAl.edges[i]) {
			if (NFAl.edges[i][symbol] != undefined) {
				NFAl.edges[i][symbol].forEach(function(val) {
					if (symbol != "0")
						NFAl.normaledges.add([i,val,symbol]);
					else {
						NFAl.ledges.add([i,val,"0"]);
					}
				});
			}
		}
	}
	for (var i = 0; i < NFAl.states; i++) {
		closure[i].forEach(function(val) {
			if (NFAl.edges[val] != undefined) {
				for (var symbol in NFAl.edges[val]) {
					if (symbol != "0" && NFAl.edges[val][symbol] != undefined) {
						NFAl.edges[val][symbol].forEach(function(val2) {
							if (NFAl.edges[i] == undefined || NFAl.edges[i][symbol] == undefined || !NFAl.edges[i][symbol].has(val2)) {
								if (addTransition(NFAl, i, val2, symbol))
									NFAl.newedges.add([i,val2,symbol]);
							}
						});
					}
				}
			}
			if (NFAl.accepting.has(val) && !NFAl.accepting.has(i)) {
				NFAl.accepting.add(i);
				NFAl.newaccepting.push(i);
			}
		});
	}
	for (var i = 0; i < NFAl.states; i++) {
		if (NFAl.edges[i] == undefined || NFAl.edges[i]["0"] == undefined)
			continue;
		NFAl.edges[i]["0"].forEach(function(val) {
			removeTransition(NFAl, i, val, "0");
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

function removeUnreachable(NFA, NFAold) { // Remove unreachable states and their edges, and lower state numbers
	var reachable = new Set([NFA.start]); // Start state is reachable
	NFAold.unreachable = [];
	reachable.forEach(function(val) {
		if (NFA.edges[val] == undefined)
			return;
		for (var symbol in NFA.edges[val]) {
			NFA.edges[val][symbol].forEach(function(val2) {
				reachable.add(val2);
			})
		}
	})
	for (var i = NFA.states-1; i >= 0; i--) {
		if (!reachable.has(i)) {
			removeState(NFA, i);
			NFAold.unreachable.push(i);
		}
	}
	return NFA;
}

/*
	Functions for DFA
*/
function subsetConstruction(NFA) { // Convert a NFA to DFA by using the subset construction
	var DFA = {
		alphabet: new Set(NFA.alphabet), // Set containing letters used in expression
		states: 1,                       // Amount of states
		start: 0,                				 // Index of starting state
		edges: [],                       // List of map of outgoing edges for each state
		outgoing: [],      							 // Amount of outgoing edges for each state
		incoming: [],      						 	 // Amount of incoming edges for each state
		accepting: new Set(),        		 // Set of accepting states
		statescor: []										 // Array that keeps track of what old states correspond to a new state
	}
	DFA.statescor[0] = [NFA.start]; // The only state corresponding to the new starting state is the old starting state

	var reachable = []; // States reachable from a current list of states using a certain symbol
	for (var i = 0; i < DFA.states; i++) {
		DFA.alphabet.forEach(function(symbol) {
			reachable = []; // Initialize reachable as empty for each symbol
			for (var j = 0; j < DFA.statescor[i].length; j++) {
				if (NFA.edges[DFA.statescor[i][j]] != undefined && NFA.edges[DFA.statescor[i][j]][symbol] != undefined) {
					NFA.edges[DFA.statescor[i][j]][symbol].forEach(function(val) {
						if (!reachable.includes(val))
							reachable.push(val);
					})
				}
			}
			reachable.sort(function(a, b) {
				return a-b;
			});
			var index = ArrayHasArray(DFA.statescor, reachable);
			if (index != -1) { // State corresponding to exactly these elements already exists
				addTransition(DFA, i, index, symbol);
			}
			else { // State corresponding to exactly these elements doesn't yet exist: create it
				var isaccepting = false; // New state is accepting if reachable contains an accepting state from the NFA
				for (var j = 0; j < reachable.length; j++) {
					if (NFA.accepting.has(reachable[j]))
						isaccepting = true;
				}
				if (isaccepting) {
					DFA.accepting.add(DFA.states);
				}
				addTransition(DFA, i, DFA.states, symbol);
				DFA.statescor[DFA.states] = reachable;
				DFA.states++;
			}
		})
	}
	return DFA;
}

/*
	Functions for DFAm
*/
function minimizeDFA(DFA) { // Minimize a DFA by computing which states are equivalent and combining them
	var equivalent = []; // 2d array of booleans indicating if state i and j are equivalent
	for (var i = 0; i < DFA.states; i++) {
		equivalent[i] = [];
		for (var j = i; j < DFA.states; j++) {
			// Start by marking states equivalent if they are both accepting or non-accepting
			if ((DFA.accepting.has(i) && DFA.accepting.has(j)) || (!DFA.accepting.has(i) && !DFA.accepting.has(j)))
				equivalent[i][j] = true;
			else
				equivalent[i][j] = false;
		}
	}
	while (true) { // Continue marking rounds until we have a round where nothing is marked
		var marked = false; // Have we marked something this round?
		for (var i = 0; i < DFA.states; i++) {
			for (var j = i+1; j < DFA.states; j++) {
				if (equivalent[i][j]) {
					DFA.alphabet.forEach(function(symbol) {
						if (!equivalent[i][j])
							return;
						var a = DFA.edges[i][symbol].values().next().value;
						var b = DFA.edges[j][symbol].values().next().value;
						if (!equivalent[Math.min(a,b)][Math.max(a,b)]) {
							equivalent[i][j] = false;
							marked = true;
						}
					})
				}
			}
		}
		if (!marked) // Nothing marked this round, stop
			break;
	}

	var DFAm = {
		alphabet: new Set(DFA.alphabet),         // Set containing letters used in expression
		states: 0,                      				 // Amount of states
		edges: [],                               // List of map of outgoing edges for each state
		outgoing: [],      											 // Amount of outgoing edges for each state
		incoming: [],														 // Amount of incoming edges for each state
		accepting: new Set(),         					 // Set of accepting states
		statescor: []
	}

	var taken = [];
	for (var i = 0; i < DFA.states; i++) {
		if (taken.includes(i)) // State already got assigned to a new state
			continue;
		if (DFA.accepting.has(i)) // New state is accepting iff old states were accepting
			DFAm.accepting.add(DFAm.states);
		DFAm.statescor[DFAm.states] = [];
		for (var j = i; j < DFA.states; j++) {
			if (equivalent[i][j]) {
				DFAm.statescor[DFAm.states].push(j);
				taken.push(j);
			}
		}
		if (DFAm.statescor[DFAm.states].includes(DFA.start))
			DFAm.start = DFAm.states; // New starting state corresponds to old starting state
		DFAm.states++;
	}

	for (var i = 0; i < DFAm.states; i++) { // Add the new transitions
		DFAm.alphabet.forEach(function(symbol) {
			var toOld = DFA.edges[DFAm.statescor[i][0]][symbol].values().next().value;
			var toNew;
			for (var j = 0; j < DFAm.states; j++) {
				if (DFAm.statescor[j].includes(toOld)) {
					toNew = j;
					break;
				}
			}
			addTransition(DFAm, i, toNew, symbol);
		})
	}
	return DFAm;
}


/*
	General functions
*/
function generateAutomata(regex) {
	instance = {}
	instance.NFAl = trivialStates(constructNFAl(parseRegex(regex_global)));
	instance.NFATransition = removelTransitions(deepCopyAutomaton(instance.NFAl));
	instance.NFA = removeUnreachable(deepCopyAutomaton(instance.NFATransition), instance.NFATransition);
	instance.DFA = subsetConstruction(instance.NFA);
	instance.DFAm = minimizeDFA(instance.DFA);
	instance.FAobj = [];
	instance.FAstrings = [];
}

function addTransition(FA, from, to, symbol) {
	if (FA.edges[from] == undefined)
		FA.edges[from] = {};
	if (FA.edges[from][symbol] == undefined)
		FA.edges[from][symbol] = new Set([to]);
	else {
		if (FA.edges[from][symbol].has(to))
			return false; // Transition already exists
		FA.edges[from][symbol].add(to);
	}
	if (FA.outgoing[from] == undefined)
		FA.outgoing[from] = 1;
	else
		FA.outgoing[from]++;
	if (FA.incoming[to] == undefined)
		FA.incoming[to] = 1;
	else
		FA.incoming[to]++;
	return true;
}

function removeTransition(FA, from, to, symbol) {
	if (FA.edges[from][symbol].has(to)) {
		FA.outgoing[from]--;
		FA.incoming[to]--;
		FA.edges[from][symbol].delete(to);
	}
}

function removeState(FA, state) { // Remove a state, corresponding edges, and lower state numbers
	if (FA.edges[state] != undefined) {
		for (var symbol in FA.edges[state]) {
			FA.edges[state][symbol].forEach(function(val) {
				removeTransition(FA, state, val, symbol);
			})
		}
	}

	// Update edges array number now that a state has been deleted
	for (var i = 0; i < FA.states; i++) {
		if (FA.edges[i] == undefined)
			continue;
		for (var symbol in FA.edges[i]) {
			FA.edges[i][symbol].forEach(function(val) {
				if (val == state)
					removeTransition(FA, i, state, symbol);
			})
		}
		for (var symbol in FA.edges[i]) {
			var newSet = new Set([]);
			FA.edges[i][symbol].forEach(function(value) {
				if (value >= state)
					newSet.add(value-1);
				else
					newSet.add(value);
			});
			FA.edges[i][symbol] = newSet;
		}
	}
	if (FA.start >= state)
		FA.start--;
	var newaccepting = new Set([]);
	var it = FA.accepting.values();
	for (var val = it.next().value; val !== undefined; val = it.next().value) {
		if (val >= state)
			newaccepting.add(val-1);
		else
			newaccepting.add(val);
	}
	FA.accepting = newaccepting;
	for (var i = state; i < FA.states; i++) {
		FA.edges[i] = FA.edges[i+1];
		FA.outgoing[i] = FA.outgoing[i+1];
		FA.incoming[i] = FA.incoming[i+1];
	}
	FA.states--;
}

function deepCopyAutomaton(FA) {
	var copy = {
		alphabet: new Set(FA.alphabet),         // Set containing letters used in expression
		states: FA.states,                      // Amount of states
		start: FA.start,                        // Index of starting state
		edges: [],                              // List of map of outgoing edges for each state
		outgoing: Array.from(FA.outgoing),      // Amount of outgoing edges for each state
		incoming: Array.from(FA.incoming),      // Amount of incoming edges for each state
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

function SetHasArray(set, array) { // Check if set contains a certain array
	var found = false;
	set.forEach(function(val) {
		if (!found) {
			for (var i = 0; i < array.length; i++) {
				if (array[i] != val[i])
					return;
			}
			found = true;
	}
	})
	return found;
}

function ArrayHasArray(array, sub) { // Check if array contains a certain subarray
	for (var i = 0; i < array.length; i++) {
		if (ArrayEquals(array[i], sub)) {
			return i;
		}
	}
	return -1;
}

function ArrayEquals(arr1, arr2) { // Check if two arrays are the same
	if (arr1.length != arr2.length)
		return false;
	for (var i = 0; i < arr1.length; i++)
		if (arr1[i] != arr2[i])
			return false;
	return true;
}
