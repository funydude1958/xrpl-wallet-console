///////////////////////////////////////////////////////////
//
// trustline_remove_submit.js - Removes a trust line linked to account with online transaction submit
// syntax: node trustline_set_submit [PUB|TEST|DEV] ACCOUNT ISSUER_ACCOUNT CURRENCY_CODE SEED_KEY MEMO
//
// To remove trustline you need to put it in its default state.
// Default state means:
//   - Balance is zero (remove all of the IOU from account).
//   - Limit is zero.
//   - Line is not authed or frozen (remove the Auth or Freeze flags if present).
//   - Line does not allow rippling, unless account has "DefaultRipple" flag set, in which case it must allow rippling.
//
// Docs: https://xrpl.org/trust-lines-and-issuing.html
//       https://xrpl.org/trustset.html
//       https://js.xrpl.org/interfaces/TrustSet.html
///////////////////////////////////////////////////////////

'use strict';

const { quit, fail, prompt, defineMainParams, ledgerIndexMinTimeout, networkMinFee, ConfirmFeeValue, ShowTransactionDetails } = require('../common/libs/common.js');
const { Submit } = require('../common/submit_send.js');
const { TrustRemove } = require('./trustline_set.js');
const { AddTransactionSequences, SignWithKeyPrompt } = require('../common/sign.js');
const { AddTransactionMemo } = require('../common/libs/memo.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	issuer_account: { id: 3, default: '', required: true, desc: 'XRPL address which issues the Token' },
	currency_code: { id: 4, default: '', required: true, desc: 'Token Currency Code' },
	key: { id: 5, default: '', required: true, desc: 'account secret seed / mnemonic phrase to sign the transaction', scramble: true },
	memo: { id: 6, default: '', required: false, desc: 'Additional information to save with a transaction' },
}

async function buildTransaction() {
	const feeDrops = await ConfirmFeeValue( networkMinFee(main_params.network.value) );

	const tx = TrustRemove({
		account: main_params.account.value,
		currencyCode: main_params.currency_code.value,
		issuerAccount: main_params.issuer_account.value,
		feeDrops // transaction fee in 'drops' (1 XRP = 1 000 000 drops)
	});

	await AddTransactionSequences(
		tx,
		{
			account: main_params.account.value,
			network: main_params.network.value,
			ledgerTimeout: ledgerIndexMinTimeout(main_params.network.value)
		}
	);

	if (main_params.memo.value) { AddTransactionMemo(tx, { data: main_params.memo.value }); }

	ShowTransactionDetails(tx);

	const signedTransaction = await SignWithKeyPrompt({
		transaction: tx,
		secretKey: main_params.key.value,
		secretKeyPromptOpts: main_params.key,
		promptParamName: 'key',
		promptAccountAddress: main_params.account.value
	});

	console.log('\nSIGNED TRANSACTION:');
	console.log(signedTransaction);

	return signedTransaction;
}

async function signAndSubmit() {
	const transaction = await buildTransaction();

	await Submit(transaction.tx_blob, { network: main_params.network.value });
}

async function main(){
	await defineMainParams(main_params);

	await signAndSubmit();
	quit();
}

main();
