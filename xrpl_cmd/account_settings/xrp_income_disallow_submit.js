///////////////////////////////////////////////////////////
//
// xrp_income_disallow_submit.js - XRP should not be sent to this account. (Enforced by client applications, not by rippled)
// syntax: node xrp_income_disallow_submit [PUB|TEST|DEV] ACCOUNT SEED_KEY
//
// The DisallowXRP flag indicates that an account should not receive XRP.
// This is a softer protection than Deposit Authorization, and is not enforced by the XRP Ledger.
// Client applications should honor this flag or at least warn about it.
//
///////////////////////////////////////////////////////////

'use strict';

const { AccountSetAsfFlags } = require('xrpl');

const { quit, fail, defineMainParams, ledgerIndexMinTimeout, networkMinFee } = require('../common/libs/common.js');
const { Submit } = require('../common/submit_send.js');
const { AddTransactionSequences, SignWithKeyPrompt } = require('../common/sign.js');
const { AccountSetFlag, DescribeSetFlag } = require('../account_settings/account_set.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	account_secret_key: { id: 3, default: '', required: true, desc: 'secret seed / mnemonic phrase', scramble: true },
}

async function buildTransaction() {
	const tx = AccountSetFlag({
		account: main_params.account.value,
		feeDrops: networkMinFee(main_params.network.value), // transaction fee in 'drops' (1 XRP = 1 000 000 drops)
		flag: AccountSetAsfFlags.asfDisallowXRP
	});

	await AddTransactionSequences(
		tx,
		{
			account: main_params.account.value,
			network: main_params.network.value,
			ledgerTimeout: ledgerIndexMinTimeout(main_params.network.value)
		}
	);

	showTransactionDetails(tx);

	const signedTransaction = await SignWithKeyPrompt({
		transaction: tx,
		secretKey: main_params.account_secret_key.value,
		secretKeyPromptOpts: main_params.account_secret_key,
		promptParamName: 'account_secret_key',
		promptAccountAddress: main_params.account.value
	});

	console.log('\nSIGNED TRANSACTION - DISALLOW XRP INCOME:');
	console.log(signedTransaction);

	return signedTransaction;
}

function showTransactionDetails (tx) {
	console.log('\nTRANSACTION DETAILS - DISALLOW XRP INCOME:');
	console.log(tx);
	console.log('\n=========');
	console.log(`SetFlag: ${DescribeSetFlag(tx.SetFlag).name}`);
	console.log(`Fee: ${tx.Fee} drops`);
	console.log('=========');
}

async function signAndSubmit() {
	const transaction = await buildTransaction();

	await Submit(transaction.tx_blob, { network: main_params.network.value });
}

async function main(){
	await defineMainParams(main_params);

	await signAndSubmit();
}

main();
