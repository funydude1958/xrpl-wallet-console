///////////////////////////////////////////////////////////
//
// account_lines.js - returns the raw ledger format for all trust lines linked to an account.
// syntax: node account_lines [PUB|TEST|DEV] ACCOUNT PEER_ACCOUNT
//
// The account_lines method returns information about an account's trust lines,
// including balances in all non-XRP currencies and assets.
// All information retrieved is relative to a particular version of the ledger.
//
// Docs: https://xrpl.org/account_lines.html
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'account_lines';

const { quit, fail, defineMainParams, XrplClient, showLoadedModules } = require('../common/libs/common.js');
const { ShowXrplHighlitedError } = require('../common/libs/errors.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	peer_account: { id: 3, default: '', required: false, desc: 'Filter by peer account address' },
}

const AccountLines = async function ({ account, network, xrplAddress, client, peer }) {
	let lclient, info;

	try{
		if (client) { lclient = client; }
		else {
			console.log('\nConnecting to XRPL to fetch Account Lines...');
			lclient = await XrplClient({ network, xrplAddress });
		}

		const response = lclient.request({ account, command: 'account_lines', peer });
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

	if (!info) { fail('Unable to fetch Account Lines'); }

	return info;
}

async function main(){
	await defineMainParams(main_params);

	const info = await AccountLines({ account: main_params.account.value, network: main_params.network.value, peer: main_params.peer_account.value });
	console.log(info);

	if (info?.result?.lines) {
		console.log(`\nACCOUNT LINES (${info.result.lines.length}):`);
		console.log(info.result.lines);
	}

	quit(`\n${JSON.stringify(info)}`);
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	if (showLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.AccountLines = AccountLines;
}
