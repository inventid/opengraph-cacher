import moment from "moment-timezone";

const INFO = "INFO";
const WARN = "WARN";
const ERR = "ERROR";

const ENV = process.env.ENV;

function log(level, message) {
	if(ENV === 'test') {
		return;
	}
	console.log(JSON.stringify({time : moment(new Date()).format(), severity : level, message : message}));
}

export default log;
export {INFO, WARN, ERR};
