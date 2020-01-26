$(document).ready(function(){
	var auto_animation = true;
	var regex_global = "";
	var NFAl, NFA, DFA, DFAm, FA;

	$("#regex").on('input', function() {
		var parsed = parseRegex($(this).val());
		if (parsed === -1) {
			$("#convert").attr("disabled", true);
			$(this).removeClass("valid").addClass("invalid");
		}
		else {
			$("#convert").attr("disabled", false);
			$(this).removeClass("invalid").addClass("valid");
		}
	});

	$("#convert").click(function() {
		var p1, p2;
		regex_global = $("#regex").val();
		p1 = $("#header").animate({
			'height': '10%'
		}, 700).promise().then(function() {
			$("#line").css({display: 'block'});
			$("#FA").css({display: 'flex'});
		})
		$("#regex").animate({
			'font-size': '21px'
		}, 700);
		generateAutomata();
		var FAobj = FAToHTML(NFAl);
		$("#FA").html(FAobj.svg);
		makeInvisible(FAobj);
		$.when(p1).then(function() {
			$("#line").animate({'opacity': '1'}, 200);
			$("#help").animate({'opacity': '1'}, 200);
			$("#options").animate({'opacity': '1'}, 200);
			$("#next_step").animate({'opacity': '1'}, 200);
			p2 = $("#previous_step").animate({'opacity': '1'}, 200).promise();
			$.when(p2).then(function() { showFA(NFAl, FAobj) });
		});
	});

	$("#options_check").change(function() {
		auto_animation = this.checked;
		if (auto_animation)
			$("#options_button").attr("disabled", true);
		else
			$("#options_button").attr("disabled", false);
	});

	function showFA(FA, FAobj) {
		var timeper = Math.max(Math.min(4000/FAobj.states.length, 500), 100); // Animation time between 100 and 500 ms
		showEdge(FAobj.start, timeper).then(function() {
			showFAParts(FA, FAobj, [FA.start], [], [$("polygon",FAobj.start)[0].points[1]]);
		});
	}

	function showFAParts(FA, FAobj, curstates, visited, entrypoints) {
		if (curstates.length == 0) return;
		var timeper = Math.max(Math.min(4000/FAobj.states.length, 500), 100); // Animation time between 100 and 500 ms
		var nextentrypoints = [];
		var nextstates = [];
		var p1, p2;

		p1 = showStates(FAobj.states, curstates, entrypoints, timeper).then(function() {
			for (var i in curstates) {
				for (var symbol in FAobj.edges[curstates[i]]) {
					FAobj.edges[curstates[i]][symbol].forEach(function(val) {
						p2 = showEdge(val[1], timeper);
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

		$.when(p1).then(function() { showFAParts(FA, FAobj, nextstates, visited, nextentrypoints) });
	}


	function getFAElements(FAstring, states, edges) {
		var elementso = $(FAstring);
		edges = $('.edge', elementso);
		console.log(edges);
	}

	function generateAutomata() {
		NFAl = trivialStates(constructNFAl(parseRegex(regex_global)));
		//NFAl = constructNFAl(parseRegex(regex_global))
	}

	function showStates(states, curstates, entrypoints, timeper) {
		var p1;
		for (var i in curstates) {
			//$("ellipse", states[curstates[i]]).attr("visibility", "visible");
			showState(states[curstates[i]], entrypoints[i], timeper)
			p1 = $("ellipse", states[curstates[i]]).animate({"opacity": "0.5"}, timeper).promise();
		}
		return p1;
	}

	function showState(state, entrypoint, time) {
		var circles = $("ellipse", state);
		var cx = circles.attr("cx");
		var cy = circles.attr("cy");
		var endx = 2*cx-entrypoint.x;
		var endy = 2*cy-entrypoint.y;
		var p1;
		for (var i = 0; i < circles.length; i++) {
			var r = circles[i].rx.baseVal.value;

			var curve1 = document.createElementNS('http://www.w3.org/2000/svg', "path");
			var curve2 = document.createElementNS('http://www.w3.org/2000/svg', "path");
			curve1.setAttribute("fill", "none");
			curve2.setAttribute("fill", "none");
			curve1.setAttribute("stroke", "#000000");
			curve2.setAttribute("stroke", "#000000");
			if (circles.length == 1 || r == 22) { // Outer circle
				curve1.setAttribute("d", "M" + entrypoint.x + "," + entrypoint.y + "A" + r + " " + r + " 0 0 0 " + endx + " " + endy);
				curve2.setAttribute("d", "M" + entrypoint.x + "," + entrypoint.y + "A" + r + " " + r + " 0 1 1 " + endx + " " + endy);
			}
			else { // Possible inner circle
				curve1.setAttribute("d", "M" + (9/11*entrypoint.x+2/11*cx) + "," + (9/11*entrypoint.y+2/11*cy) + "A18 18 0 0 0 " + (-9/11*entrypoint.x+20/11*cx) + " " + (-9/11*entrypoint.y+20/11*cy));
				curve2.setAttribute("d", "M" + (9/11*entrypoint.x+2/11*cx) + "," + (9/11*entrypoint.y+2/11*cy) + "A18 18 0 1 1 " + (-9/11*entrypoint.x+20/11*cx) + " " + (-9/11*entrypoint.y+20/11*cy));
			}
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
			for (var k in attrs)
				anim.setAttribute(k, attrs[k]);
			pol.attr("visibility", "visible");
			pol[0].appendChild(anim);
			$("animate", pol)[0].beginElement();
			return delay(10/(length+10)*time).promise();
		})
	}

	function delay(t) {
		return $.Deferred(function(def) {
			setTimeout(function() {
				def.resolve();
			}, t);
		}).promise();
}
});
