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

exports.probeRootKit = probeRootKit;



// --------------------------------------------------------------------------------------
// Run the chkrootkit command
// --------------------------------------------------------------------------------------
function probeRootKit () {
	var cmd, filter, item, cat, info = {}, clean;

	// Prepare the object that will hold log data
	info.collection = cfg.rootkitCollection();
	info.database = cfg.rootkitDatabase();
	info.data = {};
	
	// Build up the filter command, starting with the command to be run
	common.logAction('CRK001', []);
	cmd = cfg.rootkitCommand();
	
	// Add filters to remove records from returned data
	filter = cfg.rootkitFilterIn();
	if(filter.length > 0) {
		cmd += ' | grep';
		for(item in filter) {
			cmd += ' -e "' + filter[item] + '"';
		}
		common.logAction('CRK002', [filter]);
	}
	
	// Add filters to exclude records from filtered set
	filter = cfg.rootkitFilterOut();
	if(filter.length > 0) {
		cmd += ' | grep -v';
		for(item in filter) {
			cmd += ' -e "' + filter[item] + '"';
		}
		common.logAction('CRK003', [filter]);
	}
	
	// Run the SED command
	cat = exec(cmd, function (error, stdout, stderr) {
		var str, recs, r;
		
		// Trap errors running exec
		if(error !== null) {
			common.logAction('CRK004');
			info.clean = true;
		}
		// Trap errors running the command
		else if(stderr) {
			common.logAction('CRK005', [stderr]);
		}
		// Process data from STDOUT
		else {
			// Read data and split into an array on new line chars
			str = stdout.toString();
			recs = str.split('\n');
			
			// Add each (non-null) record to the stats object
			for(r=0; r<recs.length; r++) {
				if(recs[r]) {
					info.data[r] = recs[r];
				}
				common.logAction('CRK006', []);
			}
			
			// Status is OK if no records left
			info.clean = (Object.keys(info.data).length > 0) ? false : true;
		}
		
		// Log the data
		common.sendData(info);
	});
}


