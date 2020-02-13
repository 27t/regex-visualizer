"use strict";
var auto_animation = true;
var in_animation = false; // If an animation is currently active
var startscreen = true; // If the home screen is shown
var regex_global = "";
var instance;
var viz = new Viz({ workerURL: "js/full.render.js" }); // Load viz renderer
var scale, scaledir;

$(document).ready(function(){
	var test = browserTest(); // Check if some neccessary features are available in the users browser
	if (!test) {
		return; // Stop program, features not supported
	}
	loadSvgInteraction(); // Load panning and zooming events
	$("#regex").on("input", onRegexChange);
	$("#convert").click(onConvertRegex);
	$(".step").click(clickStepButton);
	
	$("#options_check").change(function() {
		auto_animation = this.checked;
		if (auto_animation) {
			$("#options_button").attr("disabled", true);
			$("#options_button").trigger("click"); // Auto animation is now on, trigger one
		}																				 // last click to clear the current animation queue
		else
			$("#options_button").attr("disabled", false);
	});

	$("#regex").trigger("input"); // If the input has been autofilled, check if the expression is correct at the start
});

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
	if ($(this).val() == "" || $(this).val() == undefined) {
		$("#convert").attr("disabled", true);
		$(this).removeClass("valid").removeClass("invalid");
		$(".greenPath").removeClass("enabled");
		$(".redPath").removeClass("enabled");
	}
	else if (parsed === -1) {
		$("#convert").attr("disabled", true);
		$(this).removeClass("valid").addClass("invalid");
		$(".greenPath").removeClass("enabled");
		$(".redPath").addClass("enabled");
	}
	else {
		$("#convert").attr("disabled", false);
		$(this).removeClass("invalid").addClass("valid");
		$(".greenPath").addClass("enabled");
		$(".redPath").removeClass("enabled");
	}
}

function onConvertRegex() {
	var parsed = parseRegex($("#regex").val());
	if (parsed === -1) // Invalid expression
		return;

	in_animation = true;
	$(".step").css("display", "none");
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
 	instance.FAstrings[0] = viz.renderSVGElement(toDotString(instance.NFAl, 0));
	if (instance.NFATransition.ledges.size == 0) {
		instance.FAstrings[1] = instance.FAstrings[0];
		instance.FAstrings[2] = instance.FAstrings[0];
	}
	else {
		instance.FAstrings[1] = viz.renderSVGElement(toDotString(instance.NFATransition, 1));
		instance.FAstrings[2] = viz.renderSVGElement(toDotString(instance.NFA, 0));
	}
	instance.FAstrings[3] = viz.renderSVGElement(toDotString(instance.DFA, 0));
	if (instance.DFA.states == instance.DFAm.states) // DFA was already minimal
		instance.FAstrings[4] = instance.FAstrings[3]
	else // DFA was not yet minimal. Create new svg for minimal DFA
		instance.FAstrings[4] = viz.renderSVGElement(toDotString(instance.DFAm, 0));
	$.when(p1).then(function() {
		return showFAWrap(0);
	}).then(function() {
		showStepButtons(1);
	})
	/*$.when(instance.FAstrings[0],p1).then(function(element) { // Element contains the svg element
			instance.FAobj[0] = FAToHTML(instance.NFAl, element);
			makeInvisible(instance.FAobj[0]);
			$("#FA").html(instance.FAobj[0].svg);
			updateScale();
			animationWrap(showFA, [instance.FAobj[0]], 0).then(function() {
				showStepButtons(1);
			});
	})*/
}

/*
	Wrapper functions for the main animations:
	- Show NFAl, NFA, DFA or DFAm
	- Convert NFAl to NFA to DFA to DFAm
*/

function showFAWrap(type) { // type=0: NFAl, 2: NFA, 3: DFA, 4: DFAm
	in_animation = true;
	return $.when(instance.FAstrings[type]).then(function(element) { // Element contains the svg element
		var FA = type == 0 ? instance.NFAl
					 : type == 2 ? instance.NFA
					 : type == 3 ? instance.DFA
					 : instance.DFAm;
		instance.FAobj[type] = FAToHTML(FA, element);
		makeInvisible(instance.FAobj[type]);
		$("#FA").html(instance.FAobj[type].svg);
		updateScale();
		return animationWrap(showFA, [instance.FAobj[type]], type);
	})
}

