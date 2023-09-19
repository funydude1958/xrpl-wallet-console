///////////////////////////////////////////////////////////
//
// payment_qr.js - transfer of value from one account to another through offline QR-code with signed transaction
// syntax: node payment_qr [PUB|TEST|DEV] SOURCE_ACCOUNT DESTINATION_ACCOUNT XRP_AMOUNT_TO_PAY SEED_KEY SRC_ACCOUNT_SEQUENCE LEDGER_INDEX LEDGER_TIMEOUT DESTINATION_TAG INVOICE_ID MEMO
//
// Docs: https://xrpl.org/payment.html
//       https://js.xrpl.org/interfaces/Payment.html
//       https://xrpl.org/use-specialized-payment-types.html
///////////////////////////////////////////////////////////

'use strict';

const { xrpToDrops, dropsToXrp, rippleTimeToISOTime } = require('xrpl');

const { quit, fail, prompt, defineMainParams, networkMinFee, ConfirmFeeValue, ledgerIndexMinTimeout, ColoredText } = require('../common/libs/common.js');
const { Payment } = require('./payment.js');
const { AddTransactionMemo } = require('../common/libs/memo.js');
const { Wallet, AddTransactionSequences } = require('../common/sign.js');
const { SignQR } = require('../common/sign_qr.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	source_account: { id: 2, default: '', required: true },
	destination_account: { id: 3, default: '', required: true },
	pay_xrp_amount: { id: 4, default: '', required: true },
	key: { id: 5, default: '', required: true, desc: 'source account secret seed / mnemonic phrase to sign the transaction', scramble: true },

	source_account_sequence: { id: 6, default: '', required: true, desc: 'see "Sequence" in `account_info`' },
	ledger_current_index: { id: 7, default: '', required: true, desc: 'see "ledger_current_index" in `account_info`' },
	ledger_index_timeout: { id: 8, default: '', required: true, desc: 'value to add to "ledger_current_index"', auto: () => ledgerIndexMinTimeout(main_params.network.value, { qr: true }) },

	destination_tag: { id: 9, default: '', required: false, desc: 'Numeric identifier for the payment to the destination', type: 'number' },
	invoice_id: { id: 10, default: '', required: false, desc: 'Arbitrary 256-bit hash representing identifier for this payment' },
	memo: { id: 11, default: '', required: false, desc: 'Additional information to save with a transaction' },
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
			accSequence: main_params.source_account_sequence.value,
			ledgerSeqIndex: main_params.ledger_current_index.value,
			ledgerTimeout: main_params.ledger_index_timeout.value
		}
	);

	if (main_params.memo.value) { AddTransactionMemo(tx, { data: main_params.memo.value }); }

	showTransactionDetails(tx);
	return tx;
}

async function signWithQR() {
	const transaction = await buildTransaction();

	await SignQR({ wallet: Wallet(main_params.key.value), transaction });
}

function showTransactionDetails (tx) {
	console.log('\nTRANSACTION DETAILS:');
	console.log(tx);
	console.log('\n=========');
	console.log(`Amount: ${ColoredText(`${dropsToXrp(parseInt(tx.Amount, 10))} XRP`, { color: 'FgGreen' })}`);
	console.log(`Fee: ${ColoredText(`${tx.Fee} drops`, { color: 'FgGreen' })}`);
	if (tx.Account && tx.Destination) { console.log(`From [${tx.Account}]  To  [${tx.Destination}]${tx.Account === tx.Destination ? ' (identical addresses)' : ''}`); }
	console.log('=========');
}

async function main(){
	await defineMainParams(main_params);

	await signWithQR();
}

main();
