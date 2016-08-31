/*
Copyright (c) 2016 KeeeX SAS 

This is an open source project available under the MIT license.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
*/
var versionMapDataAccess = require('./js/versionMapDataAccess.js').versionMapDataAccess;
var manifest = require('./package.json');
var JSZip = require("./node_modules/jszip");
var fs = require("./node_modules/fs-extra");
var path = require("./node_modules/path");
var encoder = require('./js/encoder.js').Encoder;
var utils = require('./js/utils.js').utils;
var kxapi = require('keeex-api');
var async = require('async');

//SVG CONSTANTS
var divSvg;
var svgMain;
var svgView;

var main_width;
var main_height;
var v_margin;
var h_margin_left;
var h_margin_right;

var detail_width;
var detail_h_margin;
var detail_v_margin;

var circle_radius;
var circle_stroke_width;
var subcircle_radius;
var subcircle_strokewith;
var subcircle_newradius;
var avatar_size;
var link_stroke_highlighted;
var link_stroke_unhighlighted;

var reference_circle_radius;
var reference_svg_width;
var reference_svg_height;

var referenceto_circle_radius;

var info_width;
var info_height;
var info_radius;
var info_line;

var version_charge;
var reference_charge;

var view_width;
var view_height;

var maxRefstoAllowed;
var refstoOffset;

var apiToken;

//NAVIGATION
function Navigation() {
	this.previous = null;
	this.idx = null;
	this.next = null;
};

var navigationHistories;

//D3 VARIBALES
var node_count;
var colors = d3.scale.category20().domain(d3.range(20));


var max_level;
var min_level;
var level_distance;

//MENU ITEMS
var popupMenu =
	{
		isOpen: false,
		data: null,
		svg_shape: null,
		menuItemSize: 24,
		menuItems:
		[
			{
				description: "View",
				icon: "images/view.svg",
				action: function (d) {
					populateMap(d.data.idx, true);
				}
			},
			{
				description: "Select",
				icon: "images/agree.svg",
				action: function (d) {
					if (!d.selected) {
						d.selected = true;
						//add to selected_nodes
					}
					else {
						d.selected = !d.selected;
					}

					if (d.selected) {
						selected_nodes.push(d);
					}
					else {
						//remove from selected_nodes
						for (var i = 0; i < selected_nodes.length; i++) {
							if (selected_nodes[i].id == d.id) {
								selected_nodes.splice(i, 1);
								break;
							}
						}
					}
					tick();
				}
			},
			{
				description: "Ref",
				icon: "images/ref.svg",
				action: function (d) {
					if (!d.showReferences) {
						d.showReferences = true;
					}
					else {
						d.showReferences = !d.showReferences;
					}
					if (d.showReferences)
						showReferences(d);
					else
						hideReferences(d);
				}
			},
			/*{
				description : "Clean",
				icon : "images/clean.svg",
				action : function(d){
					
				}
			},*/
			{
				description: "Zip",
				icon: "images/zip.svg",
				action: function (d) {
					var idxs = [];
					//in case of right click
					if (!d.selected) idxs.push(d.data.idx);

					for (var i = 0; i < selected_nodes.length; i++) {
						idxs.push(selected_nodes[i].data.idx);
					}
					console.log('zip called');
					versionMapDataAccess.getTopicLocations(idxs, function (error, result) {
						if (!error) {
							console.log('inside get topic localtion no error');
							var files = [];
							for (var i = 0; i < result.length; i++) {
								files.push(result[i].location[0]);
							}
							//open save dialog
							var chooser = document.querySelector("#fileDialog");
							chooser.addEventListener("change", function (evt) {
								addToZip(files, null, this.value, function (error) {
									if (!error) {
										showAlert("Save success!");
									}
									else {
										showAlert("Error occurred");
									}
								});
							}, false);
							chooser.click();
						}
						else {
							console.log('inside get topic localtion ERROR');
							handleError(new Error('Cannot get location of topics'));
						}
					});
				}
			}
		]
	}

//MOUSE EVENT VARIABLES
var mousedown;
var mouseover;

var mouse_over_node = null,
	mouse_click_node = null,
	mouse_right_node = null;

var selected_nodes = [];

//DRAW REGION VARIABLES
var svgMain;
var svgView;
var infogroup;

//LINKS AND NODES
var links;
var nodes;
var force;
var doc_path;
var doc_circle;
var refsto_node;
//var refsto_path;
var refsto_data;
var currentIdx;

//DETAIL VARIABLES
var preview_extension = [".jpg", ".png", ".bmp"];
var currentUser;

//SVG DISPLAY REGION
function initConstants() {

	divSvg = document.getElementById('divSvg');
	main_width = divSvg.clientWidth - 20;
	main_height = divSvg.clientHeight * 1.5;

	v_margin = 100;
	h_margin_left = 100;
	h_margin_right = 100;

	detail_width = 0;
	detail_h_margin = 10;
	detail_v_margin = 10;

	circle_radius = 25;
	circle_stroke_width = 3;
	subcircle_radius = 15;
	subcircle_strokewith = 50;
	subcircle_newradius = circle_radius + 2 * circle_stroke_width + subcircle_strokewith / 2;
	avatar_size = 30;
	link_stroke_highlighted = 3;
	link_stroke_unhighlighted = 2;

	reference_circle_radius = 15;
	reference_svg_width = 100;
	reference_svg_height = 100;

	referenceto_circle_radius = 10;

	info_width = 240;
	info_height = 80;
	info_radius = 10;
	info_line = 17;

	version_charge = -3000;
	reference_charge = -500;

	view_width = main_width - h_margin_left - h_margin_right - detail_width;
	view_height = main_height - 2 * v_margin;

	maxRefstoAllowed = view_height / (referenceto_circle_radius * 2) - 2;
	refstoOffset = [-50, 0];
}

