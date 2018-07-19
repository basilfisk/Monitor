// *********************************************************************************************
// *********************************************************************************************
//
// API to VisualSaaS instances
// Copyright 2015 Breato Ltd.
//
// Common functions
//
// *********************************************************************************************
// *********************************************************************************************

var	dgram = require('dgram'),
	fs = require('fs'),
	net = require('net'),
	pg = require('/usr/lib/node_modules/pg'),
	moment = require('/usr/lib/node_modules/moment'),
	cfg = require(__dirname+'/configure.js'),
	messages = require(__dirname+'/etc/messages.json');

exports.cleanPath = cleanPath;
exports.httpData = httpData;
exports.httpError = httpError;
exports.logAction = logAction;
exports.memberExists = memberExists;
exports.sendData = sendData;



// ---------------------------------------------------------------------------------------------
// Strip any redirections within a path/file string
//
// Argument 1 : String to be cleaned
//
// Return cleaned-up string
// ---------------------------------------------------------------------------------------------
function cleanPath (str) {
	str = str.replace(/~\//g,"");			// Remove change to home directory (~)
	str = str.replace(/\.\./g,"");			// Remove change to parent directory (..)
	str = str.replace(/^\//g,"");			// Remove absolute directory position (leading /)
	str = str.replace(/\/*\//g,"/");		// Replace duplicate slashes with a single slash
	return str;
}



// ---------------------------------------------------------------------------------------------
// Return data in JSON format to the client
//
// Argument 1 : Data string
// Argument 2 : HTTP response object
// ---------------------------------------------------------------------------------------------
function httpData (data, response) {
	response.writeHead(200, {
		'Content-Type': 'application/json'
	});
	response.end(data);
}



// ---------------------------------------------------------------------------------------------
// Return an error message to the client
// At the moment a 400 error is always returned, but this could be changed in the future
//
// 400 : Bad Request : The server cannot or will not process the request due to something that is perceived to be a client error
// 401 : Unauthorised : Similar to 403 Forbidden, but specifically for use when authentication is required and has failed or has not yet been provided. The response must include a WWW-Authenticate header field containing a challenge applicable to the requested resource. See Basic access authentication and Digest access authentication
// 403 : Forbidden : The request was a valid request, but the server is refusing to respond to it. Unlike a 401 Unauthorised response, authenticating will make no difference
// 404 : Not Found : The requested resource could not be found but may be available again in the future. Subsequent requests by the client are permissible
// 405 : Method Not Allowed : A request was made of a resource using a request method not supported by that resource; for example, using GET on a form which requires data to be presented via POST, or using PUT on a read-only resource
//
// Argument 1 : Error code
// Argument 2 : Error message (JSON string)
// Argument 3 : HTTP response object
// ---------------------------------------------------------------------------------------------
function httpError (msg, response) {
	response.writeHead(400, {
		'Content-Type': 'text/plain'
	});
	response.end(msg);
}



// ---------------------------------------------------------------------------------------------
// Log a message to file
//
// Argument 1 : Code of the message
// Argument 2 : Array of parameters to be substituted
//
// Return a response message that can be returned to the caller 
// ---------------------------------------------------------------------------------------------
function logAction (code, params) {
	var text, i;
	
	// Find message and substitute parameters
	text = messages[code].internal;
	if(params !== undefined) {
		for(i=0; i<params.length; i++) {
			text = text.replace(new RegExp('_p'+(1+i),'g'), params[i]);
		}
	}
	
	// Create a log record and write it to the log file
	log = moment().format('YYYY/MM/DD HH:mm:ss.SSS') + 
//	' # ' + msg.action.pid + 
	' # ' + messages[code].type + 
	' # ' + messages[code].module + 
	' # ' + messages[code].functn + 
	' # ' + code + 
	' # ' + text + '\n';
	fs.appendFile(cfg.monitorLogFile(), log);
	
	// Message to be returned to the client
	return '{ '
		+ '"status": "' + ((messages[code].type === 'error') ? 0 : 1) + '", '
		+ '"code": "' + code + '", '
		+ '"text": "' + text + '" '
		+ '}';
}



// ---------------------------------------------------------------------------------------------
// Check whether a member of a nested object exists
// Use (YAHOO, 'Foo.Bar.xyz') to operate on YAHOO.Foo.Bar.xyz
//
// Argument 1 : Object reference
// Argument 2 : Member to be tested
//
// Returns true if member exists, false otherwise
// ---------------------------------------------------------------------------------------------
function memberExists (ref, member) {
    var i, name,
		members = member.split('.');

	for(i=0; i<members.length; i++) {
		name = members.shift();
		if (!ref.hasOwnProperty(name)) return false;
		ref = ref[name];
	}
	return true;
}



// --------------------------------------------------------------------------------------
// Send the statistics object to the monitor daemon
//
// Argument 1 : Object containing statistics
// --------------------------------------------------------------------------------------
function sendData (data) {
	var client;
	
	// Connect to monitor daemon
	client = new net.Socket();
	client.connect(cfg.monitorPort(), cfg.monitorHost(), function() {
		// Write a message to the socket
		client.write(JSON.stringify(data));
		
		// Close the client socket
		client.destroy();
	});
	
	// Trap connection errors
	client.on('error', function(err) {
		var addr = cfg.monitorHost() + ':' + cfg.monitorPort();
		
		if((/ECONNREFUSED/).test(err)) {
			logAction('CMN002', [addr]);
		}
		else if((/ETIMEDOUT/).test(err)) {
			// TODO Where is connection time set?
			logAction('CMN003', [addr]);
		}
		else if((/ECONNRESET/).test(err)) {
			logAction('CMN004', [addr]);
		}
		else {
			logAction('CMN005', [addr, err]);
		}
	});
}


