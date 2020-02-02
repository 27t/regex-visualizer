"use strict";
var auto_animation = true;
var in_animation = false; // If an animation is currently active
var startscreen = true; // If the home screen is shown
var regex_global = "";
var instance;
var FAobj;
var viz = new Viz({ workerURL: "js/full.render.js" }); // Load viz renderer
var ido = 0;
var scale;

$(document).ready(function(){
	var test = browserTest(); // Check if some neccessary features are available in the users browser
	if (!test) {
		return; // Stop program, features not supported
	}
	loadSvgInteraction(); // Load panning, zooming and moving node events
	$("#regex").on("input", onRegexChange);
	$("#convert").click(onConvertRegex);

	$("#options_check").change(function() {
		auto_animation = this.checked;
		if (auto_animation) {
			$("#options_button").attr("disabled", true);
			$("#options_button").trigger("click"); // Auto animation is now on, trigger one
		}																				 // last click to clear the current animation queue
		else
			$("#options_button").attr("disabled", false);
	});
});

function animationWrap(animationStepFunction, args) {
	var in_animation = true;
	var queue = []; // Queue containing the next animation steps that are ready to go
	queue.notify = function() { // Custom queue function to notify queue when a new element gets added
		if (auto_animation)
			(queue.shift())(); // Execute the first animation in the queue
		else { // Not auto animnation, wait for click
			$("#options_button").one("click", function() { (queue.shift())() });
		}
	}
	args.push(queue);
	animationStepFunction.apply(this, args); // Start animation function
}

function browserTest() {
	try {
		var polygontest = document.createElementNS('http://www.w3.org/2000/svg', "polygon");
		polygontest.setAttribute("points", "1,1 2,2 1,1");
		var point = polygontest.points[0].x;
		if (point == undefined)
			throw "Unsupported SVG operations";
		return true;
	}
	catch(e) {
		var errstring = "The browser you are using does not support some svg features this site relies on. This site is built for desktops, and has been tested on the latest versions of Chrome, Firefox, Safari and Opera";
		alert(errstring);
		$("body").html(errstring);
		return false;
	}
}


function onRegexChange() {
	var parsed = parseRegex($(this).val());
	if (parsed === -1) {
		$("#convert").attr("disabled", true);
		$(this).removeClass("valid").addClass("invalid");
	}
	else {
		$("#convert").attr("disabled", false);
		$(this).removeClass("invalid").addClass("valid");
	}
}

function onConvertRegex() {
	var parsed = parseRegex($("#regex").val());
	if (parsed === -1) // Invalid expression
		return;

	ido++;
	regex_global = $("#regex").val();
	var p1;
	if (startscreen) { // First time making FA, show intro animation
		startscreen = false;
		p1 = introAnimation()
	}
	else { // Not first time making FA, first get rid of old one
		$("#FA svg").addClass('disappear');
		p1 = $("#FA svg").delay(900); // Artificial delay, animation takes 0.9s
		$.when(p1).then(function() {
			$(this).remove();
		})
	}

	generateAutomata();
	var p2 = viz.renderSVGElement(toDotString(instance.NFAl));

	$.when(p2,p1).then(function(element) { // Element contains the svg element
			FAobj = FAToHTML(instance.NFAl, element);
			makeInvisible(FAobj);
			$("#FA").html(FAobj.svg);
			updateScale();
			animationWrap(showFA, [FAobj, instance.NFAl.start]);
	})
}

function introAnimation() {
	$("#regex").animate({
		'font-size': '21px'
	}, 700);
	return $("#header").animate({
		'height': '10%'
	}, 700).promise().then(function() {
		$("#line").css({display: 'block'});
		$("#FA").css({display: 'flex'});
	}).then(function() {
		$("#line").animate({'opacity': '1'}, 200);
		$("#help").animate({'opacity': '1'}, 200);
		$("#options").animate({'opacity': '1'}, 200);
		$("#next_step").animate({'opacity': '1'}, 200);
		return $("#previous_step").animate({'opacity': '1'}, 200).promise();
	});
}

