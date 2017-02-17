var ogs = require('open-graph-scraper');
var express = require('express');
var ElasticSearch = require('elasticsearch');
var moment = require("moment-timezone");
var camoUrl = require('camo-url')({
	host : process.env.CAMO_HOST,
	key : process.env.CAMO_KEY
});

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

function postProcess(url, data) {
	var result = Object.assign({}, {
		_url : url,
		_scrapedAt : parseInt(moment(new Date()).format('x'), 10),
		_cacheResponse : false,
		data : {}
	});

	// Format images for their special cases
	['ogImage', 'twitterImage'].forEach(function (key) {
		if (data[key]) {
			if (!data[key].url) {
				delete data[key];
			} else if(data[key].url) {
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
		var key;
		if (originalKey.startsWith('og')) {
			key = stringToUnderscore(originalKey.substring(2)).substring(1);
		}
		else if (originalKey.startsWith('twitter')) {
			key = stringToUnderscore(originalKey);
		} else {
			return;
		}

		result.data[key] = [{value : data[originalKey]}]
	});

	if (!result.data.url) {
		result.data.url = url;
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

function workWorkWork(req, res) {
	var urlToFetch = req.query.url;
	var encodedUrl = encodeURI(urlToFetch);
	es.get({index : esIndex, type : esType, id : encodedUrl}, function (err, response) {
		if (!process.env.ES_URL || err || !response._source || !response._source._scrapedAt || cacheExpired(response._source._scrapedAt)) {
			if (!process.env.ES_URL) {
				log(WARN, "No ES cache specified, so skipping it");
			} else if (err && err.status !== 404) {
				log(WARN, "Got an error [" + err.status + "] while fetching URL '" + urlToFetch + "' from ES cache");
			} else if (response._source && response._source._scrapedAt && cacheExpired(response._source._scrapedAt)) {
				log(INFO, "Getting new value for '" + urlToFetch + "' since the cache expired");
			} else if (!response) {
				log(INFO, urlToFetch + " was not in the cache");
			} else {
				log(WARN, 'Formatting error in cache, refetching ' + urlToFetch);
			}

			var options = {
				url : urlToFetch,
				timeout : 5000
			};
			ogs(options, function (err, ogData) {
				if (err || !ogData.success) {
					log(ERR, 'Error while fetching OG data: ' + err);
					res.statusCode = 400;
					res.end();
					return;
				}
				var resultData = postProcess(urlToFetch, ogData.data);
				res.json(resultData);

				if (process.env.ES_URL) {
					resultData._cacheResponse = true;
					es.index({index : esIndex, type : esType, id : encodedUrl, body : resultData}, function (err) {
						if (err) {
							log(WARN, 'Could not save value to cache due to error: ' + err);
						}
					});
				}
			});
		} else {
			res.json(response._source);
		}
	});
}

app.get('/opengraph', workWorkWork);
app.listen(7070, function () {
	log(INFO, 'Server is listening');
});

