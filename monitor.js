// *********************************************************************************************
// *********************************************************************************************
//
// Server monitoring
// Copyright 2015 Breato Ltd.
//
// Interface between the installed monitoring probes and the Mongo database in which all
// the monitoring data is held.
//
// *********************************************************************************************
console.log(__dirname);
var net = require('net'),
	child_process = require('child_process'),
	moment = require('/usr/lib/node_modules/moment'),
	mongo = require('/usr/lib/node_modules/mongodb').MongoClient,
	common = require(__dirname+'/lib/common.js'),
	cfg = require(__dirname+'/lib/configure.js'),
	crk = require(__dirname+'/lib/probe-rootkit.js'),
	log = require(__dirname+'/lib/probe-log.js'),
	srv = require(__dirname+'/lib/probe-server.js');

// Trap any uncaught exceptions
// Write error stack to STDERR, then exit process as state may be inconsistent
process.on('uncaughtException', function(err) {
	var msg = JSON.parse(common.logAction('MON009'));
	console.error(moment().format('YYYY/MM/DD HH:mm:ss.SSS') + ' ' + msg.code + ': ' + msg.text);
	console.error(err.stack);
	process.exit(1);
});

// Read server name in background, then run 'listener' when finished
cfg.setHost(listener);



// --------------------------------------------------------------------------------------
// Open a port of the server that will accept data from the various probes running on
// the servers  This data will be written to the central monitoring database.
//
// Argument 1 : Handle of the MongoDB database to which the data is to be written
// --------------------------------------------------------------------------------------
function listener (db) {
	// Create a server that listens on a port for data sent by the probes
	net.createServer(function(client) {
		// Read in-bound data from a probe and load into Mongo
		client.on('data', function(data) {
			common.logAction('MON010', []);
			mongo_open(JSON.parse(data.toString()));
		});
	    
		// Trap connection errors
		client.on('error', function(err) {
			var addr = cfg.monitorHost() + ':' + cfg.monitorPort();
			
			if((/ECONNREFUSED/).test(err)) {
				common.logAction('MON004', [addr]);
			}
			else if((/ETIMEDOUT/).test(err)) {
				// TODO Where is connection time set?
				common.logAction('MON005', [addr]);
			}
			else if((/ECONNRESET/).test(err)) {
				common.logAction('MON006', [addr]);
			}
			else {
				common.logAction('MON007', [addr, err]);
			}
		});
	}).listen(cfg.monitorPort(), cfg.monitorHost());
	common.logAction('MON008', [cfg.monitorHost(), cfg.monitorPort()]);
	
	// Start the probes
	start_probes();
}



// --------------------------------------------------------------------------------------
// Connect to the Mongo database
//
// Argument 1 : Data to be logged
// --------------------------------------------------------------------------------------
function mongo_open (data) {
	var server, dbname;
	
	// Server name and database name
	server = cfg.mongoHost() + ':' + cfg.mongoPort();
	dbname = data.database;
	
	// Open the database
	mongo.connect('mongodb://' + server + '/' + dbname, function(err, dbref) {
		// Check connection to database was successful
		if(err) {
			common.logAction('MON001', [dbname, server, err]);
			return;
		}
		common.logAction('MON002', [dbname, server]);
		
		// Once connected to database, write data sent by probe
		mongo_write(dbref, data);
	});
}



// --------------------------------------------------------------------------------------
// Insert data into collection
//
// Argument 1 : Handle of the MongoDB database
// Argument 2 : Data to be logged
// --------------------------------------------------------------------------------------
function mongo_write (db, data) {
	var name, collref;
	
	// Read collection name and database name then remove from object
	collname = data.collection;
	dbname = data.database;
	delete data.collection;
	delete data.database;
	
	// Add server name if it hasn't been set
	if(!data.server) {
		data.server = cfg.getHost();
	}
	
	// Add a timestamp
	data.timestamp = moment().format('YYYY/MM/DD HH:mm:ss.SSS');
	
	// Open the collection and insert data
	common.logAction('MON003', [collname, dbname]);
	collref = db.collection(collname);
	collref.insert(data, function(err, result) {
		if(err) {
			common.logAction('MON011', [collname, dbname, err]);
		}
		db.close();
	});
}



// --------------------------------------------------------------------------------------
// Read set of active probes and start them
// --------------------------------------------------------------------------------------
function start_probes () {
	var probeData, probes, start, interval;
	
	// Read list of active log probes
	probeData = cfg.probesConfig();
	probes = Object.keys(probeData);
	
	// Run each probe immediately and schedule it to be run at the specified interval
	function run_probe (fn, start, interval) {
		setTimeout(function () {
			fn();
			setInterval(function () {
				fn();
			}, 1000*interval);
		}, 1000*start);
	}
		
	// Start each probe
	for(key in probes) {
		common.logAction('MON013', [probes[key]]);
		start = probeData[probes[key]].start;
		interval = probeData[probes[key]].interval;
		
		if(probes[key] === 'server') {
			run_probe(srv.probeServer, start, interval);
		}
		else if(probes[key] === 'chkrootkit') {
			run_probe(crk.probeRootKit, start, interval);
		}
		else if(probes[key] === 'apache-error') {
			run_probe(log.probeApacheError, start, interval);
		}
		else if(probes[key] === 'gateway-listener') {
			run_probe(log.probeGatewayListener, start, interval);
		}
		else if(probes[key] === 'gateway-server') {
			run_probe(log.probeGatewayServer, start, interval);
		}
		else {
			common.logAction('MON014', [probes[key]]);
		}
	}
}

