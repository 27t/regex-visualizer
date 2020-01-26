function FAToHTML(FA) { // Convert a FA to HTML (svg) code and return an object also containing reference to the state and edge elements
	var _edges = [];
	var _states = [];
	for (var i = 0; i < FA.states; i++)
		_edges[i] = {};

	var HTML = Viz(toDotString(FA), "svg");
	var elements = $(HTML);
	var n = 2;
	for (var i = 0; i < FA.edges.length; i++) {
		if (FA.edges[i] != undefined) {
			for (var symbol in FA.edges[i]) {
				FA.edges[i][symbol].forEach(function(val) {
					if (_edges[i][symbol] == undefined)
						_edges[i][symbol] = new Set();
					_edges[i][symbol].add([val, $("#edge" + n, elements)]);
					n++;
				});
			}
		}
	}
	for (var i = 0; i < FA.states; i++) {
		_states[i] = $("#node" + (i+2), elements);
	}
	return {
		svg: elements,
		edges: _edges,
		states: _states,
		start: $("#edge1", elements)
	}
}

function toDotString(FA) { // Generate a dotstring for a FA
	dotstring = "digraph automaton {\n"
	dotstring += "rankdir=LR\n"
	dotstring += "qi [shape=point, style=invis]; qi\n"
	for (var i = 0; i < FA.states; i++) {
		if (!FA.accepting.has(i))
			dotstring += "node [shape=circle] " + i + ";\n";
		else
			dotstring += "node [shape = doublecircle]; " + i + " ;\n";
	}
	dotstring += "qi -> " + FA.start + "[style=bold];\n";
	for (var i = 0; i < FA.edges.length; i++) {
		if (FA.edges[i] != undefined) {
			for (var symbol in FA.edges[i]) {
				FA.edges[i][symbol].forEach(function(val) {
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

function makeInvisible(FAobj) { // Make all nodes, edges, text hidden
	for (var i in FAobj.states) {
		$("ellipse", FAobj.states[i]).attr("visibility", "hidden");
		$("text", FAobj.states[i]).attr("visibility", "hidden");
	}
	for (var i = 0; i < FAobj.edges.length; i++) {
		for (var symbol in FAobj.edges[i]) {
			FAobj.edges[i][symbol].forEach(function(val) {
				$("text", val[1]).attr("visibility", "hidden");
				var path = $("path", val[1]);
				path.css({'stroke-dasharray': path[0].getTotalLength(), 'stroke-dashoffset': path[0].getTotalLength()});
				$("polygon", val[1]).attr("visibility", "hidden");
			});
		}
	}
	var start = $("path", FAobj.start);
	start.css({'stroke-dasharray': start[0].getTotalLength(), 'stroke-dashoffset': start[0].getTotalLength()});
	$("polygon", FAobj.start).attr("visibility", "hidden");
}