function initMap() { //call once
	var params = {};
	kxapi.getToken("Version explorer", function(error, response){		
		if (error) {
			showAlert('Cannot connect to the local API. Terminating...', function () {
				var window = global.window.nwDispatcher.requireNwGui().Window.get();
				window.close(true);
			});
		}
		else {
			kxapi.getMine(function (error, result) {
				if (error || !result) {
					showAlert('Error calling local API. Terminating...', function () {
						var window = global.window.nwDispatcher.requireNwGui().Window.get();
						window.close(true);
					});
				}
				else {
					currentUser = result;
					initConstants();
					svgMain = d3.select('#divSvg')
						.append('svg')
						.attr('id', 'svgMain')
						.attr('width', main_width)
						.attr('height', main_height)
						.on('click', function (e) {
							if (mouse_click_node) {
								if (mouse_click_node.mouseclick) {
									hideNodeDetail();
									unstyleNode(mouse_click_node);
									mouse_click_node.mouseclick = false;
								}

								if (mouse_click_node.rightclick) {
									unpopulateMenu(mouse_click_node);
									mouse_click_node.rightclick = false;
									//unstyle right clicked node
									unstyleNode(mouse_click_node);
								}
				
								//deselect all selected
								if (selected_nodes) {
									for (var i = 0; i < selected_nodes.length; i++) {
										if (selected_nodes[i].selected) {
											selected_nodes[i].selected = false;
											unstyleNode(selected_nodes[i]);
										}
									}
									selected_nodes = [];
								}
							}
						});

					svgView = svgMain.append('svg')
						.attr('id', 'svgView')
						.attr('x', h_margin_left)
						.attr('y', v_margin)
						.attr('width', view_width)
						.attr('height', view_height)
						.attr('overflow', "visible");
				}
			});
		}
	});
}

function clearMap() {
	svgView.selectAll("*").remove();
}

//CLOSE APP FUNCTION BY CLOSING THE WINDOW
function exit() {
	var gui = require('nw.gui');
	gui.Window.get().close();
}

function navigateBack() {
	if (navigationHistories && navigationHistories.previous) {
		navigationHistories = navigationHistories.previous;
		populateMap(navigationHistories.idx, false);
	}
}

function navigateForward() {
	if (navigationHistories && navigationHistories.next) {
		navigationHistories = navigationHistories.next;
		populateMap(navigationHistories.idx, false);
	}
}

function saveHistory(idx) {
	if (!navigationHistories) {
		navigationHistories = new Navigation();
		navigationHistories.idx = idx;
	}
	else {
		if (idx != navigationHistories.idx) {
			var nav = new Navigation();
			nav.previous = navigationHistories;
			nav.idx = idx;
			navigationHistories.next = nav;
			navigationHistories = nav;
		}
	}
}

//INIT FUNCTION
function populateMap(idx, history) {
	//test API's availability
	versionMapDataAccess.getReady(function (error, result) {
		if (error) {
			handleError(error);
			console.log(error);
		}
		else {
			versionMapDataAccess.getVersionMap(idx, function (error, l, n) {
				console.log("getVersionMap callback", error, l, n);
				if (error) {
					handleError(error);
					console.log(error);
				}
				else {
					if (history) saveHistory(idx);
					currentIdx = idx;
					links = l;
					nodes = n;
					node_count = nodes.length;

					//CALCULATE LEVEL DISTANCE
					if (nodes[0]) {
						min_level = nodes[0].level;
						max_level = nodes[0].level;
					}
					else {
						console.log("problem");
					}
					for (var i = 0; i < node_count; i++) {
						if (nodes[i].level > max_level) max_level = nodes[i].level;
						if (nodes[i].level < min_level) min_level = nodes[i].level;
					}
					level_distance = max_level - min_level;

					//display idx
					document.getElementById("divIdx").innerHTML = idx.substring(0, 11);
					//update navigation pisibility
					updateNavigationButtons();
					clearMap();
					reloadMap();
				}
			});
		}
	});
}


function refreshUI() {
	initConstants();
	svgView
		.attr('x', h_margin_left)
		.attr('y', v_margin)
		.attr('width', view_width)
		.attr('height', view_height);
	if (nodes) update();
}

function reloadMap() {
	node_count = nodes.length;
	
	//INIT FORCE LAYOUT
	force = d3.layout.force()
		.nodes(nodes)
		.links(links)
		.size([view_width, view_height])
		.on('tick', tick);

	//DEFINE ARROW MARKERS
	svgView.append('defs').append('marker')
		.attr('id', 'end-arrow')
		.attr('viewBox', '0 -5 10 10')
		.attr('refX', 6)
		.attr('markerWidth', 5)
		.attr('markerHeight', 5)
		.attr('orient', 'auto')
		.append('path')
		.attr('d', 'M0,-5L10,0L0,5')
		.attr('fill', '#000');

	svgView.append('defs').append('marker')
		.attr('id', 'start-arrow')
		.attr('viewBox', '0 -5 10 10')
		.attr('refX', 4)
		.attr('markerWidth', 5)
		.attr('markerHeight', 5)
		.attr('orient', 'auto')
		.append('path')
		.attr('d', 'M10,-5L0,0L10,5')
		.attr('fill', '#000');

	doc_path = svgView.append('g').selectAll('path');
	doc_circle = svgView.append('g').selectAll('g');
	
	//show references of main node
	for (var i = 0; i < node_count; i++) {
		if (nodes[i].isMain) {
			//show references from main node
			popupMenu.menuItems[2].action(nodes[i]);
			break;
		}
	}
	update();
  
	//START THE FORCE MODEL
	force.start();
}

