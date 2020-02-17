"use strict";

/*
  Wrapper function for all main animations. Takes a animation function in as argument
  and keeps a queue containing the next animation steps, that either get triggered
  automatically, or with the animation step button if auto_animation is off
*/
function animationWrap(animationFunction, args, step) {
    in_animation = true;
    var queue = []; // Queue containing the next animation steps that are ready to go
    queue.notify = function(message) { // Custom queue function to notify queue when a new element gets added
        if (queue == null) // Animation was skipped during this step, stop
          return;
        if (auto_animation)
            (queue.shift())(); // Execute the first animation in the queue
        else { // Not auto animnation, wait for click
						if (message != undefined)
							$("#step_message").html("Next step: " + message);
            $("#options_button").one("click", function() {
								$("#step_message").html("");
								(queue.shift())()
            });
        }
    }
    queue.done = $.Deferred(); // Gets resolved when last step of animation is done
    $.when(queue.done).then(function() {
        in_animation = false;
        $("#FA animate").remove(); // Delete the used animation objects
        $("#FA animateTransform").remove();
        if (step <= 4)
          $("#step_message").html("");
        $("#skip_button").unbind(); // Remove old event handlers
        $("#options_button").unbind();
        $("#skip_button").css("visibility", "hidden");
        queue = null;
    })
    $("#step_message").html("");
    args.push(queue);
    animationFunction.apply(this, args); // Start animation function
    $("#skip_button").css("visibility", "visible");
    $("#skip_button").click(function() {
      skipAnimation(step, queue);
    })
    return queue.done;
}

function skipAnimation(step, queue) {
  if (step == 5 || step == 6) {
    $("#graphdouble").remove();
    if (step == 5) {
      doubleGraph($("#graph0"), "#31eb37", false); // Green
      $("#step_message").html("The string matches the regular expression!");
    }
    else {
      doubleGraph($("#graph0"), "#e61515", false); // Red
      $("#step_message").html("The string doesn't match the regular expression!");
    }
    queue.done.resolve();
    return;
  }
  $.when(instance.FAstrings[step]).then(function(element) {
    var FA = step == 0 ? instance.NFAl
					 : step == 2 ? instance.NFA
					 : step == 3 ? instance.DFA
					 : step == 4 ? instance.DFAm
           : undefined;
    instance.FAobj[step] = FAToHTML(FA, element);
    $("#FA").html(instance.FAobj[step].svg).promise().then(function() {
      updateScale($("#FA").children()[0]);
    })
    queue.done.resolve();
  })
}

// Small intro animation
function introAnimation() {
    $(".helpbutton2, .examplebutton").css("border", "none")
    $(".beginbuttons").animate({
      'height': '0',
      'opacity': '0'
    }, 700).promise().then(function() {
      $(".beginbuttons").css("display", "none");
      $("#convert, #regex").css("margin", "10px auto");
    })
    return $("#header").animate({
        'height': '110px'
    }, 700).promise().then(function() {
        $("#line").css({
            display: 'block'
        });
        $("#FA").css({
            display: 'flex'
        });
    }).then(function() {
        $("#line").animate({
            'opacity': '1'
        }, 200);
        $("#help").animate({
            'opacity': '1'
        }, 200);
        $("#options").animate({
            'opacity': '1'
        }, 200);
        $("#next_step").animate({
            'opacity': '1'
        }, 200);
        return $("#previous_step").animate({
            'opacity': '1'
        }, 200).promise();
    });
}

/*
	Functions for showing an FA (animating in)
*/
function showFA(FAobj, queue) {
    var timeper = Math.max(Math.min(4000 / FAobj.states.length, 500), 250); // Animation time between 250 and 500 ms

    return showEdge(FAobj.start[0], timeper).then(function() { // Show starting edge
        queue.push(function() {
            showFAParts(FAobj, [FAobj.start[1].toString()], [], [$("polygon", FAobj.start[0])[0].points[1]], queue)
        });
        queue.notify("Show state(s) " + FAobj.start[1] + " and outgoing edges" );
    });
}

function showFAParts(FAobj, curstates, visited, entrypoints, queue) { // Show the states in curstates and their outgoing edges
    // Entrypoints are the coordinates at the tips of arrow of the edges that made
    // curstates. These are needed for the precise animation of the circles
    var timeper = Math.max(Math.min(4000 / FAobj.states.length, 500), 250); // Animation time between 250 and 500 ms
    var nextentrypoints = [];
    var nextstates = [];
    var p1, p2, p3;

    for (var i in curstates) {
      p1 = showState(FAobj.states[curstates[i]], entrypoints[i], timeper);
    }
    p2 = $.when(p1).then(function() {
        for (var i in curstates) {
          for (var to in FAobj.edges[curstates[i]]) {
            p3 = showEdge(FAobj.edges[curstates[i]][to][1], timeper);
            if (!curstates.includes(to) && !visited.includes(to) && !nextstates.includes(to)) {
              nextstates.push(to);
              nextentrypoints.push($("polygon", FAobj.edges[curstates[i]][to][1])[0].points[1]);
            }
          }
            /*for (var symbol in FAobj.edges[curstates[i]]) {
                FAobj.edges[curstates[i]][symbol].forEach(function(val) {
                    p2 = showEdge(val[1], timeper);
                    if (!curstates.includes(val[0]) && !visited.includes(val[0]) && !nextstates.includes(val[0])) {
                        nextstates.push(val[0]);
                        nextentrypoints.push($("polygon", val[1])[0].points[1]);
                    }
                });
            }*/
            visited.push(curstates[i]);
        }
        return p3;
    });

    return $.when(p2).then(function() {
				if (nextstates.length == 0) {
					queue.done.resolve(); // Notify queue that the animation is finished
					return;
				}
				queue.push(function() {
            showFAParts(FAobj, nextstates, visited, nextentrypoints, queue)
        });
        queue.notify("Show state(s) " + nextstates.join(",") + " and outgoing edges");
    });
}

function showState(state, entrypoint, time) {
    var circles = $("ellipse", state);
    var cx = parseFloat(circles.attr("cx"));
    var cy = parseFloat(circles.attr("cy"));
    var distance = Math.sqrt(Math.pow(cx - entrypoint.x, 2) + Math.pow(cy - entrypoint.y, 2)); // Distance from center to entrypoint
    var startx, starty, endx, endy;
    var color = circles.attr("stroke");
    var strokewidth = circles.attr("stroke-width");
    var p1;
    for (var i = 0; i < circles.length; i++) {
        var r = circles[i].rx.baseVal.value;
        // Arrows slightly stick out into the states, calculate actual entrypoint and endpoint
        startx = cx - (cx - entrypoint.x) * r / distance;
        starty = cy - (cy - entrypoint.y) * r / distance;
        endx = 2 * cx - startx;
        endy = 2 * cy - starty;

        var curve1 = document.createElementNS('http://www.w3.org/2000/svg', "path");
        var curve2 = document.createElementNS('http://www.w3.org/2000/svg', "path");
        curve1.setAttribute("fill", "none");
        curve2.setAttribute("fill", "none");
        curve1.setAttribute("stroke", color);
        curve2.setAttribute("stroke", color);
        curve1.setAttribute("stroke-width", strokewidth);
        curve2.setAttribute("stroke-width", strokewidth);
        curve1.setAttribute("d", "M" + startx + "," + starty + " A" + r + " " + r + " 0 0 0 " + endx + " " + endy);
        curve2.setAttribute("d", "M" + startx + "," + starty + " A" + r + " " + r + " 0 1 1 " + endx + " " + endy);
        curve1.setAttribute("class", "ellipsepath");
        curve2.setAttribute("class", "ellipsepath");

				var len = curve1.getTotalLength();
        $(curve1).css({
            'stroke-dasharray': len,
            'stroke-dashoffset': len
        });
				len = curve2.getTotalLength();
        $(curve2).css({
            'stroke-dasharray': len,
            'stroke-dashoffset': len
        });
        state[0].appendChild(curve1);
        state[0].appendChild(curve2);
        $(curve1).animate({
            'stroke-dashoffset': 0
        }, time);
        p1 = $(curve2).animate({
            'stroke-dashoffset': 0
        }, time).promise();
    }
    $.when(p1).then(function(path) { // Remove the animation paths and replace them with the actual circle
      $("ellipse", path.parent()).attr("visibility", "visible");
      $("text", path.parent()).animate({
          "opacity": 1
      }, 220);
      $(".ellipsepath", path.parent()).remove();
      $("animate", state).remove(); // Remove old animation objects
    })
    return p1;
}

