///////////////////////////////////////////////////////////
//
// common.js - common functions 
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'common';

// const RIPPLE_EPOCH_UNIX_DIFFERENCE = 946684800 // the number of seconds since the "Ripple Epoch" of January 1, 2000 (00:00 UTC) is 946684800.

const xrpl = require('xrpl');
const readline = require('readline'); // built-in nodejs module

const { validateMainParams, requestParameters, PromptParameter } = require('./cli_args.js');
const { XrplServerSettings, XrplServers, Colors, ShowLoadedModules, IsOffline } = require('../common_settings.js');
const { ShowMemos } = require('./memo.js');
// const { type } = require('os');

const XRPL_SERVERS = XrplServers();
const COLORS = Colors();

const quit = function (message = null) {
	if (message) { console.log(message); }
	process.exit(0);;
}

const fail = function (message) {
	if (typeof message !== 'undefined') console.error(message);
	process.exit(1);
}

const prompt = function (message) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	return new Promise(resolve => rl.question(message, answer => {
		rl.history = rl.history.slice(1);
		rl.close();
		resolve(answer);
	}));
}

const checkObjectHasArrays = (obj, maxDeepLevel, arraysList, curDeepLevel) => {
  let stoppedInMiddle = false;
  let arrayFound = false;

  for (let key in obj) {
    if (!obj.hasOwnProperty(key)) { continue; }

    if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (Array.isArray(obj[key])) {
        arrayFound = true;
        if (typeof arraysList !== 'undefined') { arraysList << { key, value: obj[key] }; }
        continue;
      }
      curDeepLevel = curDeepLevel || 0;
      if (curDeepLevel >= maxDeepLevel) { stoppedInMiddle = true; break; }

      const res = isObjectHasArrays(obj[key], maxDeepLevel, arraysList, curDeepLevel + 1);
      if (res.arrayFound) { arrayFound = true; }
      if (res.stoppedInMiddle) { stoppedInMiddle = true; }
    }
  }

  return { arrayFound, stoppedInMiddle };
}

const ConfirmFeeValue = async function (value) {
	const answer = await PromptParameter({ message: 'Enter transaction Fee in XRP drops', newline: true, required: true, infinityLoop: 20, type: 'number', default: value });
	return (answer || value);
}

const ColoredText = function (text, { color, bgColor } = {}) {
	let str = "", colored;
	if (bgColor && COLORS[bgColor]) { str += `${COLORS[bgColor]}`; colored = true; }
	if (color && COLORS[color]) { str += `${COLORS[color]}`; colored = true; }

	str += text;
	if (colored) { str += `${COLORS.ResetColor}`; }

	return str;
}

const ColoredTextStart = function ({ color, bgColor } = {}) {
	if (bgColor && COLORS[bgColor]) { return COLORS[bgColor]; }
	if (color && COLORS[color]) { return COLORS[color]; }
}

const ColoredTextEnd = function () {
	return COLORS.ResetColor;
}

const OutputJsonTransaction = function (txParams) {
	console.log(`\nJSON to be used on 'sign' script call:\n\n${ColoredText(JSON.stringify(txParams), { color: 'FgGreen' })}\n`);
}

const ShowWarning = function (message) {
	console.log();
	console.log(ColoredText(message, { color: 'FgYellow' }));
}

const ShowTransactionDetails = function (tx, { extra } = {}) {
	console.log('\nTRANSACTION DETAILS:');
	console.log(tx);

	const title = `[ ${tx.TransactionType} Details ]`;
	const topLineWidth = 32;
	const btmLineWidth = topLineWidth + title.length;
	console.log(`\n${'='.repeat(topLineWidth / 2)}${title}${'='.repeat(topLineWidth / 2)}`);

	if (tx.Amount) { console.log(`Amount: ${ColoredText(`${xrpl.dropsToXrp(parseInt(tx.Amount, 10))} XRP`, { color: 'FgGreen' })}`); }
	console.log(`Fee: ${ColoredText(`${tx.Fee} drops`, { color: 'FgGreen' })}`);

	if (tx.Account && tx.Destination) { console.log(`From [${tx.Account}]  \x1b[32mTo\x1b[0m  [\x1b[32m${tx.Destination}\x1b[0m]${tx.Account === tx.Destination ? '  (identical addresses)' : ''}`); }
	else if (tx.Account) { console.log(`Initiator Account: ${tx.Account}`); }

	if (tx.Memos || tx.DestinationTag) {
		console.log();
		if (tx.Memos) { ShowMemos(tx.Memos, { indent: 2, title: 'Memo: ' }); }
		if (tx.DestinationTag) { console.log(`Destination Tag: ${ColoredText(tx.DestinationTag, { color: 'FgYellow' })}`); }
	}

	if (tx.TransactionType === 'TrustSet') {
		if (!tx.Flags) {
			console.log(
				(typeof tx.Flags === 'undefined' && tx.LimitAmount?.value === '0') ? 'Trustline will be removed if not frozen and the balance is zero' : '<NO FLAGS SPECIFIED>'
			);
		}
		else if (extra?.flags) {
			console.log('Flags:');
			extra.flags.forEach((item) => {
				const data = {}; data[`${item[0]}`] = item[1]; console.log(data);
			});
		}
	}

	console.log(`${'='.repeat(btmLineWidth)}`);
}

