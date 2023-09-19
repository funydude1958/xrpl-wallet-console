///////////////////////////////////////////////////////////
//
// account_objects.js - returns the raw ledger format for all objects owned by an account.
// syntax: node account_objects [PUB|TEST|DEV] ACCOUNT
//
// Note that the response includes all pending escrow objects with <Account> as the sender or destination address,
// where the sender address is the Account value and the destination address is the Destination value.
//
//
// Docs: https://xrpl.org/look-up-escrows.html
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'account_objects';

const { quit, fail, defineMainParams, XrplClient, showLoadedModules } = require('../common/libs/common.js');
const { ShowXrplHighlitedError } = require('../common/libs/errors.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
}

const AccountObjects = async function ({ account, network, xrplAddress, client }) {
	let lclient, info;

	try{
		if (client) { lclient = client; }
		else {
			console.log('\nConnecting to XRPL to fetch Account Objects...');
			lclient = await XrplClient({ network, xrplAddress });
		}

		const response = lclient.request({ account, command: 'account_objects' });
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

	if (!info) { fail('Unable to fetch Account Objects'); }

	return info;
}

async function main(){
	await defineMainParams(main_params);

	const info = await AccountObjects({ account: main_params.account.value, network: main_params.network.value });
	console.log(info);

	if (info?.result?.account_objects) {
		console.log(`\nACCOUNT OBJECTS (${info.result.account_objects.length}):`);
		console.log(info.result.account_objects);
	}

	quit(`\n${JSON.stringify(info)}`);
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	if (showLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.AccountObjects = AccountObjects;
}
