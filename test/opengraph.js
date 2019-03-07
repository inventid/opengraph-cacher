import {describe, it} from 'mocha';
import assert from 'assert';
import {getOpengraphData} from '../src/opengraph';

describe('opengraph', () => {
	describe('#getOpengraphData()', async () => {
		it('successfully return a working url', async () => {
			const url = "https://magnet.me";
			const result = await getOpengraphData(url);
			assert.strictEqual(200, result.status);
			assert.strictEqual(url, result.json._url);
			const finalUrl = result.json.data.url[0].value;
			if (finalUrl.startsWith(url)) {
				assert.ok(finalUrl, "Got the correct page");
			} else {
				assert.fail("Redirect not properly followed")
			}
		});

		it('successfully return a working url with a redirect', async () => {
			const url = "https://www.magnet.me";
			const result = await getOpengraphData(url);
			assert.strictEqual(200, result.status);
			assert.strictEqual(url, result.json._url);
			const finalUrl = result.json.data.url[0].value;
			if (finalUrl.startsWith('https://magnet.me')) {
				assert.ok(finalUrl, "Got the correct page");
			} else {
				assert.fail("Redirect not properly followed")
			}
		});
	});
}).timeout(5000);
