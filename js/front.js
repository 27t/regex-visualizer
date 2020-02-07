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
	$(".step1r").click(toNFA);
	//$(".step2r").click(toDFA);
	//$(".step3r").click(toDFAm);
	//$(".step2l").click(revertNFAl);
	//$(".step3l").click(revertNFA);
	//$(".step4l").click(revertDFA);

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
	$.when(instance.FAstrings[0],p1).then(function(element) { // Element contains the svg element
			instance.FAobj[0] = FAToHTML(instance.NFAl, element);
			makeInvisible(instance.FAobj[0]);
			$("#FA").html(instance.FAobj[0].svg);
			updateScale();
			animationWrap(showFA, [instance.FAobj[0]], 0).then(function() {
				$(".step1r").css({"display": "flex", "opacity": 0}).animate({"opacity": 1}, 800);
			});
	})
}

/*
	Convert NFAl to NFA by removing l-transitions
	(and updating accepting states and removing unreachable states)
*/
function toNFA() {
	$(".step1r").animate({"opacity": 0}, 200).promise().then(function() {
		$(".step1r").css("display", "none");
	});
	$.when(instance.FAstrings[1], instance.FAstrings[2]).then(function(element1, element2) { // Check if needed svg's have been rendered
		if (instance.NFATransition.ledges.size != 0) {
			instance.FAobj[1] = FAToHTML(instance.NFATransition, element1, 1);
			hideNewEdges(instance.FAobj[1]);
		}
		else {
			instance.FAobj[1] = undefined;
		}
		instance.FAobj[2] = FAToHTML(instance.NFA, element2);
		animationWrap(animToNFAStart, [instance.FAobj], 2).then(function() {
		});
	});
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

	$(document).on("wheel mousewheel", "#FA svg", function(e) {
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
	for (var i = 0; i < FAobj.newedges.length; i++) {
		for (var symbol in FAobj.newedges[i]) {
			FAobj.newedges[i][symbol].forEach(function(val) {
				var path = $("path", val[1]);
				path.css('stroke-dashoffset', path[0].lengthsaved);
				$("polygon", val[1]).attr("visibility", "hidden");
				$("text", val[1]).css("opacity", 0);
			});
		}
	}
}

function replaceLNewEdges(FAobj) {
	for (var i = 0; i < FAobj.edges.length; i++) {
		if (FAobj.edges[i]["0"] != undefined)
			delete FAobj.edges[i]["0"];
		for (var symbol in FAobj.newedges[i]) {
			FAobj.newedges[i][symbol].forEach(function(val) {
				if (FAobj.edges[i][symbol] == undefined)
					FAobj.edges[i][symbol] = new Set();
				FAobj.edges[i][symbol].add(val);
			})
		}
	}
}

function toDotString(FA, flag) { // Generate a dotstring for a FA
	// flag is 1 if this is for the combination of NFAl and NFAl
	// in this case 3 types of edges in known order
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
				for (var symbol in FA.edges[i]) {
					FA.edges[i][symbol].forEach(function(val) {
						dotstring += i + " -> " + val + " [label = \"" + symbol + "\"];\n";
					});
				}
			}
		}
	}
	else {
		FA.normaledges.forEach(function(arr) {
			dotstring += arr[0] + " -> " + arr[1] + " [label = \"" + arr[2] + "\"];\n";
		})
		FA.newedges.forEach(function(arr) {
			dotstring += arr[0] + " -> " + arr[1] + " [label = \"" + arr[2] + "\"];\n";
		})
		FA.ledges.forEach(function(arr) {
			dotstring += arr[0] + " -> " + arr[1] + " [label = \"" + arr[2] + "\"];\n";
		})
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
	}

	var edges = $(".edge", elements);
	if (!flag) { // !flag: normal FA
		for (var i = 1; i < edges.length; i++) {
			var title = $("title", edges[i]).text().split("->");
			var from = parseInt(title[0]);
			var symbol = $("text", edges[i]).text();
			if (retObj.edges[from][symbol] == undefined)
				retObj.edges[from][symbol] = new Set();
			retObj.edges[from][symbol].add([parseInt(title[1]), $(edges[i])])
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
			var symbol = $("text", edges[i]).text();
			if (hasArray(FA.newedges, [from,to,symbol])) {
				if (retObj.newedges[from][symbol] == undefined)
					retObj.newedges[from][symbol] = new Set();
				retObj.newedges[from][symbol].add([to, $(edges[i])])
			}
			else {
				if (retObj.edges[from][symbol] == undefined)
					retObj.edges[from][symbol] = new Set();
				retObj.edges[from][symbol].add([to, $(edges[i])])
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
