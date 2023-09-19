///////////////////////////////////////////////////////////
//
// time.js - common time functions 
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'time';

const { ShowLoadedModules } = require('../common_settings.js');

// const RIPPLE_EPOCH_UNIX_DIFFERENCE = 946684800 // the number of seconds since the "Ripple Epoch" of January 1, 2000 (00:00 UTC) is 946684800.

const DateAddTimeInterval = function (initialDate, interval) {
	if (!interval) { return null; }

	let ensureLastDay, secondsAdd = 0, resultDate = initialDate, smthFound = false;
	const a = {
		millisec: { abbr: 'millisecond(s?)|(ms|mls)' },
		seconds:  { abbr: 'second(s?)|(sec|ss|s)', sec: 1 },
		minutes:  { abbr: 'minute(s?)|(min|m)', sec: 60 },
		hours:    { abbr: 'hour(s?)|(hh|h|hrs|hr)', sec: 3600 },
		days:     { abbr: 'day(s?)|(dd|d)', sec: 86400 },
		weeks:    { abbr: 'week(s?)|(ww|wk|w)', sec: 86400 * 7 },
		months:   { abbr: 'month(s?)|(mm|mo)' },
		years:    { abbr: 'year(s?)|(yy|y)' },
	};

	for (let key in a) {
		if (!a[key].abbr) { continue; }

		const regex = new RegExp(`(\\+|\\-)?\\d+\\s?(${a[key].abbr})($|\\s)`, 'gi');
		const res = timeRelativeValueSum(regex, interval);
		if (!res.validMatch || isNaN(res.sum)) { continue; }

		a[key].val = res.sum;
		if (typeof a[key].sec !== 'undefined') { secondsAdd += a[key].val * a[key].sec; }
		smthFound = true;
	}
	if (!smthFound) { return null; }
	if (secondsAdd !== 0) { resultDate.setTime(resultDate.getTime() + (secondsAdd * 1000)); }
	if (a.millisec.val) { resultDate.setTime(resultDate.getTime() + a.millisec.val); }

	// console.log(a); console.log(`secondsAdd: ${secondsAdd}, millisecondsAdd: ${a.millisec.val}`) // debug

	if (!isNaN(a.months.val) && a.months.val !== 0) {
		let mm = resultDate.getMonth() + a.months.val;
		if (mm > 11) { mm -= 12; a.years.val++; }

		ensureLastDay = resultDate.getDate(); // check the last day of month (29,30,31)
		resultDate.setMonth(mm);
	}
	if (!isNaN(a.years.val) && a.years.val != 0) { resultDate.setFullYear(resultDate.getFullYear() + a.years.val); }

	if (ensureLastDay && resultDate.getDate() !== ensureLastDay) {
		resultDate.setDate(0); // set the last day of previous month
	}

	return resultDate;
}

const timeRelativeValueSum = function (regex, interval) {
	let validMatch = false;
	let sum = interval.match(regex)
										?.map((elem) => {
											const num = Number(elem.split(/\s|[a-z]/)[0]);
											if (!isNaN(num)) { validMatch = true; return num; }
										})
										?.reduce((prevSum, curVal) => {
											if (isNaN(prevSum)) { return (curVal || 0); }
											if (isNaN(curVal)) { return prevSum; }
											return (prevSum + curVal);
										})
	sum = sum || 0;
	return { validMatch, sum };
}

if (require.main !== module) {
	if (ShowLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.DateAddTimeInterval = DateAddTimeInterval;
}