const defineMainParams = async function (main_params, autoDetectParamType = true) {
	Object.keys(main_params).forEach(key => {
		const cmdValue = process.argv[main_params[key].id + 1];

		main_params[key].cmdParam = !!cmdValue;
		main_params[key].value = cmdValue || main_params[key].default;
	})

	let validation = validateMainParams(main_params, false);
	if (validation.requiredValid && validation.nonrequiredValid ) { return; }

	await requestParameters(main_params, { autoDetectParamType, initialRequest: true});

	validation = validateMainParams(main_params, true);
	if ( !validation.requiredValid ) { fail('Invalid parameters'); }
}

const rippleEpochTimestamp = function (timeString) {
	if (!timeString) { quit("Undefined timeString in call rippleEpochTimestamp()"); }

	return xrpl.isoTimeToRippleTime(timeString)
}

const validateRippleEpochTimestamp = function (rippleEpochTimestamp, unixTimeString) {
	const dateUnixTimestampMillisec = (rippleEpochTimestamp + 946684800) * 1000
	const dateUnix = new Date(dateUnixTimestampMillisec)

	const arr = unixTimeString.split('Z')[0].split('.')
	const no_tz = !arr[1]?.length
	const no_time = no_tz && !arr[0].split('T')[1]?.length
	const normalizedTestString = (no_time ? `${arr[0]}T00:00:00.000Z` : `${arr[0]}.000Z`)

	// rippleTimeToUnixTime(rpepoch: number)
	// unixTimeToRippleTime(timestamp: number)
	// rippleTimeToISOTime(rippleTime: number) // Iso8601 timestamp
	// console.log({ fromRippleTS: dateUnix.toISOString(), testTS: normalizedTestString }) // debug

	return (dateUnix.toISOString() == normalizedTestString)
}

const ledgerIndexMinTimeout = function (network, { qr } = {}) {
	const setts = XrplServerSettings(network);

	return (qr ? setts.indexMinTimeoutOffline : setts.indexMinTimeout);
}

const networkMinFee = function (network) {
	return XrplServerSettings(network).minFee;
}

const XrplServerAddress = function (network) {
	const setts = XrplServerSettings(network);
	if (!setts) { fail('Unknown XRPL network: "' + network + '".\nAvailable networks: ' + Object.keys(XRPL_SERVERS)); }

	return setts.address;
}

const XrplClient = async function ({ network, xrplAddress } = {}) {
	let client;

	if (IsOffline()) { fail("OFFLINE mode enabled in `common_settings.js`\n\nDenied to connect to XRPL in offline mode"); }

	try{
		if (!xrplAddress) { xrplAddress = XrplServerAddress(network); }
		client = new xrpl.Client(xrplAddress);
		await client.connect();
		return client;

	} catch(err) {
		fail(err);
		if (client) { client.disconnect(); }
	}
}

const lastLedgerIndex = async function ({ network, xrplAddress, client } = {}) {
	let lclient, lastIndex;

	try{
		if (client) { lclient = client; }
		else {
			console.log('\nConnecting to XRPL to fetch Last Ledger Index...');
			lclient = await XrplClient({ network, xrplAddress });
		}

		const response = lclient.getLedgerIndex();
		response.then(
			result => {
				lastIndex = result;
				console.log(`Last Ledger index: ${result}`);
			},
			error => {
				fail(`Error: ${error}`);
			}
		)
		await response;

	} catch(err) {
		fail(err);

	} finally {
		if (!client && lclient) { lclient.disconnect(); }
	}

	if (!lastIndex) { fail('Unable to fetch Last Ledger Index'); }

	return lastIndex;
}

if (require.main !== module) {
	if (ShowLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.quit = quit;
	exports.fail = fail;
	exports.prompt = prompt;
	exports.defineMainParams = defineMainParams;
	exports.validateMainParams = validateMainParams;
	exports.rippleEpochTimestamp = rippleEpochTimestamp;
	exports.validateRippleEpochTimestamp = validateRippleEpochTimestamp;
	exports.checkObjectHasArrays = checkObjectHasArrays;
	exports.XrplServerAddress = XrplServerAddress;
	exports.XrplClient = XrplClient;
	exports.lastLedgerIndex = lastLedgerIndex;
	exports.ledgerIndexMinTimeout = ledgerIndexMinTimeout;
	exports.networkMinFee = networkMinFee;
	exports.isOffline = IsOffline;
	exports.showLoadedModules = ShowLoadedModules;
	exports.ColoredText = ColoredText;
	exports.ColoredTextStart = ColoredTextStart;
	exports.ColoredTextEnd = ColoredTextEnd;
	exports.OutputJsonTransaction = OutputJsonTransaction;
	exports.ShowTransactionDetails = ShowTransactionDetails;
	exports.ShowWarning = ShowWarning;
	exports.ConfirmFeeValue = ConfirmFeeValue;
}

if (IsOffline()) { console.log(`\n${ColoredText("-=[ OFFLINE mode enabled in 'common/common_settings.js' ]=-", { color: 'Bright', bgColor: 'BgBlue' })}\n`); }