function updateScale() {
	if ($("svg")[0].viewBox.baseVal.width * $("svg").height() < $("svg")[0].viewBox.baseVal.height * $("svg").width())
		scale = $("svg")[0].viewBox.baseVal.height / $(window).height();
	else
		scale = $("svg")[0].viewBox.baseVal.width / $(window).width();
}

function loadSvgInteraction() {
	var holdingNode = false;
	var panning = false;
	var holdingIndex; // Value of the state currently being held
	var oldX, oldY;

	$(document).mouseup(function() {
		holdingNode = false;
		panning = false;
	})

	$(document).on("mousedown", "svg", function(e) {
		panning = true;
		oldX = e.clientX;
		oldY = e.clientY;
	})

	$(document).on("mousemove", "svg", function(e) {
		if (panning) {
			this.viewBox.baseVal.x -= (e.clientX-oldX)*scale
			this.viewBox.baseVal.y -= (e.clientY-oldY)*scale;
			oldX = e.clientX;
			oldY = e.clientY;
		}
	})

	$(document).on("wheel mousewheel", "svg", function(e) {
		var delta;
		if (e.originalEvent.wheelDelta !== undefined)
    	delta = e.originalEvent.wheelDelta;
    else
    	delta = e.originalEvent.deltaY * -1;
		if (delta > 0 && this.viewBox.baseVal.width > 50 && this.viewBox.baseVal.height > 50) {
			this.viewBox.baseVal.width -= 50;
			this.viewBox.baseVal.height -= 50;
		}
		else if (delta < 0) {
			this.viewBox.baseVal.width += 50;
			this.viewBox.baseVal.height += 50;
		}
		console.log(delta);
		updateScale();
	})

	/*
	//	Moving states not finished
	//  Very processor heavy, maybe later
	$(document).on("mousedown", ".node", function(e) {
		e.stopPropagation(); // Stop click from also being interpreted as general svg click
		if (!holdingNode) {
			holdingNode = true;
			holdingIndex = parseInt($("text", this).text());
			oldX = e.clientX;
			oldY = e.clientY;
		}
	})

	$(document).on("mousemove", ".node", function(e) {
		if (holdingNode) {
			var state = FAobj.states[holdingIndex];

			for (var i = 0; i < $("ellipse", state).length; i++) {
				$("ellipse", state)[i].cx.baseVal.value += (e.clientX-oldX)*scale;
				$("ellipse", state)[i].cy.baseVal.value += (e.clientY-oldY)*scale;
			}
			$("text", state)[0].x.baseVal[0].value += (e.clientX-oldX)*scale;
			$("text", state)[0].y.baseVal[0].value += (e.clientY-oldY)*scale;
			for (var symbol in FAobj.edges[holdingIndex])
			FAobj.edges[holdingIndex][symbol].forEach(function(edge) {
				var d = $("path", edge[1]).attr("d");
				var arr = d.split(",");
				arr[1] = arr[1].split("C");
				var x = parseFloat(arr[0].substr(1)) + (e.clientX-oldX)*scale;
				arr[1][0] = parseFloat(arr[1][0]) + (e.clientY-oldY)*scale;
				arr[0] = "M" + x;
				arr[1] = arr[1].join("C");
				d = arr.join(",");
				$("path", edge[1]).attr("d", d);
				console.log(edge[1]);
			})
			oldX = e.clientX;
			oldY = e.clientY;
		}
	})*/
}

/*
	Functions for animating in a FA
*/

function showFA(FAobj, startnode, queue) {
	var timeper = Math.max(Math.min(4000/FAobj.states.length, 500), 250); // Animation time between 250 and 500 ms

	return showEdge(FAobj.start, timeper).then(function() { // Show starting edge
		queue.push(function() { showFAParts(FAobj, [startnode], [], [$("polygon",FAobj.start)[0].points[1]], queue) });
		queue.notify();
	});
}

