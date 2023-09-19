///////////////////////////////////////////////////////////
//
// account_info.js - retrieves information about an account, its activity, and its XRP balance.
//                   All information retrieved is relative to a particular version of the ledger. 
//
// Docs:
//   https://xrpl.org/account_info.html
//   https://xrpl.org/accountroot.html#accountroot-flags
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'account_info';

const { dropsToXrp, LedgerEntry } = require('xrpl');

const { quit, fail, defineMainParams, ColoredText, ColoredTextStart, ColoredTextEnd, XrplClient, showLoadedModules } = require('../common/libs/common.js');
const { ShowXrplHighlitedError } = require('../common/libs/errors.js');

const KNOWN_ACCOUNT_FLAGS = {
	lsfPasswordSpent: 'The account has used its free SetRegularKey transaction.',
  lsfRequireDestTag: 'Requires incoming payments to specify a Destination Tag.',
	lsfRequireAuth: "This account must individually approve other users for those users to hold this account's tokens.",
  lsfDisallowXRP: 'Client applications should not send XRP to this account. Enforced by client applications, not by `rippled` service.',
	lsfDisableMaster: 'Disallows use of the master key to sign transactions for this account.',
  lsfNoFreeze: 'This address cannot freeze trust lines connected to it. Once enabled, cannot be disabled.',
	lsfGlobalFreeze: 'All assets issued by this address are frozen.',
  lsfDefaultRipple: "Enable rippling on this addresses's trust lines by default. Required for issuing addresses; discouraged for others.",
	lsfDepositAuth: "This account can only receive funds from transactions it sends, and from preauthorized accounts. (It has DepositAuth enabled)"
}

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
}

const AccountInfo = async function ({ account, network, xrplAddress, client }) {
	let lclient, info;

	try{
		if (client) { lclient = client; }
		else {
			console.log('\nConnecting to XRPL to fetch Account Info...');
			lclient = await XrplClient({ network, xrplAddress });
		}

		const response = lclient.request({ account, command: 'account_info', strict: true });
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

	if (!info) { fail('Unable to fetch Account Info'); }

	return info;
}

const DescribeAccountFlags = function (flagsValue) {
	const list = [], desc = [];
	const enumNumericKeys = Object.keys(LedgerEntry.AccountRootFlags).filter((k) => !isNaN(k));

	enumNumericKeys.forEach(function(key){
		const val = Number(key);
		if ((flagsValue & val) === val) {
			flagsValue -= val;
			list.push(LedgerEntry.AccountRootFlags[key]);
		}
	})
	list.forEach((key) => { desc.push([key, KNOWN_ACCOUNT_FLAGS[key] || 'unknown']) });

	return { list, desc };
}

async function main(){
	await defineMainParams(main_params);

	const info = await AccountInfo({ account: main_params.account.value, network: main_params.network.value });
	console.log(info);
	
	const flags = DescribeAccountFlags(info?.result?.account_data?.Flags);
	if (flags.list.length) {
		console.log('\n* Account Flags:');
		flags.desc.forEach((item) => console.log(`    ${item[0]} - ${item[1]}`));
	}

	if (info?.result?.account_data?.RegularKey) {
		console.log('\n* Account has a Regular Key pair to sign transactions instead of the master key.');
	}

	console.log(`\n\n${ColoredTextStart({ color: 'FgYellow' })}* The information necessary to create new transaction in offline mode:`);
	console.log(`\n    Account Sequence: ${info.result.account_data.Sequence}`);
	console.log(`\n    Ledger current index: ${info.result.ledger_index || info.result.ledger_current_index}${ColoredTextEnd()}`);

	console.log(`\n\n[ Account Balance: ${ColoredText(dropsToXrp(info.result.account_data.Balance), { color: 'Bright' })} XRP ]\n`);

	quit();
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	if (showLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.AccountInfo = AccountInfo;
	exports.DescribeAccountFlags = DescribeAccountFlags;
}
