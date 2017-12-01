import moment from "moment-timezone";

const INFO = "INFO";
const WARN = "WARN";
const ERR = "ERROR";

function log(level, message) {
	console.log(JSON.stringify({time : moment(new Date()).format(), severity : level, message : message}));
}

export default log;
export {INFO, WARN, ERR};
