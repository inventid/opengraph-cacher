var ogs = require('open-graph-scraper');
var express = require('express');
var ElasticSearch = require('elasticsearch');
var moment = require("moment-timezone");
var camoUrl = require('camo-url')({
	host : process.env.CAMO_HOST,
	key : process.env.CAMO_KEY
});
var URL = require('url');
var app = express();
var es = new ElasticSearch.Client({
	host : process.env.ES_URL,
	apiVersion : process.env.ES_VERSION
});

var esIndex = process.env.ES_INDEX;
var esType = process.env.ES_TYPE;

var INFO = "INFO";
var WARN = "WARN";
var ERR = "ERROR";

var BLOCKED_EXTENSIONS = ['pdf', 'gif', 'jpg', 'jpeg', 'png', 'svg'];

var CACHABLE_ERRORS = ['Page Not Found'];

var cacheInDays = parseInt(process.env.CACHE_IN_DAYS, 10) || 28;

function stringToUnderscore(input) {
	return input.replace(/([A-Z])/g, function ($1) {
		return "_" + $1.toLowerCase();
	});
}

function log(level, message) {
	console.log(JSON.stringify({time : moment(new Date()).format(), severity : level, message : message}));
}

function cacheExpired(date) {
	return moment(date).add(cacheInDays, 'days').isBefore(moment(new Date()));
}

function defaultOutput(url) {
	return Object.assign({}, {
		_url : url,
		_scrapedAt : parseInt(moment(new Date()).format('x'), 10),
		_cacheResponse : false,
		data : {}
	});
}

function postProcess(url, data) {
	var result = defaultOutput(url);

	// Format images for their special cases
	['ogImage', 'twitterImage'].forEach(function (key) {
		if (data[key]) {
			if (!data[key].url) {
				delete data[key];
			} else if (data[key].url) {
				var imageUrl = resolveRelative(data[key].url, url);
				if (process.env.CAMO_KEY && process.env.CAMO_HOST) {
					imageUrl = camoUrl(imageUrl);
				}
				var image = Object.assign({}, {value : imageUrl});
				Object.keys(data[key]).filter(function (e) {
					return e !== 'url';
				}).forEach(function (innerKey) {
					image[innerKey] = [{value : data[key][innerKey]}];
				});
				data[key] = image;
			}
		}
	});

	// Now map this to useful structures
	Object.keys(data).forEach(function (originalKey) {
		if (data[originalKey] === null || typeof data[originalKey] === 'undefined') {
			return;
		}

		var key;
		if (originalKey.startsWith('og')) {
			key = stringToUnderscore(originalKey.substring(2)).substring(1);
		}
		else if (originalKey.startsWith('twitter')) {
			key = stringToUnderscore(originalKey);
		} else {
			return;
		}

		if (data[originalKey].value) {
			result.data[key] = [data[originalKey]]
		} else {
			result.data[key] = [{value : data[originalKey]}]
		}
	});

	if (!result.data.url) {
		result.data.url = [{value : url}];
	}

	return result;
}

function resolveRelative(path, base) {
	// Absolute URL
	if (path.match(/^[a-z]*:\/\//)) {
		return path;
	}
	// Protocol relative URL
	if (path.indexOf("//") === 0) {
		return base.replace(/\/\/.*/, path)
	}
	// Upper directory
	if (path.indexOf("../") === 0) {
		return resolveRelative(path.slice(3), base.replace(/\/[^\/]*$/, ''));
	}
	// Relative to the root
	if (path.indexOf('/') === 0) {
		if (!base.endsWith('/')) {
			base += '/';
		}
		var match = base.match(/(\w*:\/\/)?[^\/]*\//) || [base];
		return match[0] + path.slice(1);
	}
	//relative to the current directory
	return base.replace(/\/[^\/]*$/, "") + '/' + path.replace(/^\.\//, '');
}

if (process.env.ES_URL) {
	log(INFO, "Connected to Elasticsearch " + process.env.ES_VERSION + " on " + process.env.ES_URL + " using index '" + esIndex + "' with type '" + esType + "'. Using a cache of " + cacheInDays + " days.");
}

function cacheEntryIsValid(error, response, url) {
	if (!process.env.ES_URL) {
		// No ES cache entry is set
		log(WARN, "No ES cache specified, so skipping it");
		return false;
	}
	if (error) {
		if (error.status !== 404) {
			log(WARN, "Got an error [" + error.status + "] while fetching URL '" + url + "' from ES cache");
		}
		return false;
	}
	if (!response._source || !response._source._scrapedAt || cacheExpired(response._source._scrapedAt)) {
		log(WARN, 'Formatting error in cache, refetching ' + url);
		return false;
	}
	if (cacheExpired(response._source._scrapedAt)) {
		// cache is just expired
		log(INFO, "Getting new value for '" + url + "' since the cache expired");
		return false;
	}
	return true;
}

function workWorkWork(req, res) {
	var urlToFetch = req.query.url;
	var pathname = URL.parse(urlToFetch).pathname;
	var blockedResource = BLOCKED_EXTENSIONS.filter(function (extension) {
			return pathname.endsWith(extension);
		}).length > 0;
	if (blockedResource) {
		// Return standard format for misbehaving clients
		var blockedError = defaultOutput(urlToFetch);
		blockedError.error = 'This resource is blocked from fetching opengraph data';
		res.status(403).json(blockedError);
		return;
	}

	var encodedUrl = encodeURI(urlToFetch);
	es.get({index : esIndex, type : esType, id : encodedUrl}, function (err, response) {
		if (cacheEntryIsValid(err, response, urlToFetch)) {
			// If there is an error, we do not have the opengraph data so we return a 404
			var statusCode = !response._source.error ? 200 : 404;
			res.status(statusCode).json(response._source);
		} else {
			var options = {
				url : urlToFetch,
				timeout : 5000
			};
			ogs(options, function (err, ogData) {
				var resultData;
				if (err || !ogData.success) {
					// Return the data to the client
					resultData = defaultOutput(urlToFetch);
					resultData.err = ogData.err;

					res.status(404).json(resultData);

					if (CACHABLE_ERRORS.indexOf(ogData.err) === -1) {
						// If this is a more permanent failure, we cache it
						log(ERR, 'Error while fetching OG data: ' + JSON.stringify(ogData));
						return;
					}
				} else {
					// All went well, postprocess and send to client
					resultData = postProcess(urlToFetch, ogData.data);
					res.json(resultData);
				}

				if (process.env.ES_URL) {
					resultData._cacheResponse = true;
					es.index({index : esIndex, type : esType, id : encodedUrl, body : resultData}, function (err) {
						if (err) {
							log(WARN, 'Could not save value to cache due to error: ' + err);
						}
					});
				}
			});
		}
	});
}

app.get('/opengraph', workWorkWork);
app.get('/_health', function (req, res) {
	res.end('Jolly good here');
});
app.listen(7070, function () {
	log(INFO, 'Server is listening');
});

