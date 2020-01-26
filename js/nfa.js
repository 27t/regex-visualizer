function removelTransitions(NFAl, ledges, newedges) { // Remove lambda transitions from a NFAl to turn it into a NFA
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