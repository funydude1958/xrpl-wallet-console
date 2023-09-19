///////////////////////////////////////////////////////////
//
// errors.js
//
///////////////////////////////////////////////////////////

'use strict';

class BaseError extends Error {
  constructor (message) {
    super();

    // Set this.message
    Object.defineProperty(this, 'message', {
      configurable: true,
      enumerable: false,
      value: typeof message !== 'undefined' ? String(message) : ''
    });

    // Set this.name
    Object.defineProperty(this, 'name', {
      configurable: true,
      enumerable: false,
      value: this.constructor.name
    });

    // Set this.stack
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    };
  }
}

class MissingDataError extends BaseError {
}

class InternalError extends BaseError {
}

const ShowXrplHighlitedError = function (error) {
  try {
    if (!(error.name === 'RippledError' || error.name === 'XrplError')) { return false; }
    if (!error.data.error) { return false; }

    if (error.data.error === 'actNotFound') { console.log(`\x1b[41m\x1b[1m  ${error.message}  Any account must be initialized by receiving minimum XRP reserve amount first (10 XRP)  \x1b[0m`); }
    else if (error.data.error === 'actMalformed') { console.log(`\x1b[41m\x1b[1m  ${error.message} Invalid Account Address  \x1b[0m`); }
    else { console.log(`\x1b[41m\x1b[1m  ${error.message}  \x1b[0m`); }
    console.log();
    return true;

  } catch (err) {
    console.log(`try err: ${err}`);
  }
  return false;
}

if (require.main !== module) {
	exports.MissingDataError = MissingDataError;
	exports.InternalError = InternalError;
	exports.ShowXrplHighlitedError = ShowXrplHighlitedError;
}
