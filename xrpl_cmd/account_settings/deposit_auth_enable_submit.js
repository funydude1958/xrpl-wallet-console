///////////////////////////////////////////////////////////
//
// deposit_auth_enable_submit.js - enables Deposit Authorization on this account through offline QR-code with signed transaction
// syntax: node deposit_auth_enable_submit [PUB|TEST|DEV] ACCOUNT SEED_KEY
//
// Deposit Authorization is an optional account setting in the XRP Ledger.
// By default, new accounts have DepositAuth disabled and can receive XRP from anyone.
//
// If Deposit Authorization enabled, it blocks all transfers from strangers, including transfers of XRP and tokens.
// An account with Deposit Authorization can only receive value in two ways:
//   - From accounts it has preauthorized.
//   - By sending a transaction to receive the funds.
//     For example, an account with Deposit Authorization could finish an Escrow that was initiated by a stranger.
//     When you have Deposit Authorization enabled, you can receive money from Checks, Escrow, and Payment Channels.
//
//
// Docs: https://xrpl.org/depositauth.html
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
		flag: AccountSetAsfFlags.asfDepositAuth
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

	console.log('\nSIGNED TRANSACTION - ENABLE DEPOSIT AUTH:');
	console.log(signedTransaction);

	return signedTransaction;
}

function showTransactionDetails (tx) {
	console.log('\nTRANSACTION DETAILS - ENABLE DEPOSIT AUTH:');
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
