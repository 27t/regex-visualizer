"use strict";

/*
  Wrapper function for all animations. Takes a animation function in as argument
  and keeps a queue containing the next animation steps, that either get triggered
  automatically, or with the animation step button if auto_animation is off
*/
function animationWrap(animationFunction, args, step) {
    if (in_animation)
      return; // Animation already in progress, return
    in_animation = true;
    var queue = []; // Queue containing the next animation steps that are ready to go
    queue.notify = function(message) { // Custom queue function to notify queue when a new element gets added
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
        $("#skip_button").unbind(); // Remove old event handlers
        $("#skip_button").css("visibility", "hidden");
    })
    args.push(queue);
    animationFunction.apply(this, args); // Start animation function
    $("#skip_button").css("visibility", "visible");
    $("#skip_button").click(function() {
      skipAnimation(step, queue);
    })
    return queue.done;
}

function skipAnimation(step, queue) {
  $.when(instance.FAstrings[step]).then(function(element) {
    switch(step) {
      case 0:
        instance.FAobj[0] = FAToHTML(instance.NFAl, element);
        break;
      case 2:
      instance.FAobj[2] = FAToHTML(instance.NFA, element);
        break;
    }
    $("#FA").html(instance.FAobj[step].svg);
    queue.done.resolve();
  })
}

// Small intro animation
function introAnimation() {
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
	Functions for animating in a FA
*/
function showFA(FAobj, queue) {
    var timeper = Math.max(Math.min(4000 / FAobj.states.length, 500), 250); // Animation time between 250 and 500 ms

    return showEdge(FAobj.start[0], timeper).then(function() { // Show starting edge
        queue.push(function() {
            showFAParts(FAobj, [FAobj.start[1]], [], [$("polygon", FAobj.start[0])[0].points[1]], queue)
        });
        queue.notify("Show state(s) " + FAobj.start[1] + " and outgoing edges" );
    });
}

function showFAParts(FAobj, curstates, visited, entrypoints, queue) {
    var timeper = Math.max(Math.min(4000 / FAobj.states.length, 500), 250); // Animation time between 250 and 500 ms
    //timeper = 1;
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
                        nextentrypoints.push($("polygon", val[1])[0].points[1]);
                    }
                });
            }
            visited.push(curstates[i]);
        }
        return p2;
    });

    return $.when(p1).then(function() {
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

function showStates(states, curstates, entrypoints, timeper) {
    var p1;
    for (var i in curstates) {
        p1 = showState(states[curstates[i]], entrypoints[i], timeper).then(function(path) {
            // Remove the animation paths and replace them with the actual circle
            $("ellipse", path.parent()).attr("visibility", "visible");
            $("text", path.parent()).animate({
                "opacity": 1
            }, 220);
            $("path", path.parent()).remove();
        });
    }
    return p1;
}

function showState(state, entrypoint, time) {
    var circles = $("ellipse", state);
    var cx = parseFloat(circles.attr("cx"));
    var cy = parseFloat(circles.attr("cy"));
    var distance = Math.sqrt(Math.pow(cx - entrypoint.x, 2) + Math.pow(cy - entrypoint.y, 2));
    var startx, starty, endx, endy;
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
        curve1.setAttribute("stroke", "#000000");
        curve2.setAttribute("stroke", "#000000");
        curve1.setAttribute("d", "M" + startx + "," + starty + " A" + r + " " + r + " 0 0 0 " + endx + " " + endy);
        curve2.setAttribute("d", "M" + startx + "," + starty + " A" + r + " " + r + " 0 1 1 " + endx + " " + endy);

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
    return p1;
}

function showEdge(edge, time) {
    var path = $("path", edge);
    var pol = $("polygon", edge);
    var length = path[0].getTotalLength();
    return path.animate({
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
				})
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
		return path.animate({
        'stroke-dashoffset': length
    }, length / (length + 10) * time).promise().then(function() {
			$("text", edge).animate({"opacity": 0}, 220);
		});
	})
}