function unshowState(state, entrypoint, time) { // Opposite of showState
    // (in this case entrypoint is actually the exit point for the next edge)
    $("ellipse", state).attr("visibility", "hidden"); // Hide ellipses and replace them with animated paths
    var circles = $("ellipse", state);
    var cx = parseFloat(circles.attr("cx"));
    var cy = parseFloat(circles.attr("cy"));
    var distance = Math.sqrt(Math.pow(cx - entrypoint.x, 2) + Math.pow(cy - entrypoint.y, 2)); // Distance from center to entrypoint
    var startx, starty, endx, endy;
    var color = circles.attr("stroke");
    var strokewidth = circles.attr("stroke-width");
    var p1;
    for (var i = 0; i < circles.length; i++) {
        var r = circles[i].rx.baseVal.value;
        // Arrows slightly stick out into the states, calculate actual entrypoint and endpoint
        startx = cx + (cx - entrypoint.x) * r / distance;
        starty = cy + (cy - entrypoint.y) * r / distance;
        endx = 2 * cx - startx;
        endy = 2 * cy - starty;

        var curve1 = document.createElementNS('http://www.w3.org/2000/svg', "path");
        var curve2 = document.createElementNS('http://www.w3.org/2000/svg', "path");
        curve1.setAttribute("fill", "none");
        curve2.setAttribute("fill", "none");
        curve1.setAttribute("stroke", color);
        curve2.setAttribute("stroke", color);
        curve1.setAttribute("stroke-width", strokewidth);
        curve2.setAttribute("stroke-width", strokewidth);
        curve1.setAttribute("d", "M" + startx + "," + starty + " A" + r + " " + r + " 0 0 0 " + endx + " " + endy);
        curve2.setAttribute("d", "M" + startx + "," + starty + " A" + r + " " + r + " 0 1 1 " + endx + " " + endy);
        curve1.setAttribute("class", "ellipsepath");
        curve2.setAttribute("class", "ellipsepath");

				var len = curve1.getTotalLength();
        $(curve1).css({
            'stroke-dasharray': len,
            'stroke-dashoffset': 0
        });
				len = curve2.getTotalLength();
        $(curve2).css({
            'stroke-dasharray': len,
            'stroke-dashoffset': 0
        });
        state[0].appendChild(curve1);
        state[0].appendChild(curve2);
        $(curve1).animate({
            'stroke-dashoffset': -len
        }, time);
        p1 = $(curve2).animate({
            'stroke-dashoffset': -len
        }, time).promise();
    }
    $.when(p1).then(function(path) { // Remove the animation paths
      $(".ellipsepath", path.parent()).remove();
      $("animate", state).remove(); // Remove old animation objects
    })
    return p1;
}

function showEdge(edge, time) {
    var path = $("path", edge);
    var pol = $("polygon", edge);
    var length = path[0].getTotalLength();
    return path.css("stroke-dashoffset", length).animate({
        'stroke-dashoffset': 0
    }, length / (length + 10) * time).promise().then(function() {
        var points = pol[0].points;
        var anim = document.createElementNS('http://www.w3.org/2000/svg', "animate");
        var attrs = {
            attributeName: "points",
            attributeType: "XML",
            begin: "indefinite",
            dur: (10 / (length + 10) * time) + "ms",
            fill: "freeze",
            from: points[0].x + " " + points[0].y + " " + points[0].x + " " + points[0].y + " " + points[2].x + " " + points[2].y + " " + points[2].x + " " + points[2].y + " " + points[0].x + " " + points[0].y + " ",
            to: points[0].x + " " + points[0].y + " " + points[1].x + " " + points[1].y + " " + points[1].x + " " + points[1].y + " " + points[2].x + " " + points[2].y + " " + points[0].x + " " + points[0].y + " "
        };
        for (var k in attrs)
            anim.setAttribute(k, attrs[k]);
        pol.attr("visibility", "visible");
        pol[0].appendChild(anim);
        $("animate", pol)[0].beginElement();
        return edge.delay(10 / (length + 10) * time).promise().then(function() { // Artifical delay, same time as animation time
					$("text", edge).animate({"opacity": 1}, 220);
          $("animate", edge).remove(); // Remove old animation objects
				})
    })
}

function showEdge2(edge, time) { // Show edge the other way around (first polygon then path)
  var path = $("path", edge);
  var pol = $("polygon", edge);
  var length = path[0].lengthsaved;
  var points = pol[0].points;
  var anim = document.createElementNS('http://www.w3.org/2000/svg', "animate");
  var attrs = {
      attributeName: "points",
      attributeType: "XML",
      begin: "indefinite",
      dur: (10 / (length + 10) * time) + "ms",
      fill: "freeze",
      from: points[1].x + " " + points[1].y + " " + points[1].x + " " + points[1].y + " " + points[1].x + " " + points[1].y + " " + points[1].x + " " + points[1].y + " " + points[1].x + " " + points[1].y + " ",
      to: points[0].x + " " + points[0].y + " " + points[1].x + " " + points[1].y + " " + points[1].x + " " + points[1].y + " " + points[2].x + " " + points[2].y + " " + points[0].x + " " + points[0].y + " "
  };
  for (var k in attrs)
      anim.setAttribute(k, attrs[k]);
  pol.attr("visibility", "visible");
  pol[0].appendChild(anim);
  $("animate", pol)[0].beginElement();
  return edge.delay(10 / (length + 10) * time).promise().then(function() { // Artifical delay, same time as animation time
		return path.css("stroke-dashoffset", -length).animate({
        'stroke-dashoffset': 0
    }, length / (length + 10) * time).promise().then(function() {
      $("text", edge).animate({"opacity": 1}, 220);
      $("animate", edge).remove(); // Remove old animation objects
		});
	})
}

function unshowEdge(edge, time) { // Opposite of showEdge. First animate out polygon, then path
	var path = $("path", edge);
	var pol = $("polygon", edge);
	var length = path[0].lengthsaved;
	var points = pol[0].points;
	var anim = document.createElementNS('http://www.w3.org/2000/svg', "animate");
	var attrs = {
			attributeName: "points",
			attributeType: "XML",
			begin: "indefinite",
			dur: (10 / (length + 10) * time) + "ms",
			fill: "freeze",
			from: points[0].x + " " + points[0].y + " " + points[1].x + " " + points[1].y + " " + points[1].x + " " + points[1].y + " " + points[2].x + " " + points[2].y + " " + points[0].x + " " + points[0].y + " ",
			to: points[0].x + " " + points[0].y + " " + points[0].x + " " + points[0].y + " " + points[2].x + " " + points[2].y + " " + points[2].x + " " + points[2].y + " " + points[0].x + " " + points[0].y + " "
	};
	for (var k in attrs)
			anim.setAttribute(k, attrs[k]);
	pol[0].appendChild(anim);
	$("animate", pol)[0].beginElement();
	return edge.delay(10 / (length + 10) * time).promise().then(function() { // Artifical delay, same time as animation time
		pol.attr("visibility", "hidden");
		return path.css("stroke-dashoffset", 0).animate({
        'stroke-dashoffset': length
    }, length / (length + 10) * time).promise().then(function() {
			$("text", edge).animate({"opacity": 0}, 220);
      $("animate", edge).remove(); // Remove old animation objects
		});
	})
}

