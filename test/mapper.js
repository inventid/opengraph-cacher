import {describe, it} from 'mocha';
import assert from 'assert';
import postProcess from '../src/mapper';

describe('Mapper', () => {
	describe('#postProcess()', async () => {
		it('should prefer the set url', async () => {
			const result = await postProcess("http://bit.ly/redirect", {ogUrl : 'http://example.com'});
			console.log(JSON.stringify(result));
			assert.equal('http://example.com', result.data.url[0].value);
		});

		it('should prefer the set url but default to the given one', async () => {
			const result = await postProcess("http://bit.ly/redirect", {});
			assert.equal('http://bit.ly/redirect', result.data.url[0].value);
		});

		it('should set the name if given', async () => {
			const result = await postProcess("http://bit.ly/redirect", {ogSiteName : 'Example'});
			assert.equal('Example', result.data.site_name[0].value);
		});

		it('should omit the name if not given', async () => {
			const result = await postProcess("http://bit.ly/redirect", {});
			assert.equal(undefined, result.data.site_name);
		});
	});
});
