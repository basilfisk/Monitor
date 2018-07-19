// **************************************************************************************
// **************************************************************************************
//
// Probe that gathers Postgres database statistics on the server.
// The data is written to the monitor daemon which in turn writes the data to the
// Mongo database in which all the monitoring data is held.
//
// **************************************************************************************
// **************************************************************************************

var net = require('net'),
	child_process = require('child_process'),
	pg = require('/usr/lib/node_modules/pg'),
	config = require(__dirname+'/etc/config.json'),
	common = require(__dirname+'/common.js'),
	cfg = require(__dirname+'/configure.js');
var statarr = [];

exports.probePostgres = probePostgres;

pg_test();



//--------------------------------------------------------------------------------------
// Start extracting data
//--------------------------------------------------------------------------------------
function probePostgres () {
	var script, option, dbhost, dbport, servers, dbs,
		dbstats,
		index = 0;
		statistics = { data : {} };
	
	// Header details
	statistics.category = config.probes.postgres.category;
	statistics.type = config.probes.postgres.type;
	
	// Database script and server data
	script = config.probes.postgres.test.script;
	option = config.probes.postgres.test.option;
	servers = config.probes.postgres.test.servers;
	
	// Read connection information and databases for each server
	for(var s=0; s<servers.length; s++) {
		dbhost = servers[s].dbhost;
		dbport = servers[s].dbport;
		dbs = servers[s].databases;
		
		// Add server name to statistics
//		statistics.server = dbhost;
		
		// Run script against each database
		for(var d=0; d<dbs.length; d++) {
			statarr.push(statistics);
			
			coverfn(index,script,option,dbhost,dbport,dbs[d]);
			
			index++;
/*			dbstats = child_process.spawn(script, ['--action='+option, '--host='+dbhost, '--port='+dbport, '--dbname='+dbs[d]]);
			
			// Process data from the command
			dbstats.stdout.on('data', function (data) {
				var str, info, fields, item;
				
				// Read data, remove new line char and split into a set of data items
				str = data.toString();
				str = str.replace('\n','');
				info = str.split(' ');
				
				// Process each data item returned for the database
				for(var i=0; i<info.length; i++) {
					// Break each item into a name/value pair
					item = info[i].split(':');
					
					// Add item to statistics object
					statistics.data[item[0]] = item[1];
				}
console.log('DATA:'+dbhost+':'+statistics.data.dbname);
				
				// Add server name to statistics
//				statistics.server = dbhost;
				
				// Write statistics to monitor daemon
				common.sendData(statistics, config.probes.postgres.category);
			});
			
	//		// Add an 'end' event listener to close the writeable stream
	//		dbstats[d].stdout.on('close', function(data) {
	//			console.log('CLOSE:'+statistics.data.dbname);
	//			common.sendData(statistics, config.probes.postgres.category);
	//		});
			
			// When the spawn child process exits, check if there were any errors and close the writeable stream
			dbstats.on('exit', function(code) {
				if(code != 0) {
					logger.log('error','Error running Postgres script: ' + code);
				}
			});
*/
		}
	}
}



function coverfn(idx,fn,opt,host,port,database) {
	var stats, dbstats;
	
	stats = statarr[idx];
	console.log(idx);
	console.log(stats);
	dbstats = child_process.spawn(fn, ['--action='+opt, '--host='+host, '--port='+port, '--dbname='+database]);
	
	// Process data from the command
	dbstats.stdout.on('data', function (data) {
		var str, info, fields, item;
		
		// Read data, remove new line char and split into a set of data items
		str = data.toString();
		str = str.replace('\n','');
		info = str.split(' ');
		
		// Process each data item returned for the database
		for(var i=0; i<info.length; i++) {
			// Break each item into a name/value pair
			item = info[i].split(':');
			
			// Add item to statistics object
			stats.data[item[0]] = item[1];
		}
		console.log('DATA:'+host+':'+database+':'+stats.data.dbname);
		
		// Add server name to statistics
		stats.server = host;
console.log(host);
		
statarr[idx] = stats;
		// Write statistics to monitor daemon
		common.sendData(stats, config.probes.postgres.category);
	});
	
	//		// Add an 'end' event listener to close the writeable stream
	//		dbstats[d].stdout.on('close', function(data) {
	//			console.log('CLOSE:'+stats.data.dbname);
	//			common.sendData(stats, config.probes.postgres.category);
	//		});
	
	// When the spawn child process exits, check if there were any errors and close the writeable stream
	dbstats.on('exit', function(code) {
		if(code != 0) {
//			logger.log('error','Error running Postgres script: ' + code);
		}
	});
}

function pg_test () {
	var sql;
	
	sql = "SELECT	pg_relation_size(c.oid) AS rsize, " +
		  "			pg_size_pretty(pg_relation_size(c.oid)) AS psize, " +
		  "			relkind, relname, nspname " +
		  "FROM		pg_class c, pg_namespace n " +
		  "WHERE	(relkind = 'r' OR relkind = 'i') " +
		  "AND		n.oid = c.relnamespace";

	select_run('db1', sql, select_result);
}

