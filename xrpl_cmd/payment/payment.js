///////////////////////////////////////////////////////////
//
// payment.js - transfer of value from one account to another
// syntax: node payment [PUB|TEST|DEV] SOURCE_ACCOUNT DESTINATION_ACCOUNT XRP_AMOUNT_TO_PAY DESTINATION_TAG INVOICE_ID MEMO
//
// Payments are also the only way to create accounts.
//
// Docs: https://xrpl.org/payment.html
//       https://js.xrpl.org/interfaces/Payment.html
//       https://xrpl.org/use-specialized-payment-types.html
//       https://xrpl.org/payment.html#creating-accounts
//
//       https://xrpl.org/known-amendments.html#paychan
//       https://xrpl.org/paymentchannelclaim.html
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'payment';

const { xrpToDrops } = require("xrpl");

const { quit, fail, defineMainParams, ledgerIndexMinTimeout, networkMinFee, ShowTransactionDetails, OutputJsonTransaction } = require('../common/libs/common.js');
const { AddTransactionSequences } = require('../common/sign.js');
const { AddTransactionMemo } = require('../common/libs/memo.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	source_account: { id: 2, default: '', required: true },
	destination_account: { id: 3, default: '', required: true },
	pay_xrp_amount: { id: 4, default: '', required: true },
	destination_tag: { id: 5, default: '', required: false, desc: 'Numeric identifier for the payment to the destination', type: 'number' },
	invoice_id: { id: 6, default: '', required: false, desc: 'Arbitrary 256-bit hash representing identifier for this payment' },
	memo: { id: 7, default: '', required: false, desc: 'Additional information to save with a transaction' },
}

function Payment({ accountSrc, accountDest, payAmount, feeDrops, invoiceID, tagSrc, tagDest }) {
	// Docs: https://js.xrpl.org/interfaces/Payment.html
	//       https://xrpl.org/payment.html
	//
	// Types of Payments:
	//  - Direct XRP-to-XRP Payment (https://xrpl.org/direct-xrp-payments.html)
	//  - Creating or redeeming tokens (https://xrpl.org/tokens.html)
	//  - Cross-currency Payment (https://xrpl.org/cross-currency-payments.html)
	//  - Partial payment (https://xrpl.org/partial-payments.html)
	//  - Currency conversion (Consumes offers in the decentralized exchange to convert one currency to another. The Amount and SendMax cannot both be XRP. Delivers money to the sender.)
	//
	// The Payment transaction type can Create New Accounts in the XRP Ledger
	// by sending enough XRP to an unfunded address (https://xrpl.org/accounts.html#creating-accounts)
	//
	// When one of your addresses receives a payment whose purpose is unclear,
	// we recommend that you try to return the money to its sender.
	// You should send bounced payments as Partial Payments.
	// Partial payments are useful for returning payments without incurring additional costs to oneself.
	// (https://xrpl.org/become-an-xrp-ledger-gateway.html#bouncing-payments)
	//
	let error;

	if (!accountSrc){ console.error("Must specify 'accountSrc' in call Payment()"); error = true; }
	if (!accountDest){ console.error("Must specify 'accountDest' in call Payment()"); error = true; }
	if (!payAmount || payAmount <= 0){ console.error("Must specify 'payAmount' greater than zero in call Payment()"); error = true; }
	if (!feeDrops || feeDrops <= 0){ console.error("Must specify 'feeDrops' greater than zero in call Payment()"); error = true; }
	if (typeof tagSrc !== 'undefined' && tagSrc !== null && isNaN(tagSrc)){ console.log("Source Tag 'tagSrc' must be a Number in call Payment()"); error = true; }
	if (typeof tagDest !== 'undefined' && tagDest !== null && isNaN(tagDest)){ console.log("Destination Tag 'tagDest' must be a Number in call Payment()"); error = true; }

	if (error) { fail('Error occurred'); }

	let cmd = {
		TransactionType: 'Payment',
		Account: accountSrc, // The unique address of the account that initiated the transaction
		Destination: accountDest, // Address of the account receiving the payment
		Fee: feeDrops.toString(),
		Amount: payAmount.toString(), // The amount of currency to deliver.
																	// Amount can be a Hash for non-XRP amounts, the nested field names MUST be lower-case:
																	//   keys[0] = 'currency'
																	//   keys[1] = 'issuer'
																	//   keys[2] = 'value'
	};

	// cmd.Paths // Array of payment paths to be used for this transaction. Must be omitted for XRP-to-XRP transactions.

	// cmd.SendMax // Highest amount of source currency this transaction is allowed to cost, including transfer fees, exchange rates, and slippage.
								 // Does not include the XRP destroyed as a cost for submitting the transaction.
								 // For non-XRP amounts, the nested field names MUST be lower-case.
								 // Must be supplied for cross-currency/cross-issue payments. Must be omitted for XRP-to-XRP payments.

	// cmd.DeliverMin // Minimum amount of destination currency this transaction should deliver.
										// Only valid if this is a partial payment. For non-XRP amounts, the nested field names are lower-case.

	if (typeof tagSrc !== 'undefined' && tagSrc !== null) { cmd.SourceTag = Number(tagSrc); } // Arbitrary integer used to identify the reason for this payment, or a sender on whose behalf this transaction is made.
	if (typeof tagDest !== 'undefined' && tagDest !== null) { cmd.DestinationTag = Number(tagDest); } // Arbitrary tag (Number) that identifies the reason for the payment to the destination, or a hosted recipient to pay.
	if (invoiceID) { cmd.InvoiceID = invoiceID; } // Arbitrary 256-bit hash string representing a specific reason or identifier for this payment.

	return cmd;
}

async function commandTxParams() {
	let txData = Payment({
		accountSrc: main_params.source_account.value,
		accountDest: main_params.destination_account.value,
		tagDest: main_params.destination_tag.value,
		invoiceID: main_params.invoice_id.value,
		payAmount: xrpToDrops(main_params.pay_xrp_amount.value),
		feeDrops: networkMinFee(main_params.network.value)
	});

	await AddTransactionSequences(
		txData,
		{
			account: main_params.source_account.value,
			network: main_params.network.value,
			ledgerTimeout: ledgerIndexMinTimeout(main_params.network.value)
		}
	);

	if (main_params.memo.value) { AddTransactionMemo(txData, { data: main_params.memo.value }); }

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

	exports.Payment = Payment;
}
