///////////////////////////////////////////////////////////
//
// account_set.js - modifies the properties of an account in the XRP Ledger.
// syntax: node account_set [PUB|TEST|DEV] ACCOUNT FLAG_NAME_OR_CODE
//
//
// Docs:
//   https://xrpl.org/accountset.html
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'account_set';

const { AccountSetAsfFlags, AccountSetTfFlags } = require('xrpl');

const { quit, fail, defineMainParams, ledgerIndexMinTimeout, networkMinFee } = require('../common/libs/common.js');
const { AddTransactionSequences } = require('../common/sign.js');

const KNOWN_SET_FLAGS = {
	// AccountSet Flags
	asfRequireDest: "Require a destination tag to send transactions to this account.",
  asfRequireAuth: "Require authorization for users to hold balances issued by this address. Can only be enabled if the address has no trust lines connected to it.",
  asfDisallowXRP: "XRP should not be sent to this account. (Enforced by client applications, not by `rippled` service)",
  asfDisableMaster: "Disallow use of the master key pair. Can only be enabled if the account has configured another way to sign transactions, such as a Regular Key or a Signer List.",
  asfAccountTxnID: "Track the ID of this account's most recent transaction. Required for AccountTxnID",
  asfNoFreeze: "Permanently give up the ability to freeze individual trust lines or disable Global Freeze. This flag can never be disabled after being enabled.",
  asfGlobalFreeze: "Freeze all assets issued by this account.",
  asfDefaultRipple: "Enable rippling on this account's trust lines by default ( https://xrpl.org/rippling.html )",
  asfDepositAuth: "Enable Deposit Authorization on this account ( https://xrpl.org/depositauth.html )",
  asfAuthorizedNFTokenMinter: "Enable to allow another account to mint non-fungible tokens (NFTokens) on this account's behalf. Specify the authorized account in the NFTokenMinter field of the AccountRoot object.",

	// Transaction Flags
	tfRequireDestTag: "Require a destination tag to send transactions to this account.", // as SetFlag: asfRequireDest.
  tfOptionalDestTag: "Require a destination tag to send transactions to this account.", // as ClearFlag: asfRequireDest
  tfRequireAuth: "Require authorization for users to hold balances issued by this address. Can only be enabled if the address has no trust lines connected to it.", // as SetFlag: asfRequireAuth
  tfOptionalAuth: "Require authorization for users to hold balances issued by this address. Can only be enabled if the address has no trust lines connected to it.", // as ClearFlag: asfRequireAuth
  tfDisallowXRP: "XRP should not be sent to this account. (Enforced by client applications, not by rippled)", // as SetFlag: asfDisallowXRP
  tfAllowXRP: "XRP should not be sent to this account. (Enforced by client applications, not by rippled)", // as ClearFlag: asfDisallowXRP
}

const FLAG_TYPES_MESSAGE = 'Must be one of asfXXX or tfXXX flags (not lsfXXX)';

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
	flag: { id: 3, default: '', required: true, desc: 'Flag name (asfXX, tfXX) or numeric code' },
}

const ValueByFlagCode = function (flag) {
	return (AccountSetTfFlags[flag] || AccountSetAsfFlags[flag]);
}

const AvailableFlags = function () {
	return Object.keys(AccountSetAsfFlags).filter((k) => isNaN(k)).map((key) => {
		const h = {}
		h[key] = { value: AccountSetAsfFlags[key], desc: KNOWN_SET_FLAGS[key] }
		return h
	});
}

const DescribeSetFlag = function (flag) {
	let name, code;

	if (typeof flag === 'number') { code = flag; }
	else if (!isNaN(flag)) { code = flag = Number(flag); }
	else {
		code = AccountSetTfFlags[flag] || AccountSetAsfFlags[flag];
		if (code) { name = flag; }
	}

	if (!name) { name = AccountSetTfFlags[code] || AccountSetAsfFlags[code]; }

	const desc = KNOWN_SET_FLAGS[name];
	return { name, desc };
}

function AccountSetFlag ({ account, feeDrops, flag }) {
	let error;

	if (!account) { console.error("Must specify 'account' in call AccountSetFlag()"); error = true; }
	if (!feeDrops || feeDrops <= 0) { console.error("Must specify 'feeDrops' greater than zero in call AccountSetFlag()"); error = true; }
	if (!flag) { console.error("Must specify 'flag' in call AccountSetFlag()"); error = true; }
	if (flag && typeof flag !== 'number' && !isNaN(flag)) { flag = Number(flag); }
	if (flag && isNaN(flag)) {
		const val = ValueByFlagCode(flag);
		if (!val) { console.error(`Unknown flag "${flag}". ${FLAG_TYPES_MESSAGE}`); error = true; }
		else { flag = val; }
	}
	if (error) { fail('Error occurred'); }

	let cmd = {
		TransactionType: 'AccountSet',
		Account: account,
		SetFlag: flag,
		Fee: feeDrops.toString()
	};

	return cmd;
}

function AccountClearFlag ({ account, feeDrops, flag }) {
	let error;

	if (!account) { console.error("Must specify 'account' in call AccountClearFlag()"); error = true; }
	if (!feeDrops || feeDrops <= 0) { console.error("Must specify 'feeDrops' greater than zero in call AccountClearFlag()"); error = true; }
	if (!flag) { console.error("Must specify 'flag' in call AccountClearFlag()"); error = true; }
	if (flag && typeof flag !== 'number' && !isNaN(flag)) { flag = Number(flag); }
	if (flag && isNaN(flag)) {
		const val = ValueByFlagCode(flag);
		if (!val) { console.error(`Unknown flag "${flag}". ${FLAG_TYPES_MESSAGE}`); error = true; }
		else { flag = val; }
	}
	if (error) { fail('Error occurred'); }

	let cmd = {
		TransactionType: 'AccountSet',
		Account: account,
		ClearFlag: flag,
		Fee: feeDrops.toString()
	};

	return cmd;
}

async function commandTxParams() {
	let txData = AccountSetFlag({
		account: main_params.account.value,
		feeDrops: networkMinFee(main_params.network.value),
		flag: main_params.flag.value
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

function validateFlagCode() {
	if (!isNaN(main_params.flag.value)) { main_params.flag.value = Number(main_params.flag.value); }

	const val = ValueByFlagCode(main_params.flag.value);
	if (!val) { fail(`Unknown flag "${main_params.flag.value}". ${FLAG_TYPES_MESSAGE}`); }

	if (isNaN(main_params.flag.value)) { main_params.flag.value = val; }
	console.log();
}

function showTransactionDetails (txParams) {
	console.log('\nTRANSACTION DETAILS:');
	console.log(txParams);
	console.log(`\nSetFlag "${txParams.SetFlag}":`);
	console.log(DescribeSetFlag(txParams.SetFlag));
}

async function main(){
	await defineMainParams(main_params);
	validateFlagCode();

	const txParams = await commandTxParams();
	showTransactionDetails(txParams);

	quit(`\nJSON to be used on 'sign' script call:\n\n${JSON.stringify(txParams)}\n`);
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	console.log(MODULE_NAME + ' module loaded');

	exports.AccountSetFlag = AccountSetFlag;
	exports.AccountClearFlag = AccountClearFlag;
	exports.AvailableFlags = AvailableFlags;
	exports.DescribeSetFlag = DescribeSetFlag;
	exports.ValueByFlagCode = ValueByFlagCode;
}
