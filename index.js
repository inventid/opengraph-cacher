const ogs = require('open-graph-scraper');
const express = require('express');
const ElasticSearch = require('elasticsearch');
const moment = require("moment-timezone");
const URL = require('url');
const app = express();
const promisify = require('es6-promisify');
const dns = require('dns');
const ip = require('ip');
const es = new ElasticSearch.Client({
	host : process.env.ES_URL,
	apiVersion : process.env.ES_VERSION
});
const defaultOutput = require('./defaultOutput');
const postProcess = require('./mapper');

const esIndex = process.env.ES_INDEX;
const esType = process.env.ES_TYPE;
const ES_URL = process.env.ES_URL;

const INFO = "INFO";
const WARN = "WARN";
const ERR = "ERROR";

const BLOCKED_EXTENSIONS = ['pdf', 'gif', 'jpg', 'jpeg', 'png', 'svg'];

const CACHABLE_NETWORK_ERRORS = [
	'HPE_INVALID_CONSTANT' // May trigger if eg chipsoft Sharepoint send a content-length of 0 but secretly appends data
];
const NETWORK_ERRORS = [].concat(CACHABLE_NETWORK_ERRORS);
const CACHABLE_PAGE_ERRORS = ['Page Not Found'];
const CACHABLE_ERRORS = CACHABLE_NETWORK_ERRORS.concat(CACHABLE_PAGE_ERRORS);

const cacheInDays = parseInt(process.env.CACHE_IN_DAYS, 10) || 28;

function log(level, message) {
	console.log(JSON.stringify({time : moment(new Date()).format(), severity : level, message : message}));
}

const timeout = Number(process.env.HTTP_TIMEOUT) || 10000;
log(INFO, "Using a HTTP timeout of " + timeout + " milliseconds");

function cacheExpired(date) {
	return moment(date).add(cacheInDays, 'days').isBefore(moment(new Date()));
}

if (process.env.ES_URL) {
	log(INFO, "Connected to Elasticsearch " + process.env.ES_VERSION + " on " + ES_URL + " using index '" + esIndex + "' with type '" + esType + "'. Using a cache of " + cacheInDays + " days.");
}

function cacheEntryIsValid(error, response, url) {
	if (!ES_URL) {
		// No ES cache entry is set
		log(WARN, "No ES cache specified, so skipping it");
		return false;
	}
	if (error) {
		if (error.status === 404) {
			log(INFO, "Getting new value for '" + url + "' since never seen that before");
		} else {
			log(WARN, "Got an error [" + error.status + "] while fetching URL '" + url + "' from ES cache");
		}
		return false;
	}
	if (!response._source || !response._source._scrapedAt) {
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

function saveResultToEs(resultData, encodedUrl) {
	resultData._cacheResponse = true;
	es.index({index : esIndex, type : esType, id : encodedUrl, body : resultData}, function (err) {
		if (err) {
			log(WARN, 'Could not save value to cache due to error: ' + err);
		}
	});
}

function fetchFromRemoteAndSaveToCache(urlToFetch, res, encodedUrl) {
	const options = {
		url : encodeURI(urlToFetch),
		timeout : timeout
	};
	ogs(options, function (err, ogData) {
		let resultData;
		if (err || !ogData.success) {
			// Return the data to the client
			resultData = defaultOutput(urlToFetch);
			resultData.err = ogData.err;

			const status = ogData.errorDetails && NETWORK_ERRORS.indexOf(ogData.errorDetails.code) !== -1 ?
				406 : // If the network request is borked
				404; // If the page was not found

			res.status(status).json(resultData);

			if (CACHABLE_ERRORS.indexOf(ogData.err) === -1) {
				// If this is a more permanent failure, we cache it
				log(ERR, 'Error while fetching OG data for ' + urlToFetch + ': ' + JSON.stringify(ogData));
				return;
			}
		} else {
			// All went well, postprocess and send to client
			resultData = postProcess(urlToFetch, ogData.data);
			res.json(resultData);
		}

		if (ES_URL) {
			saveResultToEs(resultData, encodedUrl);
		}
	});
}

async function isPubliclyAccessible(url) {
	const host = url.host;
	try {
		const result = await promisify(dns.lookup)(host, {all : true, verbatim : true});
		return result.map(e => e.address).reduce((val, cur) => val && ip.isPublic(cur), true);
	} catch (e) {
		log(WARN, `url ${host} could not be resolved to an ip address`);
		return false;
	}
}

async function isBlocked(urlToFetch) {
	const url = URL.parse(urlToFetch);
	const isPublicResource = await isPubliclyAccessible(url);
	const pathname = url.pathname;
	const blockedResource = BLOCKED_EXTENSIONS.filter(function (extension) {
		return pathname.endsWith(extension);
	}).length > 0;
	const blockedError = defaultOutput(urlToFetch);
	if (blockedResource) {
		// Return standard format for misbehaving clients
		blockedError.err = 'This resource is blocked from fetching opengraph data';
		return blockedError;
	}
	else if (!isPublicResource) {
		// Return standard format for internal requests clients
		blockedError.err = 'This resource is not publicly accessible';
		return blockedError;
	}
	return null;
}

async function workWorkWork(req, res) {
	const urlToFetch = req.query.url;
	const potentialBlockedError = await isBlocked(urlToFetch);
	if (potentialBlockedError) {
		return res.status(403).json(potentialBlockedError);
	}

	const encodedUrl = encodeURI(urlToFetch);
	es.get({index : esIndex, type : esType, id : encodedUrl}, function (err, response) {
		if (cacheEntryIsValid(err, response, urlToFetch)) {
			// If there is an error, we do not have the opengraph data so we return a 404
			const statusCode = !response._source.err ? 200 : 404;
			res.status(statusCode).json(response._source);
		} else {
			fetchFromRemoteAndSaveToCache(urlToFetch, res, encodedUrl);
		}
	});
}

function ditchDitchDitch(req, res) {
	const urlToDelete = req.query.url;

	const encodedUrl = encodeURI(urlToDelete);
	if (!ES_URL) {
		// Technically not, but the effect is the same for the caller
		res.status(200).json({message : 'The url has been deleted from the cache', url : urlToDelete});
		return;
	}
	es.delete({index : esIndex, type : esType, id : encodedUrl}, function (err) {
		if (err && err.statusCode !== 404) {
			// If there is an error, we do not have the opengraph data so we return a 404
			log(ERR, 'An error occured while deleting data from the cache: ' + err);
			res.status(500).json({
				message : 'The url could not be deleted due to an internal error',
				url : urlToDelete
			});
		} else {
			res.status(200).json({message : 'The url has been deleted from the cache', url : urlToDelete});
		}
	});
}

app.get('/opengraph', workWorkWork);
app.delete('/opengraph', ditchDitchDitch);
app.get('/_health', function (req, res) {
	res.end('Jolly good here');
});
app.listen(7070, function () {
	log(INFO, 'Server is listening');
});

