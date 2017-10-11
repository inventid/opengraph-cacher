const moment = require("moment-timezone");

module.exports = function defaultOutput(url) {
	return Object.assign({}, {
		_url : url,
		_scrapedAt : parseInt(moment(new Date()).format('x'), 10),
		_cacheResponse : false,
		data : {}
	});
};

