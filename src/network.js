import promisify from 'es6-promisify';
import dns from 'dns';
import ip from 'ip';
import log, {WARN} from "./log";

const CACHABLE_NETWORK_ERRORS = [
	'HPE_INVALID_CONSTANT' // May trigger if eg chipsoft Sharepoint send a content-length of 0 but secretly appends data
];
const NETWORK_ERRORS = [...CACHABLE_NETWORK_ERRORS];
const CACHABLE_PAGE_ERRORS = ['Page Not Found'];
const CACHABLE_ERRORS = [...CACHABLE_NETWORK_ERRORS, ...CACHABLE_PAGE_ERRORS];
const BLOCKED_EXTENSIONS = ['pdf', 'gif', 'jpg', 'jpeg', 'png', 'svg', 'mp4'];

async function isHostnamePubliclyAccessible(hostname) {
	try {
		const result = await promisify(dns.lookup)(hostname, {all : true, verbatim : true});
		return result.map(e => e.address).reduce((val, cur) => val && ip.isPublic(cur), true);
	} catch (e) {
		log(WARN, `url ${hostname} could not be resolved to an ip address`);
		return false;
	}
}

function isAllowedExtension(url) {
	return BLOCKED_EXTENSIONS.filter(extension => url.toLowerCase().endsWith(extension.toLowerCase())).length === 0;
}

function determineErrorCode(errorDetails) {
	return errorDetails && NETWORK_ERRORS.indexOf(errorDetails.code) !== -1 ?
		406 : // If the network request is borked
		404; // If the page was not found
}

function isCachableError(error) {
	return CACHABLE_ERRORS.includes(error);
}

export {isCachableError, determineErrorCode, isHostnamePubliclyAccessible, isAllowedExtension}
