///////////////////////////////////////////////////////////
//
// qr.js - QR code functions
//
///////////////////////////////////////////////////////////

'use strict';

const MODULE_NAME = 'qr';

const userHomePath = function () { let path; try { path = require('os').homedir(); } catch (e) {}; return path; }
const mozillaProfilePath = function () {
	const userHome = userHomePath();
	return (userHome ? `${userHomePath()}/snap/firefox/common/.mozilla/firefox/` : 'firefox_profile/');
}

const BROWSERS = ['chrome', 'firefox', 'opera', 'safari', 'chromium'];
const BROWSERS_SETTINGS = {
  'firefox': {
    profile: mozillaProfilePath(), // See Firefox [Help] menu -> [More Troubleshooting Information] -> Application Basics.
    detached: true,
    options: ['--disable-web-security', '--disable-extensions']
  }
};

const WEB_SERVER_PORT = 3133;
const WEB_SERVER_TIMEOUT = 12_000;

const QRCoder = require('qrcode');

const { fail, defineMainParams, quit } = require('./libs/common.js');

const main_params = {
	data_text: { id: 1, default: '', required: true },
	title: { id: 2, default: '', required: false },
}

const QRgenerateURL = async function (qrText) {
	const opts = {
		errorCorrectionLevel: 'H',
		type: 'image/png',
		scale: 5
	};

	try {
    return await QRCoder.toDataURL(qrText, opts);

  } catch (err) {
    fail(err);
  }
}

const GenerateQRhtml = async function (qrText, { title, descriptionFieldsTop, descriptionFieldsBottom }) {
	const qrImageUrl = await QRgenerateURL(qrText);
	let htmlContent = [].concat(htmlHead(title?.length > 290));

	if (descriptionFieldsTop?.length) {
		for (let idx in descriptionFieldsTop) {
			const item = descriptionFieldsTop[idx];
			htmlContent.push(`<div class="detail clearBoth"><span class="name inline">${item.name}:</span><span class="value inline">${item.value}</span></div>`);
		}
	}

	htmlContent.push('<div class="clearBoth codeBlock">');
	if (title) { htmlContent.push(`<div class="head">${title}</div>`); }
	htmlContent.push(`<div class="qr clearBoth"><img class="clearBoth" src='${qrImageUrl}'></div>`);
	htmlContent.push('</div>');

	if (descriptionFieldsBottom?.length) {
		for (let idx in descriptionFieldsBottom) {
			const item = descriptionFieldsBottom[idx];
			htmlContent.push(`<div class="detail inline"><span class="name">${item.name}:</span><span class="value">${item.value}</span></div>`);
		}
	}

	htmlContent.push('</body></html>');

	return htmlContent.join('');
}

const ShowHtmlQR = async function (qrText, options = {}) {
	const htmlContent = await GenerateQRhtml(qrText, options);

	console.log('\nLaunching local web server to show QR in browser...\n');

	const express = require('express');
	const launcher = require('./libs/launch_browser');
	const app = express();

	app.listen(WEB_SERVER_PORT);
	console.log(`To see the QR code, open in your web browser this link URL: http://localhost:${WEB_SERVER_PORT}/\n`);

	app.get('/', function(req, res) {
		res.writeHead(200, { 'Content-Type': 'text/html' });

		console.log('\nPress Ctrl+C to stop web server and quit this script\n');

		setTimeout(() => quit(`Server stopped by timeout (${WEB_SERVER_TIMEOUT/1000} s)`), WEB_SERVER_TIMEOUT);

		res.end(htmlContent);
	})

	launcher(`http://localhost:${WEB_SERVER_PORT}/`, { browser: BROWSERS, browserSettings: BROWSERS_SETTINGS }, function (e, browser){
		console.log('\nBrowser launched to show QR code');

		browser.on('stop', function(code){
			quit( 'Browser closed.\nWeb server stopped.' );
		});

		if (e) { return fail(e); }
	});
}

function htmlHead(titleCenter) {
	return [
		"<!DOCTYPE html/><html><head><title>XRPL transaction QR code</title></head><body>",
		"<style type='text/css'>div { padding: 7px; } .inline { float:left; } .clearBoth { clear:both; display: block; } span.value { display:block; width:500px; word-wrap:break-word; } span.name { font-weight: bold; padding-right: 0.5rem; } .head { font-weight: bold; padding-top: 0; padding-bottom: 0; }</style>",
		`<style type='text/css'>.codeBlock { text-align: ${titleCenter ? 'center' : 'left'}; width: 480px }</style>`
	];
}

async function main(){
	await defineMainParams(main_params);

	await ShowHtmlQR(main_params.data_text.value, {
		title: main_params.title.value || 'QR code',
		descriptionFieldsTop: [],
		descriptionFieldsBottom: [
			{ name: 'Data', value: main_params.data_text.value },
		],
	});
}

if (require.main === module) {
	console.log(MODULE_NAME + ' called directly\n');
	main();

} else {
	console.log(MODULE_NAME + ' module loaded');

	exports.QRgenerateURL = QRgenerateURL;
	exports.GenerateQRhtml = GenerateQRhtml;
	exports.ShowHtmlQR = ShowHtmlQR;
}