function update() {
	node_count = nodes.length;
	force
		.linkDistance(function (d) { return d.type == "version" ? view_height / (level_distance + 2) : view_height * 0.5 / (level_distance + 2); })
		.charge(function (d) { return d.type == "version" ? version_charge : reference_charge });
	
	// REFRESH DATA
	doc_circle = doc_circle.data(nodes, function (d) { return d.id; });
	doc_path = doc_path.data(links, function (d) {
		return d.name;
	});
	
	// ADD PATHS
	doc_path.enter().append('path')
		.attr('class', function (d) { return "link" + " " + d.type; })
		.style('marker-start', function (d) {
			return d.left ? 'url(#start-arrow)' : '';
		})
		.style('marker-end', function (d) {
			return d.right ? 'url(#end-arrow)' : '';
		})
		.style('stroke', function (d) { return d.source.id ? colors(d.source.id) : colors(d.source); })
		.style('stroke-width', function (d) {
			return d.highlighted ? link_stroke_highlighted : link_stroke_unhighlighted;
		});
		
	// ADD CIRCLES
	var g = doc_circle.enter().append('g');
	//show node's filename  
	g.append('text')
		.attr('x', function (d) { return d.type == "version" ? circle_radius + 5 : reference_circle_radius + 5; })
		.attr('y', 0)
		.attr('class', 'filename')
		.style('transform', function (d) { return d.type == "version" ? "none" : "rotate(90deg)"; })
		.text(function (d) { return d.data ? encoder.htmlDecode(d.data.name) : "" });
		
	//show node's author avatar
	g.append('image')
		.attr('xlink:href', function (d) {
			//load the image
			return d.author == null ? "" : d.author.avatar == null ? "" : ("file:///" + d.author.avatar);
		})
		.attr('x', -circle_radius - avatar_size)
		.attr('y', circle_radius)
		.attr('width', avatar_size)
		.attr('height', avatar_size)
		.call(force.drag);
		
	//--add circle to display the document
	g.append('circle')
		.attr('class', 'node')
		.attr('r', function (d) { return d.type == "version" ? circle_radius : reference_circle_radius; })
		.style('fill', function (d) {
			if (d.type == "version")
				return colors(d.id);
			else
				return "#ffffff";
		})
		.style('stroke', function (d) {
			return colors(d.id);
		})
		.style('stroke-width', circle_stroke_width)
		.on('mousedown', function (d) {

		})
		.on('mouseup', function (d) {

		})
		.on('click', function (d) {

			//close menu if opened
			if (popupMenu.isOpen) {
				unpopulateMenu(mouse_click_node);
			}

			if (mouse_click_node && d != mouse_click_node) {
				mouse_click_node.mouseclick = false;
				hideInfo(mouse_click_node);
				unstyleNode(mouse_click_node);
			}

			mouse_click_node = d;

			if (!d.mouseclick) {
				d.mouseclick = true;
			}
			else {
				d.mouseclick = !d.mouseclick;
			}

			if (d.mouseclick) {
				displayNodeDetail(d);
				hideInfo(d);
			}
			else {
				hideNodeDetail(d);
				showInfo(d);
			}
			d3.event.stopPropagation();
		})
		.on('mouseenter', function (d) {
			d.mouseover = true;
			mouse_over_node = d;
			highlightLink(d);
			styleNode(d);
			//DISPLAY INFO
			if (!d.rightclick && !d.mouseclick) {
				showInfo(d);
			}
		})
		.on('mouseleave', function (d) {
			d.mouseover = false;
			unhighlightLink(d);
			//REMOVE INFO
			hideInfo(d);

			if (!d.rightclick && !d.mouseclick && !d.selected) {
				unstyleNode(d);
			}
			mouse_over_node = null;
		})
		.on('contextmenu', function (d) {
			//hide any preopened menu
			if (popupMenu.isOpen) {
				unpopulateMenu(mouse_click_node);
			}

			if (mouse_click_node && d != mouse_click_node) {
				//unstyle if previous is not in selected nodes
				if (!mouse_click_node.selected) {
					unstyleNode(mouse_click_node);
					mouse_click_node.mouseclick = false;
				}
			}

			mouse_click_node = d;
			if (!d.rightclick)
				d.rightclick = true;
			else
				d.rightclick = !d.rightclick;

			if (d.rightclick) {
				hideInfo(d);
				populateMenu(d);
			}
			else {
				if (!d.mouseclick) showInfo(d);
				unpopulateMenu(d);
			}
		});
	//--show the node on which we performed the search
	g.append('text')
		.attr('x', 0)
		.attr('y', 5)
		.attr('class', 'id')
		.text(function (d) { return d.isMain ? 'x' : ''; });

	doc_circle.exit().remove();
	doc_path.exit().remove();

	force.start();
}

function updateNavigationButtons() {
	if (navigationHistories) {
		var btNavigationBack = document.getElementById("btNavigationBack");
		var btNavigationForward = document.getElementById("btNavigationForward");

		btNavigationBack.disabled = !navigationHistories.previous;
		btNavigationForward.disabled = !navigationHistories.next;
	}
}

