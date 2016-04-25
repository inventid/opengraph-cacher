var ogs = require('open-graph-scraper');
var express = require('express');
var ElasticSearch = require('elasticsearch');
var moment = require("moment-timezone");

var app = express();
var es = new ElasticSearch.Client({
	host: process.env.ES_URL,
	apiVersion: process.env.ES_VERSION
});

var esIndex = process.env.ES_INDEX;
var esType = process.env.ES_TYPE;

var info = "INFO";
var warn = "WARN";
var err = "ERROR";

var cacheInDays = parseInt(process.env.CACHE_IN_DAYS) || 28;

function log(level, message) {
	console.log(JSON.stringify({time: moment(new Date()).format(), severity: level, message: message}));
}

function cacheExpired(date) {
	return moment(date).add(cacheInDays, 'days').isBefore(moment(new Date()));
}

log(info, "Connected to Elasticsearch " + process.env.ES_VERSION + " on " + process.env.ES_URL + " using index '" + esIndex + "' with type '" + esType + "'. Using a cache of " + cacheInDays + " days.");
app.get('/opengraph', function(req, res) {
	var urlToFetch = req.query.url;
	var encodedUrl = encodeURI(urlToFetch);
	es.get({index: esIndex, type: esType, id: encodedUrl}, function(err, response) {
		if (err || !response._source || !response._source.fetched_at || cacheExpired(response._source.fetched_at)) {
			if(err && err.status !== 404) {
				log(warn, "Got an error [" + err.status + "] while fetching URL '" + urlToFetch + "' from ES cache");
			} else if ( response._source && response._source.fetched_at && cacheExpired(response._source.fetched_at) ) {
				log(info, "Getting new value for '" + urlToFetch + "' since the cache expired");
			} else {
				log(warn, 'Formatting error in cache, refetching ' + urlToFetch);
			}

			var options = {
				url: urlToFetch,
				timeout: 5000
			};
			ogs(options, function(err, ogData) {
				if(err) {
					log(err, 'Error while fetching OG data: ' + err);
					res.statusCode = 400;
					res.end();
					return;
				}
				res.json(ogData.data);

				esData = { fetched_at: moment(new Date()), data: ogData.data }; 
				es.index({index: esIndex, type: esType, id: encodedUrl, body: esData}, function(err, response) {
					if(err)	{
						log(warn, 'Could not save value to cache due to error: ' + error);
					}
				});
			});
		} else {
			res.json(response._source.data);
		}
	});
});

app.listen(7070, function() {
	log(info, 'Server is listening');
});

