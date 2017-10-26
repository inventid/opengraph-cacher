const moment = require("moment-timezone");

export default function defaultOutput(url) {
	return {
		_url : url,
		_scrapedAt : parseInt(moment(new Date()).format('x'), 10),
		_cacheResponse : false,
		data : {}
	};
}