function styleNode(d) {
	d.styled = true;
	tick();
}

function unstyleNode(d) {
	d.styled = false;
	tick();
}

function highlightLink(d) {
	for (var i = 0; i < links.length; i++) {
		if (links[i].source == d) {
			if (!links[i].highlighted) {
				links[i].highlighted = true;
			}
		}
	}
	tick();
	//update();
}

function unhighlightLink(d) {
	for (var i = 0; i < links.length; i++) {
		if (links[i].source == d) {
			links[i].highlighted = false;
		}
	}
	tick();
	//update();
}
	
//THIS FUNCTION IS CALLED AUTOMATICALLY TO UPDATE THE GRAPH
function tick() {
	//UPDATE PATHS
	doc_path
		.attr('d', function (d) {
			var deltaX = d.target.x - d.source.x,
				deltaY = d.target.y - d.source.y,
				dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
				normX = deltaX / dist,
				normY = deltaY / dist,
				sourcePadding = circle_radius + 10,
				targetPadding = d.type == "version" ? circle_radius + 10 : reference_circle_radius + 10,
				sourceX = d.source.x + (sourcePadding * normX),
				sourceY = d.source.y + (sourcePadding * normY),
				targetX = d.target.x - (targetPadding * normX),
				targetY = d.target.y - (targetPadding * normY);
			return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
		})
		.style('stroke-width', function (d) {
			return d.highlighted ? link_stroke_highlighted : link_stroke_unhighlighted;
		});
	
	//UPDATE INFOGROUP TO NEW POSITION
	if (infogroup && mouse_over_node) {
		infogroup
			.attr('transform', 'translate(' + mouse_over_node.x + ',' + mouse_over_node.y + ')');
	}
	
	//UPDATE MENU POSITION
	if (popupMenu.isOpen) {
		popupMenu.svg_shape
			.attr('transform', 'translate(' + popupMenu.data.x + ',' + popupMenu.data.y + ')');
	}
	//UPDATE CIRCLES
	doc_circle
		.attr('transform', function (d) {
			return 'translate(' + d.x + ',' + d.y + ')';
		})
		.attr('cx', function (d) { return d.x = Math.max(circle_radius, Math.min(view_width - circle_radius, d.x)); })
		.attr('cy', function (d) { return d.y = Math.max(circle_radius, Math.min(view_height - circle_radius, d.y)); })
		.attr('class', function (d) {
			return d.styled || d.selected ? "node hover" : "node";
		})
		.style('fill', function (d) {
			return d.styled || d.selected ? "none" : d.type == "version" ? colors(d.id) : "none";
		});
	
	/*
	if (refsto_node && refsto_path){
		refsto_path
			.attr('d', function(){
				return "M " + referenceto_circle_radius + " " + refsto_data.length*2*referenceto_circle_radius 
				+ " L " + referenceto_circle_radius + " " + view_height
				+ " L " + refsto_node.x + " " + view_height
				+ " L " + refsto_node.x + " " + (refsto_node.y+circle_radius + 10);
			});
	}*/
	
	//FIX CIRCLES'S Y COORDINATES
	if (node_count == 1) {
		nodes[0].x = view_width / 2;
		nodes[0].y = view_height / 2;
	}
	else {
		for (var i = 0; i < node_count; i++) {
			if (nodes[i].type == "version") {
				/*var created_time = new Date(nodes[i].data.CreatedDate);
				nodes[i].y = view_height*(created_time-last_created_time)/distance_created_time;
				//let the circles inside the svg
				if (nodes[i].x<0) nodes[i].x=0;
				if (nodes[i].x>view_width) nodes[i].x=view_width;*/
				nodes[i].y = (nodes[i].level - min_level + 1) * view_height / (level_distance + 2);
			}
		}
	}
}

//THIS FUNCTION SHOW THE REFERECES TO CIRCLES
function showReferencesTo(d) {
	refsto_node = d;
	versionMapDataAccess.getReferencesTo(d.data.idx, function (error, result) {
		if (!error) {
			hideReferencesTo();		
			
			//check whether there will be too many documents
			var maxReached;
			refsto_data = [];
			for (var i = 0; i < result.length; i++) {
				if (i < maxRefstoAllowed)
					refsto_data.push({ id: i, topic: result[i] });
				else {
					maxReached = true;
					break;
				}
			}

			var test_circles = svgView.append('g')
				.attr('id', "refsto_container");
			
			/*refsto_path = test_circles.append('path')
				.attr('class', "refsto")
				.attr('d', function(){
					return "M " + referenceto_circle_radius + " " + refsto_data.length*2*referenceto_circle_radius 
					+ " L " + referenceto_circle_radius + " " + view_height
					+ " L " + d.x + " " + view_height
					+ " L " + d.x + " " + (d.y + circle_radius + 10);
			});*/


			test_circles.append('text')
				.attr('class', "refsto")
				.text("Related documents")
				.attr('x', refstoOffset[0] - 2 * referenceto_circle_radius)
				.attr('y', refstoOffset[1] - 20);

			if (maxReached) {
				test_circles.append('text')
					.attr('class', "refsto")
					.text("..." + Math.round(result.length - maxRefstoAllowed) + " more")
					.attr('x', refstoOffset[0] - 2 * referenceto_circle_radius)
					.attr('y', refstoOffset[1] + maxRefstoAllowed * 2 * referenceto_circle_radius + 30);
			}

			test_circles = test_circles.selectAll('circle');
			test_circles = test_circles.data(refsto_data);
			var g = test_circles.enter().append('g')
				.attr('class', "refsto");
			g.append('circle')
				.attr('class', "circle")
				.attr('r', referenceto_circle_radius)
				.style('fill', function (d) { return colors(d.id); })
				.attr('cx', refstoOffset[0] - referenceto_circle_radius)
				.attr('cy', function (d) { return refstoOffset[1] + d.id * 2 * referenceto_circle_radius; });

			g.append('text')
				.attr('class', "text")
				.attr('x', refstoOffset[0] + 10)
				.attr('y', function (d) { return refstoOffset[1] + d.id * 2 * referenceto_circle_radius + 5; })
				.text(function (d) { return encoder.htmlDecode(d.topic.name); })
				.on('click', function (d) {
					populateMap(d.topic.idx, true);
				});
			
			//call tick to update
			tick();
		}
	});
}

