///////////////////////////////////////////////////////////
//
// escrow_condition.js - escrow condition functions
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'escrow_condition';

const { fail, ColoredText, ColoredTextStart, ColoredTextEnd, showLoadedModules } = require('../common/libs/common.js');
const { Sha256condition, Sha256Fulfillment } = require('../common/libs/bcrypt_sha256.js');
const { prompt, PromptRequired, ProcessInputDateTime } = require('../common/libs/cli_args.js');
const { EscrowConditionBcryptRounds } = require('../common/common_settings.js');

const escrowPasswordProtectionOnRequest = async function ({ account, releaseTimeString, skipAskCancelAfter }) {
	const answers = await escrowAskPasswordProtection();
	if (!answers.protect) { return answers; }

	if (!skipAskCancelAfter) { await escrowAskPasswordCancellation({ answers, releaseTimeString }); }

	const conditionParams = { verbose: false };

	if (!answers.random && answers.secret) {
		conditionParams.bcryptFromSecret = answers.secret;
		conditionParams.bcryptUsePermanentSaltFromSecret = !answers.randomSalt;
		conditionParams.bcryptPermanentSaltPepper = account;
		conditionParams.bcryptHashRounds = EscrowConditionBcryptRounds();
	}

	const shaCondition = Sha256condition(conditionParams);
	if (!shaCondition.hexCondition) { return answers; }

	if (!answers.random) {
		if (shaCondition.salt) { conditionParams.bcryptExistingSalt = shaCondition.salt; }
		conditionParams.verbose = false;

		const result_test = Sha256condition(conditionParams);
		if (shaCondition.hexCondition !== result_test.hexCondition || shaCondition.hexSecretPreimage !== result_test.hexSecretPreimage || typeof shaCondition.hexCondition === 'undefined' || typeof shaCondition.hexSecretPreimage === 'undefined' || shaCondition.hexSecretPreimage === 'undefined' || !shaCondition.hexCondition || !shaCondition.hexSecretPreimage) {
			fail('Internal error occurred in Sha256condition()');
			return answers;
		}
	}

	const showBcryptRounds = (typeof shaCondition.bcryptRounds !== 'undefined');
	let showSecrets = shaCondition.random || shaCondition.saltRandom;
	if (!showSecrets && answers.secret) {
		const answer = await PromptRequired('Show secret keys so you write them down on paper ? (Yes/No)', { newline: true });
		showSecrets = ['y', 'yes'].includes(answer.toLowerCase());
	}

	if (showSecrets) {
		console.log(`\n${ColoredTextStart({ color: 'Bright' })}${"=".repeat(87)}`);
		if (shaCondition.random || answers.secret) { console.log(`\nSecret SHA-256 Key: ${shaCondition.hexSecretPreimage.toUpperCase()}`); }
		if (shaCondition.saltRandom) { console.log(`\nSecret Salt phrase: ${shaCondition.salt}`); }
		if (showBcryptRounds) { console.log(`\nCrypto Hash Rounds number: ${shaCondition.bcryptRounds}.`); }

		const txt = (shaCondition.random || !shaCondition.saltRandom ? "Secret SHA-256 Key" : "Secret Salt");
		console.log(`\n\n${ColoredTextStart({ color: 'FgYellow' })}!!! Write down the ${txt} on a piece of paper and don't lose it !!!`);
		if (shaCondition.saltRandom) { console.log("\nYour password will be invalid without secret salt phrase!\nSecret Salt is case sensitive."); }
		if (!shaCondition.random && answers.secret) { console.log("\nYou can use the Secret SHA-256 Key directly instead of your password to finish the escrow."); }
		console.log(`\n${ColoredTextEnd()}${ColoredTextStart({ color: 'Bright' })}${"=".repeat(87)}${ColoredTextEnd()}`);
		await new Promise(r => setTimeout(r, 3000));

	} else if (showBcryptRounds) {
		console.log(`\n${ColoredTextStart({ color: 'Bright' })}Crypto Hash Rounds count: ${shaCondition.bcryptRounds}.`);
		await new Promise(r => setTimeout(r, 1500));
	}

	answers.condition = shaCondition;
	return answers;
}