/*
	Convert NFAl to NFA by removing l-transitions
	(and updating accepting states and removing unreachable states)
*/
function animToNFAStart(FAobjs, queue) { // Starting animations: Rearrange and add accepting states
	if (FAobjs[1] == undefined || FAobjs[1].newedges == undefined) {
		$("#step_message").html("The automaton didn't contain any &lambda;-transitions. Continuing..");
		$("#step_message").delay(3000).promise().then(function() { // Show message for 3 seconds
			this.html("");
		})
    $("#FA").html(FAobjs[2].svg);
		queue.done.resolve();
    return;
	}

  var newedges = false;
  for (var i = 0; i < FAobjs[1].newedges.length; i++) {
    for (var symbol in FAobjs[1].newedges[i]) {
      FAobjs[1].newedges[i][symbol].forEach(function(val) {
        newedges = true;
      })
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
    $("#FA animate").remove(); // Delete the used animation objects
    replaceEdges(FAobjs, 0, queue);
  }

  if (FAobjs[1].newaccepting.length == 0) { // No new accepting states, skip that step
    if (!newedges) { // No new edges, no need to rearrange
      $("#FA").html(FAobjs[1].svg);
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
        $("#FA").html(FAobjs[1].svg);
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
      replaceLNewEdges(FAobjs[1]);
      moveo(FAobjs[1], FAobjs[2]).then(function() {
        queue.done.resolve();
      })
    })
    queue.notify("Rearrange for clarity")
  }
  else {
    queue.push(function() {
      var p1;
      for (var i = 0; i < FAobjs[1].unreachable.length; i++) {
        for (var symbol in FAobjs[1].edges[FAobjs[1].unreachable[i][0]]) {
          FAobjs[1].edges[FAobjs[1].unreachable[i][0]][symbol].forEach(function(val) {
            unshowEdge(val[1], 200);
          })
        }
        for (var j = 0; j < FAobjs[1].edges.length; j++) {
          for (var symbol in FAobjs[1].edges[j]) {
            FAobjs[1].edges[j][symbol].forEach(function(val) {
              if (val[0] == FAobjs[1].unreachable[i][0])
                unshowEdge(val[1], 200);
            })
          }
        }
        p1 = FAobjs[1].unreachable[i][1].delay(200).promise().then(function() {
          return this.animate({"opacity": 0}, 300).promise();
        })
      }
      $.when(p1).then(function() {
        queue.push(function() {
          replaceLNewEdges(FAobjs[1]);
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
	if (FAobj.edges[state]["0"] == undefined || FAobj.edges[state]["0"].size == 0) {
		replaceEdges(FAobjs, state+1, queue); // Doesnt have ledges, go to next state
		return;
	}
	FAobj.edges[state]["0"].forEach(function(val) {	// Mark lambda edges red to be removed in the next step
		var path = $("path", val[1]);
		var pol = $("polygon", val[1]);
		path.attr("stroke", "#ff0000");
		pol.attr("fill", "#ff0000");
		pol.attr("stroke", "#ff0000");
		$("text", val[1]).attr("fill", "#ff0000");
	});
	queue.push(function() {
		var p1;
		FAobj.edges[state]["0"].forEach(function(val) {
			p1 = unshowEdge(val[1], 1000); // Unshow the ledges
		})
		$.when(p1).then(function() {
			var p2;
			for (var symbol in FAobj.newedges[state]) {
				FAobj.newedges[state][symbol].forEach(function(val) {
					p2 = showEdge(val[1], 1000);
				})
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

    $("text", FAnew.svg).attr("visibility", "hidden"); // Hide all text temporarily
    var edges = $(".edge", FAnew);
    var states = $(".node", FAnew);
    return $("text", FAold.svg).animate({
        "opacity": 0
    }, 300).promise().then(function() {
        $("#FA").html(FAnew.svg);
        // Animate transform translate to new value
        var anim = document.createElementNS('http://www.w3.org/2000/svg', "animateTransform");
        var attrs = {
          attributeName: "transform",
          attributeType: "XML",
          type: "translate",
          begin: "indefinite",
          fill: "freeze",
          from: FAold.svg.children().attr("transform").match(/translate\((.*)\)/)[1],
          to: FAnew.svg.children().attr("transform").match(/translate\((.*)\)/)[1],
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
            for (var j = 0; j < $("ellipse", FAnew.states[i]).length; j++) {
                // Animate ellipses from old to new position
                var anim = document.createElementNS('http://www.w3.org/2000/svg', "animate");
                var attrs = {
                    attributeName: "cx",
                    attributeType: "XML",
                    begin: "indefinite",
                    dur: "1s",
                    fill: "freeze",
                    from: $("ellipse", FAold.states[newtoold[i]]).attr("cx"),
                    to: $("ellipse", FAnew.states[i]).attr("cx")
                };
                var anim2 = document.createElementNS('http://www.w3.org/2000/svg', "animate");
                var attrs2 = {
                    attributeName: "cy",
                    attributeType: "XML",
                    begin: "indefinite",
                    dur: "1s",
                    fill: "freeze",
                    from: $("ellipse", FAold.states[newtoold[i]]).attr("cy"),
                    to: $("ellipse", FAnew.states[i]).attr("cy")
                };
                for (var k in attrs)
                    anim.setAttribute(k, attrs[k]);
                for (var k in attrs2)
                    anim2.setAttribute(k, attrs2[k]);
                $("ellipse", FAnew.states[i])[j].appendChild(anim);
                $("ellipse", FAnew.states[i])[j].appendChild(anim2);
                anim.beginElement();
                anim2.beginElement();
            }
            for (var symbol in FAnew.edges[i]) {
                FAnew.edges[i][symbol].forEach(function(val) {
                    FAold.edges[newtoold[i]][symbol].forEach(function(val2) {
                        if (newtoold[val[0]] == val2[0]) {
                            moveEdge(val2[1], val[1])
                        }
                    })
                })
            }
        }
        moveEdge(FAold.start[0], FAnew.start[0]); // Also move starting edge
        return $("#FA svg").delay(1000).promise().then(function() {
					$("text", FAnew.svg).attr("visibility", "visible"); // Reshow text
					for (var i = 0; i < FAnew.edges.length; i++) { // Animate in text
						for (var symbol in FAnew.edges[i]) {
							FAnew.edges[i][symbol].forEach(function(val) {
								$("text", val[1]).css("opacity",0).animate({"opacity": 1}, 300);
							})
						}
						$("text", FAnew.states[i]).css("opacity",0).animate({"opacity": 1}, 300);
					}
				});
    })
}

function moveEdge(val2, val) { // Move edge from position val2 to position val
    $("path", val).css("stroke-dasharray", 0); // Set stroke-dasharray to 0 while animating to avoid invisible parts
    // Animating path requires both paths to have same amount of segments. Check difference and add empty segments if necessary
    var from = $("path", val2).attr("d");
    var to = $("path", val).attr("d");
    //var diff = (from.match(/,/g) || []).length - (to.match(/,/g) || []).length;
    var diff = from.split(/[\s,CMc]+/).length - to.split(/[\s,CMc]+/).length;
    if (diff % 6 != 0)
      console.log("??");
    if (diff > 0)
        to += "c0,0 0,0 0,0".repeat(diff / 6);
    else
        from += "c0,0 0,0 0,0".repeat(-diff / 6);
    var anim = document.createElementNS('http://www.w3.org/2000/svg', "animate");
    var attrs = {
        attributeName: "d",
        attributeType: "XML",
        begin: "indefinite",
        dur: "1s",
        fill: "freeze",
        from: from,
        to: to
    };
    for (var k in attrs)
        anim.setAttribute(k, attrs[k]);
    $("path", val)[0].appendChild(anim);
    anim.beginElement();
    // Animate path polygons (arrow points) from old to new position
    var anim2 = document.createElementNS('http://www.w3.org/2000/svg', "animate");
    var attrs2 = {
        attributeName: "points",
        attributeType: "XML",
        begin: "indefinite",
        dur: "1s",
        fill: "freeze",
        from: $("polygon", val2).attr("points"),
        to: $("polygon", val).attr("points")
    };
    for (var k in attrs)
        anim2.setAttribute(k, attrs2[k]);
    $("polygon", val)[0].appendChild(anim2);
    anim2.beginElement();
    $("path", val).delay(1000).promise().then(function() {
      this.css("stroke-dasharray", this[0].lengthsaved); // Set stroke-dasharray back to original value
    })
}
