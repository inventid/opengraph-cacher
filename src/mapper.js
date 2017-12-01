import defaultOutput from './defaultOutput';

const config = {
	host : process.env.CAMO_HOST,
	key : process.env.CAMO_KEY
};

const camoUrl = require('camo-url')(config);

function stringToUnderscore(input) {
	return input.replace(/([A-Z])/g, function ($1) {
		return "_" + $1.toLowerCase();
	});
}

function resolveRelative(path, base) {
	// Somebody forgot to properly set a protocol on an otherwise absolute url
	if (path.startsWith("www.")) {
		return 'http://' + path;
	}

	// Absolute URL
	else if (path.match(/^[a-z]*:\/\//)) {
		return path;
	}
	// Protocol relative URL
	else if (path.startsWith("//")) {
		return base.replace(/\/\/.*/, path)
	}
	// Upper directory
	else if (path.startsWith("../")) {
		return resolveRelative(path.slice(3), base.replace(/\/[^\/]*$/, ''));
	}
	// Relative to the root
	else if (path.startsWith('/')) {
		if (!base.endsWith('/')) {
			base += '/';
		}
		const match = base.match(/(\w*:\/\/)?[^\/]*\//) || [base];
		return match[0] + path.slice(1);
	}
	//relative to the current directory
	return base.replace(/\/[^\/]*$/, "") + '/' + path.replace(/^\.\//, '');
}

function mapKey(originalKey) {
	if (originalKey.startsWith('og')) {
		return stringToUnderscore(originalKey.substring(2)).substring(1);
	}
	else if (originalKey.startsWith('twitter')) {
		return stringToUnderscore(originalKey);
	}
}

// result will be mutated
function mapKeys(data, originalKey, result) {
	if (data[originalKey] === null) {
		return;
	}

	const key = mapKey(originalKey);
	if (!key) {
		return;
	}

	if (data[originalKey].value) {
		result.data[key] = [data[originalKey]]
	} else {
		result.data[key] = [{value : data[originalKey]}]
	}
}

export default function postProcess(url, data) {
	const result = defaultOutput(url);
	const canonicalUrl = data.ogUrl || url;

	// Format images for their special cases
	['ogImage', 'twitterImage'].forEach(key => {
		if (data[key]) {
			if (!data[key].url) {
				delete data[key];
			} else if (data[key].url) {
				let imageUrl = resolveRelative(data[key].url, canonicalUrl);
				if (config.host && config.key) {
					imageUrl = camoUrl(imageUrl);
				}

				const image = {value : imageUrl};
				Object.keys(data[key])
					.filter(e => e !== 'url')
					.forEach(function (innerKey) {
						image[innerKey] = [{value : data[key][innerKey]}]
					});
				data[key] = image;
			}
		}
	});

	// Now map this to useful structures
	Object.keys(data).forEach(originalKey => mapKeys(data, originalKey, result));

	if (!result.data.url) {
		result.data.url = [{value : url}];
	}
	return result;
}
