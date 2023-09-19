///////////////////////////////////////////////////////////
//
// cli_args.js - CLI input arguments utils
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'cli_args';

const readline = require('readline'); // built-in nodejs module 

const { DateAddTimeInterval } = require('./time.js');
const { ShowLoadedModules } = require('../common_settings.js');

const clearLastLines = function (count) {
  process.stdout.moveCursor(0, -count);
  process.stdout.clearScreenDown();
}

const prompt = function (message, { hide, scramble } = {}) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	return new Promise(resolve => {
		rl.question(message, answer => {
			rl.history = rl.history.slice(1);
			rl.close();
			resolve(answer);
		});

		if (scramble || hide) {
			rl._writeToOutput = function (stringToWrite) {
				const chr = (hide ? '': '*');
				let out = stringToWrite;

				if (message?.length && stringToWrite.startsWith(message)) {
					const mm = /^.*[\r\n]$/.exec(stringToWrite);
					const len = (mm ? mm.index : stringToWrite.length) - message.length;
					out = `${message}\x1b[2m${chr.repeat(len)}\x1b[0m`; // 'Dim' color

				} else if (!/^[\r\n]/.exec(stringToWrite)) {
					out = `\x1b[2m${chr.repeat(stringToWrite.length)}\x1b[0m`;
				}
				rl.output.write(out);
			}
		}
	})
}

const PromptRequired = async function (promptQuestion, options = {}) {
	const opts = Object.assign({}, options);
	opts.message = promptQuestion;
	opts.infinityLoop = 20;

	return await PromptParameter(opts);
}

const PromptParameter = async function (paramOptions, paramKey, initialRequest = false) {
	let promptQuestion;
	const num = paramOptions.infinityLoop || 10;

	const textDescLine = paramOptions.descLine?.trim();
	if (textDescLine) { console.log(`\n${textDescLine}`); }

	for (let i = 0; i < num; i++) {
		const newline = (i === 0 ? '\n' : '');
		const existDefaultValue = paramIsAnyDefaultValue(paramOptions);

		if (paramKey) {
			const textRequired = (paramOptions.required ? 'required' : 'optional');
			const textDescription = (paramOptions.desc ? `, ${paramOptions.desc}` : '');
			const textExample = (paramOptions.example ? `, example: ${paramOptions.example}` : '');
			const textAuto = (existDefaultValue ? `; default: ${paramDefaultAutoValue(paramOptions)}` : '');
			promptQuestion = `${newline}${paramKey} (${textRequired}${textDescription}${textExample}${textAuto}): `;

		} else {
			const textAuto = (existDefaultValue ? ` [Default: ${paramDefaultAutoValue(paramOptions)}]` : '');
			promptQuestion = `${newline}${paramOptions.message}${textAuto}: `;
		}

		let answer = (await prompt(promptQuestion, { scramble: paramOptions.scramble })).trim();
		if (!answer && existDefaultValue) { answer = paramDefaultAutoValue(paramOptions); }
		if (answer && typeof paramOptions.answerMinLength !== 'undefined' && paramOptions.answerMinLength >= 0 && answer.length < paramOptions.answerMinLength) {
			console.log(`  You must type at least ${options.answerMinLength} characters`);
			continue;
		}
		if (answer) { answer = paramProcessByType(answer, paramOptions); }
		if (!answer && paramOptions.required) {
			if (!initialRequest || paramOptions.mandatory_required) { continue; }

			if (!paramOptions.cmdParam && paramIsOfType('secret_key', paramOptions)) {
				console.log("  You will have to enter the Secret Key later.\n");
				break;
			}
			continue;
		}
		if (!answer) { break; }

		return answer;
	}
}

const PromptWalletKey = async function (paramOptions, paramName, walletAccount) {
	const opts = Object.assign({}, paramOptions);
	opts.newline = true;
	opts.default = null;
	opts.infinityLoop = 20;

	if (!opts.descLine) {
		const textAccount = (walletAccount ? ` for account '${walletAccount}'` : '');
		opts.descLine = `Enter the wallet's secret key to sign the transaction${textAccount}.`;
	}

	return await PromptParameter(opts, paramName);
}

const validateMainParams = function (params, allowSkipSomeRequired = false) {
	let requiredValid = true, nonrequiredValid = true;

	Object.keys(params).forEach(key => {
		if (params[key].value) { return; }
		if (params[key].mandatory_required) { params[key].required = true; }
		if (!params[key].required) { nonrequiredValid = false; return; }

		console.error('Required parameter ' + params[key].id + ' ("' + key + '") not specified');

		if (allowSkipSomeRequired && !params[key].mandatory_required) {
			if (!params[key].cmdParam && paramIsOfType('secret_key', params[key])) { return; }
		}

		requiredValid = false;
	})

	return { requiredValid, nonrequiredValid };
}

