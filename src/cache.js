import ElasticSearch from 'elasticsearch';
import moment from "moment-timezone";
import log, {INFO, WARN} from "./log";

const config = process.env.ES_URL ? {
	index : process.env.ES_INDEX,
	type : process.env.ES_TYPE,
	url : process.env.ES_URL,
	version : process.env.ES_VERSION,
	duration : parseInt(process.env.CACHE_IN_DAYS, 10) || 28
} : null;

if (config) {
	log(INFO, `Connected to Elasticsearch ${config.version} on ${config.url} using index '${config.index}' with type '${config.type}'. Using a cache of ${config.duration} days.`);
}

const es = config ? new ElasticSearch.Client({
	host : config.url,
	apiVersion : config.version
}) : null;

function isCacheExpired(date) {
	return moment(date).add(config.duration, 'days').isBefore(moment(new Date()));
}

function isCacheEntryValid(response, url) {
	if (!response._source || !response._source._scrapedAt) {
		log(WARN, `Formatting error in cache, refetching ${url}`);
		return false;
	}
	if (isCacheExpired(response._source._scrapedAt)) {
		// cache is just expired
		log(INFO, `Getting new value for '${url}' since the cache expired`);
		return false;
	}
	return true;
}

async function get(urlToFetch) {
	if (!es) {
		return null;
	}
	const encodedUrl = encodeURI(urlToFetch);
	try {
		const response = await es.get({index : config.index, type : config.type, id : encodedUrl});
		if (isCacheEntryValid(response, urlToFetch)) {
			return {
				statusCode : !response._source.err ? 200 : 404,
				response : response._source
			};
		}
	} catch (e) {
		return null;
	}
}

async function save(url, resultData) {
	if (!es) {
		return null;
	}
	const encodedUrl = encodeURI(url);

	const saveData = {...resultData, _cacheResponse : true};
	try {
		await es.index({index : config.index, type : config.type, id : encodedUrl, body : saveData});
		return true;
	} catch (err) {
		if (err) {
			log(WARN, `Could not save value to cache due to error: ${err}`);
		}
		return false;
	}
}

async function remove(url) {
	if (!es) {
		return null;
	}
	const encodedUrl = encodeURI(url);
	return await es.delete({index : config.index, type : config.type, id : encodedUrl});
}

export {save, get, remove};
