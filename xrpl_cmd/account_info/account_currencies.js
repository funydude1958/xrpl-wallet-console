///////////////////////////////////////////////////////////
//
// account_currencies.js - retrieves a list of currencies that an account can send or receive, based on its trust lines.
// syntax: node account_currencies [PUB|TEST|DEV] ACCOUNT
//
// The XRP Ledger has two kinds of digital asset: XRP and tokens.
// Both types have high precision, although their formats are different.
//
// Docs: https://xrpl.org/currency-formats.html
//       https://xrpl.org/nftoken.html
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'account_currencies';

const { quit, fail, defineMainParams, XrplClient } = require('../common/libs/common.js');
const { ShowXrplHighlitedError } = require('../common/libs/errors.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
}

const AccountCurrencies = async function ({ account, network, xrplAddress, client }) {
	let lclient, info;

	try{
		if (client) { lclient = client; }
		else {
			console.log('\nConnecting to XRPL to fetch Account Currencies...');
			lclient = await XrplClient({ network, xrplAddress });
		}

		const response = lclient.request({ account, command: 'account_currencies', strict: true });
		response.then(
			result => {
				info = result;
			},
			error => {
				if (ShowXrplHighlitedError(error) && error?.data) { fail(error.data); }
				else fail(`Error: ${error}`);
			}
		)
		await response;

	} catch(err) {
		fail(err);

	} finally {
		if (!client && lclient) { lclient.disconnect(); }
	}

	if (!info) { fail('Unable to fetch Account Currencies'); }

	return info;
}

async function main(){
	await defineMainParams(main_params);

	const info = await AccountCurrencies({ account: main_params.account.value, network: main_params.network.value });
	console.log(info);
	quit(`\n${JSON.stringify(info)}`);
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	console.log(MODULE_NAME + ' module loaded');

	exports.AccountCurrencies = AccountCurrencies;
}