function hideReferencesTo() {
	//remove old refsto
	d3.selectAll('#refsto_container').remove();
}

//THIS FUNCTION ADD THE REFERENCES
function showReferences(d) {
	node_count = nodes.length;
	//get array of references
	var refs = [];

	// HERE
	if (d.data && d.data.references) {
		for (var i = 0; i < d.data.references.length; i++) {
			refs.push(d.data.references[i]);
		}
	}

	if (refs.length > 0) {
		versionMapDataAccess.getTopics(refs, function (error, result) {
			if (!error) {
				d.ref_nodes = [];
				for (var i = 0; i < result.length; i++) {
					//remove reference to self
					if (result[i]) {
						if (result[i].idx != d.data.idx) {
							//check if this reference is already in nodes
							var existed = false;
							var node;
							for (var j = 0; j < nodes.length; j++) {
								if (result[i].idx == nodes[j].data.idx) {
									existed = true;
									node = nodes[j];
									break;
								}
							}

							if (!existed) {
								var pos = polarToCartesian(d.x, d.y, 100, i * 360 / result.length);
								node = {
									id: nodes.length,
									data: result[i],
									isMain: false,
									type: "references",
									//initial position
									x: pos[0],
									y: pos[1],
									level: d.level + 1
								};
								nodes.push(node);
							}
							
							//add an array of nodes point to this node
							if (!node.to_nodes) node.to_nodes = [];
							
							//avoid adding link to previous version
							if (node.type == "references") {
								var link = {
									name: d.id + "to" + node.id,
									source: d,
									target: node,
									left: false,
									right: true,
									type: "references"
								}
								links.push(link);
								node.to_nodes.push(d);
								d.ref_nodes.push(node);
							}
						}
					}
				}
				update();
			}
			else {
				handleError(error);
			}
		});
	}
}

//THIS FUNCTION HIDE THE REFERENCES
function hideReferences(d) {
	if (d.ref_nodes) {
		for (var i = 0; i < d.ref_nodes.length; i++) {
			removeReferenceNodes(d, d.ref_nodes[i]);
		}
		d.ref_nodes = null;
		update();
	}
	
	//remove recusively child nodes
	function removeReferenceNodes(d_parent, d) {
		//remove the link
		for (var i = 0; i < links.length; i++) {
			if (links[i].target == d && links[i].source == d_parent) {
				links.splice(i, 1);
				break;
			}
		}
		
		//remove parent from to_nodes in d
		d.to_nodes.splice(d.to_nodes.indexOf(d_parent), 1);
		
		//check if there are still nodes that point to this node
		if (d.to_nodes.length == 0) {
			//remove the node and its ref_node
			if (d.ref_nodes) {
				for (var i = 0; i < d.ref_nodes.length; i++) {
					removeReferenceNodes(d, d.ref_nodes[i]);
				}
			}
			nodes.splice(nodes.indexOf(d), 1);
		}
	}
}

