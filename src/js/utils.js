utils = {
	
	handlePostRequest: function (params, action, host, port, callback) {
		//create a POST request
		var paramString = JSON.stringify(params);

		var headers = {
			'Content-Type': 'application/json',
			'Content-Length': paramString.length
		};

		var options = {
			host: host,
			port: port,
			path: action,
			method: 'POST',
			headers: headers
		};

		var http = require('http');
		var request = http.request(options, function (response) {
			//////console.log("in request");
			var responseString = "";

			response.on('data', function (data) {
				responseString += data;
			});

			response.on('end', function () {
				//////console.log("response ended");
				var resultObject;
				if (responseString) resultObject = JSON.parse(responseString);
				var error;
				if (response.statusCode != 200) error = "error";
				callback(error, resultObject);
			});
		});

		request.on('error', function (error) {
			callback(error);
		});
		request.write(paramString);
		request.end();
	},
}

if (typeof exports=='undefined'){
	exports = {};
}

exports.utils = utils;