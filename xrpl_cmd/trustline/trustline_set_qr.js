///////////////////////////////////////////////////////////
//
// trustline_set_qr.js - Create or modify a trust line linking two accounts through offline QR-code with signed transaction
// syntax: node trustline_set_qr [PUB|TEST|DEV] ACCOUNT ISSUER_ACCOUNT CURRENCY_CODE CURRENCY_LIMIT_AMOUNT SEED_KEY SRC_ACCOUNT_SEQUENCE LEDGER_INDEX LEDGER_TIMEOUT MEMO
//
// Docs: https://xrpl.org/payment.html
//       https://js.xrpl.org/interfaces/Payment.html
//       https://xrpl.org/use-specialized-payment-types.html
///////////////////////////////////////////////////////////

'use strict';

const { TrustSetFlags } = require('xrpl')

const { defineMainParams, networkMinFee, ConfirmFeeValue, ledgerIndexMinTimeout, ColoredText, ShowTransactionDetails } = require('../common/libs/common.js');
const { TrustSet, FlagsByValue } = require('./trustline_set.js');
const { AddTransactionMemo } = require('../common/libs/memo.js');
const { Wallet, AddTransactionSequences } = require('../common/sign.js');
const { SignQR } = require('../common/sign_qr.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	issuer_account: { id: 3, default: '', required: true, desc: 'XRPL address which issues the Token' },
	currency_code: { id: 4, default: '', required: true, desc: 'Token Currency Code' },
	limit_amount: { id: 5, default: '', required: true },
	key: { id: 6, default: '', mandatory_required: true, desc: 'account secret seed / mnemonic phrase to sign the transaction', scramble: true },

	account_sequence: { id: 7, default: '', required: true, desc: 'see "Sequence" in `account_info`' },
	ledger_current_index: { id: 8, default: '', required: true, desc: 'see "ledger_current_index" in `account_info`' },
	ledger_index_timeout: { id: 9, default: '', required: true, desc: 'value to add to "ledger_current_index"', auto: () => ledgerIndexMinTimeout(main_params.network.value, { qr: true }) },

	memo: { id: 10, default: '', required: false, desc: 'Additional information to save with a transaction' },
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
			accSequence: main_params.account_sequence.value,
			ledgerSeqIndex: main_params.ledger_current_index.value,
			ledgerTimeout: main_params.ledger_index_timeout.value
		}
	);

	if (main_params.memo.value) { AddTransactionMemo(tx, { data: main_params.memo.value }); }

	const flags = []; FlagsByValue(tx.Flags).forEach((item) => {
		Object.keys(item).forEach((flagName) => flags.push([flagName, item[flagName].desc]));
	});

	ShowTransactionDetails(tx, { extra: { flags } });

	return tx;
}

async function signWithQR() {
	const transaction = await buildTransaction();

	await SignQR({ wallet: Wallet(main_params.key.value), transaction });
}

async function main(){
	await defineMainParams(main_params);

	await signWithQR();
}

main();