//THIS FUNCTION SHOW THE POPUPMENU OF NODE
function populateMenu(d) {
	//associate data
	popupMenu.data = d;
	popupMenu.isOpen = true;
	
	//check if menu had been created 
	//if (!popupMenu.svg_shape)
	{
		popupMenu.svg_shape = svgView.append('g').attr('id', "popupmenu").attr('class', "menuitem");
		for (var i = 0; i < popupMenu.menuItems.length; i++) {
			//--add the mini circle for effect
			popupMenu.svg_shape.append('circle')
				.attr('class', "subcircle")
				.attr('r', subcircle_radius);
			popupMenu.svg_shape.append('path')
				.attr('id', i)
				.attr('class', "menuitem")
				.attr('d', getPathData(0, 0, subcircle_newradius + subcircle_strokewith / 2, subcircle_newradius - subcircle_strokewith / 2, i * (360 / popupMenu.menuItems.length), (i + 1) * (360 / popupMenu.menuItems.length)))
				.on('mouseover', function () {
					var d = popupMenu.data;
					//menuitem have focus
					if (d.rightclick) {
						var c = d3.select(this);
						c.style('fill', "#ffffff")
							.style('stroke', colors(d.id));
						var descText = popupMenu.svg_shape.select("text.menuitemdesc");
						descText.text(popupMenu.menuItems[c.attr('id')].description);
					}
				})
				.on('mouseout', function () {
					var d = popupMenu.data;
					//menuitem lost focus
					if (d.rightclick) {
						var c = d3.select(this);
						c.style('fill', "none")
							.style('stroke', "#ffffff");
						var descText = popupMenu.svg_shape.select("text.menuitemdesc");
						descText.text("");
					}
				})
				.on('click', function () {
					var d = popupMenu.data;
					if (d.rightclick) {
						d.rightclick = !d.rightclick;
						//hide desc text
						popupMenu.menuItems[d3.select(this).attr('id')].action(d);
						var descText = popupMenu.svg_shape.select("text.menuitemdesc");
						descText.text("");
						//menuitem lost focus
						var c = d3.select(this);
						c.style('fill', "none")
							.style('stroke', "#ffffff");
						//center circle lost focus
						unstyleNode(d);
						//hide menu
						unpopulateMenu(d);
					}
					d3.event.stopPropagation();
				});
				
			//get image position
			var position = polarToCartesian(0, 0, subcircle_newradius, (i + 0.5) * 360 / popupMenu.menuItems.length);
			popupMenu.svg_shape.append('image')
				.attr('xlink:href', function () {
					return popupMenu.menuItems[i].icon;
				})
				.attr('x', position[0] - popupMenu.menuItemSize / 2)
				.attr('y', position[1] - popupMenu.menuItemSize / 2)
				.attr('width', popupMenu.menuItemSize)
				.attr('height', popupMenu.menuItemSize)
				.style('pointer-events', "none");
			popupMenu.svg_shape.append('text')
				.attr('x', 0)
				.attr('y', 0)
				.attr('class', "menuitemdesc");
		}
	}
	
	//ANIMATE SUBCIRCLE
	var subcircle = popupMenu.svg_shape.select("circle.subcircle");
	subcircle
		.attr('class', "subcircle mousedown")
		.style('stroke', colors(popupMenu.data.id))
		.attr('r', subcircle_newradius);
	
	//MOVE MENU IF TO NEW POSITION
	popupMenu.svg_shape
		.attr('transform', 'translate(' + popupMenu.data.x + ',' + popupMenu.data.y + ')');
}

//THIS FUNCTION HIDE THE POPUPMENU
function unpopulateMenu(d) {
	if (d) {
		popupMenu.isOpen = false;
		d.rightclick = false;
		d3.select("#popupmenu").remove();
	}
}

//THIS FUNCTION SHOWES THE DETAIL INFO OF A NODE
function showInfo(d) {
	if (d.data) {
		infogroup = svgView.append('g').attr('id', "info").attr('class', "info");
		infogroup.append('rect')
			.attr('class', "info")
			.style('fill', colors(d.id))
			.attr('x', -circle_radius - info_width)
			.attr('y', -circle_radius - info_height)
			.attr('rx', info_radius)
			.attr('ry', info_radius)
			.attr("width", info_width)
			.attr("height", info_height);
		infogroup.append('text')
			.attr('class', "info")
			.attr('x', -circle_radius - info_width + 10)
			.attr('y', -circle_radius - info_height + info_line)
			.text("idx: " + d.data.idx.substring(0, 11));
		infogroup.append('text')
			.attr('class', "info")
			.attr('x', -circle_radius - info_width + 10)
			.attr('y', -circle_radius - info_height + 2 * info_line)
			.text("Date created: " + getDateFormatted(d.data.creationDate));
		infogroup.append('text')
			.attr('class', "info")
			.attr('x', -circle_radius - info_width + 10)
			.attr('y', -circle_radius - info_height + 3 * info_line)
			.text("Author: " + (d.author == null ? "" : d.author.name));

		infogroup
			.attr('transform', 'translate(' + d.x + ',' + d.y + ')');
	}
}

//THIS FUNCTION HIDE THE DETAIL INFO OF A NODE
function hideInfo(d) {
	d3.select("#info").remove();
	infogroup = null;
}

