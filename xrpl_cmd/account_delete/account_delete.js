///////////////////////////////////////////////////////////
//
// account_delete.js - deletes an account and any objects it owns in the XRP Ledger.
//                     If possible, sending the account's remaining XRP to a specified destination account.
//
// syntax: node account_delete [PUB|TEST|DEV] ACCOUNT DESTINATION_ACCOUNT
//
// To be deleted, an account must meet the following requirements:
//    - The account's Sequence number plus 256 must be less than the current Ledger Index.
//    - The account must not be linked to any of the following types of ledger objects (as a sender or receiver):
//      + Escrow
//      + PayChannel
//      + RippleState
//      + Check
//   - The account must own fewer than 1000 objects in the ledger.
//   - The AccountDelete transaction must pay a special transaction cost equal to at least the owner reserve for one item (currently 2 XRP).
//
// As an additional deterrent against ledger spam, the AccountDelete transaction requires a much higher than usual transaction cost:
//   instead of the standard minimum of 0.00001 XRP, AccountDelete must destroy at least the owner reserve amount, currently 2 XRP.
//   This discourages excessive creation of new accounts because the reserve requirement cannot be fully recouped by deleting the account.
// 
// The transaction cost always applies when a transaction is included in a validated ledger,
// even if the transaction fails to delete the account. (See Error Cases.)
// To greatly reduce the chances of paying the high transaction cost if the account cannot be deleted, submit the transaction with fail_hard enabled.
//
//
// !!! ATTENTION: Please do not use an exchange account or other custodial wallet as destination address! YOU MAY LOSE YOUR FUNDS !!!
//
//
// Docs:
//   https://xrpl.org/accounts.html#deletion-of-accounts
//   https://xrpl.org/reserves.html
//   https://xrpl.org/accountdelete.html
//   https://js.xrpl.org/interfaces/AccountDelete.html
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'account_delete';

const { quit, fail, defineMainParams, ledgerIndexMinTimeout, networkMinFee, ShowTransactionDetails, OutputJsonTransaction } = require('../common/libs/common.js');
const { AddTransactionSequences } = require('../common/sign.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	destination_account: { id: 3, default: '', required: true, desc: 'Account to receive remaining XRP' },
	tx_fee_drops: { id: 4, default: '', required: true, desc: 'Transaction Fee in XRP drops (at least 2000)', auto: () => networkMinFee(main_params.network.value) },
}

function AccountDelete ({ account, accountDest, tagDest, feeDrops }) {
	let error;

	if (!account) { console.error("Must specify 'account' in call AccountDelete()"); error = true; }
	if (!accountDest){ console.error("Must specify 'accountDest' in call AccountDelete()"); error = true; }
	if (account === accountDest){ console.error("Destination account must not be equal to the source account"); error = true; }
	if (!feeDrops || feeDrops <= 0) { console.error("Must specify 'feeDrops' greater than zero in call AccountDelete()"); error = true; }
	if (typeof tagDest !== 'undefined' && tagDest !== null && isNaN(tagDest)){ console.log("Destination Tag 'tagDest' must be a Number in call Payment()"); error = true; }

	if (error) { fail('Error occurred'); }

	let cmd = {
		TransactionType: 'AccountDelete',
		Account: account,
		Destination: accountDest,
		Fee: feeDrops.toString()
	};

	// Arbitrary destination tag that identifies a hosted recipient or other information for the recipient of the deleted account's leftover XRP.
	if (typeof tagDest !== 'undefined' && tagDest !== null) { cmd.DestinationTag = Number(tagDest); }

	return cmd;
}

async function commandTxParams() {
	let txData = AccountDelete({
		account: main_params.account.value,
		accountDest: main_params.destination_account.value,
		feeDrops: main_params.tx_fee_drops.value
	});

	await AddTransactionSequences(
		txData,
		{
			account: main_params.account.value,
			network: main_params.network.value,
			ledgerTimeout: ledgerIndexMinTimeout(main_params.network.value)
		}
	);

	return txData;
}

async function main(){
	await defineMainParams(main_params);

	const txParams = await commandTxParams();

	ShowTransactionDetails(txParams);

	quit( OutputJsonTransaction(txParams) );
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	console.log(MODULE_NAME + ' module loaded');

	exports.AccountDelete = AccountDelete;
}
