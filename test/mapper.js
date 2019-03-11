import {describe, it} from 'mocha';
import assert from 'assert';
import postProcess from '../src/mapper';

describe('Mapper', () => {
	describe('#postProcess()', async () => {
		it('should prefer the set url', async () => {
			const result = await postProcess("http://bit.ly/redirect", {ogUrl : 'http://example.com'});
			assert.strictEqual(result.data.url[0].value, 'http://example.com');
		});

		it('should prefer the set url but default to the given one', async () => {
			const result = await postProcess("http://bit.ly/redirect", {});
			assert.strictEqual(result.data.url[0].value, 'http://bit.ly/redirect');
		});

		it('should set the name if given', async () => {
			const result = await postProcess("http://bit.ly/redirect", {ogSiteName : 'Example'});
			assert.strictEqual(result.data.site_name[0].value, 'Example');
		});

		it('should omit the name if not given', async () => {
			const result = await postProcess("http://bit.ly/redirect", {});
			assert.strictEqual(result.data.site_name, undefined);
		});
	});
});