const escrowFinishFulfillmentRequest = async function ({ escrowSrcAccountAddress, escrowTestCondition } = {}) {
	let secret, shaCondition;

	for (let i = 0; i < 20; i++) {
		const isProtected = (await PromptRequired('Is the escrow protected by a password or a key ? (Password / Key / Non-protected)', { newline: true })).trim();
		const byPassword = ['p', 'password'].includes(isProtected.toLowerCase());
		const byKey = ['k', 'key'].includes(isProtected.toLowerCase());
		if (!byPassword && !byKey) { return; }

		if (byKey) {
			secret = await PromptRequired('Enter sha-256 secret to finish the escrow', { scramble: true, newline: true });
			if (secret) {
				try {
					shaCondition = Sha256condition({ verbose: false, existingPreimage: secret });
					if (shaCondition.hexSecretPreimage.toUpperCase() !== secret.toUpperCase()) { fail('Internal Error'); return; }
				} catch (e) { console.log(`\nError: ${e}`); }
			}

		} else if (byPassword) {
			const password = await PromptRequired('Enter password to finish the escrow', { scramble: true, newline: true });
			const salt = (await prompt('\nEnter optional secret salt if you know it: ')).trim();
			if (password) {
				shaCondition = Sha256condition({ verbose: false, bcryptFromSecret: password, bcryptExistingSalt: salt, bcryptUsePermanentSaltFromSecret: true, bcryptPermanentSaltPepper: escrowSrcAccountAddress });
			}
		}

		if (!shaCondition) {
			if (byPassword) { fail('Unable to solve the password specified to a valid condition fulfillment required to finish the escrow'); }
			if (byKey) {
				console.log('Unable to compare your secret and required condition.');
				const answer = await PromptRequired('Continue anyway with this secret ? (Yes/No)', { newline: true });
				if (['y', 'yes'].includes(answer.toLowerCase())) { return { data: secret } }
			}
			return;
		}

		if (!escrowTestCondition || shaCondition.hexCondition.toUpperCase() === escrowTestCondition.toUpperCase()) {
			return escrowFulfillment(shaCondition.hexSecretPreimage);
		}

		console.log(ColoredText("The specified secret mismatched the escrow condition", { color: 'FgYellow' }));
		let answer = await PromptRequired('Continue anyway with this secret ? (Yes/No)', { newline: true });
		if (['y', 'yes'].includes(answer.toLowerCase())) { return escrowFulfillment(shaCondition.hexSecretPreimage) };

		answer = await PromptRequired('Do you want to enter a new secret and try again ? (Yes/No)', { newline: true });
		if (!['y', 'yes'].includes(answer.toLowerCase())) { break; }
	}

	return;
}

const escrowFulfillment = function (secret) {
	const preimage = Buffer.from(secret, 'hex');
	return { data: Sha256Fulfillment({ preimage }), preimageSize: preimage.length };
}

const escrowAskPasswordProtection = async function () {
	const result = {};
	const passwordMinLength = 6;

	let answer;

	answer = (await prompt('\nDo you want to protect the escrow finish operation with password? (Yes/No) [No]: ')).trim();
	result.protect = ['y', 'yes'].includes(answer.toLowerCase());
	if (!result.protect) { return result; }

	answer = (await prompt('\nGenerate random SHA-256 key pair or use your password? (Random/Password) [Random]: ')).trim();
	if (!answer || ['r', 'random', 'rnd'].includes(answer.toLowerCase())) {
		result.random = true;
		return result;
	}

	console.log(ColoredText('\n!!! DO NOT USE the password already used earlier !!!', { color: 'FgYellow' }));
	console.log(ColoredText("because the secret key corresponding to a combination of\npassword and account will be visible in public transactions\nafter it is used to finish an escrow", { color: 'FgYellow' }));

	answer = await PromptRequired('Enter password to protect the finish of this escrow', { scramble: true, newline: true, answerMinLength: passwordMinLength });
	answer = answer.trim();
	if (!answer) { return result; }

	const answer2 = (await PromptRequired('Confirm password', { scramble: true, newline: true, answerMinLength: passwordMinLength })).trim();
	if (!answer2 || answer2 !== answer) { fail('\nInvalid password confirmation'); return result; }

	const secret = answer;

	answer = (await prompt('\nAdd random 22 characters to passphrase (more secure, you must remember them)? (Yes/No) [No]: ')).trim();
	const randomSalt = ['y', 'yes'].includes(answer.toLowerCase());

	result.secret = secret;
	result.randomSalt = randomSalt;

	return result;
}

const escrowAskPasswordCancellation = async function ({ answers, releaseTimeString }) {
	let answer = (await prompt(`\nAllow escrow cancellation after a few decades in case you lose the ${answers.random ? 'secret key' : 'password'}? (Yes/No) [Yes]: `)).trim();
	if (answer && !['y', 'yes'].includes(answer.toLowerCase())) { return; }

	console.log();
	for (let i = 0; i < 20; i++) {
		answer = await PromptRequired('Enter the number of YEARS AFTER THE RELEASE DATE to allow cancellation');
		answer = Math.abs(answer);
		if (isNaN(answer)) { answer = null; continue; }

		answer = ProcessInputDateTime(`${answer} years`, { type: ['timeoffset', 'drop_ms'] }, new Date(releaseTimeString));
		if (answer) { break; }
	}
	if (!answer) { return; }

	answers.timeConditionCancelAfter = answer;
}

async function main(){
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	if (showLoadedModules()) { console.log(MODULE_NAME + ' module loaded') };

	exports.escrowPasswordProtectionOnRequest = escrowPasswordProtectionOnRequest;
	exports.escrowFinishFulfillmentRequest = escrowFinishFulfillmentRequest;
}
