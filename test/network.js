import {describe, it} from 'mocha';
import assert from 'assert';
import URL from 'url';
import {isAllowedExtension, isHostnamePubliclyAccessible} from '../src/network';

describe('Network blocks', () => {
	describe('#isPubliclyAccessible()', async () => {
		const create = async (name, url, expected) => {
			it(name, async () => {
				assert.equal(expected, await isHostnamePubliclyAccessible(URL.parse(url).hostname))
			});
		};

		create('should disallow localhost without a port', 'http://localhost', false);
		create('should disallow localhost with a port', 'http://localhost:1223', false);
		create('should disallow localhost ip', 'http://127.0.0.1', false);
		create('should disallow localhost ip xip.io', 'http://127.0.0.1.xip.io', false);

		create('should allow some domain without a port', 'http://example.com', true);
		create('should allow some domain with a port', 'http://example.com:1337', true);
		create('should allow some ip', 'http://1.1.1.1', true);

		create('should allow an external domain', 'http://magnet.me', true);
		create('should not allow an internal domain', 'http://localdev.internal.magnet.me', false);
	});

	describe('#isAllowedExtension()', () => {
		const create = async (name, url, expected) => {
			it(name, async () => assert.equal(expected, isAllowedExtension(url)));
		};

		create('should allow some file', 'http://example.com/index.html', true);
		create('should allow the file root', 'http://example.com:1337/', true);
		create('should allow some ip an url with a block somewhere', 'http://1.1.1.1/files.pdfs/index.html', true);

		const createType = async (type, expected) => {
			const name2 = `should ${!expected ? 'dis' : ''}allow an ${type ? type : 'root document'}`;
			const url = `http://example.com/download${type ? '.' : ''}${type}`;
			console.log(url);
			create(name2, url, expected);
		};
		createType('PDF', false);
		createType('pdf', false);
		createType('gif', false);
		createType('GIF', false);
		createType('JPG', false);
		createType('MP4', false);
		createType('html', true);
		createType('html', true);
		createType('', true);
	});
});
