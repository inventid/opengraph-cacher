import {it} from "mocha";
import parallel from 'mocha.parallel';
import assert from "assert";
import {getOpengraphData} from '../src/opengraph';
import testCases from './knownDomainList'

parallel('', async () => {
	testCases
		// .filter((e, i) => i < 5) // For development purposes
		.forEach(async (domain) => {
			it(`can query domain '${domain}'`, async () => {
				const url = `http://${domain}/`;
				const {status, json} = await getOpengraphData(url);
				assert.strictEqual(status, 200);
				assert.strictEqual(json.data.url.length, 1);
			}).timeout(20000);
		});
});
