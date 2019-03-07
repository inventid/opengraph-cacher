import promisify from 'es6-promisify';
import dns from 'dns';
import ip from 'ip';
import log, {WARN} from "./log";

const CACHABLE_NETWORK_ERRORS = [
	'HPE_INVALID_CONSTANT', // May trigger if eg chipsoft Sharepoint send a content-length of 0 but secretly appends data
	'CERT_HAS_EXPIRED',
	'DEPTH_ZERO_SELF_SIGNED_CERT',
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

function isCachableError(error) {
	return CACHABLE_ERRORS.includes(error);
}

function isNetworkError(code) {
	return NETWORK_ERRORS.includes(code);
}

export {isCachableError, isHostnamePubliclyAccessible, isAllowedExtension, isNetworkError}
