///////////////////////////////////////////////////////////
//
// wallet.js - Wallet object functions.
//
// Docs: https://js.xrpl.org/classes/Wallet.html
//       https://xrpl.org/peer-to-peer-payments-uc.html#wallets
//       https://xrpl.org/crypto-wallets.html#crypto-wallets
//       https://xrpl.org/build-a-browser-wallet-using-javascript.html#build-a-browser-wallet-using-javascript
///////////////////////////////////////////////////////////

'use strict';

const xrpl = require("xrpl");
const { fail } = require('./common.js');

const Wallet = function (key, { masterAddress } = {}) {
	return WalletFromSecret(key, { failOnError: true, masterAddress }).wallet
}

const WalletFromSecret = function (key, { failOnError, masterAddress } = { failOnError: true }) {
	const regexpMnemonic = /\s+/;
	const walletOpts = {};

	if (!key) {
		const errorText = 'Empty wallet key specified!\n';
		if (failOnError) { fail (errorText); }
		return { invalidKey: true, errorText };
	}

	if (masterAddress) { walletOpts.masterAddress = masterAddress; }

	try {
		const wallet = (regexpMnemonic.test(key)
			?
			xrpl.Wallet.fromMnemonic(key, walletOpts)
			:
			xrpl.Wallet.fromSeed(key, walletOpts));

		return { wallet };

	} catch (err) {
		const invalidKey = (err.message === 'checksum_invalid' || err.message === 'version_invalid' || /invalid_input_size/.test(err.message)); // version_invalid
		const errorText = (invalidKey ? "Invalid wallet key!\n" : 'Wallet (key) error\n');

		if (failOnError) { fail (errorText + err.stack); }
		return { invalidKey, errorText };
	}
};

const IsValidSecretKey = function (key) {
	const xwallet = WalletFromSecret(key, { failOnError: false });

	return (!xwallet.invalidKey && !!xwallet.wallet);
};

if (require.main === module) {

} else {
	exports.Wallet = Wallet;
	exports.WalletFromSecret = WalletFromSecret;
	exports.IsValidSecretKey = IsValidSecretKey;
}
