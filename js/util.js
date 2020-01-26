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