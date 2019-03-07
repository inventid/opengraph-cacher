import express from 'express';
import log, {INFO} from "./log";
import {getOpengraphData, removeOpengraphData} from "./opengraph";

const HTTP_TIMEOUT = Number(process.env.HTTP_TIMEOUT) || 10000;

log(INFO, "Using a HTTP timeout of " + HTTP_TIMEOUT + " milliseconds");

function respondWithData(res, data) {
	res.status(data.status).json(data.json).end();
}

const app = express();
app.get('/opengraph', async (req, res) => {
	const data = await getOpengraphData(req.query.url);
	respondWithData(res, data);
});
app.delete('/opengraph', async (req, res) => {
	const data = await removeOpengraphData(req.query.url);
	respondWithData(res, data);
});
app.get('/_health', (req, res) => res.end('Jolly good here'));
app.listen(7070, () => log(INFO, 'Server is listening'));