function toNFA() {
	in_animation = true;
	return $.when(instance.FAstrings[1], instance.FAstrings[2]).then(function(element1, element2) { // Check if needed svg's have been rendered
		if (instance.NFATransition.ledges.size != 0) {
			instance.FAobj[1] = FAToHTML(instance.NFATransition, element1, 1);
			hideNewEdges(instance.FAobj[1]);
		}
		else {
			instance.FAobj[1] = undefined;
		}
		instance.FAobj[2] = FAToHTML(instance.NFA, element2);
		return animationWrap(animToNFAStart, [instance.FAobj], 2);
	});
}

function toDFA() {
	in_animation = true;
	return $.when(instance.FAstrings[3]).then(function(element) { // Check if needed svg has been rendered
		instance.FAobj[3] = FAToHTML(instance.DFA, element);
		makeInvisible(instance.FAobj[3]);
		return animationWrap(animToDFAStart, [instance], 3);
	})
}

function toDFAm() {
	in_animation = true;
	return $.when(instance.FAstrings[4]).then(function(element) { // Check if needed svg has been rendered
		instance.FAobj[4] = FAToHTML(instance.DFAm, element);
		return animationWrap(animToDFAmStart, [instance], 4);
	})
}

function updateScale() {
	if ($("#FA svg")[0].viewBox.baseVal.width * $("#FA svg").height() < $("#FA svg")[0].viewBox.baseVal.height * $("#FA svg").width()) {
		scale = $("#FA svg")[0].viewBox.baseVal.height / $("#FA svg").height();
		scaledir = 0;
	}
	else {
		scale = $("#FA svg")[0].viewBox.baseVal.width / $("#FA svg").width();
		scaledir = 1;
	}
}