function unshowEdge2(edge, time) { // Opposite of showEdge. First animate out path, then polygon
  var path = $("path", edge);
  var pol = $("polygon", edge);
  var length = path[0].getTotalLength();
  return path.css("stroke-dashoffset", 0).animate({
      'stroke-dashoffset': -length
  }, length / (length + 10) * time).promise().then(function() {
      var points = pol[0].points;
      var anim = document.createElementNS('http://www.w3.org/2000/svg', "animate");
      var attrs = {
          attributeName: "points",
          attributeType: "XML",
          begin: "indefinite",
          dur: (10 / (length + 10) * time) + "ms",
          fill: "freeze",
          from: points[0].x + " " + points[0].y + " " + points[1].x + " " + points[1].y + " " + points[1].x + " " + points[1].y + " " + points[2].x + " " + points[2].y + " " + points[0].x + " " + points[0].y + " ",
          to: points[1].x + " " + points[1].y + " " + points[1].x + " " + points[1].y + " " + points[1].x + " " + points[1].y + " " + points[1].x + " " + points[1].y + " " + points[1].x + " " + points[1].y + " "
      };
      for (var k in attrs)
          anim.setAttribute(k, attrs[k]);
      pol[0].appendChild(anim);
      $("animate", pol)[0].beginElement();
      return edge.delay(10 / (length + 10) * time).promise().then(function() { // Artifical delay, same time as animation time
        pol.attr("visibility", "hidden");
        $("animate", edge).remove(); // Remove old animation objects
      })
  })
}

/*
	Convert NFAl to NFA by removing l-transitions
	(and updating accepting states and removing unreachable states)
*/
function animToNFAStart(FAobjs, queue) { // Starting animations: Rearrange and add accepting states
	if (FAobjs[1] == undefined || FAobjs[1].newedges == undefined) {
		$("#step_message").html("The automaton doesn't contain any &lambda;-transitions. Continuing..");
    FAobjs[2].svg.attr("viewBox", FAobjs[0].svg.attr("viewBox"));
    FAobjs[2].svg.children().attr("transform", FAobjs[0].svg.children().attr("transform"));
    $("#FA").html(FAobjs[2].svg).promise().then(function() {
      updateScale($("#FA").children()[0]);
    })
    $("#FA").delay(1000).promise().then(function() {
      queue.done.resolve();
    })
    return;
	}

  var newedges = false;
  for (var from in FAobjs[1].newedges) {
    for (var to in FAobjs[1].newedges[from]) {
      if (FAobjs[1].newedges[from][to].length != 0)
        newedges = true;
      if (newedges) break
    }
    if (newedges) break
  }

  var fMoveo = function() {
    return moveo(FAobjs[0], FAobjs[1]);
  }
  var fAccepting = function() {
      var p1;
      for (var i = 0; i < FAobjs[1].newaccepting.length; i++)
        p1 = $($("ellipse",FAobjs[1].newaccepting[i][1])[1]).animate({"opacity": "1"}, 400).promise();
      return p1;
  }
  var fReplace = function() {
    replaceEdges(FAobjs, 0, queue);
  }

  if (FAobjs[1].newaccepting.length == 0) { // No new accepting states, skip that step
    if (!newedges) { // No new edges, no need to rearrange
      FAobjs[1].svg.attr("viewBox", FAobjs[0].svg.attr("viewBox"));
      FAobjs[1].svg.children().attr("transform", FAobjs[0].svg.children().attr("transform"));
      $("#FA").html(FAobjs[1].svg).promise().then(function() {
        updateScale($("#FA").children()[0]);
      })
      fReplace();
    }
    else { // Has new edges, rearrange first
      queue.push(function() {
        fMoveo().then(fReplace);
      })
      queue.notify("Rearrange graph to make space for the new edges");
    }
  }
  else { // Does have new accepting states
    if (!newedges) { // No new edges, no need to rearrange
      queue.push(function() {
        FAobjs[1].svg.attr("viewBox", FAobjs[0].svg.attr("viewBox"));
        FAobjs[1].svg.children().attr("transform", FAobjs[0].svg.children().attr("transform"));
        $("#FA").html(FAobjs[1].svg).promise().then(function() {
          updateScale($("#FA").children()[0]);
        })
        fAccepting().then(fReplace);
      })
      var str = "";
      for (var i = 0; i < FAobjs[1].newaccepting.length-1; i++)
        str += FAobjs[1].newaccepting[i][0] + ", ";
      str += FAobjs[1].newaccepting[FAobjs[1].newaccepting.length-1][0];
      queue.notify("Mark all states that can reach an accepting state using only &lambda;-transitions as accepting (states " + str + ")");
    }
    else { // Has new edges, rearrange first
      queue.push(function() {
        fMoveo().then(function() {
          queue.push(function() {
            fAccepting().then(fReplace);
          })
          var str = "";
          for (var i = 0; i < FAobjs[1].newaccepting.length-1; i++)
            str += FAobjs[1].newaccepting[i][0] + ", ";
          str += FAobjs[1].newaccepting[FAobjs[1].newaccepting.length-1][0];
          queue.notify("Mark all states that can reach an accepting state using only &lambda;-transitions as accepting (states " + str + ")");
        })
      })
      queue.notify("Rearrange graph to make space for the new edges");
    }
  }
}

function animToNFAFinish(FAobjs, queue) { // Finishing animations: Remove unreachable states and rearrange
  if (FAobjs[1].unreachable.length == 0) { // No unreachable states, skip that step
    queue.push(function() {
      moveo(FAobjs[1], FAobjs[2]).then(function() {
        queue.done.resolve();
      })
    })
    queue.notify("Rearrange for clarity")
  }
  else {
    queue.push(function() {
      var p1;
      for (var from in FAobjs[1].edges) {
        for (var to in FAobjs[1].edges[from]) {
          for (var i = 0; i < FAobjs[1].unreachable.length; i++) {
            if (from == FAobjs[1].unreachable[i][0] || to == FAobjs[1].unreachable[i][0]) {
              unshowEdge(FAobjs[1].edges[from][to][1],200);
              break;
            }
          }
        }
      }
      for (var i = 0; i < FAobjs[1].unreachable.length; i++) {
        p1 = FAobjs[1].unreachable[i][1].delay(200).promise().then(function() {
          return this.animate({"opacity": 0}, 300).promise();
        })
      }
      $.when(p1).then(function() {
        queue.push(function() {
          moveo(FAobjs[1], FAobjs[2], FAobjs[1].unreachable).then(function() {
            queue.done.resolve();
          })
        })
        queue.notify("Rearrange for clarity")
      })
    })

    var str = "";
    for (var i = 0; i < FAobjs[1].unreachable.length-1; i++)
      str += FAobjs[1].unreachable[i][0] + ", ";
    str += FAobjs[1].unreachable[FAobjs[1].unreachable.length-1][0];
    queue.notify("Remove unreachable states from the starting state (remove states " + str + ")")
  }
}

