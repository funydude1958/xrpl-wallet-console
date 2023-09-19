///////////////////////////////////////////////////////////
//
// new.js - generates new wallet (account) credentials
//          A wallet can be derived from either a seed, mnemonic (bip39 or rfc1751), or entropy (array of random numbers).
//
// For most cases, you should use a seed value generated from a strong source of randomness.
//
// BIP-39 English word list has each word being uniquely identified by the first four letters, which can be useful when space to write them is scarce.
// BIP-39 Mnemonic generators:
//   https://iancoleman.io/bip39/
//   https://it-tools.tech/bip39-generator
//
// JS BIP-39: https://github.com/bitcoinjs/bip39
// JS RFC-1751: https://github.com/vmizg/rfc1751.js
//
// Docs:
//   https://xrpl.org/accounts.html#address-encoding
//   https://xrpl.org/wallet_propose.html
//   https://xrpl.org/cryptographic-keys.html
//   https://github.com/XRPLF/xrpl.js/tree/develop/packages/ripple-keypairs
//
// Faucets:
//   https://xrpl.org/xrp-testnet-faucet.html
//
// Testnet Transaction sender:
//   https://xrpl.org/tx-sender.html
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'new';

const { Wallet } = require('xrpl');

const { quit, fail, prompt, defineMainParams, ColoredText } = require('../common/libs/common.js');

const main_params = {
	type: { id: 1, default: '', required: true, example: 'seed / mnemonic', auto: 'seed' },
}

const NewSeed = function () {
	const wallet = Wallet.generate();

	return {
		address: wallet.classicAddress,
		secret: wallet.seed, // base58 encoded seed
		secretType: 'seed',
		wallet
	};
}

const NewFromMnemonic = async function ({ whitespaceDelimitedWords, scrambleInput } = {}) {
	// bip39 example: 'jewel insect retreat jump claim horse second chef west gossip bone frown exotic embark laundry'

	if (!whitespaceDelimitedWords) {
		const words = await QueryMnemonic({ scramble: scrambleInput });
		if (!words) { return; }

		whitespaceDelimitedWords = words.join(' ');
	}

	const wallet = Wallet.fromMnemonic(whitespaceDelimitedWords);

	return {
		address: wallet.classicAddress,
		secret: whitespaceDelimitedWords, // bip39 or RFC1751 mnemonic (Defaults to bip39)
		secretType: 'mnemonic',
		scrambleSecret: scrambleInput,
		wallet
	};
}

const QueryMnemonic = async function ({ scramble }) {
	const numMin = 12;
	const numMax = 24;
	const numDefault = 15;

	const answer = (await prompt(`\n\nType a number of mnemonic words (${numMin}-${numMax}, default: ${numDefault}): `)).trim();
	const answerNum = (answer.length === 0 ? numDefault : Number(answer));
	if (isNaN(answerNum) || answerNum < numMin || answerNum > numMax) { fail('Invalid input'); return; }

	let words = [];
	for (let i = 1; i <= answerNum; i++) {
		const word = await queryWord(i, scramble);
		if (!word?.length) { fail('Aborted'); }

		words.push(word);
	}
	return words;
}

const queryWord = async function (idx, scramble) {
	console.log();
	for (let i = 0; i < 100; i++) {
		let answer = (await prompt(`Type a word # ${idx}: `, { scramble })).trim();
		if (answer) { return answer; }
	}
}

async function main(){
	await defineMainParams(main_params);

	let generated;
	if (main_params.type.value === 'seed') { generated = NewSeed(); }
	else if (main_params.type.value === 'mnemonic') { generated = await NewFromMnemonic({ scrambleInput: false }); }

	if (!generated?.wallet) { fail(`Unable to generate a wallet by "${main_params.type.value}"`); }

	console.log(`\n\nAccount Address: ${ColoredText(generated.address, { color: 'FgGreen' })}`);
	if (generated.wallet.seed) { console.log(`\nSeed Secret: ${ColoredText(generated.wallet.seed, { color: 'Dim' })}`); }
	else { console.log(`\nSecret Mnemonic: ${generated.scrambleSecret ? '[ ** SCRAMBLED ** ]' : generated.secret}`); }

	if (!generated.scrambleSecret) { console.log(`\n${"=".repeat(42)}\n${ColoredText("Please write the Secret down on a paper.\nDon't copy/paste, screenshot or photo !!!", { color: 'Bright' })}\n${"=".repeat(42)}`); }
	console.log();

	const answer = await prompt('\nType [Y]es to show a QR code with Account Address: ');
	if (!['y', 'yes'].includes(answer.toLowerCase())) { quit(); }

	const { ShowHtmlQR } = require('../common/qr.js');

	await ShowHtmlQR(generated.address, { title: ' ', descriptionFieldsBottom: [{ name: 'Account', value: generated.address }] });
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	console.log(MODULE_NAME + ' module loaded');

	exports.NewSeed = NewSeed;
	exports.NewFromMnemonic = NewFromMnemonic;
}
