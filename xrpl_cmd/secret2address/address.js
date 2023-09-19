///////////////////////////////////////////////////////////
//
// address.js - extracts XRPL account (wallet) address from credentials
//              A wallet can be derived from either a seed or mnemonic phrase (bip39 or rfc1751).
//
// For most cases, you should use a seed value generated from a strong source of randomness.
//
// XRP Ledger APIs often use a "base58" encoding with a checksum to represent
// account addresses and other types of values related to cryptographic keys.
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
//   https://xrpl.org/addresses.html#address-encoding
//   https://xrpl.org/wallet_propose.html
//   https://xrpl.org/cryptographic-keys.html
//   https://github.com/XRPLF/xrpl.js/tree/develop/packages/ripple-keypairs
//
// Base58 Docs:
//   https://xrpl.org/base58-encodings.html
//   https://en.bitcoin.it/wiki/Base58Check_encoding
//
// Faucets:
//   https://xrpl.org/xrp-testnet-faucet.html
//
// Testnet Transaction sender:
//   https://xrpl.org/tx-sender.html
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'address';

const { quit, fail, prompt, defineMainParams, ColoredText } = require('../common/libs/common.js');
const { Wallet } = require('../common/sign.js');

const main_params = {
	secret_key: { id: 1, default: '', required: true, desc: 'seed or mnemonic phrase', scramble: true },
}

const AddressFromSecret = function (secretKey) {
	const wallet = Wallet(secretKey);

	return {
		address: wallet.classicAddress,
		//// secret: wallet.seed, // base58 encoded seed
		//// wallet
	}
}

async function main(){
	await defineMainParams(main_params);

	const result = AddressFromSecret(main_params.secret_key.value);
	console.log(`\n\nAccount Address: ${ColoredText(result.address, { color: 'FgGreen' })}\n`);

	const answer = await prompt('\nType [Y]es to show a QR code with Account Address: ');
	if (!['y', 'yes'].includes(answer.toLowerCase())) { quit(); }

	const { ShowHtmlQR } = require('../common/qr.js');
	await ShowHtmlQR(result.address, { title: ' ', descriptionFieldsBottom: [{ name: 'Account Address', value: result.address }] });
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	console.log(MODULE_NAME + ' module loaded');

	// exports.AddressFromSecret = AddressFromSecret
}