function replaceEdges(FAobjs, state, queue) { // Main animations: Replace the lambda transitions
  var FAobj = FAobjs[1];
  if (FAobj.states.length == state) { // Reached last state, play finishing animation
		animToNFAFinish(FAobjs, queue);
		return;
	}
  var hasledges = false;
  for (var to in FAobj.edges[state]) {
    if (FAobj.edges[state][to][0].includes("0")) {
      hasledges = true;
      break;
    }
  }
	if (!hasledges) {
		replaceEdges(FAobjs, state+1, queue); // Doesnt have ledges, go to next state
		return;
	}
  for (var to in FAobj.edges[state]) {
    if (FAobj.edges[state][to][0].includes("0")) {
      var edge = FAobj.edges[state][to][1]; // Mark lambda edges red to be removed in the next step
      var path = $("path", edge);
  		var pol = $("polygon", edge);
  		path.attr("stroke", "#ff0000");
  		pol.attr("fill", "#ff0000");
  		pol.attr("stroke", "#ff0000");
  		$("text", edge).attr("fill", "#ff0000");
    }
  }
	queue.push(function() {
		var p1;
    for (var to in FAobj.edges[state]) {
      if (FAobj.edges[state][to][0].includes("0")) {
        var edge = FAobj.edges[state][to];
        edge[0].splice(edge[0].indexOf("0"), 1);
        if (edge[0].length == 0) { // Transition only consists of lambda, can remove it entirely
          p1 = unshowEdge(edge[1], 1000); // Unshow the edges
        }
        else { // Transition also contains other symbols, just change text
          $("text", edge[1]).text(edge[0].join(","));
          var te = $("text", edge[1])[0];
  				var index = te.innerHTML.indexOf("0");
  				if (index != -1)
  					te.innerHTML = te.innerHTML.substr(0, index) + "&lambda;" + te.innerHTML.substr(index+1);
        }
      }
    }
    var showEdgeAndText = function(edge) {
      return showEdge(edge[1], 1000).then(function() {
        $("text", edge[1]).text(edge[0].join(",")); // Set new text of edge
        var te = $("text", edge[1])[0];
        var index = te.innerHTML.indexOf("0");
        if (index != -1)
          te.innerHTML = te.innerHTML.substr(0, index) + "&lambda;" + te.innerHTML.substr(index+1);
      });
    }

    $.when(p1).then(function() {
			var p2;
      for (var to in FAobj.newedges[state]) {
        if (FAobj.newedges[state][to].length == 0)
          continue;
        var edge = FAobj.edges[state][to];
        var path = $("path", edge[1]); // Make edge black again if previously colored red
    		var pol = $("polygon", edge[1]);
    		path.attr("stroke", "#000000");
    		pol.attr("fill", "#000000");
    		pol.attr("stroke", "#000000");
    		$("text", edge[1]).attr("fill", "#000000");
        edge[0] = edge[0].concat(FAobj.newedges[state][to]);
        if (edge[0].length == FAobj.newedges[state][to].length) { // Transition didnt exist yet, show it
          p2 = showEdgeAndText(edge);
        }
      }
			return p2;
		}).then(function() {
			replaceEdges(FAobjs, state+1, queue);
		})
	})
	queue.notify("Replace &lambda;-transitions from state " + state + " with corresponding non-&lambda;-transitions")
}

function moveo(FAold, FAnew, unreachable) { // Animate an automaton to another automaton with the same states and edges, possibly with shifted states
    // Compute which old state numbers correspond to which new state numbers using a list of the unreachable states from the old automaton
    var stepdown = [];
    for (var i = 0; i < FAold.states.length; i++)
      stepdown[i] = 0
    if (unreachable != undefined) {
      for (var i = 0; i < unreachable.length; i++) {
        for (var j = unreachable[i][0]; j < FAold.states.length; j++) {
          stepdown[j]++;
        }
      }
    }
    var newtoold = []
    for (var i = 0; i < FAnew.states.length; i++) {
      var j = 0;
      for (; j < FAold.states.length; j++) {
        if (j-stepdown[j]==i) {
          newtoold[i] = j
          break;
        }
      }
    }

    $("#graph0 text", FAnew.svg).attr("visibility", "hidden"); // Hide all text temporarily
    var edges = $(".edge", FAnew);
    var states = $(".node", FAnew);
    $("text", FAold.svg).finish(); // Finish all ongoing text animations instantly
    return $("#graph0 text", FAold.svg).animate({
        "opacity": 0
    }, 300).promise().then(function() {
        $("#FA").html(FAnew.svg).promise().then(function() { // Replace with actual DFAm
          updateScale($("#FA").children()[0]);
        })
        // Animate transform translate to new value
        var anim = document.createElementNS('http://www.w3.org/2000/svg', "animateTransform");
        var attrs = {
          attributeName: "transform",
          attributeType: "XML",
          type: "translate",
          begin: "indefinite",
          fill: "freeze",
          from: FAold.svg.children().eq(0).attr("transform").match(/translate\((.*)\)/)[1],
          to: FAnew.svg.children().eq(0).attr("transform").match(/translate\((.*)\)/)[1],
          dur: "1s"
        }
        for (var k in attrs)
          anim.setAttribute(k, attrs[k]);
        FAnew.svg.children()[0].appendChild(anim);
        anim.beginElement();
        // Animate viewbox to new value
        var anim2 = document.createElementNS('http://www.w3.org/2000/svg', "animate");
        var attrs2 = {
          attributeName: "viewBox",
          attributeType: "XML",
          begin: "indefinite",
          fill: "freeze",
          from: FAold.svg.attr("viewBox"),
          to: FAnew.svg.attr("viewBox"),
          dur: "1s"
        }
        for (var k in attrs2)
          anim2.setAttribute(k, attrs2[k]);
        FAnew.svg[0].appendChild(anim2);
        anim2.beginElement();
        $("text", FAold.svg).css("opacity", 1)
        for (var i = 0; i < FAnew.states.length; i++) {
            var oldi = newtoold[i];
            moveState(FAnew.states[i],
              [$("ellipse", FAold.states[oldi]).attr("cx"), $("ellipse", FAold.states[oldi]).attr("cy")],
              [$("ellipse", FAnew.states[i]).attr("cx"), $("ellipse", FAnew.states[i]).attr("cy")], 1000);
            for (var to in FAnew.edges[i]) {
              var edgeNew = FAnew.edges[i][to];
              var edgeOld = FAold.edges[oldi][newtoold[to]];
              if (edgeOld != undefined && edgeNew != undefined && ArrayEquals(edgeOld[0], edgeNew[0]))
                moveEdge(edgeNew[1],
                  [$("path", edgeOld[1]).attr("d"), $("polygon", edgeOld[1]).attr("points")],
                  [$("path", edgeNew[1]).attr("d"), $("polygon", edgeNew[1]).attr("points")], 1000);
            }
        }
        moveEdge(FAnew.start[0],
          [$("path", FAold.start[0]).attr("d"), $("polygon", FAold.start[0]).attr("points")],
          [$("path", FAnew.start[0]).attr("d"), $("polygon", FAnew.start[0]).attr("points")], 1000);
        return $("#FA svg").delay(1000).promise().then(function() {
					$("#graph0 text", FAnew.svg).attr("visibility", "visible"); // Reshow text
          for (var i = 0; i < FAnew.edges.length; i++) { // Animate in text
            for (var to in FAnew.edges[i])
              if (FAnew.edges[i][to][0].length != 0)
                $("text", FAnew.edges[i][to][1]).css("opacity",0).animate({"opacity": 1}, 300);
            $("text", FAnew.states[i]).css("opacity",0).animate({"opacity": 1}, 300);
          }
          $("#FA animate").remove(); // Delete the used animation objects
				});
    })
}
function moveEdge(edge, from, to, time) { // Animate edge from one position to another. From and to contain the d and points attributes
    $("path", edge).css("stroke-dasharray", 0); // Set stroke-dasharray to 0 while animating to avoid invisible parts
    // Animating path requires both paths to have same amount of segments. Check difference and add empty segments if necessary
    var diff = from[0].split(/[\s,CMc]+/).length - to[0].split(/[\s,CMc]+/).length;
    if (diff % 6 != 0)
      console.log("??");
    if (diff > 0)
        to[0] += "c0,0 0,0 0,0".repeat(diff / 6);
    else
        from[0] += "c0,0 0,0 0,0".repeat(-diff / 6);
    var anim = document.createElementNS('http://www.w3.org/2000/svg', "animate");
    var attrs = {
        attributeName: "d",
        attributeType: "XML",
        begin: "indefinite",
        dur: time + "ms",
        fill: "freeze",
        from: from[0],
        to: to[0]
    };
    for (var k in attrs)
        anim.setAttribute(k, attrs[k]);
    $("path", edge)[0].appendChild(anim);
    anim.beginElement();
    // Animate path polygons (arrow points) from old to new position
    var anim2 = document.createElementNS('http://www.w3.org/2000/svg', "animate");
    var attrs2 = {
        attributeName: "points",
        attributeType: "XML",
        begin: "indefinite",
        dur: time + "ms",
        fill: "freeze",
        from: from[1],
        to: to[1]
    };
    for (var k in attrs)
        anim2.setAttribute(k, attrs2[k]);
    $("polygon", edge)[0].appendChild(anim2);
    anim2.beginElement();
    $("path", edge).delay(time).promise().then(function() {
      this[0].lengthsaved = this[0].getTotalLength();
      this.css("stroke-dasharray", this[0].lengthsaved); // Set stroke-dasharray back to original value
    })
    return $(edge).delay(time).promise();
}