function showFAParts(FAobj, curstates, visited, entrypoints, queue) {
	if (curstates.length == 0) {
		in_animation = false;
		return;
	}
	var timeper = Math.max(Math.min(4000/FAobj.states.length, 500), 250); // Animation time between 250 and 500 ms
	var nextentrypoints = [];
	var nextstates = [];
	var p1, p2;

	p1 = showStates(FAobj.states, curstates, entrypoints, timeper).then(function() {
			for (var i in curstates) {
				for (var symbol in FAobj.edges[curstates[i]]) {
					FAobj.edges[curstates[i]][symbol].forEach(function(val) {
						p2 = showEdge(val[1], timeper).then(function(edge) {
							$("text", edge).animate({"opacity": 1}, 220);
						});
						if (!curstates.includes(val[0]) && !visited.includes(val[0]) && !nextstates.includes(val[0])) {
							nextstates.push(val[0]);
							nextentrypoints.push($("polygon",val[1])[0].points[1]);
						}
					});
				}
				visited.push(curstates[i]);
			}
			return p2;
	});

	return $.when(p1).then(function() {
		queue.push(function() { showFAParts(FAobj, nextstates, visited, nextentrypoints, queue) });
		queue.notify();
	});
}

function showStates(states, curstates, entrypoints, timeper) {
	var p1;
	for (var i in curstates) {
		p1 = showState(states[curstates[i]], entrypoints[i], timeper).then(function(path) {
			// Remove the animation paths and replace them with the actual circle
			$("ellipse", path.parent()).attr("visibility", "visible");
			$("text", path.parent()).animate({"opacity": 1}, 220);
			$("path", path.parent()).remove();
		});
	}
	return p1;
}

function showState(state, entrypoint, time) {
	var circles = $("ellipse", state);
	var cx = parseFloat(circles.attr("cx"));
	var cy = parseFloat(circles.attr("cy"));
	var distance = Math.sqrt(Math.pow(cx-entrypoint.x,2)+Math.pow(cy-entrypoint.y,2));
	var startx, starty, endx, endy;
	var p1;
	for (var i = 0; i < circles.length; i++) {
		var r = circles[i].rx.baseVal.value;
		// Arrows slightly stick out into the states, calculate actual entrypoint and endpoint
		startx = cx-(cx-entrypoint.x)*r/distance;
		starty = cy-(cy-entrypoint.y)*r/distance;
		endx = 2*cx-startx;
		endy = 2*cy-starty;

		var curve1 = document.createElementNS('http://www.w3.org/2000/svg', "path");
		var curve2 = document.createElementNS('http://www.w3.org/2000/svg', "path");
		curve1.setAttribute("fill", "none");
		curve2.setAttribute("fill", "none");
		curve1.setAttribute("stroke", "#000000");
		curve2.setAttribute("stroke", "#000000");
		curve1.setAttribute("d", "M" + startx + "," + starty + " A" + r + " " + r + " 0 0 0 " + endx + " " + endy);
		curve2.setAttribute("d", "M" + startx + "," + starty + " A" + r + " " + r + " 0 1 1 " + endx + " " + endy);

		$(curve1).css({'stroke-dasharray': curve1.getTotalLength(), 'stroke-dashoffset': curve1.getTotalLength()});
		$(curve2).css({'stroke-dasharray': curve2.getTotalLength(), 'stroke-dashoffset': curve2.getTotalLength()});
		state[0].appendChild(curve1);
		state[0].appendChild(curve2);
		$(curve1).animate({'stroke-dashoffset': 0}, time);
		p1 = $(curve2).animate({'stroke-dashoffset': 0}, time).promise();
	}
	return p1;
}

