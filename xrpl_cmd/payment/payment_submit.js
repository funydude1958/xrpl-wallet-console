///////////////////////////////////////////////////////////
//
// payment_submit.js - transfer of value from one account to another with online transaction submit
// syntax: node payment_submit [PUB|TEST|DEV] SOURCE_ACCOUNT DESTINATION_ACCOUNT XRP_AMOUNT_TO_PAY SEED_KEY DESTINATION_TAG INVOICE_ID MEMO
//
// Docs: https://xrpl.org/payment.html
//       https://js.xrpl.org/interfaces/Payment.html
//       https://xrpl.org/use-specialized-payment-types.html
///////////////////////////////////////////////////////////

'use strict';

const { xrpToDrops, dropsToXrp } = require('xrpl');

const { quit, fail, prompt, defineMainParams, ledgerIndexMinTimeout, networkMinFee, ConfirmFeeValue, ShowTransactionDetails } = require('../common/libs/common.js');
const { Submit } = require('../common/submit_send.js');
const { Payment } = require('./payment.js');
const { AddTransactionSequences, Sign, Wallet } = require('../common/sign.js');
const { AddTransactionMemo } = require('../common/libs/memo.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	source_account: { id: 2, default: '', required: true },
	destination_account: { id: 3, default: '', required: true },
	pay_xrp_amount: { id: 4, default: '', required: true },
	key: { id: 5, default: '', required: true, desc: 'source account secret seed / mnemonic phrase to sign the transaction', scramble: true },

	destination_tag: { id: 6, default: '', required: false, desc: 'Numeric identifier for the payment to the destination', type: 'number' },
	invoice_id: { id: 7, default: '', required: false, desc: 'Arbitrary 256-bit hash representing identifier for this payment' },
	memo: { id: 8, default: '', required: false, desc: 'Additional information to save with a transaction' },
}

async function buildTransaction() {
	const feeDrops = await ConfirmFeeValue( networkMinFee(main_params.network.value) );

	const tx = Payment({
		accountSrc: main_params.source_account.value,
		accountDest: main_params.destination_account.value,
		payAmount: xrpToDrops(main_params.pay_xrp_amount.value),
		tagDest: main_params.destination_tag.value,
		invoiceID: main_params.invoice_id.value,
		feeDrops // transaction fee in 'drops' (1 XRP = 1 000 000 drops)
	});

	await AddTransactionSequences(
		tx,
		{
			account: main_params.source_account.value,
			network: main_params.network.value,
			ledgerTimeout: ledgerIndexMinTimeout(main_params.network.value)
		}
	);

	if (main_params.memo.value) { AddTransactionMemo(tx, { data: main_params.memo.value }); }

	ShowTransactionDetails(tx);

	const transaction = Sign({ wallet: Wallet(main_params.key.value), transaction: tx, addLedgerMaxSequence: true });
	console.log('\nSIGNED TRANSACTION:');
	console.log(transaction);

	return transaction;
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
