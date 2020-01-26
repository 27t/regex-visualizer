// Recursive function for constructing NFAl
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

// Merge edges and incoming and outgoing arrays of two FA's
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

// Remove trivial states (states that have only 1 outgoing or 1 incoming lambda-edge)
function trivialStates(NFAl) {
	var amt = 0;
	for (var i = NFAl.states-1; i >= 0; i--) {
		//$("#err").after("<br><br>NU"+Viz(toDotString(NFAl), "svg"));
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
				/*for (var index in NFAl.edges[j]["0"]) {
					if (NFAl.edges[j]["0"][index] == i) {
						removeTrivialState(NFAl, i, j, true);
						//if (amt==2) return NFAl;
						//amt++;
						removed = true;
						break;
					}
				}*/
			}
		}
	}
	return NFAl;
}

function removeTrivialState(NFAl, state, tofr, tag) {
	if (NFAl.accepting.has(state) || NFAl.start == state)
		return;
	//if (NFAl.start == state)
	//	NFAl.start = tofr;
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
	
	for (var i = 0; i < NFAl.states; i++) {
		for (var symbol in NFAl.edges[i]) {
			newSet = new Set([]);
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
	
	newAccepting = new Set([]);
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