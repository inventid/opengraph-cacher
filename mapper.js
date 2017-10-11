const camoUrl = require('camo-url')({
	host : process.env.CAMO_HOST,
	key : process.env.CAMO_KEY
});
const defaultOutput = require('./defaultOutput');

function stringToUnderscore(input) {
	return input.replace(/([A-Z])/g, function ($1) {
		return "_" + $1.toLowerCase();
	});
}

function resolveRelative(path, base) {
	// Somebody forgot to properly set a protocol on an otherwise absolute url
	if (path.indexOf("www.") === 0) {
		return 'http://' + path;
	}

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
		const match = base.match(/(\w*:\/\/)?[^\/]*\//) || [base];
		return match[0] + path.slice(1);
	}
	//relative to the current directory
	return base.replace(/\/[^\/]*$/, "") + '/' + path.replace(/^\.\//, '');
}

// result will be mutated
function mapKeys(data, originalKey, result) {
	if (data[originalKey] === null || typeof data[originalKey] === 'undefined') {
		return;
	}

	let key;
	if (originalKey.startsWith('og')) {
		key = stringToUnderscore(originalKey.substring(2)).substring(1);
	}
	else if (originalKey.startsWith('twitter')) {
		key = stringToUnderscore(originalKey);
	} else {
		return;
	}

	if (data[originalKey].value) {
		result.data[key] = [data[originalKey]]
	} else {
		result.data[key] = [{value : data[originalKey]}]
	}
}

module.exports = function postProcess(url, data) {
	const result = defaultOutput(url);

	// Format images for their special cases
	['ogImage', 'twitterImage'].forEach(function (key) {
		if (data[key]) {
			if (!data[key].url) {
				delete data[key];
			} else if (data[key].url) {
				let imageUrl = resolveRelative(data[key].url, url);
				if (process.env.CAMO_KEY && process.env.CAMO_HOST) {
					imageUrl = camoUrl(imageUrl);
				}
				const image = Object.assign({}, {value : imageUrl});
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
	Object.keys(data).forEach(function(originalKey) { mapKeys(data, originalKey, result); });

	if (!result.data.url) {
		result.data.url = [{value : url}];
	}

	return result;
};
