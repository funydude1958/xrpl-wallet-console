///////////////////////////////////////////////////////////
//
// account_balance.js - shows account XRP balance including amount in escrow.
// syntax: node account_balance [PUB|TEST|DEV] ACCOUNT
//
// Docs:
//   https://xrpl.org/account_info.html
//   https://xrpl.org/escrow-object.html
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'account_balance';

const { dropsToXrp, unixTimeToRippleTime } = require('xrpl');

const { quit, fail, defineMainParams, ColoredText, XrplClient, showLoadedModules } = require('../common/libs/common.js');
const { AccountInfo } = require('./account_info.js');
const { AccountEscrows } = require('./account_escrows.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
	account: { id: 2, default: '', required: true },
}

const AccountBalance = async function ({ account, client, network, xrplAddress }) {
	let lclient;

	try{
		if (client) { lclient = client; }
		else {
			console.log('\nConnecting to XRPL to fetch Account Information...');
			lclient = await XrplClient({ network, xrplAddress });
		}
	} catch(err) {
		fail(err);
	}

	const accountInfo = await AccountInfo({ account, client: lclient, network, xrplAddress });
	const allEscrows = await AccountEscrows({ account, client: lclient, network, xrplAddress });
	if (!client && lclient) { lclient.disconnect(); }

	const accountBalance = Number(accountInfo.result.account_data.Balance);
	const currentRippleTimestamp = unixTimeToRippleTime(new Date().getTime());
	const escrowsInfo = {
		countOnSelf: 0, countFinishReady: 0, countCancelReady: 0, countToOthers: 0, countTotal: allEscrows.length,
		amountTotal: 0, amountOnSelf: 0, amountReadyOnSelf: 0, amountFinishReady: 0, amountCancelReady: 0, amountToOthers: 0, amountReadyToOthers: 0
	}

	allEscrows.forEach((item, idx) => {
		const amount = Number(item.Amount);
		const onSelf = (item.Account === item.Destination);
		const finishReady = (item.FinishAfter && currentRippleTimestamp > item.FinishAfter);
		const cancelReady = (item.CancelAfter && currentRippleTimestamp > item.CancelAfter);

		escrowsInfo.amountTotal += amount;

		if (finishReady) { escrowsInfo.amountFinishReady += amount; escrowsInfo.countFinishReady++; }
		if (cancelReady) { escrowsInfo.amountCancelReady += amount; escrowsInfo.countCancelReady++; }

		if (onSelf) {
			escrowsInfo.amountOnSelf += amount;
			escrowsInfo.countOnSelf++;
			if(finishReady || cancelReady) { escrowsInfo.amountReadyOnSelf += amount; }
		}
		else {
			escrowsInfo.amountToOthers += amount;
			escrowsInfo.countToOthers++;

			if(finishReady || cancelReady) { escrowsInfo.amountReadyToOthers += amount; }
		}
	})

	return {
		Account: accountInfo.result.account_data.Account,
		accountBalance,
		balanceTotal: accountBalance + escrowsInfo.amountTotal,
		balanceWithUnlockedSelfEscrows: accountBalance + escrowsInfo.amountReadyOnSelf,
		escrow: escrowsInfo,
	};
}

function showBalanceInfo(info) {
	console.log(info);

	const anyLocks = (info.escrow.countTotal != 0);

	console.log(`\n\n[ Account${anyLocks ? ' Available' : ''} Balance: ${ColoredText(dropsToXrp(info.accountBalance), { color: 'Bright' })} XRP ]\n`);
	if (!anyLocks) { return; }

	console.log(`On self Escrow ready to unlock: ${dropsToXrp(info.escrow.amountReadyOnSelf)} XRP`);

	if (info.escrow.amountReadyOnSelf != 0) {
		console.log(`\nTOTAL BALANCE with self escrows unlocked: [ ${dropsToXrp(info.balanceWithUnlockedSelfEscrows)} XRP ]`);
	}
	console.log();

	console.log(`* total amount in all escrows: ${dropsToXrp(info.escrow.amountTotal)} XRP`);
	console.log(`* total amount in escrows for others: ${dropsToXrp(info.escrow.amountToOthers)} XRP`);

	if (info.escrow.amountToOthers != 0 || info.escrow.amountReadyToOthers != 0) {
		console.log(`* total amount in escrows for others ready to unlock: ${dropsToXrp(info.escrow.amountReadyToOthers)} XRP`);
	}

	console.log(`\nTOTAL AMOUNT with all escrows: ${dropsToXrp(info.balanceTotal)} XRP`);

	console.log('\n');
}

async function main(){
	await defineMainParams(main_params);

	const info = await AccountBalance({ account: main_params.account.value, network: main_params.network.value });
	showBalanceInfo(info);

	quit();
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	if (showLoadedModules()) { console.log(MODULE_NAME + ' module loaded'); }

	exports.AccountBalance = AccountBalance;
}
