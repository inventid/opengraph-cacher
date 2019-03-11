import ogs from 'open-graph-scraper';
import URL from 'url';
import {get, remove, save} from "./cache";
import defaultOutput from './defaultOutput';
import postProcess from './mapper';
import log, {ERR, INFO} from "./log";
import {isAllowedExtension, isCachableError, isHostnamePubliclyAccessible, isNetworkError} from "./network";

const HTTP_TIMEOUT = Number(process.env.HTTP_TIMEOUT) || 10000;

log(INFO, "Using a HTTP timeout of " + HTTP_TIMEOUT + " milliseconds");

function response(statusCode, response) {
	return {
		statusCode,
		response
	}
}

async function fetchFromRemote(urlToFetch) {
	const options = {
		url : encodeURI(urlToFetch),
		timeout : HTTP_TIMEOUT,
		headers : {
			'user-agent' : 'opengraph-cacher <https://github.com/inventid/opengraph-cacher>',
			accept : 'text/html,text/plain;q=0.9,*/*;q=0.8',
			'accept-encoding': 'identify',
		}
	};
	try {
		const ogData = await ogs(options);
		if (ogData && ogData.success) {
			const resultData = postProcess(urlToFetch, ogData.data);
			return response(200, resultData);
		} else {
			const resultData = defaultOutput(urlToFetch);
			if (ogData && ogData.err) {
				resultData.err = ogData.err;
			}
			const statusCode = (ogData && ogData.err && isNetworkError(ogData.errorDetails.message.code)) ? 406 : 404;
			return response(statusCode, resultData);
		}
	} catch (e) {
		let statusCode = 500;
		if (e && e.errorDetails) {
			if (isNetworkError(e.errorDetails.code)) {
				statusCode = 406;
			} else {
				statusCode = 404;
			}
		}

		if (e.response && e.response.body) {
			e.response.body = '<cleared>';
		}
		log('ERROR', e);
		return response(statusCode, defaultOutput(urlToFetch));
	}
}

async function isBlocked(urlToFetch) {
	const url = URL.parse(urlToFetch);
	const blockedError = defaultOutput(urlToFetch);

	if (!isAllowedExtension(urlToFetch)) {
		// Return standard format for misbehaving clients
		blockedError.err = 'This resource is blocked from fetching opengraph data';
		return blockedError;
	}

	const isPublicResource = await isHostnamePubliclyAccessible(url.hostname);
	if (!isPublicResource) {
		// Return standard format for internal requests clients
		blockedError.err = 'This resource is not publicly accessible';
		return blockedError;
	}
	return null;
}

async function getOpengraphData(urlToFetch) {
	const potentialBlockedError = await isBlocked(urlToFetch);
	if (potentialBlockedError) {
		return {
			status : 403,
			json : potentialBlockedError,
		};
	}

	let result;
	let shouldCache = true;
	try {
		result = await get(urlToFetch);
		if (!result) {
			// Cache miss
			result = await fetchFromRemote(urlToFetch);
		}
	} catch (e) {
		// Weird error
		result = await fetchFromRemote(urlToFetch);
		shouldCache = isCachableError(e);
	}

	if (shouldCache) {
		save(urlToFetch, result.response);
	}
	return {
		status : result.statusCode,
		json : result.response,
	}
}

async function removeOpengraphData(urlToDelete) {
	try {
		await remove(urlToDelete);
	} catch (e) {
		if (e && e.statusCode !== 404) {
			log(ERR, `An error occurred while deleting data from the cache: ${e}`);
			return {
				status : 500,
				json : {
					message : 'The url could not be deleted due to an internal error',
					url : urlToDelete
				}
			};
		}
	}
	return {
		status : 200,
		json : {message : 'The url has been deleted from the cache', url : urlToDelete}
	};
}

export {getOpengraphData, removeOpengraphData};