function moveState(state, from, to, time) { // Animate state from one position to another. From and to contain the cx and cy attributes
  for (var j = 0; j < $("ellipse", state).length; j++) {
    // Animate ellipses from old to new position
    var anim = document.createElementNS('http://www.w3.org/2000/svg', "animate");
    var attrs = {
        attributeName: "cx",
        attributeType: "XML",
        begin: "indefinite",
        dur: time + "ms",
        fill: "freeze",
        from: from[0],
        to: to[0]
    };
    var anim2 = document.createElementNS('http://www.w3.org/2000/svg', "animate");
    var attrs2 = {
        attributeName: "cy",
        attributeType: "XML",
        begin: "indefinite",
        dur: time + "ms",
        fill: "freeze",
        from: from[1],
        to: to[1]
    };
    for (var k in attrs)
        anim.setAttribute(k, attrs[k]);
    for (var k in attrs2)
        anim2.setAttribute(k, attrs2[k]);
    $("ellipse", state)[j].appendChild(anim);
    $("ellipse", state)[j].appendChild(anim2);
    anim.beginElement();
    anim2.beginElement();
  }
  return $(state).delay(time).promise();
}

/*
	Convert NFA to DFA using subset construction
	(Make a splitscreen, and state by state build the DFA)
*/
function animToDFAStart(instance, queue) {
  $("#FA svg").animate({"width": "40%"}, 600).promise().then(function() {
      updateScale($("#FA svg")[0]);
    //$("#FA").append("<div id='table_container'><table id='dfa_table'><thead><tr><th>New state nr.</th><th>Corresponding old states</th></tr></thead></table></div>");
    $("#FA").append("<div id='table_container'><div id='table_head'><div class='table_row'><div class='table_text_left'>New state nr.</div><div class='table_text_right'>Corresponding old states</div></div></div><div id='table_body'></div></div>");
    instance.FAobj[3].svg.css("width", "40%");
    $("#FA").append(instance.FAobj[3].svg).promise().then(function() {
      updateScale($("#FA svg")[1]);
    });
    queue.push(function() {
      $("#table_body").append("<div class='table_row'><div class='table_text_left'>0</div><div class='table_text_right'>" + instance.DFA.statescor[0].join(",") + "</div></div>");
      showEdge(instance.FAobj[3].start[0], 300).then(function() {
        showState(instance.FAobj[3].states[0], $("polygon", instance.FAobj[3].start[0])[0].points[1], 300).then(function() {
          animToDFAMain(instance, queue, 0, 0, [0]);
        })
      })
    })
    queue.notify("Create a new starting state, that corresponds to old stating state");
  })
}

function animToDFAMain(instance, queue, curstate, curto, shown) {
  var NFAobj = instance.FAobj[2];
  var DFAobj = instance.FAobj[3];
  if (curto == DFAobj.states.length) { // Done with all edges, go to next state
    if (curstate == DFAobj.states.length-1) { // Just did last state, finish
      queue.push(function() {
        $("#FA").children().eq(0).animate({"width": 0}, 400).promise().then(function() {
          this.remove();
        })
        $("#FA").children().eq(1).css("min-width", 0).animate({"width": 0}, 400).promise().then(function() {
          this.remove();
        })
        $("#FA").children().eq(2).animate({"width": "100%"}, 400).promise().then(function() {
          updateScale(this[0]);
        })
        queue.done.resolve();
      })
      queue.notify("Finished. Click animation step one last time when you are ready to get rid of the table");
      return;
    }
    else { // More states to go
      animToDFAMain(instance, queue, curstate+1, 0, shown);
      return;
    }
  }

  if (DFAobj.edges[curstate][curto] == undefined) { // No edge from state to curto
    animToDFAMain(instance, queue, curstate, curto+1, shown);
    return;
  }

  for (var oldfrom of instance.DFA.statescor[curstate]) {
    for (var oldto of instance.DFA.statescor[curto]) {
      if (NFAobj.edges[oldfrom][oldto] == undefined)
        continue;
      var edge = NFAobj.edges[oldfrom][oldto][1]; // Mark NFA edges red for clarity
      var path = $("path", edge);
      var pol = $("polygon", edge);
      path.attr("stroke", "#ff0000");
      pol.attr("fill", "#ff0000");
      pol.attr("stroke", "#ff0000");
      $("text", edge).attr("fill", "#ff0000");
    }
  }

  queue.push(function() {
    if (!shown.includes(curto)) {
      if (instance.DFA.statescor[curto].length == 0)
        $("#table_body").append("<div class='table_row'><div class='table_text_left'>" + curto + "</div><div class='table_text_right'>None</div></div>");
      else
        $("#table_body").append("<div class='table_row'><div class='table_text_left'>" + curto + "</div><div class='table_text_right'>" + instance.DFA.statescor[curto].join(",") + "</div></div>");
    }
    showEdge(DFAobj.edges[curstate][curto][1], 300).then(function() {
      var p1;
      if (!shown.includes(curto)) {// State hasnt been shown yet, do it now
        p1 = showState(DFAobj.states[curto], $("polygon", DFAobj.edges[curstate][curto][1])[0].points[1], 300);
        shown.push(curto);
      }
      $.when(p1).then(function() {
        for (var oldfrom of instance.DFA.statescor[curstate]) {
          for (var oldto of instance.DFA.statescor[curto]) {
            if (NFAobj.edges[oldfrom][oldto] == undefined)
              continue;
            var edge = NFAobj.edges[oldfrom][oldto][1]; // Make NFA edges black again for clarity
            var path = $("path", edge);
            var pol = $("polygon", edge);
            path.attr("stroke", "#000000");
            pol.attr("fill", "#000000");
            pol.attr("stroke", "#000000");
            $("text", edge).attr("fill", "#000000");
          }
        }
        animToDFAMain(instance, queue, curstate, curto+1, shown);
      })
    })
  })
  if (instance.DFA.statescor[curstate].length == 0) {
    var notifymsg = "Starting from the 'empty' new state " + curstate + ", corresponding to no old states, using any symbol, we still can't reach any old states."
  }
  else {
    var notifymsg = "Starting from old ";
    if (instance.DFA.statescor[curstate].length == 1)
      notifymsg += "state " + instance.DFA.statescor[curstate][0] + " (new state " + curstate + "), ";
    else
      notifymsg += "states " + instance.DFA.statescor[curstate].join(",") + " (new state " + curstate + "), ";
    if (DFAobj.edges[curstate][curto][0].length == 1)
      notifymsg += "using the symbol " + DFAobj.edges[curstate][curto][0][0] + ", ";
    else
      notifymsg += "using one of the symbols " + DFAobj.edges[curstate][curto][0].join(",") + ", ";
    if (instance.DFA.statescor[curto].length == 0)
      notifymsg += "we can reach no old states";
    else if (instance.DFA.statescor[curto].length == 1)
      notifymsg += "we can reach old state " + instance.DFA.statescor[curto][0];
    else
      notifymsg += "we can reach old states " + instance.DFA.statescor[curto].join(",");
    if (!shown.includes(curto))
      notifymsg += ". This is not a new state yet, so create it.";
    else
      notifymsg += " (new state " + curto + ")";
  }
  queue.notify(notifymsg);
}