function showEdge(edge, time) {
	var path = $("path", edge);
	var pol = $("polygon", edge);
	var length = path[0].getTotalLength();
	return path.animate({'stroke-dashoffset': 0}, length/(length+10)*time).promise().then(function() {
		var points = pol[0].points;
		var anim = document.createElementNS('http://www.w3.org/2000/svg', "animate");
		var attrs = {attributeName: "points", attributeType: "XML", begin: "indefinite", dur: (10/(length+10)*time)+"ms", fill: "freeze",
					 from: points[0].x+" "+points[0].y+" "+((points[0].x + points[2].x)/2)+" "+((points[0].y + points[2].y)/2)+" "+points[2].x+" "+points[2].y+" "+points[3].x+" "+points[3].y,
					 to: points[0].x+" "+points[0].y+" "+points[1].x+" "+points[1].y+" "+points[2].x+" "+points[2].y+" "+points[3].x+" "+points[3].y};
		pol.attr("points", attrs.from);
		for (var k in attrs)
			anim.setAttribute(k, attrs[k]);
		pol.attr("visibility", "visible");
		pol[0].appendChild(anim);
		$("animate", pol)[0].beginElement();
		return edge.delay(10/(length+10)*time).promise(); // Artifical delay, same time as animation time
	})
}

function makeInvisible(FAobj) { // Make all nodes, edges, text hidden
	$("ellipse", FAobj.svg).attr("visibility", "hidden");
	$("ellipse", FAobj.svg).attr("fill", "#eeeeee");
	$("text", FAobj.svg).css({"opacity": 0});

	for (var i = 0; i < FAobj.edges.length; i++) {
		for (var symbol in FAobj.edges[i]) {
			FAobj.edges[i][symbol].forEach(function(val) {
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

function toDotString(FA) { // Generate a dotstring for a FA
	var dotstring = "digraph automaton {\n"
	dotstring += "rankdir=LR\n"
	dotstring += "qi [shape=point, style=invis]; qi\n"
	for (var i = 0; i < FA.states; i++) {
		dotstring += "node [shape=circle] " + i + ";\n";
		//if (!FA.accepting.has(i))
		//	dotstring += "node [shape=circle] " + i + ";\n";
		//else
		//	dotstring += "node [shape = doublecircle]; " + i + " ;\n";
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

function FAToHTML(FA, HTML) { // Convert a FA to HTML (svg) code and return an object containing reference to the state and edge elements
	var _edges = [];
	var _states = [];
	for (var i = 0; i < FA.states; i++)
		_edges[i] = {};

	var realsvg = document.createElementNS('http://www.w3.org/2000/svg', "svg");
	realsvg.setAttribute("width", HTML.attributes.width.value);
	realsvg.setAttribute("height", HTML.attributes.height.value);
	realsvg.setAttribute("viewBox", HTML.attributes.viewBox.value);
	realsvg.setAttribute("xmlns", HTML.attributes.xmlns.value);
	realsvg.setAttribute("xmlns:xlink", HTML.attributes["xmlns:xlink"].value);
	$(realsvg).append($(HTML).children()[0]);

	var elements = $(realsvg);
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
		if (FA.accepting.has(i)) { // Add inner circle to accepting states
			var circle = document.createElementNS('http://www.w3.org/2000/svg', "ellipse");
			circle.setAttribute("stroke", "#000000");
			circle.setAttribute("cx", $("ellipse", _states[i]).attr("cx"));
			circle.setAttribute("cy", $("ellipse", _states[i]).attr("cy"));
			circle.setAttribute("rx", $("ellipse", _states[i]).attr("rx")-3);
			circle.setAttribute("ry", $("ellipse", _states[i]).attr("ry")-3);
			$("ellipse", _states[i]).after(circle);
		}
	}
	$("title", elements).remove(); // Remove all the title elements (hovering indicator)
	return {
		svg: elements,
		edges: _edges,
		states: _states,
		start: $("#edge1", elements)
	}
}
