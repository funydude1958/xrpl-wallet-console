///////////////////////////////////////////////////////////
//
// server_state.js - asks the server for various machine-readable information about the rippled server's current state. 
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'server_state';

const { quit, fail, defineMainParams, XrplClient } = require('../common/libs/common.js');

const main_params = {
	network: { id: 1, default: '', required: true, example: 'DEV, TEST, PUB' },
}

const ServerState = async function ({ network, xrplAddress, client }) {
	let lclient, info;

	try{
		if (client) { lclient = client; }
		else {
			console.log('\nConnecting to XRPL to fetch Server State...');
			lclient = await XrplClient({ network, xrplAddress });
		}

		const response = lclient.request({ command: 'server_state' });
		response.then(
			result => {
				info = result;
			},
			error => {
				fail(`Error: ${error}`);
			}
		)
		await response;

	} catch(err) {
		fail(err);

	} finally {
		if (!client && lclient) { lclient.disconnect(); }
	}

	if (!info) { fail('Unable to fetch Server State'); }

	return info;
}

async function main(){
	await defineMainParams(main_params);

	const info = await ServerState({ network: main_params.network.value });
	console.log(info);

	quit(`\n${JSON.stringify(info)}`);
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	console.log(MODULE_NAME + ' module loaded');

	exports.ServerState = ServerState;
}
