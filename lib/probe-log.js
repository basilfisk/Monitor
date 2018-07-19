// **************************************************************************************
// **************************************************************************************
//
// Probe that reads data from the end of log files.
// The data is written to the monitor daemon which in turn writes the data to the
// Mongo database in which all the monitoring data is held.
//
// **************************************************************************************
// **************************************************************************************

var fs = require('fs');
	child_process = require('child_process'),
	exec = require('child_process').exec,
	common = require(__dirname+'/common.js'),
	cfg = require(__dirname+'/configure.js');

exports.probeApacheError = probeApacheError;
exports.probeGatewayListener = probeGatewayListener;
exports.probeGatewayServer = probeGatewayServer;



// --------------------------------------------------------------------------------------
// Cover functions for each type of log file to be processes
// This is necessary as 'setInterval' does not handle functions with arguments
// --------------------------------------------------------------------------------------
function probeApacheError () {
	probeLog('apache-error');
}

function probeGatewayListener () {
	probeLog('gateway-listener');
}

function probeGatewayServer () {
	probeLog('gateway-server');
}



// --------------------------------------------------------------------------------------
// Start extracting data from log files
// There may be several log file processes running in parallel
//
// Argument 1 : Name of function to be run
// --------------------------------------------------------------------------------------
function probeLog (fn) {
	// Read the number of records in each active log file, then process the log file
	// Created in a function to keep the context of the number of records to be processed
	function runFn (type) {
		// Determine number of rows in file
		var count = child_process.spawn('wc', ['-l', cfg.logFile(type)]);
		
		// Extract number of rows from output
		count.stdout.on('data', function (data) {
			read_last_record(type, data.toString().trim());
		});
	}
	
	// Process the log file
	runFn(fn);
}



// --------------------------------------------------------------------------------------
// Read records from the log  and write to MongoDB
//
// Argument 1 : Type of log file being processed
// Argument 2 : Word count result (nnnn filename)
// Argument 3 : Number of last record read from log file by this probe
// --------------------------------------------------------------------------------------
function process_log (type, wc, lastrecord) {
	var arr, firstrecord, filename, cmd, filter, item, info = {};
	
	// Prepare the object that will hold log data
	info.collection = cfg.logCollection(type);
	info.database = cfg.logDatabase(type);
	info.data = {};
	
	// Read data, remove new line chars, then extract no. records in file and file name
	arr = wc.replace('\n','').split(' ');
	firstrecord = 1 + lastrecord;
	lastrecord = arr[0];
	filename = arr[1];
	
	// Skip if no new records
	common.logAction('LOG001', [firstrecord, lastrecord, type]);
	if(firstrecord <= lastrecord) {
		// Build up the filter command, starting with the record set to be read
		// sed -n 15351,15399p /var/log/breato/listener.log | grep -e "read" | grep -v -e "debug" -e "common"
		cmd = 'sed -n ' + firstrecord + ',' + lastrecord + 'p ' + filename;
		
		// Add filters to remove records from returned data
		filter = cfg.logFilterIn(type);
		if(filter.length > 0) {
			cmd += ' | grep';
			for(item in filter) {
				cmd += ' -e "' + filter[item] + '"';
			}
			common.logAction('LOG002', [filter]);
		}
		
		// Add filters to exclude records from filtered set
		filter = cfg.logFilterOut(type);
		if(filter.length > 0) {
			cmd += ' | grep -v';
			for(item in filter) {
				cmd += ' -e "' + filter[item] + '"';
			}
			common.logAction('LOG003', [filter]);
		}
		
		// Run the SED command
		child = exec(cmd, function (error, stdout, stderr) {
			var str, recs, r, fields, key, clean, names, n, fld;
			
			// Trap errors running exec
			if(error !== null) {
				common.logAction('LOG004', [error]);
			}
			// Trap errors running the command
			else if(stderr) {
				common.logAction('LOG005', [stderr]);
			}
			// Process data from STDOUT
			else {
				// Read data and split into an array on new line chars
				str = stdout.toString();
				recs = str.split('\n');
				
				// Add each (non-null) record to the stats object
				for(r=0; r<recs.length; r++) {
					if(recs[r]) {
						// Parse the fields in the record using delimiters
						if(cfg.logParseType(type) === 'delimiter') {
							// Break record into fields
							fields = recs[r].split(cfg.logParsePattern(type));
							
							// Key for the record
							// TODO this is wrong as it is not the line number xxxxxxxxxxxxxxxx
							key = (firstrecord+r).toString();
							
							// Load data
							info.data[key] = {};
							names = cfg.logParseFields(type);
							clean = cfg.logParseCleanse(type);
							for(n=0; n<names.length; n++) {
								// Don't load field unless name is defined
								if(names[n] !== undefined) {
									fld = fields[n];
									// Cleanse the data
									regexp = new RegExp(clean[n],"g");
									fld = fld.replace(regexp,"");
									// Save the data
									info.data[key][names[n]] = fld;
								}
							}
						}
					}
				}
				common.logAction('LOG006', [type]);
				common.sendData(info);
				
				// Update the last record in the tracker file
				fs.writeFileSync(cfg.logLastRecord(type), lastrecord);
			}
		});
	}
}



// --------------------------------------------------------------------------------------
// Read the last record from the tracker file
//
// Argument 1 : Type of log file being processed
// Argument 2 : Word count result (nnnn filename)
// --------------------------------------------------------------------------------------
function read_last_record (type, wc) {
	fs.readFile(cfg.logLastRecord(type), function (err, data) {
		if(err) {
			process_log(type, wc, 0);
		}
		else {
			process_log(type, wc, parseInt(data.toString()));
		}
	});
}

