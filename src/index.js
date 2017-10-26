import ogs from 'open-graph-scraper';
import express from 'express';
import URL from 'url';
import promisify from 'es6-promisify';
import {get, remove, save} from "./cache";
import defaultOutput from './defaultOutput';
import postProcess from './mapper';
import log, {ERR, INFO} from "./log";
import {determineErrorCode, isBlockedExtension, isCachableError, isPubliclyAccessible} from "./network";

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
		timeout : HTTP_TIMEOUT
	};
	try {
		const ogData = await promisify(ogs)(options);
		if (ogData && ogData.success) {
			const resultData = postProcess(urlToFetch, ogData.data);
			return response(200, resultData);
		} else {
			const resultData = defaultOutput(urlToFetch);
			if (ogData && ogData.err) {
				resultData.err = ogData.err;
			}
			const statusCode = (ogData && ogData.err) ? determineErrorCode(ogData.errorDetails) : 404;
			return response(statusCode, resultData);
		}
	} catch (e) {
		return response(500, defaultOutput(urlToFetch));
	}
}

async function isBlocked(urlToFetch) {
	const url = URL.parse(urlToFetch);
	const blockedError = defaultOutput(urlToFetch);

	if (isBlockedExtension(urlToFetch)) {
		// Return standard format for misbehaving clients
		blockedError.err = 'This resource is blocked from fetching opengraph data';
		return blockedError;
	}

	const isPublicResource = await isPubliclyAccessible(url);
	if (!isPublicResource) {
		// Return standard format for internal requests clients
		blockedError.err = 'This resource is not publicly accessible';
		return blockedError;
	}
	return null;
}

async function getOpengraphData(req, res) {
	const urlToFetch = req.query.url;
	const potentialBlockedError = await isBlocked(urlToFetch);
	if (potentialBlockedError) {
		return res.status(403).json(potentialBlockedError);
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
	res.status(result.statusCode).json(result.response);

	if (shouldCache) {
		await save(urlToFetch, result.response);
	}
}

async function removeOpengraphData(req, res) {
	const urlToDelete = req.query.url;

	try {
		await remove(urlToDelete);
		res.status(200).json({message : 'The url has been deleted from the cache', url : urlToDelete});
	} catch (e) {
		if (e && e.statusCode !== 404) {
			log(ERR, `An error occurred while deleting data from the cache: ${e}`);
			res.status(500).json({
				message : 'The url could not be deleted due to an internal error',
				url : urlToDelete
			});
		}
	}
}

const app = express();
app.get('/opengraph', getOpengraphData);
app.delete('/opengraph', removeOpengraphData);
app.get('/_health', (req, res) => res.end('Jolly good here'));
app.listen(7070, () => log(INFO, 'Server is listening'));