/*

 backends            => [1, 'Number of connections, compared to max_connections.'],
 bloat               => [0, 'Check for table and index bloat.'],
 checkpoint          => [1, 'Checks how long since the last checkpoint'],
 commitratio         => [0, 'Report if the commit ratio of a database is too low.'],
 connection          => [0, 'Simple connection check.'],
 database_size       => [0, 'Report if a database is too big.'],
 dbstats             => [1, 'Returns stats from pg_stat_database: Cacti output only'],
 disk_space          => [1, 'Checks space of local disks Postgres is using.'],
 fsm_pages           => [1, 'Checks percentage of pages used in free space map.'],
 fsm_relations       => [1, 'Checks percentage of relations used in free space map.'],
 hitratio            => [0, 'Report if the hit ratio of a database is too low.'],
 index_size          => [0, 'Checks the size of indexes only.'],
 table_size          => [0, 'Checks the size of tables only.'],
 relation_size       => [0, 'Checks the size of tables and indexes.'],
 listener            => [0, 'Checks for specific listeners.'],
 locks               => [0, 'Checks the number of locks.'],
 logfile             => [1, 'Checks that the logfile is being written to correctly.'],
 pgb_pool_cl_active  => [1, 'Check the number of active clients in each pgbouncer pool.'],
 pgb_pool_cl_waiting => [1, 'Check the number of waiting clients in each pgbouncer pool.'],
 pgb_pool_sv_active  => [1, 'Check the number of active server connections in each pgbouncer pool.'],
 pgb_pool_sv_idle    => [1, 'Check the number of idle server connections in each pgbouncer pool.'],
 pgb_pool_sv_used    => [1, 'Check the number of used server connections in each pgbouncer pool.'],
 pgb_pool_sv_tested  => [1, 'Check the number of tested server connections in each pgbouncer pool.'],
 pgb_pool_sv_login   => [1, 'Check the number of login server connections in each pgbouncer pool.'],
 pgb_pool_maxwait    => [1, 'Check the current maximum wait time for client connections in pgbouncer pools.'],
 pgbouncer_backends  => [0, 'Check how many clients are connected to pgbouncer compared to max_client_conn.'],
 pgbouncer_checksum  => [0, 'Check that no pgbouncer settings have changed since the last check.'],
 pgagent_jobs        => [0, 'Check for no failed pgAgent jobs within a specified period of time.'],
 prepared_txns       => [1, 'Checks number and age of prepared transactions.'],
 timesync            => [0, 'Compare database time to local system time.'],
 txn_idle            => [1, 'Checks the maximum "idle in transaction" time.'],
 txn_time            => [1, 'Checks the maximum open transaction time.'],
 txn_wraparound      => [1, 'See how close databases are getting to transaction ID wraparound.'],
 version             => [1, 'Check for proper Postgres version.'],

*/

// ---------------------------------------------------------------------------------------------
// Run an SQL SELECT statement and pass the results as an object to the callback function
//
// Argument 1 : Database connection parameters
// Argument 2 : SQL statement to be run
// Argument 3 : Callback function
//
// Return the data records as an array of objects
// ---------------------------------------------------------------------------------------------
function select_run (dbref, sql, callback) {
	var db, pgconnect, msg;
	
	// Database connection parameters
	db = cfg.pgDBConnect(dbref, 'aa001');
	
	// Database connection string
	pgconnect = 'postgres://' + db.user + ':' + db.pass + '@' + db.host + ':' + db.port + '/' + db.name;
	
	// Connect to the database
	pg.connect(pgconnect, function(err, client, done) {
		// Failed to connect to database and get a client from the pool
		if(err) {
			msg = logAction('CMN112', [db.name, db.host, err]);
			return;
		}
		
		// Run the SQL statement
		client.query(sql, function(err, result) {
			// Release client back to the pool
			done();
			
			// Failed to run query
			if(err) {
				msg = err.toString().replace(/"/g,"'");
				msg = logAction('CMN113', [msg]);
				return;
			}
			
			// Process the callback with the data records as an array of objects
			callback(result.rows);
		});
	});
}

// ---------------------------------------------------------------------------------------------
// Return the records from an SQL Select query as a JSON string
//
// Argument 1 : Object holding data returned from SQL query (array of objects)
// ---------------------------------------------------------------------------------------------
function select_result (data) {
	var keys, id, i, jsonString, tx,
		result = {},
		inner = {};
	
	// Turn the array of objects into a nested object keyed by record ID (column 1)
	if(data.length > 0) {
		// Read the list of keys for each hash element. 1st key is the ID.
		keys = Object.keys(data[0]);
		id = keys[0];
		
		// Build a nested object, keyed by the ID (don't include the ID in the data)
		for(i=0; i<data.length; i++) {
			inner = {};
			for(var n=0; n<keys.length; n++) {
				if(keys[n] !== id) {
					inner[keys[n]] = data[i][keys[n]];
				}
			}
			result[data[i][id]] = inner;
		}
		
		// Turn data object into string
		jsonString = JSON.stringify(result);
		
		// Log transaction details
		tx = {'num':1, 'recs':data.length, 'vol':jsonString.length};
		common.logAction('SQL008', [data.length], tx);
	}
	// Empty data set as no records returned by query
	else {
		// Turn data object into string
		jsonString = JSON.stringify(result);
		
		// Log transaction details
		tx = {'num':1, 'recs':0, 'vol':jsonString.length};
		common.logAction('SQL009', [], tx);
	}
	
	// Return data
console.log(result);
	return result;
}
