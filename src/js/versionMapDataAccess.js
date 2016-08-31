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
var async = require('async');
var process = require('process');
var utils = require('./utils.js').utils;
var kxapi = require('keeex-api');

versionMapDataAccess = {
	getVersionMap: function (idx, callback) {
		var links = [];
		var nodes = [];
		var visited = [];
		var idx = idx;

		//check if the topic exists
		versionMapDataAccess.getTopics([idx], function (error, topics) {
			if (error || (topics[0] == null)) {
				console.log(topics);
				if (error) {
					console.log(error);
				}
				callback(new Error("TopicNotFound"));
			}
			else {
				scanMap(idx, 0, function (error, links, nodes) {
					//load items for nodes
					var idxs = [];
					for (var i = 0; i < nodes.length; i++) {
						idxs.push(nodes[i].label);
					}
					versionMapDataAccess.getTopics(idxs, function (error, topics) {
						if (error) {
							if (error) { 
								//console.log(error);
							}
							callback(error);
						}
						else {
							var avatarTask = [];
							for (var i = 0; i < nodes.length; i++) {
								if (topics[i]) {
									nodes[i].data = topics[i];
									var profileIdx = null;
										
									// SHIT HERE
									if (true) {
										avatarTask.push({ 'id': i, 'profileIdx': nodes[i].data.idx });
									}

								}
							}

							async.eachSeries(avatarTask, function (profile, callback) {
								addAuthorInfo(profile, function (error) {
									if (error) { 
										//console.log(error);
									}
									callback(error);
								});
							}, function (error) {
								if (error) {
									//console.log(error);
								}

								callback(error, links, nodes);
							});

							function addAuthorInfo(profile, callback) {
								versionMapDataAccess.getAuthor(profile.profileIdx, function (error, author) {
									nodes[profile.id].author = author;
									callback(error);
								});
							}
						}
					});
				});
			}
		});
		
		//internal recursive function
		function scanMap(idx, level, callback) {
			var tasks = [];
			var nextTasks = [];
			var nextArguments = [];


			addToNodes(idx, level);
			visited.push(idx);

			tasks.push(function (callback) {
				versionMapDataAccess.getPreviousVersions(idx, function (error, result) {
					if (error) {
						callback(error);
					}
					else {
						//add parents to links
						if (result)
							result.forEach(function (item) {
								addToNodes(item.idx, level - 1);
								
								//add relation
								addRelation(getNodeId(item.idx), getNodeId(idx));				
								
								//recusion if not visited
								if (visited.indexOf(item.idx) == -1) {
									nextArguments.push({ idx: item.idx, level: level - 1 });
								}
							});
						callback(error, result);
					}
				});
			});

			tasks.push(function (callback) {
				versionMapDataAccess.getNextVersions(idx, function (error, result) {

					if (error) {
						callback(error, null);
					}
					else {
						//add children to links
						if (result)
							result.forEach(function (item) {
								//add relation
								addToNodes(item.idx, level + 1);
								addRelation(getNodeId(idx), getNodeId(item.idx));
								
								//recusion if not visited
								if (visited.indexOf(item.idx) == -1) {
									nextArguments.push({ idx: item.idx, level: level + 1 });
								}
							});
						callback(error, result);
					}
				});
			});
			
			async.series(tasks, function (error, result) {
				async.map(
					nextArguments, 
					function (argument, callback) { 
						scanMap(argument.idx, argument.level, callback); 
					}, 
					function (error, result) {
						callback(error, links, nodes);
					});
			});
		}
		
		//add a relation to nodes
		function addRelation(source, target) {
			var relation = {
				name: source + "to" + target,
				source: source,
				target: target,
				type: "version",
				left: false,
				right: true,
			};
			if (!relationExist(relation)) {
				links.push(relation);
			}
		}

		function relationExist(relation) {
			for (var i = 0; i < links.length; i++) {
				if (relation.source == links[i].source && relation.target == links[i].target) {
					return true;
				}
			};
			return false;
		}

		function addToNodes(newIdx, level) {
			if (!existInNodes(newIdx)) {
				var node = {
					id: nodes.length,
					label: newIdx,
					isMain: (newIdx === idx),
					type: "version",
					level: level
				}
				nodes.push(node);
			}
		}

		function existInNodes(idx) {
			return getNodeId(idx) >= 0;
		}

		function getNodeId(idx) {
			for (var i = 0; i < nodes.length; i++) {
				if (idx === nodes[i].label) {
					return nodes[i].id;
				}
			};
			return -1;
		}
	},

	getReferencesMap: function (idx, callback) {
		var idxs = [];
		idxs.push(idx);
		versionMapDataAccess.getTopics(idxs, function (error, result) {
			if (!error) {
				var topic = result[0];
				versionMapDataAccess.getTopics(topic.references, function (error, result) {
					var nodes = [];
					var links = [];
					//remove self reference
					var self;
					for (var i = 0; i < result.length; i++) {
						if (result[i].idx == topic.idx) {
							self = result[i];
						}
					}
					var node;
					var link;

					var self_node = {
						id: 0,
						data: self,
						isMain: true
					}
					nodes.push(self_node);
					for (var i = 0; i < result.length; i++) {
						if (result[i].idx != self.idx) {
							node = {
								id: nodes.length,
								data: result[i],
								x: 0,
								y: 0
							};
							nodes.push(node);
							link = {
								name: self_node.id + "to" + node.id,
								source: self_node.id,
								target: node.id,
								left: false,
								right: true,
								type: "references"
							};
							links.push(link);
						}
					}
					callback(error, nodes, links);
				});
			}
		});
	},


	getReady: function (callback) {
		var params = {
		};
		//utils.handlePostRequest(params, "/keeex.api.check", 'localhost', 8288, function (error, result) {
			//callback(error, result);
			callback(null, undefined);
		//});
	},

	getComments: function (idx, callback) {
		kxapi.getComments(idx, function (error, result) {
			callback(error, result);
		});
	},

	getAgreement: function (idx, callback) {
		kxapi.getAgreements(idx, function (error, result) {
			callback(error, result);
		});
	},

	getSharedUsers: function (idx, callback) {
		kxapi.getShared(idx, function (error, result) {
			//We just have an array of idxs, must call again to get user's infomation
			if (!error) {
				if (result)
					versionMapDataAccess.getUsers(result.shared, function (error, result) {
						callback(error, result);
					});
				else
					callback(error, []);
			}
			else {
				callback(error);
			}
		});
	},

	getReferencesTo: function (idx, callback) {
		kxapi.getRefs(idx, function (error, result) {
			callback(error, result);
		});
	},

	getUsers: function (idxs, callback) {
		kxapi.getUsers(idxs, function (error, result) {
			callback(error, result);
		});
	},

	getAuthor: function (idx, callback) {
		kxapi.getAuthor(idx,  function (error, result) {
			callback(error, result);
		});
	},

	getTopics: function (idxs, callback) {
		kxapi.getTopics(idxs, function (error, result) {
			callback(error, result);
		});
	},

	getPreviousVersions: function (idx, callback) {
		kxapi.getPrevs(idx, function (error, result) {
			callback(error, result);
		});
	},

	getNextVersions: function (idx, callback) {
		kxapi.getNexts(idx, function (error, result) {
			callback(error, result);
		});
	},

	getTopicLocations: function (idxs, callback) {
		kxapi.getLocations(idxs, function (error, result) {
			callback(error, result);
		});
	},

	getSearchResult: function (filter, callback) {
		kxapi.search(filter,[], [], null, null, {document:true, discussion:true}, function (error, result) {
			callback(error, result);
		});
	}
}
if (typeof exports === 'undefined') {
	exports = module.exports = {};
}
exports.versionMapDataAccess = versionMapDataAccess;