//THIS FUNCTION DISPLAY THE DETAIL OF A NODE IN THE RIGHT PANEL
function displayNodeDetail(d) {

	showReferencesTo(d);

	var div_detail = document.getElementById("div_detail");
	// clear previous elements
	div_detail.innerHTML = "";
	
	// DETAILS Box
	var infos = [];
	infos.push("name: " + d.data.name);
	infos.push("idx: " + d.data.idx);
	infos.push("Created date: " + getDateFormatted(d.data.creationDate));

	var panel_detail_info = createPanel("Details", infos);
	
	// SHARE AND AGREEMENTS box
	var panel_detail_agree = createPanel("Shared&nbsp;with");

	versionMapDataAccess.getSharedUsers(d.data.idx, function (error, users) {
		console.log("getSharedUsers", users)
		if (!error) {
			if (users.length > 0) {

				// Agreements
				versionMapDataAccess.getAgreement(d.data.idx, function (error, result) {
					if (!error) {
						var contents = [];
						for (var i = 0; i < users.length; i++) {
							var found = false;
							for (var j = 0; j < result.length; j++) {
								if (result[j] == users.shared[i].profileIdx) {
									found = true;
									break;
								}
							}

							var div = document.createElement('div');
							div.setAttribute('class', "detail_shared_avatar" + (found ? " agreed" : ""));
							var img_detail_agree_avatar = document.createElement('img');
							img_detail_agree_avatar.setAttribute('class', "detail_shared_avatar");
							img_detail_agree_avatar.setAttribute('src', users[i] == null ? " " : users[i].avatar);
							img_detail_agree_avatar.setAttribute('title', users[i] == null ? " " : users[i].name);
							div.appendChild(img_detail_agree_avatar);
							contents.push(div);
						}
						panel_detail_agree.updateContent(contents);
					}
					else {
						handleError(error);
					}
				});
			}
		}
		else {
			handleError(error);
		}

	});
	
	
	// COMMENTS box
	var panel_detail_comment = createPanel("Comments");
	
	versionMapDataAccess.getComments(d.data.idx, function (error, result) {
		console.log("comments", error, result);
		if (!error) {
			var contents = [];

			async.each(result, function(comment, callback){
				versionMapDataAccess.getAuthor(comment.idx, function(err, res){
					if(!err){
						var div_comment = createComment(comment.name, res.avatar, res.name);
						contents.push(div_comment);
					}

					callback();
				})
			}, function(err){
				if(!err)
					panel_detail_comment.updateContent(contents);
			});
		}
		else {
			handleError(error);
		}
	});

	
	// SHOW PREVIEW
	var panel_detail_preview = createPanel("Preview");

	versionMapDataAccess.getTopicLocations([d.data.idx], function (error, result) {
		if (result && result[0]) {
			var contents = [];
			var location = result[0].location[0];// result[0].location[0];
		
			var div_file_preview_content = document.createElement('div');
			div_file_preview_content.setAttribute('class', "detail_preview");

			var extension = path.extname(location);
			if (extension && preview_extension.indexOf(extension.toLowerCase()) >= 0) {
				var img_preview = document.createElement('img');
				img_preview.setAttribute('class', "detail_preview");
				img_preview.setAttribute('src', location);
				div_file_preview_content.appendChild(img_preview);
			}
			else {
				div_file_preview_content.innerHTML = "preview not available";
			}
			
			//contents.push(div_file_preview);
			contents.push(div_file_preview_content);
			panel_detail_preview.updateContent(contents);
		}
	});
	
	//add these panels
	div_detail.appendChild(panel_detail_info.dom);
	div_detail.appendChild(panel_detail_agree.dom);
	div_detail.appendChild(panel_detail_comment.dom);
	div_detail.appendChild(panel_detail_preview.dom);

}

function displaySearchResult(filter) {
	versionMapDataAccess.getSearchResult(filter, function (error, topics) {
		if (error) {
			handleError(error);
		}
		else {
			showSearchResultList(topics);
		}
	});
}

function showSearchResultList(topics) {
	//hideSearchResultList();
	var width = document.getElementById("txtSearch").style.width;
	var div_list = document.getElementById("divSearchResult");
	div_list.setAttribute('class', "search_list visible");
	div_list.setAttribute('style', "width:" + width + "px;");

	var divSearchContent = document.getElementById("divSearchContent");
	divSearchContent.innerHTML = "";
	if (!topics || topics.length == 0) {
		var div_item = document.createElement('div');
		div_item.setAttribute('class', "search_item_noresult");
		div_item.innerHTML = "No result";
		div_item.addEventListener('click', function (evt) {
			var txtSearch = document.getElementById("txtSearch");
			txtSearch.value = "";
			hideSearchResultList();
			txtSearch.focus();
		});
		divSearchContent.appendChild(div_item);
	}
	else {
		for (var i = 0; i < topics.length; i++) {
			var div_item = document.createElement('div');
			div_item.setAttribute('class', "search_item");
			var a_mainname = document.createElement('a');
			a_mainname.setAttribute('class', "search_mainname");
			a_mainname.innerHTML = topics[i].name;
			a_mainname.topicidx=topics[i].idx;

			var div_idx = document.createElement('div');
			div_idx.setAttribute('class', "search_mainidx");
			div_idx.topicidx=topics[i].idx;
			div_idx.innerHTML = topics[i].idx.substring(0,11);
			div_item.appendChild(a_mainname);
			div_item.appendChild(div_idx);

			a_mainname.addEventListener('click', function (evt) {
				evt.target.className = "search_mainname visited";
				populateMap(evt.target.topicidx, false);
				hideNodeDetail();
			});

			divSearchContent.appendChild(div_item);
		}
	}
}

function hideSearchResultList() {
	var div_list = document.getElementById("divSearchResult");
	div_list.setAttribute('class', "search_list collapsed");
	var txtSearch = document.getElementById("txtSearch");
	txtSearch.value = "";
}

function hideNodeDetail() {
	//display reftos of node that has currentidx
	hideReferencesTo();
	var divDetail = document.getElementById("div_detail");
	divDetail.innerHTML = "";
}

//=====================================UTIL FUNCTIONS

function showAlert(message, callback) {
	var divHider = document.getElementById('divHider');
	showElement(divHider);
	var divDialog = document.getElementById('divDialog');
	var divDialogTitleBar = document.getElementById('divDialogTitleBar');
	var divDialogContent = document.getElementById('divDialogContent');
	var btDialogOK = document.getElementById('btDialogOK');
	var btDialogCancel = document.getElementById('btDialogCancel');

	showElement(btDialogOK);
	btDialogCancel.setAttribute('style', 'display : none');
	divDialogTitleBar.innerHTML = "Alert";
	divDialogContent.innerHTML = message;
	btDialogOK.addEventListener('click', function _func(evt) {
		hideElement(btDialogOK);
		hideElement(divDialog);
		//if (!requireHider) 
		hideElement(divHider);
		btDialogOK.removeEventListener('click', _func);
		if (callback != null) callback();
	});
	showElement(divDialog);
}

