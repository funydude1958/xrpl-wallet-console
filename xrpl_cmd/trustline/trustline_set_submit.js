///////////////////////////////////////////////////////////
//
// trustline_set_submit.js - Create or modify a trust line linking two accounts with online transaction submit
// syntax: node trustline_set_submit [PUB|TEST|DEV] ACCOUNT ISSUER_ACCOUNT CURRENCY_CODE CURRENCY_LIMIT_AMOUNT SEED_KEY MEMO
//
// Docs: https://xrpl.org/trust-lines-and-issuing.html
//       https://xrpl.org/trustset.html
//       https://js.xrpl.org/interfaces/TrustSet.html
///////////////////////////////////////////////////////////

'use strict';

const { TrustSetFlags } = require("xrpl");

const { quit, fail, prompt, defineMainParams, ledgerIndexMinTimeout, networkMinFee, ConfirmFeeValue, ShowTransactionDetails } = require('../common/libs/common.js');
const { Submit } = require('../common/submit_send.js');
const { TrustSet, FlagsByValue } = require('./trustline_set.js');
const { AddTransactionSequences, SignWithKeyPrompt } = require('../common/sign.js');
const { AddTransactionMemo } = require('../common/libs/memo.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	issuer_account: { id: 3, default: '', required: true, desc: 'XRPL address which issues the Token' },
	currency_code: { id: 4, default: '', required: true, desc: 'Token Currency Code' },
	limit_amount: { id: 5, default: '', required: true },
	key: { id: 6, default: '', required: true, desc: 'account secret seed / mnemonic phrase to sign the transaction', scramble: true },
	memo: { id: 7, default: '', required: false, desc: 'Additional information to save with a transaction' },
}

async function buildTransaction() {
	const feeDrops = await ConfirmFeeValue( networkMinFee(main_params.network.value) );

	const tx = TrustSet({
		account: main_params.account.value,
		trustFlags: TrustSetFlags.tfSetNoRipple,
		currencyCode: main_params.currency_code.value,
		issuerAccount: main_params.issuer_account.value,
		limitAmountValue: main_params.limit_amount.value,
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

	const flags = []; FlagsByValue(tx.Flags).forEach((item) => {
		Object.keys(item).forEach((flagName) => flags.push([flagName, item[flagName].desc]));
	});

	ShowTransactionDetails(tx, { extra: { flags } });

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
