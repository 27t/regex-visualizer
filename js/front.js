"use strict";
var auto_animation = true;
var in_animation = false; // If an animation is currently active
var startscreen = true; // If the home screen is shown
var regex_global = "";
var instance;
var viz = new Viz({ workerURL: "js/full.render.js" }); // Load viz renderer

$(document).ready(function(){
	var test = browserTest(); // Check if some neccessary features are available in the users browser
	if (!test) {
		return; // Stop program, features not supported
	}
	loadSvgInteraction(); // Load panning and zooming events
	$("#regex").on("input", onRegexChange);
	$("#convert").click(onConvertRegex);
	$(".stepbutton").click(clickStepButton);

	$(".helpbutton").click(function() {
		$(".helpmenu").toggleClass("helpmenu_selected");
	})
	$(".helpexit").click(function() {
		$(".helpmenu").removeClass("helpmenu_selected");
	})
	$(".helpsectionbutton").click(function() { // Scroll to the clicked section
		$(".helpcontent").stop().animate({
			scrollTop: $(this.getAttribute("section"))[0].offsetTop
		}, 600);
	})
	$(".examplebutton").click(function() {
		$("#regex").val("a*(b+a|de*)*a*"); // Example regular expression
		$("#regex").trigger("input");
	})
	$("#startrect").click(function() {
		$("#startpopup").css("display", "none");
	})
	$("#options_check").change(function() {
		auto_animation = this.checked;
		if (auto_animation) {
			$("#options_button").attr("disabled", true);
			$("#options_button").trigger("click"); // Auto animation is now on, trigger one
		}																				 // last click to clear the current animation queue
		else
			$("#options_button").attr("disabled", false);
	});
	$("#startpopup").animate({"opacity": 1}, 500).promise().then(function() { // Animate in starting popup
		startPopupAnimation(); // Popup path animation
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
		var errstring = "The browser you are using does not support some svg features this site relies on. This site is built for desktops and we recommended using Chrome, but Firefox, Safari and Opera should also work.";
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
	var val = $("#regex").val()
	var parsed = parseRegex(val);
	if (parsed === -1 || val == "" || val == undefined || in_animation) // Invalid expression or animation in progress
		return;

	in_animation = true;
	$("#convert").attr("disabled", true).animate({"opacity": 0}, 700);
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
		$("#convert").attr("disabled", false).animate({"opacity": 1}, 700);
		showStepButtons(1);
	})
}

/*
	Wrapper functions for the main animations:
	- Show NFAl, NFA, DFA or DFAm
	- Convert NFAl to NFA to DFA to DFAm
	- Check if string matches regular expression
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
		updateScale($("#FA").children()[0]);
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
		return animationWrap(animToNFAStart, [instance.FAobj], 2).then(function() {
			updateScale($("#FA").children()[0]);
		})
	})
}

function toDFA() {
	in_animation = true;
	return $.when(instance.FAstrings[3]).then(function(element) { // Check if needed svg has been rendered
		instance.FAobj[3] = FAToHTML(instance.DFA, element);
		makeInvisible(instance.FAobj[3]);
		return animationWrap(animToDFAStart, [instance], 3).then(function() {
			updateScale($("#FA").children()[0]);
		})
	})
}

function toDFAm() {
	in_animation = true;
	return $.when(instance.FAstrings[4]).then(function(element) { // Check if needed svg has been rendered
		instance.FAobj[4] = FAToHTML(instance.DFAm, element);
		return animationWrap(animToDFAmStart, [instance], 4).then(function() {
			updateScale($("#FA").children()[0]);
		})
	})
}

function checkMatch(string) {
	in_animation = true;
	$("#graphdouble").remove(); // Remove old graph double
	var match = stringMatches(instance.DFAm, string)
	return animationWrap(animCheckMatchStart, [instance.FAobj[4], match, string], match.matched ? 5 : 6).then(function() {
		var double = $("#graphdouble");
		double.delay(3000).promise().then(function() { // If the graph double is still there after 3 seconds, remove it
			double.remove();
			$("#step_message").html("");
		})
	});
}

function updateScale(element) {
	if (element.viewBox.baseVal.width * $(element).height() < element.viewBox.baseVal.height * $(element).width()) {
		element.scale = element.viewBox.baseVal.height / $(element).height();
		element.scaledir = 0;
	}
	else {
		element.scale = element.viewBox.baseVal.width / $(element).width();
		element.scaledir = 1;
	}
}

function loadSvgInteraction() {
	var holdingNode = false;
	var panning = false;
	var holdingIndex; // Value of the state currently being held
	var oldX, oldY;
	var nodeSelected = false;
	var infobox, state, statedouble;

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
			this.viewBox.baseVal.x -= (e.clientX-oldX)*this.scale
			this.viewBox.baseVal.y -= (e.clientY-oldY)*this.scale;
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
		if (this.scaledir) {
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
		updateScale(this);
	})

	$(window).on("resize", function(e) { // Update scale when window gets resized
		var FAs = $("#FA svg");
		for (var FA of FAs)
			updateScale(FA);
	})

	$(document).on("mouseenter mousemove", ".node", function(e) {
		if (!nodeSelected && !in_animation) {
			nodeSelected = true;
			infobox = $("#infobox" + this.id);
			state = this;
			statedouble = document.getElementById(state.id + "double")
			$("#graph0").prepend($("#graph0").children().filter(".edge")); // Move edges to background
			$(".info_path", infobox).addClass("info_path_selected");
			$(".info_text", infobox).addClass("info_text_selected")
			$(".info_rect", state).addClass("info_rect_selected");
			$("ellipse", state).eq(0).addClass("selected_big");
			if (statedouble)
				$("ellipse", statedouble).eq(0).addClass("selected_big");
			if ($("ellipse", state).length == 2) { // Accepting state, 2 ellipses
				$("ellipse", state).eq(1).addClass("selected_small");
				if (statedouble)
					$("ellipse", statedouble).eq(1).addClass("selected_small");
			}
		}
	})

	$(document).on("mouseleave", ".node", function(e) {
		if (nodeSelected) {
			nodeSelected = false;
			$(".info_path", infobox).removeClass("info_path_selected");
			$(".info_text", infobox).removeClass("info_text_selected");
			$(".info_rect", state).removeClass("info_rect_selected");
			$("ellipse", state).eq(0).removeClass("selected_big");
			if (statedouble)
				$("ellipse", statedouble).eq(0).removeClass("selected_big");
			if ($("ellipse", state).length == 2) { // Accepting state, 2 ellipses
				$("ellipse", state).eq(1).removeClass("selected_small");
				if (statedouble)
					$("ellipse", statedouble).eq(1).removeClass("selected_small");
			}
			$(document).delay(1500).promise().then(function() {
				// If no state selected after transition is done (1.5s), move edges to foreground again
				if (!nodeSelected)
					$("#graph0").append($("#graph0").children().filter(".edge"));
			})
		}
	})
}


function makeInvisible(FAobj) { // Make all nodes, edges, text hidden
	$("#graph0 ellipse", FAobj.svg).attr("visibility", "hidden");
	$("#graph0 text", FAobj.svg).css({"opacity": 0});

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
				var te = $("text", edge)[0];
				var index = te.innerHTML.indexOf("0");
				if (index != -1)
					te.innerHTML = te.innerHTML.substr(0, index) + "&lambda;" + te.innerHTML.substr(index+1);
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

	var g = document.createElementNS('http://www.w3.org/2000/svg', "g");
	g.setAttribute("id", "infoboxes");
	g.setAttribute("transform", retObj.svg.children().eq(0).attr("transform"));
	retObj.svg.append(g);
	var appendAndTruncate = function(examplestring, tspan, text) {
		$(tspan).appendTo(text).promise().then(function() {
			tspan.innerHTML = examplestring;
			// Truncate string if too long
			if (tspan.getSubStringLength(0, examplestring.length) > 95) {
				var newlength = examplestring.length-1;
				tspan.innerHTML = examplestring.substr(0, newlength);
				while (tspan.getSubStringLength(0, newlength) > 90 && newlength > 1) {
					newlength--;
					tspan.innerHTML = examplestring.substr(0, newlength);
				}
				tspan.innerHTML += "...";
			}
		})
	}

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
			var subg = document.createElementNS('http://www.w3.org/2000/svg', "g");
			subg.setAttribute("id", "infobox" + retObj.states[i].attr("id"));
			subg.setAttribute("class", "info_box")
			g.appendChild(subg);
			var cx = $("ellipse", retObj.states[i]).attr("cx");
			var cy = $("ellipse", retObj.states[i]).attr("cy");
			var path = document.createElementNS('http://www.w3.org/2000/svg', "path");
			path.setAttribute("stroke", "#000000");
			path.setAttribute("fill", "#eeeeee");
			path.setAttribute("d", "M" + (cx-23) + "," + cy + " l0,-75 100,0 0,52 -77,0 a23 23 0 0 0 -23 23");
			path.setAttribute("class", "info_path");
			var len = path.getTotalLength();
			path.style["stroke-dasharray"] = len;
			path.style["stroke-dashoffset"] = len;
			subg.append(path);
			var text = document.createElementNS('http://www.w3.org/2000/svg', "text");
			text.setAttribute("x", cx-20);
			text.setAttribute("y", cy-64);
			text.setAttribute("fill", "#000000");
			text.classList.add("info_text");
			subg.append(text);
			var texthead = document.createElementNS('http://www.w3.org/2000/svg', "tspan");
			texthead.setAttribute("x", cx-20);
			texthead.setAttribute("dy", "0");
			texthead.classList.add("info_text_big");
			texthead.innerHTML = "State " + i;
			text.append(texthead);
			// Get (a maximum of) 4 random strings from the examplestrings array
			var examplestrings = [];
			if (FA.examplestrings[i].length <= 4)
				examplestrings = FA.examplestrings[i];
			else {
				// Always add the first found examplestring
				examplestrings.push(FA.examplestrings[i][0]);
				while (examplestrings.length < 4) {
					var index = Math.floor(Math.random()*FA.examplestrings[i].length);
					if (examplestrings.indexOf(FA.examplestrings[i][index]) == -1)
						examplestrings.push(FA.examplestrings[i][index]);
				}
				examplestrings.sort(function(a,b) {
					return a.length - b.length; // Ascending in length
				})
			}
			var textexample = document.createElementNS('http://www.w3.org/2000/svg', "tspan");
			textexample.setAttribute("x", cx-20);
			textexample.setAttribute("dy", "7.8px");
			textexample.classList.add("info_text_small");
			textexample.innerHTML = "Example strings:";
			$(textexample).appendTo(text);
			for (var examplestring of examplestrings) {
				var textexample = document.createElementNS('http://www.w3.org/2000/svg', "tspan");
				textexample.setAttribute("x", cx-20);
				textexample.setAttribute("dy", "7.5px");
				textexample.classList.add("info_text_small");
				if (examplestring.length == 0) { // Empty string
					textexample.innerHTML = "&lambda; (Empty string)";
					$(textexample).appendTo(text);
				}
				else {
					appendAndTruncate(examplestring, textexample, text);
				}
			}
			var rect = document.createElementNS('http://www.w3.org/2000/svg', "rect"); // Invisible rectangle to detect hovering
			rect.setAttribute("x", cx-23);
			rect.setAttribute("y", cy-75);
			rect.setAttribute("width", "100");
			rect.setAttribute("height", "75");
			rect.setAttribute("fill", "rgba(0,0,0,0)");
			rect.setAttribute("stroke", "rgba(0,0,0,0)");
			rect.setAttribute("class", "info_rect");
			retObj.states[i].append(rect);
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
	$("text", edges).each(function() {
		var index = this.innerHTML.indexOf("0");
		if (index != -1)
			this.innerHTML = this.innerHTML.substr(0, index) + "&lambda;" + this.innerHTML.substr(index+1);
	})
	$("title", elements).remove(); // Remove all the title elements (hovering indicator)
	$("ellipse", elements).attr("fill", "#eeeeee");
	elements.children().children("polygon").remove(); // Remove the background fill
	elements.children().contents().each(function() {
		if (this.nodeType == Node.COMMENT_NODE || this.nodeType == Node.TEXT_NODE) {
			$(this).remove(); // Remove comments from the html
		}
	})
	return retObj;
}

function showStepButtons(step) {
	var textl = "", textr= "";
	switch (step) {
		case 1:
			textl = "Replay<br>animation";
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
	$(".step").finish();
	if (step < 4) {
		$("#stepr .steptext").html(textr);
		$("#stepr").attr("step", step);
		$("#stepr").css({"display": "flex", "opacity": 0}).animate({"opacity": 1}, 800);
	}
	else { // Step == 4
		$("#stepr").css("display", "none");
		$("#stepmatch .stepbutton").attr("step", 4);
		$("#stepmatch").css({"display": "block", "opacity": 0}).animate({"opacity": 1}, 800);
	}
	$("#stepl .steptext").html(textl);
	$("#stepl").attr("step", step+4);
	$("#stepl").css({"display": "flex", "opacity": 0}).animate({"opacity": 1}, 800);
	$("#convert").attr("disabled", false).animate({"opacity": 1}, 800);
}

function clickStepButton() {
	if (in_animation)
		return; // Animation already in progress: stop
	if (this.getAttribute("step") == "4") {
		var string = $("#matchinput").val();
		for (var i = 0; i < string.length; i++) {
			if (!instance.DFAm.alphabet.has(string[i])) { // String contains letter not in alphabet
				$("#step_message").html("String may only contain characters that are present in the automaton");
				return;
			}
		}
	}
	$(".step, #convert").finish().attr("disabled", true).animate({"opacity": 0}, 100).promise().then(function() {
		if (in_animation)
			$(".step").css("display", "none");
	})
	switch (this.getAttribute("step")) {
		case "1":
			toNFA().then(function() { showStepButtons(2); });
			break;
		case "2":
			toDFA().then(function() { showStepButtons(3); });
			break;
		case "3":
			toDFAm().then(function() { showStepButtons(4); });
			break;
		case "4":
			checkMatch(string).then(function() { showStepButtons(4); });
			break;
		case "5":
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
}