/*
	Convert DFA to DFAm (minimal DFA) by merging states that are equivalent
*/
function animToDFAmStart(instance, queue) { // Start of DFA to DFAm animation: move viewbox
  if (instance.DFA.states == instance.DFAm.states) { // DFA was already minimal
    $("#step_message").html("The automaton was already minimal. Continuing..");
    var DFAobj = instance.FAobj[3];
    var DFAmobj = instance.FAobj[4];
    DFAmobj.svg.attr("viewBox", DFAobj.svg.attr("viewBox")); // Change viewbox & transform to new value
    DFAmobj.svg.children().attr("transform", DFAobj.svg.children().attr("transform"));
    $("#FA").html(DFAmobj.svg).promise().then(function() { // Replace with actual DFAm
      updateScale($("#FA").children()[0]);
    })
    $("#FA").delay(1000).promise().then(function() {
      queue.done.resolve();
    })
  }
  else {
    $(".edge text").animate({"opacity": 0}, 200); // Temporarily remove text from edges during animation for clarity
    animToDFAmMain(instance, queue, 0);
  }
}

function animToDFAmMain(instance, queue, curstate) { // Main DFA to DFAm animation: merge states
  var DFAobj = instance.FAobj[3];
  var DFAmobj = instance.FAobj[4];
  if (curstate == instance.DFAm.states) { // Just did last state, finish
    DFAmobj.svg.attr("viewBox", DFAobj.svg.attr("viewBox")); // Change viewbox & transform to new value
    DFAmobj.svg.children().attr("transform", DFAobj.svg.children().attr("transform"));
    $("#graph0 text", DFAmobj.svg).css("opacity", 0).animate({"opacity": 1}, 200); // Animate in text
    $("#FA").html(DFAmobj.svg).promise().then(function() { // Replace with actual DFAm
      updateScale($("#FA").children()[0]);
    })
    queue.done.resolve();
    return;
  }
  // Mark the states and edges to be moved as red
  for (var oldstate of instance.DFAm.statescor[curstate]) {
    var stateobj = DFAobj.states[oldstate];
    $("ellipse", stateobj).css("stroke", "#ff0000");
    $("text", stateobj).css("fill", "#ff0000");
    for (var oldto in DFAobj.edges[oldstate]) {
      var edge = DFAobj.edges[oldstate][oldto][1];
      $("path", edge).css("stroke", "#ff0000");
      $("polygon", edge).css("stroke", "#ff0000");
      $("polygon", edge).css("fill", "#ff0000");
    }
    for (var oldfrom in DFAobj.edges) {
      if (DFAobj.edges[oldfrom][oldstate] == undefined)
        continue;
      var edge = DFAobj.edges[oldfrom][oldstate][1];
      $("path", edge).css("stroke", "#ff0000");
      $("polygon", edge).css("stroke", "#ff0000");
      $("polygon", edge).css("fill", "#ff0000");
    }
  }
  queue.push(function() {
    var newobj = DFAmobj.states[curstate];
    for (var oldstate of instance.DFAm.statescor[curstate]) {
      var oldobj = DFAobj.states[oldstate];
      moveState(oldobj, // Move states to new position
        [$("ellipse", oldobj).attr("cx"), $("ellipse", oldobj).attr("cy")],
        [$("ellipse", newobj).attr("cx"), $("ellipse", newobj).attr("cy")], 600
      );
      $("text", oldobj).css("opacity", 0); // Temporarily get rid of state nrs (they change)
      if (oldstate == instance.DFA.start) { // Move starting edge
        var d1 = $("path", DFAobj.start[0]).attr("d");
        var d2 = $("path", DFAmobj.start[0]).attr("d");
        var p1 = $("polygon", DFAobj.start[0]).attr("points");
        var p2 = $("polygon", DFAmobj.start[0]).attr("points");
        moveEdge(DFAobj.start[0], [d1, p1], [d2, p2], 600);
      }
      // Next: Move edge from one position to another.
      // The exact curve is not given, since either the starting state or
      // ending state moves and the other doesn't. Solution:
      // For outgoing states, transform to new edge, rotated such that endpoint
      // Coincides with old ending state.
      // For incoming states, rotate old edge such that endpoint coincides
      // with new ending state
      for (var oldto in DFAobj.edges[oldstate]) {
        var oldfrom = oldstate;
        var newfrom = curstate;
        oldto = parseInt(oldto);
        var newto;
        for (var i = 0; i < DFAmobj.states.length; i++) {
  				if (instance.DFAm.statescor[i].includes(oldto)) {
  					newto = i;
  					break;
  				}
  			}

        var oldedge = DFAobj.edges[oldfrom][oldto][1];
        var newedge = DFAmobj.edges[newfrom][newto][1];
        var d1 = $("path", oldedge).attr("d");
        var d2 = $("path", newedge).attr("d");
        var p1 = $("polygon", oldedge).attr("points");
        var p2 = $("polygon", newedge).attr("points");
        if (oldedge.halved) {
          moveEdge(oldedge, [d1, p1], [d2, p2], 600);
        }
        else {
          var d1split = d1.split(/[\s,CMc]+/);
          var d2split = d2.split(/[\s,CMc]+/);
          var origin = {"x": parseFloat(d2split[1]), "y": parseFloat(d2split[2])}; // Origin point to rotate and scale curve around
          var oldcenter = {"x": $("ellipse", DFAobj.states[oldto])[0].cx.baseVal.value, "y": $("ellipse", DFAobj.states[oldto])[0].cy.baseVal.value};
          var newcenter = {"x": $("ellipse", DFAmobj.states[newto])[0].cx.baseVal.value, "y": $("ellipse", DFAmobj.states[newto])[0].cy.baseVal.value};
          var newentrypoint = {"x": $("polygon", newedge)[0].points[1].x, "y": $("polygon", newedge)[0].points[1].y}
          var centerangle = Math.atan2(oldcenter.y-origin.y,oldcenter.x-origin.x) - Math.atan2(newcenter.y-origin.y,newcenter.x-origin.x);
          var entryangle = Math.atan2(newentrypoint.y-newcenter.y,newentrypoint.x-newcenter.x);
          var oldentryunit = {"x": Math.cos(centerangle+entryangle), "y": Math.sin(centerangle+entryangle)};
          var r = $("ellipse", DFAobj.states[oldto])[0].rx.baseVal.value;
          var oldend = {"x": oldcenter.x + oldentryunit.x * (r + 10), "y": oldcenter.y + oldentryunit.y * (r + 10)};
          var newend = {"x": parseFloat(d2split[d2split.length-2]), "y": parseFloat(d2split[d2split.length-1])};

          var scale = Math.sqrt(Math.pow(oldend.x-origin.x,2)+Math.pow(oldend.y-origin.y,2))
                    / Math.sqrt(Math.pow(newend.x-origin.x,2)+Math.pow(newend.y-origin.y,2)); // Ratio of distances to origin point
          var angle = Math.atan2(oldend.y-origin.y,oldend.x-origin.x)
                    - Math.atan2(newend.y-origin.y,newend.x-origin.x); // Angle between 2 end points as seen from the origin
          var newd = "M" + d2split[1] + "," + d2split[2] + "C"; // Will contain the new "d" attribute
          var newdarray = [];
          for (var i = 3; i < d2split.length; i+=2) {
            var newpoint = rotateScale(parseFloat(d2split[i]), parseFloat(d2split[i+1]), angle, scale, origin);
            newdarray.push(newpoint.x + "," + newpoint.y);
          }
          newd += newdarray.join(" ");
          var newpoints = []; // Will contan the new "points" attribute
          newpoints[0] = (oldend.x - oldentryunit.y * 3.5) + "," + (oldend.y + oldentryunit.x * 3.5);
          newpoints[1] = (oldend.x - oldentryunit.x * 10.4) + "," + (oldend.y - oldentryunit.y * 10.4);
          newpoints[2] = (oldend.x + oldentryunit.y * 3.5) + "," + (oldend.y - oldentryunit.x * 3.5);
          newpoints[3] = newpoints[0];
          newpoints = newpoints.join(" ");
          moveEdge(DFAobj.edges[oldfrom][oldto][1], [d1, p1], [newd, newpoints], 600);
          DFAobj.edges[oldfrom][oldto][1].halved = true;
        }
      }
      for (var oldfrom in DFAobj.edges) {
        for (var oldto in DFAobj.edges[oldfrom]) {
          oldto = parseInt(oldto);
          if (oldto != oldstate)
            continue;
          oldfrom = parseInt(oldfrom);
          var newto = curstate;
          var newfrom;
          for (var i = 0; i < DFAmobj.states.length; i++) {
    				if (instance.DFAm.statescor[i].includes(oldfrom)) {
    					newfrom = i;
    					break;
    				}
    			}

          var oldedge = DFAobj.edges[oldfrom][oldto][1];
          var newedge = DFAmobj.edges[newfrom][newto][1];
          var d1 = $("path", oldedge).attr("d");
          var d2 = $("path", newedge).attr("d");
          var p1 = $("polygon", oldedge).attr("points");
          var p2 = $("polygon", newedge).attr("points");
          if (oldedge.halved) {
            moveEdge(oldedge, [d1, p1], [d2, p2], 600);
          }
          else {
            var d1split = d1.split(/[\s,CMc]+/);
            var d2split = d2.split(/[\s,CMc]+/);
            var origin = {"x": parseFloat(d1split[1]), "y": parseFloat(d1split[2])}; // Origin point to rotate and scale curve around
            var oldcenter = {"x": $("ellipse", DFAobj.states[oldto])[0].cx.baseVal.value, "y": $("ellipse", DFAobj.states[oldto])[0].cy.baseVal.value};
            var newcenter = {"x": $("ellipse", DFAmobj.states[newto])[0].cx.baseVal.value, "y": $("ellipse", DFAmobj.states[newto])[0].cy.baseVal.value};
            var oldentrypoint = {"x": $("polygon", oldedge)[0].points[1].x, "y": $("polygon", oldedge)[0].points[1].y}
            var centerangle =  Math.atan2(newcenter.y-origin.y,newcenter.x-origin.x) - Math.atan2(oldcenter.y-origin.y,oldcenter.x-origin.x);
            var entryangle = Math.atan2(oldentrypoint.y-oldcenter.y,oldentrypoint.x-oldcenter.x);
            var newentryunit = {"x": Math.cos(centerangle+entryangle), "y": Math.sin(centerangle+entryangle)};
            var r = $("ellipse", DFAobj.states[newto])[0].rx.baseVal.value;
            var newend = {"x": newcenter.x + newentryunit.x * (r + 10), "y": newcenter.y + newentryunit.y * (r + 10)};
            var oldend = {"x": parseFloat(d1split[d1split.length-2]), "y": parseFloat(d1split[d1split.length-1])};

            var scale = Math.sqrt(Math.pow(newend.x-origin.x,2)+Math.pow(newend.y-origin.y,2))
                      / Math.sqrt(Math.pow(oldend.x-origin.x,2)+Math.pow(oldend.y-origin.y,2)); // Ratio of distances to origin point
            var angle = Math.atan2(newend.y-origin.y,newend.x-origin.x)
                      - Math.atan2(oldend.y-origin.y,oldend.x-origin.x); // Angle between 2 end points as seen from the origin
            var newd = "M" + d1split[1] + "," + d1split[2] + "C"; // Will contain the new "d" attribute
            var newdarray = [];
            for (var i = 3; i < d1split.length; i+=2) {
              var newpoint = rotateScale(parseFloat(d1split[i]), parseFloat(d1split[i+1]), angle, scale, origin);
              newdarray.push(newpoint.x + "," + newpoint.y);
            }
            newd += newdarray.join(" ");
            var newpoints = []; // Will contan the new "points" attribute
            newpoints[0] = (newend.x - newentryunit.y * 3.5) + "," + (newend.y + newentryunit.x * 3.5);
            newpoints[1] = (newend.x - newentryunit.x * 10.4) + "," + (newend.y - newentryunit.y * 10.4);
            newpoints[2] = (newend.x + newentryunit.y * 3.5) + "," + (newend.y - newentryunit.x * 3.5);
            newpoints[3] = newpoints[0];
            newpoints = newpoints.join(" ");
            moveEdge(DFAobj.edges[oldfrom][oldto][1], [d1, p1], [newd, newpoints], 600);
            DFAobj.edges[oldfrom][oldto][1].halved = true;
          }
        }
      }
    }
    $(document).delay(600).promise().then(function() { // Wait until animations are finished until pushing next step
      for (var oldstate of instance.DFAm.statescor[curstate]) { // Make moved states and edges green
        var stateobj = DFAobj.states[oldstate];
        $("ellipse", stateobj).css("stroke", "#003300");
        $("text", stateobj).css("fill", "#003300");
        for (var oldto in DFAobj.edges[oldstate]) {
          var edge = DFAobj.edges[oldstate][oldto][1];
          $("path", edge).css("stroke", "#003300");
          $("polygon", edge).css("stroke", "#003300");
          $("polygon", edge).css("fill", "#003300");
        }
        for (var oldfrom in DFAobj.edges) {
          if (DFAobj.edges[oldfrom][oldstate] == undefined)
            continue;
          var edge = DFAobj.edges[oldfrom][oldstate][1];
          $("path", edge).css("stroke", "#003300");
          $("polygon", edge).css("stroke", "#003300");
          $("polygon", edge).css("fill", "#003300");
        }
      }
      animToDFAmMain(instance, queue, curstate+1);
    })
  })
  if (instance.DFAm.statescor[curstate].length == 1) {
    queue.notify("State " + instance.DFAm.statescor[curstate][0] + " cannot be merged with any states. Move it to its new position");
  }
  else {
    queue.notify("States " + instance.DFAm.statescor[curstate].join(", ") + " are equivalent and can be merged");
  }
}

