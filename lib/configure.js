// *********************************************************************************************
// *********************************************************************************************
//
// Server monitoring
// Copyright 2015 Breato Ltd.
//
// Load the data from the configuration file
//
// *********************************************************************************************
// *********************************************************************************************

module.exports = (function () {
	var fs = require('fs'),
		child_process = require('child_process'),
		_config = {}, _buffer, _fns;
	
	// Create empty elements for hanging the different types of configuration data
	_config.defs = {};
	
	// Read the configuration file
	_buffer = fs.readFileSync(__dirname+'/etc/config.json');
	_config.defs = JSON.parse(_buffer.toString());
	
	// Set up the accessor functions
	_fns = {
		// ------------------------------------------
		// Log files
		// ------------------------------------------
		logCollection: function (type) {
			return _config.defs.probes[type].mongo.collection;
		},
		logDatabase: function (type) {
			return _config.defs.probes[type].mongo.database;
		},
		logFile: function (type) {
			return _config.defs.probes[type].file;
		},
		logFilterIn: function (type) {
			return _config.defs.probes[type].filter.include;
		},
		logFilterOut: function (type) {
			return _config.defs.probes[type].filter.exclude;
		},
		logLastRecord: function (type) {
			return _config.defs.probes[type].lastrecord;
		},
		logParseCleanse: function (type) {
			return _config.defs.probes[type].parse.cleanse;
		},
		logParseFields: function (type) {
			return _config.defs.probes[type].parse.fields;
		},
		logParsePattern: function (type) {
			return _config.defs.probes[type].parse.pattern;
		},
		logParseType: function (type) {
			return _config.defs.probes[type].parse.type;
		},
		
		// ------------------------------------------
		// General monitor related information
		// ------------------------------------------
		monitorHost: function () {
			return _config.defs.monitor.host;
		},
		monitorLogFile: function () {
			return _config.defs.log.file;
		},
		monitorPort: function () {
			return _config.defs.monitor.port;
		},
		mongoHost: function () {
			return _config.defs.mongo.host;
		},
		mongoPort: function () {
			return _config.defs.mongo.port;
		},
		
		// ------------------------------------------
		// PostgreSQL information
		// ------------------------------------------
		pgDBConnect: function (server, name) {
			var db = {};
			db.host = _config.defs.probes.postgres.servers[server].host;
			db.port = _config.defs.probes.postgres.servers[server].port;
			db.user = _config.defs.probes.postgres.servers[server].username;
			db.pass = _config.defs.probes.postgres.servers[server].password;
			db.name = name;
			return db;
		},
//		processFilterOut: function () {
//			return _config.defs.probes.server.check.process.filter.exclude;
//		},
//		serverCollection: function () {
//			return _config.defs.probes.server.mongo.collection;
//		},
//		serverDatabase: function () {
//			return _config.defs.probes.server.mongo.database;
//		},
//		systemCycles: function () {
//			return _config.defs.probes.server.check.system.cycles;
//		},
		
		// ------------------------------------------
		// Active probes
		// ------------------------------------------
		probesActive: function (type) {
			var all = [], active = [], i;
			all = Object.keys(_config.defs.probes);
			for(i=0; i<all.length; i++) {
				if(_config.defs.probes[all[i]].type === type && _config.defs.probes[all[i]].active === 'true') {
					active.push(all[i]);
				}
			}
			return active;
		},
		probesConfig: function (type) {
			var all = [], conf = {}, i;
			all = Object.keys(_config.defs.probes);
			for(i=0; i<all.length; i++) {
				if(_config.defs.probes[all[i]].active === 'true') {
					conf[all[i]] = {};
					conf[all[i]].interval = _config.defs.probes[all[i]].usage.interval;
					conf[all[i]].start = _config.defs.probes[all[i]].usage.start;
				}
			}
			return conf;
		},
		
		// ------------------------------------------
		// Server information
		// ------------------------------------------
		processFilterIn: function () {
			return _config.defs.probes.server.check.process.filter.include;
		},
		processFilterOut: function () {
			return _config.defs.probes.server.check.process.filter.exclude;
		},
		serverCollection: function () {
			return _config.defs.probes.server.mongo.collection;
		},
		serverDatabase: function () {
			return _config.defs.probes.server.mongo.database;
		},
		systemCycles: function () {
			return _config.defs.probes.server.check.system.cycles;
		},
		
		// ------------------------------------------
		// Server information
		// ------------------------------------------
		rootkitCollection: function () {
			return _config.defs.probes.chkrootkit.mongo.collection;
		},
		rootkitDatabase: function () {
			return _config.defs.probes.chkrootkit.mongo.database;
		},
		rootkitCommand: function () {
			return _config.defs.probes.chkrootkit.command;
		},
		rootkitFilterIn: function () {
			return _config.defs.probes.chkrootkit.filter.include;
		},
		rootkitFilterOut: function () {
			return _config.defs.probes.chkrootkit.filter.exclude;
		},
		
		// ------------------------------------------
		// Get and set host name
		// ------------------------------------------
		getHost: function (callback) {
			return _config.defs.hostname;
		},
		setHost: function (callback) {
			var proc;
			proc = child_process.spawn('hostname');
			proc.on('error', function (err) {
				console.log("Can't run hostname command: " + err.code);
				return;
			});
			proc.stdout.on('data', function (data) {
				_config.defs.hostname = data.toString().replace('\n','');
				callback();
			});
		}
	}
	
	// Expose the accessor functions
    return _fns;
})();