const requestParameters = async function (params, { autoDetectParamType, initialRequest} = { autoDetectParamType: true }) {
	let firsttime = true;

	for (const key of Object.keys(params)) {
		if (params[key].value) { continue; }
		if (firsttime) { console.log('Specify parameters to continue'); firsttime = false; }
		if (!params[key].type && autoDetectParamType) { params[key].type = paramTypeByName(key); }

		params[key].value = await PromptParameter(params[key], key, initialRequest);
	}
}

function paramIsOfType (type, opts = {}) {
	if (!opts.type) { return false; }
	if (typeof opts.type === 'string' && opts.type === type) { return true; }
	if (typeof opts.type === 'object' && Array.isArray(opts.type) && opts.type.includes(type)) { return true; }

	return false;
}

function paramProcessByType (answer, paramOptions) {
	if (paramIsOfType('datetime', paramOptions)) { answer = ProcessInputDateTime(answer, paramOptions); }
	if (paramIsOfType('number', paramOptions)) { answer = ProcessInputNumber(answer, paramOptions); }
	if (paramIsOfType('xrpl_account', paramOptions)) { answer = ProcessXrplAccount(answer, paramOptions); }
	if (paramIsOfType('secret_key', paramOptions)) { answer = ProcessXrplAccountSecret(answer, paramOptions); }

	return answer;
}

const ProcessXrplAccount = function (answer, paramOptions) {
	const { IsValidSecretKey } = require('./wallet');

	if (IsValidSecretKey(answer)) {
		clearLastLines(1); // let's erase the entered secret key from the screen
		console.error('Invalid Account! You specified a Secret Key instead of an account address!\n');
		return null;
	}
	return answer;
}

const ProcessXrplAccountSecret = function (answer, paramOptions) {
	const { IsValidSecretKey } = require('./wallet');

	if (!IsValidSecretKey(answer)) {
		console.error('Invalid secret key specified!\n');
		return null;
	}
	// paramOptions.required
	return answer;
}

const ProcessInputDateTime = function (answer, paramOptions, dateOffsetFrom) {
	let newAnswer;
	let dateTest = new Date(answer);

	if (!isValidDate(dateTest) && paramIsOfType('timeoffset', paramOptions)) {
		dateOffsetFrom = dateOffsetFrom || new Date();
		dateTest = DateAddTimeInterval(dateOffsetFrom, answer);
	}

	if (paramIsOfType('drop_ms', paramOptions) && isValidDate(dateTest)) {
		const ms = dateTest.getMilliseconds();
		if (ms !== 0) { dateTest = DateAddTimeInterval(dateTest, `${ms >= 500 ? (1000 - ms) : -1*ms}ms`); }
	}
	
	if (!isValidDate(dateTest)) {
		console.error('Invalid date specified!\n');
		return null;
	}
	newAnswer = dateTest.toISOString();

	if (newAnswer !== answer) {
		answer = newAnswer;
		console.log(`\x1b[32m< Specified ISO date: ${answer}  |  ${dateTest} >\x1b[0m`);
	}

	return answer;
}

const ProcessInputNumber = function (answer, paramOptions) {
	const newAnswer = Number(answer);
	answer = (isNaN(newAnswer) ? null : newAnswer);

	return answer;
}

function isValidDate(dateTest) {
	return (dateTest instanceof Date && !isNaN(dateTest));
}

function paramIsAnyDefaultValue(paramOptions) {
	if (!isUndefinedEmptyValue(paramOptions?.default)) { return true; }

	return !isUndefinedEmptyValue( paramAutoValue(paramOptions) );
}

function paramAutoValue(paramOptions) {
	if (typeof paramOptions?.auto === 'function') { return paramOptions.auto(); }

	return paramOptions.auto;
}

function paramDefaultAutoValue(paramOptions) {
	if (isUndefinedEmptyValue(paramOptions?.default) && ('auto' in paramOptions)) { return paramAutoValue(paramOptions); }

	return paramOptions.default;
}

function isUndefinedEmptyValue(val) {
	if (typeof val === 'undefined' || val === null) { return true; }
	if (['string', 'object'].includes(typeof val) && val.length === 0) { return true; }
	if (typeof val === 'object' && Object.keys(val).length === 0) { return true; }

	return false;
}

function paramTypeByName (key) {
	switch (key) {
		case 'account':
		case 'address':
			return 'xrpl_account';

		case 'account_secret_key':
		case 'secret_key':
		case 'sign_key':
		case 'key':
			return 'secret_key';
	}
}

if (require.main !== module) {
	if (ShowLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.validateMainParams = validateMainParams;
	exports.requestParameters  = requestParameters;
	exports.PromptParameter = PromptParameter;
	exports.PromptRequired  = PromptRequired;
	exports.PromptWalletKey = PromptWalletKey;
	exports.prompt = prompt;
	exports.ProcessInputDateTime = ProcessInputDateTime;
}