function loadSvgInteraction() {
	var holdingNode = false;
	var panning = false;
	var holdingIndex; // Value of the state currently being held
	var oldX, oldY;
	var nodeSelected = true;
	var savedThis, savedNext;

	$(document).mouseup(function() {
		holdingNode = false;
		panning = false;
	})

	$(document).on("mousedown", "#FA svg", function(e) {
		panning = true;
		oldX = e.clientX;
		oldY = e.clientY;
	})

	$(document).on("mousemove", "#FA svg", function(e) {
		if (panning) {
			this.viewBox.baseVal.x -= (e.clientX-oldX)*scale
			this.viewBox.baseVal.y -= (e.clientY-oldY)*scale;
			oldX = e.clientX;
			oldY = e.clientY;
		}
	})

	$("#FA").on("wheel mousewheel", "svg", function(e) {
		e.preventDefault(); // Don't also scroll the window
		var delta;
		if (e.originalEvent.wheelDelta !== undefined)
    	delta = e.originalEvent.wheelDelta;
    else
    	delta = e.originalEvent.deltaY * -1;
		var mat = this.getScreenCTM().inverse();
		var mouseX = e.clientX*mat.a+e.clientY*mat.c+mat.e;
		var mouseY = e.clientX*mat.b+e.clientY*mat.d+mat.f;
		var zoomscale;
		if (scaledir) {
			if (delta > 0 && this.viewBox.baseVal.width > 50)
				zoomscale = (this.viewBox.baseVal.width-50)/this.viewBox.baseVal.width;
			else if (delta < 0)
				zoomscale = (this.viewBox.baseVal.width+50)/this.viewBox.baseVal.width;
			else
				return;
		}
		else {
			if (delta > 0 && this.viewBox.baseVal.height > 50)
				zoomscale = (this.viewBox.baseVal.height-50)/this.viewBox.baseVal.height;
			else if (delta < 0)
				zoomscale = (this.viewBox.baseVal.height+50)/this.viewBox.baseVal.height;
			else
				return;
		}
		this.viewBox.baseVal.width *= zoomscale;
		this.viewBox.baseVal.height *= zoomscale;
		this.viewBox.baseVal.x = mouseX - (mouseX-this.viewBox.baseVal.x)*zoomscale;
		this.viewBox.baseVal.y = mouseY - (mouseY-this.viewBox.baseVal.y)*zoomscale;
		updateScale();
	})

	$(document).on("mouseenter", ".node", function(e) {
		if (!nodeSelected && !in_animation) {
			nodeSelected = true;
			savedThis = this;
			$(this).parent().prepend($(this).parent().children().filter(".edge")); // Move edges to background
			$(".info_path", savedThis).addClass("info_selected")
			$("ellipse", savedThis).eq(0).addClass("selected_big");
			if ($("ellipse", savedThis).length == 2) // Accepting state, 2 ellipses
				$("ellipse", savedThis).eq(1).addClass("selected_small");
		}
	})

	$(document).on("mouseleave", ".node", function(e) {
		if (nodeSelected) {
			nodeSelected = false;
			$(".info_path", savedThis).removeClass("info_selected")
			$("ellipse", savedThis).eq(0).removeClass("selected_big");
			if ($("ellipse", savedThis).length == 2) // Accepting state, 2 ellipses
				$("ellipse", savedThis).eq(1).removeClass("selected_small");
			$(savedThis).delay(1500).promise().then(function() {
				// If no state selected after transition is done (1.5s), move edges to foreground again
				if (!nodeSelected)
					$(this).parent().append($(this).parent().children().filter(".edge"));
			})
		}
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


function makeInvisible(FAobj) { // Make all nodes, edges, text hidden
	$("ellipse", FAobj.svg).attr("visibility", "hidden");
	$("text", FAobj.svg).css({"opacity": 0});

	var edges = $(".edge", FAobj.svg);
	for (var i = 0; i < edges.length; i++) {
		var path = $("path", edges[i]);
		path.css('stroke-dashoffset', path[0].lengthsaved);
		$("polygon", edges[i]).attr("visibility", "hidden");
	}
	/*for (var i = 0; i < FAobj.edges.length; i++) {
		for (var symbol in FAobj.edges[i]) {
			FAobj.edges[i][symbol].forEach(function(val) {
				var path = $("path", val[1]);
				path.css({'stroke-dasharray': path[0].getTotalLength(), 'stroke-dashoffset': path[0].getTotalLength()});
				$("polygon", val[1]).attr("visibility", "hidden");
			});
		}
	}
	var start = $("path", FAobj.start[0]);
	start.css({'stroke-dasharray': start[0].getTotalLength(), 'stroke-dashoffset': start[0].getTotalLength()});
	$("polygon", FAobj.start).attr("visibility", "hidden");*/
}

function hideNewEdges(FAobj) {
	for (var from in FAobj.newedges) {
		for (var to in FAobj.newedges[from]) {
			var edge = FAobj.edges[from][to][1];
			if (FAobj.edges[from][to][0].length == 0) {
				var path = $("path", edge);
				path.css('stroke-dashoffset', path[0].lengthsaved);
				$("polygon", edge).attr("visibility", "hidden");
				$("text", edge).css("opacity", 0);
			}
			else {
				$("text", edge).text(FAobj.edges[from][to][0].join(","));
			}
		}
	}
}

/*function replaceLNewEdges(FAobj) {
	for (var from in FAobj.edges) {
		for (var to in FAobj.edges[from]) {
			var index = FAobj.edges[from][to][0].indexOf("0");
			if (index != -1)
				FAobj.edges[from][to][0].splice(index, 1);
			FAobj.edges[from][to][0] = FAobj.edges[from][to][0].concat(FAobj.newedges[from][to]);
		}
	}
}*/

function toDotString(FA, flag) { // Generate a dotstring for a FA
	// flag is 1 if this is for the combination of NFAl and NFAl
	var dotstring = "digraph automaton {\n"
	dotstring += "rankdir=LR\n"
	dotstring += "qi [shape=point, style=invis]; qi\n"
	for (var i = 0; i < FA.states; i++) {
		dotstring += "node [shape=circle] " + i + ";\n";
	}
	dotstring += "qi -> " + FA.start + "[style=bold];\n";
	if (!flag) {
		for (var i = 0; i < FA.edges.length; i++) {
			if (FA.edges[i] != undefined) {
				var todict = {};
				for (var symbol in FA.edges[i]) {
					FA.edges[i][symbol].forEach(function(val) {
						if (todict[val] == undefined)
							todict[val] = [];
						todict[val].push(symbol)
					});
					/*FA.edges[i][symbol].forEach(function(val) {
						dotstring += i + " -> " + val + " [label = \"" + symbol + "\"];\n";
					});*/
				}
				for (var key in todict) {
					dotstring += i + " -> " + key + " [label = \"" + todict[key].join(",") + "\"];\n";
				}
			}
		}
	}
	else {
		var todict = {};
		var builddict = function(arr) {
			if (todict[arr[0]] == undefined)
				todict[arr[0]] = {};
			if (todict[arr[0]][arr[1]] == undefined)
				todict[arr[0]][arr[1]] = [];
			todict[arr[0]][arr[1]].push(arr[2]);
		}
		FA.normaledges.forEach(function(arr) {
			builddict(arr);
			//dotstring += arr[0] + " -> " + arr[1] + " [label = \"" + arr[2] + "\"];\n";
		})
		FA.newedges.forEach(function(arr) {
			builddict(arr);
			//dotstring += arr[0] + " -> " + arr[1] + " [label = \"" + arr[2] + "\"];\n";
		})
		FA.ledges.forEach(function(arr) {
			builddict(arr);
			//dotstring += arr[0] + " -> " + arr[1] + " [label = \"" + arr[2] + "\"];\n";
		})
		for (var from in todict)
			for (var to in todict[from])
				dotstring += from + " -> " + to + " [label = \"" + todict[from][to].join(",") + "\"];\n";
	}
	dotstring += "}";
	return dotstring;
}

function FAToHTML(FA, HTML, flag) { // From a FA and HTML (svg) code return an object containing reference to the state and edge elements
	var retObj = { // Object to be returned
		edges: [],
		states: []
	}
	for (var i = 0; i < FA.states; i++)
		retObj.edges[i] = {};

	// Create a new svg element and paste the svg content in it, because the svg
	// element created by viz didn't work properly with animations in some browsers
	var realsvg = document.createElementNS('http://www.w3.org/2000/svg', "svg");
	realsvg.setAttribute("width", HTML.attributes.width.value);
	realsvg.setAttribute("height", HTML.attributes.height.value);
	realsvg.setAttribute("viewBox", HTML.attributes.viewBox.value);
	realsvg.setAttribute("xmlns", HTML.attributes.xmlns.value);
	realsvg.setAttribute("xmlns:xlink", HTML.attributes["xmlns:xlink"].value);
	$(realsvg).append($(HTML.cloneNode(true)).children()[0]);

	var elements = $(realsvg);
	retObj.svg = elements;
	retObj.start = [$("#edge1", elements), FA.start];

	for (var i = 0; i < FA.states; i++) {
		retObj.states[i] = $("#node" + (i+2), elements); // State 0 has id #node2 etc..
		if (FA.accepting.has(i)) { // Add inner circle to accepting states
			var circle = document.createElementNS('http://www.w3.org/2000/svg', "ellipse");
			circle.setAttribute("stroke", "#000000");
			circle.setAttribute("cx", $("ellipse", retObj.states[i]).attr("cx"));
			circle.setAttribute("cy", $("ellipse", retObj.states[i]).attr("cy"));
			circle.setAttribute("rx", $("ellipse", retObj.states[i]).attr("rx")-3);
			circle.setAttribute("ry", $("ellipse", retObj.states[i]).attr("ry")-3);
			$("ellipse", retObj.states[i]).after(circle);
		}
		if (!flag) { // Add hover info box to states
			var cx = $("ellipse", retObj.states[i]).attr("cx");
			var cy = $("ellipse", retObj.states[i]).attr("cy");
			var path = document.createElementNS('http://www.w3.org/2000/svg', "path");
			path.setAttribute("stroke", "#000000");
			path.setAttribute("fill", "#eeeeee");
			path.setAttribute("fill-opacity", "0");
			path.setAttribute("d", "M" + (cx-23) + "," + cy + " l0,-50 70,0 0,27 -47,0 a23 23 0 0 0 -23 23");
			path.setAttribute("class", "info_path");
			retObj.states[i].append(path);
		}
	}

	var edges = $(".edge", elements);
	if (!flag) { // !flag: normal FA
		for (var i = 1; i < edges.length; i++) {
			var title = $("title", edges[i]).text().split("->");
			var from = parseInt(title[0]);
			var to = parseInt(title[1]);
			var symbols = $("text", edges[i]).text().split(",");
			if (retObj.edges[from][to] == undefined)
				retObj.edges[from][to] = [[], $(edges[i])];
			retObj.edges[from][to][0] = retObj.edges[from][to][0].concat(symbols)
		}
	}
	else { // flag: combination of NFAl and NFA
		retObj.newedges = [];
		retObj.newaccepting = [];
		retObj.unreachable = [];
		for (var i = 0; i < FA.states; i++)
			retObj.newedges[i] = {};
		for (var i = 0; i < FA.newaccepting.length; i++) {
			retObj.newaccepting.push([FA.newaccepting[i], retObj.states[FA.newaccepting[i]]]);
			// Temporarily hide the inner circle, to be added back in the toNFA animation
			$($("ellipse", retObj.newaccepting[i][1])[1]).css("opacity", "0");
		}
		for (var i = 0; i < FA.unreachable.length; i++)
			retObj.unreachable.push([FA.unreachable[i], retObj.states[FA.unreachable[i]]]);

		for (var i = 1; i < edges.length; i++) {
			var title = $("title", edges[i]).text().split("->");
			var from = parseInt(title[0]);
			var to = parseInt(title[1]);
			var symbols = $("text", edges[i]).text().split(",");
			retObj.edges[from][to] = [[], $(edges[i])];
			retObj.newedges[from][to] = [];
			for (var index in symbols) {
				if (SetHasArray(FA.newedges, [from,to,symbols[index]]))
					retObj.newedges[from][to].push(symbols[index]);
				else
					retObj.edges[from][to][0].push(symbols[index]);
			}
		}
	}
	for (var i = 0; i < edges.length; i++) { // Set stroke-dasharray for all edges
		$("path", edges[i])[0].lengthsaved = $("path", edges[i])[0].getTotalLength()
		$("path", edges[i]).css("stroke-dasharray", $("path", edges[i])[0].lengthsaved);
	}

	$("title", elements).remove(); // Remove all the title elements (hovering indicator)
	$("ellipse", elements).attr("fill", "#eeeeee");
	elements.children().children("polygon").remove(); // Remove the background fill
	return retObj;
}

function showStepButtons(step) {
	var textl = "", textr= "";
	switch (step) {
		case 1:
			textr = "Remove<br>&lambda;-transitions";
			break;
		case 2:
			textl = "Revert to<br>NFA-&lambda;";
			textr = "Remove non-<br>determinism";
			break;
		case 3:
			textl = "Revert to<br>NFA";
			textr = "Minimize";
			break;
		case 4:
			textl = "Revert to<br>DFA"
	}
	if (step < 4) {
		$("#stepr .steptext").html(textr);
		$("#stepr").attr("step", step);
		$("#stepr").css({"display": "flex", "opacity": 0}).animate({"opacity": 1}, 800);
	}
	if (step > 1) {
		$("#stepl .steptext").html(textl);
		$("#stepl").attr("step", step+4);
		$("#stepl").css({"display": "flex", "opacity": 0}).animate({"opacity": 1}, 800);
	}
}

function clickStepButton() {
	if (in_animation)
		return; // Animation already in progress: stop
	var savedthis = this;
	$(".step").finish().animate({"opacity": 0}, 100).promise().then(function() {
			$(".step").css("display", "none");
			switch (savedthis.getAttribute("step")) {
				case "1":
					toNFA().then(function() { showStepButtons(2); });
					break;
				case "2":
					toDFA().then(function() { showStepButtons(3); });
					break;
				case "3":
					toDFAm().then(function() { showStepButtons(4); });
					break;
				case "6":
					showFAWrap(0).then(function() { showStepButtons(1); });
					break;
				case "7":
					showFAWrap(2).then(function() { showStepButtons(2); });
					break;
				case "8":
					showFAWrap(3).then(function() { showStepButtons(3); });
					break;
			}
	});
}