//THIS FUNCTION RETURNS THE TIME WITH FORMAT 'January 01 2014 at 00:00'
function getDateFormatted(d) {
	function twoLetterNumber(value) {
		return value >= 10 ? value : "0" + value;
	}
	var monthNames = [
		"January", "February", "March",
		"April", "May", "June", "July",
		"August", "September", "October",
		"November", "December"
	];
	var date = new Date(d);
	var day = date.getDate();
	var monthIndex = date.getMonth();
	var year = date.getFullYear();
	return monthNames[monthIndex] + " " + day + " " + year + " at " + twoLetterNumber(date.getHours()) + ":" + twoLetterNumber(date.getMinutes());
}

//THIS FUNCTION RETURN THE PATH DATA OF A PART ON A DONUT SHAPE
function getPathData(x, y, R, r, from, to) {
	var firstPoint = polarToCartesian(x, y, r, from);
	var secondPoint = polarToCartesian(x, y, r, to);
	var thirdPoint = polarToCartesian(x, y, R, to);
	var fourthPoint = polarToCartesian(x, y, R, from);
	return "M" + " " + firstPoint[0] + " " + firstPoint[1]
		+ "A " + r + ", " + r + " 0 0,1 " + secondPoint[0] + ", " + secondPoint[1]
		+ "L " + thirdPoint[0] + " " + thirdPoint[1]
		+ "A " + R + ", " + R + " 0 0,0 " + fourthPoint[0] + ", " + fourthPoint[1]
		+ " z";
}

//THIS FUNCTION CONVERT THE POLAR COORDINATES TO CARTESIAN COORDINATES
function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
	var angleInRadians = angleInDegrees * Math.PI / 180.0;
	var x = centerX + radius * Math.cos(angleInRadians);
	var y = centerY + radius * Math.sin(angleInRadians);
	return [x, y];
}

//THIS FUNCTION ADD FILES TO A ZIP WITH PATHS IN FILES AND FLDER FOR CONTAINING THE FILES INSIDE THE ZIP
function addToZip(files, folder, destination, callback) {
	var zip = new JSZip();
	for (var i = 0; i < files.length; i++) {
		var aFileName = path.basename(files[i]);
		var aContent = fs.readFileSync(files[i]); //content of file
		//put files onto a folder
		if (folder) zip.folder(folder).file(aFileName, aContent);
		else zip.file(aFileName, aContent);
	}
	//generate the zip with all files
	var content = zip.generate({ type: "nodebuffer" });

	fs.writeFile(destination, content, function (error) {
		callback(error, destination);
	});
}

function showElement(e) {
	e.setAttribute('style', 'visibility : visible');
}

function hideElement(e) {
	e.setAttribute('style', 'display : none');
}

//THIS FUNCTION SHOW THE ERROR
function handleError(error) {
	showAlert('Error occured: ' + (error.message ? error.message : error));
	console.log(error);
}

//----------------------------------------------------------------CUSTOM COMPONENT--------------------------------------------------------------------
function createComment(comment, authorAvatar, authorName) {
	var div_container = document.createElement('div');
	var div_comment = document.createElement('div');
	var img_avatar = document.createElement('img');

	div_container.setAttribute('class', "detail_comment_container");

	div_comment.innerHTML = comment;
	div_comment.setAttribute('class', "detail_comment_content");

	img_avatar.setAttribute('class', "detail_comment_avatar");
	img_avatar.setAttribute('src', authorAvatar);
	img_avatar.setAttribute('title', authorName);
	div_container.appendChild(div_comment);
	div_container.appendChild(img_avatar);

	return div_container;
}

function createPanel(header, contents) {
	var content = contents;
	function updateContent(contents) {
		div_detail_content.innerHTML = "";
		var div_content_c;
		for (var i = 0; i < contents.length; i++) {
			div_content_c = document.createElement('div');
			if (contents[i].nodeName)
				div_detail_content.appendChild(contents[i]);
			else {
				div_content_c.innerHTML = contents[i];
				div_detail_content.appendChild(div_content_c);
			}
		}
	}

	var div_container = document.createElement('div');
	var div_header = document.createElement('div');
	var div_header_text = document.createElement('div');
	var button_collapse = document.createElement('input');
	var div_content_body = document.createElement('div');
	var div_detail_content = document.createElement('div');

	div_container.setAttribute('class', "detail_container");
	div_header.setAttribute('class', "detail_header");

	div_header_text.setAttribute('class', "detail_header_text");
	div_header_text.innerHTML = header;
	//add collapse button
	button_collapse.setAttribute('type', "button");
	button_collapse.setAttribute('class', "panel expanded");
	div_header.appendChild(div_header_text);
	div_header.appendChild(button_collapse);
	div_content_body.setAttribute('id', header + "Content");
	div_content_body.setAttribute('class', "detail_body");
	div_detail_content.setAttribute('class', "detail_content");
	div_content_body.appendChild(div_detail_content);

	button_collapse.addEventListener("click", function (evt) {
		var div = document.getElementById(header + "Content");
		if (evt.target.className == "panel expanded") {
			evt.target.className = "panel collapsed";
			//collapse the div content
			div.className = "detail_body collapsed";
		}
		else {
			evt.target.className = "panel expanded";
			//expand the div content
			div.className = "detail_body expanded";
		}
	});

	if (contents) updateContent(contents);
	div_container.appendChild(div_header);
	div_container.appendChild(div_content_body);

	var panel = {
		dom: div_container,
		updateContent: function (contents) {
			updateContent(contents);
		},
		getContent: function () {
			return content;
		}
	}
	return panel;
}
	
	
