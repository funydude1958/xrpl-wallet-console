///////////////////////////////////////////////////////////
//
// trustline_set.js - Create or modify a trust line linking two accounts
// syntax: node trustline_set [PUB|TEST|DEV] ACCOUNT ISSUER_ACCOUNT CURRENCY_CODE CURRENCY_LIMIT_AMOUNT
//
// Trust lines are structures in the XRP Ledger for holding tokens.
// Trust lines enforce the XRP Ledger's rule that you cannot cause someone else to hold a token they don't want.
// This precaution is necessary to enable the XRP Ledger's use case for community credit among other benefits.
//
// Since a trust line occupies space in the ledger, a trust line increases the XRP your account must hold in reserve.
//
// Either or both accounts in the trust line may be charged the reserve for the trust line, depending on the status of the trust line:
// if any of your settings are not the default, or if you hold a positive balance, it counts as one item toward your owner reserve.
// Generally, this means that the account that created the trust line is responsible for the reserve and the issuer is not.
//
// Docs: https://xrpl.org/trust-lines-and-issuing.html
//       https://xrpl.org/trustset.html
//       https://js.xrpl.org/interfaces/TrustSet.html
//
//       https://github.com/XRPLF/xrpl.js/blob/1a1d8087/packages/xrpl/src/models/transactions/trustSet.ts#L75
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'trustline_set';

const { TrustSetFlags } = require("xrpl");

const { quit, fail, defineMainParams, ledgerIndexMinTimeout, networkMinFee, ShowTransactionDetails, OutputJsonTransaction } = require('../common/libs/common.js');
const { AddTransactionSequences } = require('../common/sign.js');
const { AddTransactionMemo } = require('../common/libs/memo.js');

const KNOWN_SET_FLAGS = {
	// Transaction Flags
	tfSetfAuth: "Authorize the other party to hold currency issued by this account. (No effect unless using the asfRequireAuth AccountSet flag.) Cannot be unset.",
	tfSetNoRipple: "Enable the No Ripple flag, which blocks rippling between two trust lines of the same currency if this flag is enabled on both.",
		// If a transaction tries to enable No Ripple but cannot, it fails with the result code tecNO_PERMISSION.
	tfClearNoRipple: "Disable the No Ripple flag, allowing rippling on this trust line.",
	tfSetFreeze: "Freeze the trust line.",
	tfClearFreeze: "Unfreeze the trust line."

	// The Auth flag of a trust line does not determine whether the trust line counts towards its owner's XRP reserve requirement.
	// However, an enabled Auth flag prevents the trust line from being in its default state.
	// An authorized trust line can never be deleted.
	// An issuer can pre-authorize a trust line with the tfSetfAuth flag only, even if the limit and balance of the trust line are 0.
}

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	issuer_account: { id: 3, default: '', required: true, desc: 'XRPL address which issues the Token' },
	currency_code: { id: 4, default: '', required: true, desc: 'Token Currency Code' },
	limit_amount: { id: 5, default: '', required: true },
}

const AvailableFlags = function () {
	return Object.keys(TrustSetFlags).filter((k) => isNaN(k)).map((key) => {
		const h = {};
		h[key] = { value: TrustSetFlags[key], value_hex: `0x${TrustSetFlags[key].toString(16)}`, desc: KNOWN_SET_FLAGS[key] };
		return h;
	});
}

const TrustRemove = function ({ account, feeDrops, currencyCode, issuerAccount }) {
	return TrustSet({
		account, currencyCode, issuerAccount, feeDrops,
		limitAmountValue: 0
	});
}

const TrustSet = function ({ account, trustFlags, feeDrops, currencyCode, issuerAccount, limitAmountValue }) {
	let error;

	if (!account){ console.error("Must specify 'account' in call TrustSet()"); error = true; }
	if (!currencyCode){ console.error("Must specify 'currencyCode' in call TrustSet()"); error = true; }
	if (!issuerAccount){ console.error("Must specify 'issuerAccount' in call TrustSet()"); error = true; }
	if (typeof limitAmountValue === 'undefined'){ console.error("Must specify 'limitAmountValue' in call TrustSet()"); error = true; }
	if (!feeDrops || feeDrops <= 0){ console.error("Must specify 'feeDrops' greater than zero in call TrustSet()"); error = true; }

	if (error) { fail('Error occurred'); }

	let cmd = {
		TransactionType: 'TrustSet',
		Account: account, // The unique address of the account that initiated the transaction.
		Fee: feeDrops.toString(),
		LimitAmount: { // a Hash for non-XRP amounts, the nested field names MUST be lower-case:
			currency: currencyCode,
			issuer: issuerAccount,
			value: limitAmountValue.toString()
		},
		// QualityIn // Value incoming balances on this trust line at the ratio of this number per 1,000,000,000 units. A value of 0 is shorthand for treating balances at face value.
		// QualityOut // Value outgoing balances on this trust line at the ratio of this number per 1,000,000,000 units. A value of 0 is shorthand for treating balances at face value.
	};

	if (typeof trustFlags !== 'undefined') { cmd.Flags = trustFlags; }
	// https://js.xrpl.org/interfaces/TrustSetFlagsInterface.html
	// https://github.com/XRPLF/xrpl.js/blob/main/packages/xrpl/src/models/transactions/trustSet.ts

	return cmd;
}

const FlagsByValue = function (flagsValue) {
	const allFlags = AvailableFlags();
	const foundFlags = [];

	for (let i = 0; i < allFlags.length; i++) {
		const flagItem = allFlags.find((item) => {
			const keys = Object.keys(item);
			for (const k of keys) {
				if ((item[k]?.value & flagsValue) == item[k]?.value) {
					flagsValue -= item[k]?.value;
					return true;
				}
			}
		})
		if (!flagItem) { break; }

		foundFlags.push(flagItem);
	}
	return foundFlags;
}

async function commandTxParams() {
	let txData = TrustSet({
		account: main_params.account.value,
		trustFlags: TrustSetFlags.tfSetNoRipple,
		currencyCode: main_params.currency_code.value,
		issuerAccount: main_params.issuer_account.value,
		limitAmountValue: main_params.limit_amount.value,
		feeDrops: networkMinFee(main_params.network.value)
	});

	await AddTransactionSequences(
		txData,
		{
			account: main_params.account.value,
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

	exports.TrustSet = TrustSet;
	exports.TrustRemove = TrustRemove;
	exports.AvailableFlags = AvailableFlags;
	exports.FlagsByValue = FlagsByValue;
}