function rotateScale(x, y, angle, scale, origin) { // Rotate point (x,y) angle around origin and scale scale
  var sin = Math.sin(angle);
  var cos = Math.cos(angle);
  x -= origin.x; // Translate origin point to (0,0) (sortof)
  y -= origin.y;
  var newx = (x * cos - y * sin) * scale; // Rotate and scale
  var newy = (x * sin + y * cos) * scale;
  newx += origin.x; // Translate origin point back
  newy += origin.y;
  return {"x": newx, "y": newy};
}

/*
  Animation for checking if string matches regular expression
*/
function animCheckMatchStart(FAobj, matches, string, queue) { // Start by marking the starting state
  queue.push(function() {
    doubleGraph($("#graph0"), "#30cfc9", true); // Create a duplicate graph on top of the other one to be animated
    var id = "#" + FAobj.start[0].attr("id") + "double";
    var id2 = "#node" + (FAobj.start[1]+2) + "double";
    showEdge($(id), 500).then(function() {
      unshowEdge2($(id), 500);
      var entry = $("polygon", $(id))[0].points[1];
      showState($(id2), entry, 500).then(function() {
        $(id2).delay(10).promise().then(function() {
          animCheckMatchMain(FAobj, matches, string, 0, queue);
        })
      });
    })
  })
  queue.notify("Go to the starting state");
}

