function toDotString(automaton) {
	dotstring = "digraph automaton {\n"
	dotstring += "rankdir=LR\n"
	dotstring += "qi [shape=point, style=invis]; qi\n"
	automaton.accepting.forEach(function(val) {
		dotstring += "node [shape = doublecircle]; " + val + " ;\n";
	});
	dotstring += "node [shape=circle];\n";
	dotstring += "qi -> " + automaton.start + "[style=bold];\n";
	for (var i = 0; i < automaton.edges.length; i++) {
		if (automaton.edges[i] != undefined) {
			for (var symbol in automaton.edges[i]) {
				automaton.edges[i][symbol].forEach(function(val) {
					dotstring += i + " -> " + val + " [label = \"" + symbol + "\"];\n";
				});
			}
			//automaton.outgoing[i].forEach(function(pair) {
			//	dotstring += i + " -> " + pair[0] + " [label = \"" + pair[1] + "\"];\n";
			//});
		}
	}
	dotstring += "}";
	return dotstring;
}