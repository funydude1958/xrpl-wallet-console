var launcher = require('@james-proxy/james-browser-launcher');

function launchBrowser(address, opts, callback){
	if (arguments.length == 1) {
		callback = function(){};
		opts = {};
	} else if (arguments.length == 2) {
		if (typeof opts === 'function') {
			callback = opts;
			opts = {};
		} else {
			callback = function(){};
		}
	}

	// defaults
	opts.browser = opts.browser || [];
	if (typeof opts.browser === 'string') { opts.browser = [opts.browser]; }
	opts.browserSettings = opts.browserSettings || {};

	launcher(function(e, launch) {
		if (e || launch.browsers.length == 0) { return callback("Unable to open browser!"); }

		// which browser to use? check preferred browsers first
		let useBrowser = '';
		for (let i = 0; i < opts.browser.length; i++) {
			for (let ii = 0; ii < launch.browsers.length; ii++) {
				if (launch.browsers[ii].name.toLowerCase() == opts.browser[i].toLowerCase()) {
					useBrowser = launch.browsers[ii].name;
					break;
				}
			}
			if (useBrowser != '') { break; }
		}

		if (useBrowser == '') { useBrowser = launch.browsers[0].name; }

		opts.browser = useBrowser;
		if (opts.browserSettings[useBrowser]) { Object.assign(opts, opts.browserSettings[useBrowser]); }
		delete opts.browserSettings;

		launch(address, opts, callback);
	});
}

module.exports = launchBrowser;