function animCheckMatchFinish(FAobj, matches, lastentry, queue) { // Finished: Color the whole thing green/red if matched/not matched
  queue.push(function() {
    $("#graphdouble").remove(); // Remove blue double graph, create a new one
    if (matches.matched)
      doubleGraph($("#graph0"), "#31eb37", true); // Green
    else
      doubleGraph($("#graph0"), "#e61515", true); // Red
    animCheckMatchMain2(FAobj, [matches.passed[matches.passed.length-1]], [], [lastentry], queue).then(function() {
      if (matches.matched)
        $("#step_message").html("The string matches the regular expression!");
      else
        $("#step_message").html("The string doesn't match the regular expression!");
    })
  })
  if (matches.matched)
    queue.notify("After reading the entire string, we ended up in an accepting state (" + matches.passed[matches.passed.length-1] + "). Therefore the string matches the regular expression");
  else
    queue.notify("After reading the entire string, we ended up in an non-accepting state (" + matches.passed[matches.passed.length-1] + "). Therefore the string does not match the regular expression");
}

function animCheckMatchMain(FAobj, matches, string, index, queue) {
  queue.push(function() {
    var nextstatenr = matches.passed[index+1];
    var previousstatenr = matches.passed[index];
    var nextstate = $("#node" + (nextstatenr+2) + "double");
    var previousstate = $("#node" + (previousstatenr+2) + "double");
    var edgeid = FAobj.edges[previousstatenr][nextstatenr][1].attr("id") + "double";
    var edge = $("#" + edgeid);
    var entry = $("polygon", edge)[0].points[1];
    if (previousstatenr != nextstatenr)
      unshowState(previousstate, $("path", edge)[0].getPointAtLength(0), 500);
    showEdge(edge, 500).then(function() {
      if (previousstatenr != nextstatenr)
        showState(nextstate, entry, 500);
      edge.delay(10).promise().then(function() {
        unshowEdge2(edge, 500).then(function() {
          nextstate.delay(10).promise().then(function() {
            if (index == string.length-1) { // Just did last step, go to finishing animation
              animCheckMatchFinish(FAobj, matches, $("polygon", edge)[0].points[1], queue);
              return;
            }
            animCheckMatchMain(FAobj, matches, string, index+1, queue);
          })
        })
      })
    })
  })
  queue.notify("Read character " + string[index] + ". Follow edge to state " + matches.passed[index+1]);
}

function animCheckMatchMain2(FAobj, curstates, visited, entrypoints, queue) { // Recursive function from finish function: color green or red
  var timeper = Math.max(Math.min(2000 / FAobj.states.length, 250), 125); // Animation time between 125 and 250 ms
  var nextentrypoints = [];
  var nextstates = [];
  var p1, p2, p3;

  for (var i in curstates) {
    var id = "#node" + (curstates[i]+2) + "double";
    p1 = showState($(id), entrypoints[i], timeper);
  }
  p2 = $.when(p1).then(function() {
      for (var i in curstates) {
        if (curstates[i] == FAobj.start[1]) {
          var id = "#" + FAobj.start[0].attr("id") + "double";
          p3 = showEdge2($(id), timeper);
        }
        for (var to in FAobj.edges[curstates[i]]) {
          to = parseInt(to);
          if (visited.includes(to))
            continue;
          var id = "#" + FAobj.edges[curstates[i]][to][1].attr("id") + "double";
          p3 = showEdge($(id), timeper);
          if (!curstates.includes(to) && !visited.includes(to) && !nextstates.includes(to)) {
            nextstates.push(to);
            nextentrypoints.push($("polygon", $(id))[0].points[1]);
          }
        }
        for (var from in FAobj.edges) {
          from = parseInt(from);
          if (FAobj.edges[from][curstates[i]] == undefined || visited.includes(from) || curstates.includes(from))
            continue;
          var id = "#" + FAobj.edges[from][curstates[i]][1].attr("id") + "double";
          p3 = showEdge2($(id), timeper);
          if (!curstates.includes(from) && !visited.includes(from) && !nextstates.includes(from)) {
            nextstates.push(from);
            nextentrypoints.push($("path", $(id))[0].getPointAtLength(0));
          }
        }
      }
      return p3;
  });

  return $.when(p2).then(function() {
      for (var i in curstates)
        visited.push(curstates[i]);
			if (nextstates.length == 0) {
				queue.done.resolve(); // Notify queue that the animation is finished
				return;
			}
      animCheckMatchMain2(FAobj, nextstates, visited, nextentrypoints, queue);
  });
}

function doubleGraph(graph, color, invis) { // Make a duplicate of the graph with different ids and class names for animating over the other graph
  var g = document.createElementNS('http://www.w3.org/2000/svg', "g");
  g.setAttribute("id", "graphdouble");
  g.setAttribute("transform", graph.attr("transform"));
  graph.after(g);
  var states = $(".node", graph);
  var edges = $(".edge", graph);
  for (var state of states) {
    var statecopy = state.cloneNode(false);
    statecopy.setAttribute("id", state.id + "double");
    $(statecopy).removeClass("node").addClass("nodedouble");
    var ellipsecopy = $("ellipse", state)[0].cloneNode(false);
    ellipsecopy.setAttribute("fill", "none");
    ellipsecopy.setAttribute("stroke", color);
    ellipsecopy.setAttribute("stroke-width", "1.7px");
    statecopy.appendChild(ellipsecopy);
    if ($("ellipse", state).length == 2) {// Accepting state
      var ellipsecopy2 = $("ellipse", state)[1].cloneNode(false);
      ellipsecopy2.setAttribute("fill", "none");
      ellipsecopy2.setAttribute("stroke", color);
      ellipsecopy2.setAttribute("stroke-width", "1.7px");
      statecopy.appendChild(ellipsecopy2);
    }
    g.appendChild(statecopy);
  }
  for (var edge of edges) {
    var edgecopy = edge.cloneNode(false);
    edgecopy.setAttribute("id", edge.id + "double");
    $(edgecopy).removeClass("edge").addClass("edgedouble");
    var pathcopy = $("path", edge)[0].cloneNode(false);
    var polcopy = $("polygon", edge)[0].cloneNode(false);
    pathcopy.setAttribute("stroke", color);
    pathcopy.setAttribute("stroke-width", "1.7px");
    pathcopy.lengthsaved = $("path", edge)[0].lengthsaved;
    $(pathcopy).css('stroke-dasharray', pathcopy.lengthsaved);
    if (invis)
      $(pathcopy).css('stroke-dashoffset', pathcopy.lengthsaved);
    polcopy.setAttribute("stroke", color);
    polcopy.setAttribute("fill", color);
    edgecopy.appendChild(pathcopy);
    edgecopy.appendChild(polcopy);
    g.appendChild(edgecopy);
  }
  if (invis) // Start off as invisible
    $("polygon, ellipse", g).attr("visibility", "hidden")
}
