// **************************************************************************************
// **************************************************************************************
//
// Probe that gathers system and process statistics on the server.
// The data is written to the monitor daemon which in turn writes the data to the
// Mongo database in which all the monitoring data is held.
//
// **************************************************************************************
// **************************************************************************************

var exec = require('child_process').exec,
	common = require(__dirname+'/common.js'),
	cfg = require(__dirname+'/configure.js');

exports.probeServer = probeServer;



// --------------------------------------------------------------------------------------
// Create a function to keep the context of each iteration
// --------------------------------------------------------------------------------------
var check_status = (function () {
	// Initialise process status
	var _status = { process:false, system:false };
	
	// Prepare the object that will hold log data
	var _info = {};
	_info.collection = cfg.serverCollection();
	_info.database = cfg.serverDatabase();
	
	// Create a function to set the completion status of the extract processes
	// When both are complete, send the gathered data to the monitor daemon
	var _fns = {
		end: function (name, data) {
			// Set status
			_status[name] = true;
			
			// Save data
			if(name === 'process') {
				_info.process = [];
				_info.process = data;
			}
			else if(name === 'system') {
				_info.system = {};
				_info.system = data;
			}
			
			// If both extract functions have finished, reset status and send data to monitor daemon
			if(_status.process && _status.system) {
				common.logAction('SRV009', []);
				_status = { process:false, system:false };
				common.sendData(_info);
			}
		}
	};
	
	return _fns;
})();



// --------------------------------------------------------------------------------------
// Start extracting data
// These processes run in parallel and data is written on completion of both
// --------------------------------------------------------------------------------------
function probeServer () {
	var probes, key;
	
	// Read list of active system probes
	probes = cfg.probesActive('server');
	
	// Start, only if the server checks are active
	for(key in probes) {
		if(probes[key] === 'server') {
			process_probe();
			system_probe();
		}
	}
}



// --------------------------------------------------------------------------------------
// Populate the temporary hash with process information
// Runs in parallel with other statistics gathering functions
// --------------------------------------------------------------------------------------
function process_probe () {
	var cmd, filter, filter, item, process;
	
	// Command to be run
	cmd = 'ps -e -o pid,ppid,user,priority,nice,%cpu,%mem,stat,args';
	common.logAction('SRV007', []);
	
	// Add filters to remove records from returned data
	filter = cfg.processFilterIn();
	if(filter.length > 0) {
		cmd += ' | grep';
		for(item in filter) {
			cmd += ' -e "' + filter[item] + '"';
		}
		common.logAction('SRV003', [filter]);
	}
	
	// Add filters to exclude records from filtered set
	filter = cfg.processFilterOut();
	if(filter.length > 0) {
		cmd += ' | grep -v';
		for(item in filter) {
			cmd += ' -e "' + filter[item] + '"';
		}
		common.logAction('SRV004', [filter]);
	}
	
	// Use the 'ps' command to gather data for running processes
	process = exec(cmd, function (error, stdout, stderr) {
		var data;
		
		// Trap errors running exec
		if(error !== null) {
			common.logAction('SRV005', [error]);
		}
		// Trap errors running the command
		else if(stderr) {
			common.logAction('SRV006', [stderr]);
		}
		// Process data from STDOUT
		else {
			data = process_extract(stdout);
			check_status.end('process', data);
		}
	});
}



// --------------------------------------------------------------------------------------
// Extract process related data from the standard output of the 'ps' command
//
// Argument 1 : STDOUT from 'ps' command
//
// Return the extracted information
// --------------------------------------------------------------------------------------
function process_extract (stdout) {
	var	str, rows, row, fields, temp, status, values, value, data = [];
	
	// Convert to string and skip if empty
	str = stdout.toString();
	if(str.length > 1) {
		// Split into rows
		rows = str.split('\n');
		
		// Extract data
		for(var i=0; i<rows.length; i++) {
			row = rows[i];
			// Skip empty rows
			if(row) {
				// Remove commas, replace spaces with commas, and remove an unwanted leading comma
				row = row.replace(/,/g,'');
				row = row.replace(/\s+/g,',');
				row = row.replace(/^,/g,'');
				
				// Split into fields using commas
				fields = row.split(',');
				
				// PID  PPID USER     PRI  NI %CPU %MEM STAT COMMAND
				//   1     0 root      20   0  0.0  0.0 Ss   /sbin/init
				// Ignore the header row
				if(fields[0] !== 'PID') {
					temp = {};
					temp.pid = fields.shift();
					temp.parent = fields.shift();
					temp.user = fields.shift();
					temp.priority = fields.shift();
					temp.nice = fields.shift();
					temp.cpu = fields.shift();
					temp.memory = fields.shift();
					
					// Expand the status code
					status = fields.shift();
					if(status) {
						temp.status = {};
						temp.status.code = status;
						values = status.split('');
						temp.status.status = values[0];
						temp.status.modifier = values[1];
						
/*						// Get status description from code
						switch(values[0]) {
							case 'D':
								value = 'Uninterruptible sleep (usually IO)';
								break;
							case 'R':
								value = 'Running or runnable (on run queue)';
								break;
							case 'S':
								value = 'Interruptible sleep (waiting for an event to complete)';
								break;
							case 'T':
								value = 'Stopped, either by a job control signal or because it is being traced';
								break;
							case 'W':
								value = 'Paging (not valid since the 2.6.xx kernel)';
								break;
							case 'X':
								value = 'Dead (should never be seen)';
								break;
							case 'Z':
								value = 'Defunct ("zombie") process, terminated but not reaped by its parent';
								break;
							default:
						}
						temp.status.status = value;
						
						// Get status modifier description from code
						switch(values[1]) {
							case '<':
								value = 'High-priority (not nice to other users)';
								break;
							case 'N':
								value = 'Low-priority (nice to other users)';
								break;
							case 'L':
								value = 'Has pages locked into memory (for real-time and custom IO)';
								break;
							case 's':
								value = 'Session leader';
								break;
							case 'l':
								value = 'Multi-threaded (using CLONE_THREAD, like NPTL pthreads do)';
								break;
							case '+':
								value = 'In the foreground process group';
								break;
							default:
						}
						temp.status.modifier = value;
*/
					}
				}
				
				// Remaining elements in array all relate to command and it's arguments
				temp.command = fields.join(' '); // Full command and all arguments
				temp.command = fields.shift();
				
				// Only add user processes to the object
				if(temp.parent > 2) {
					data.push(temp);
				}
			}
		}
	}
	
	// Return the extracted information
	return data;
}



// --------------------------------------------------------------------------------------
// Populate the temporary hash with system statistics
// Runs in parallel with other statistics gathering functions
// --------------------------------------------------------------------------------------
function system_probe () {
	var cmd, system;
	
	// Use the header section of the 'top' command to gather system summary data
	cmd = 'top -p 1 -n ' + cfg.systemCycles() + ' -b';
	common.logAction('SRV008', []);
	
	// Process data from the command
	system = exec(cmd, function (error, stdout, stderr) {
		var data;
		
		// Trap errors running exec
		if(error !== null) {
			common.logAction('SRV001', [error]);
		}
		// Trap errors running the command
		else if(stderr) {
			common.logAction('SRV002', [stderr]);
		}
		// Process data from STDOUT
		else {
			data = system_extract(stdout);
			check_status.end('system', data);
		}
	});
}



// --------------------------------------------------------------------------------------
// Extract system related data from the standard output of the 'top' command
//
// Argument 1 : STDOUT from 'top' command
//
// Return the extracted information
// --------------------------------------------------------------------------------------
function system_extract (stdout) {
	var	str, rows, row, fields, regexp, data = {};
	
	// Convert to string and skip if empty
	str = stdout.toString();
	if(str.length > 1) {
		// Split into rows
		rows = str.split('\n');
		
		// Extract data
		for(var i=0; i<rows.length; i++) {
			row = rows[i];
			// Skip empty rows
			if(row) {
				// Remove commas, replace spaces with commas, and remove an unwanted leading comma
				row = row.replace(/,/g,'');
				row = row.replace(/\s+/g,',');
				row = row.replace(/^,/g,'');
				
				// Split into fields using commas
				fields = row.split(',');
				
				// Read no. users and 3 CPU load averages
				// top,-,13:44:42,up,1,day,5:15,6,users,load,average:,0.43,0.45,0.52
				regexp = /^top/;
				if(regexp.test(row)) {
					data.users = fields[fields.length-7];
					data.load = {};
					data.load.mins15 = fields[fields.length-1];
					data.load.mins05 = fields[fields.length-2];
					data.load.mins01 = fields[fields.length-3];
				}
				
				// Read process info
				// Tasks:,1,total,0,running,1,sleeping,0,stopped,0,zombie
				regexp = /^Tasks:/;
				if(regexp.test(row)) {
					data.processes = {};
					data.processes.total = fields[1];
					data.processes.running = fields[3];
					data.processes.sleeping = fields[5];
					data.processes.stopped = fields[7];
					data.processes.zombie = fields[9];
				}
				
				// Read time CPU has spent running users' processes
				// %Cpu(s):,13.7,us,2.3,sy,0.0,ni,78.1,id,5.9,wa,0.0,hi,0.0,si,0.0,st
				regexp = /^%Cpu/;
				if(regexp.test(row)) {
					data.cpu = {};
					data.cpu.user = fields[1];
					data.cpu.system = fields[3];
					data.cpu.nice = fields[5];
					data.cpu.idle = fields[7];
					data.cpu.wait = fields[9];
					data.cpu.hwinterupts = fields[11];
					data.cpu.swinterupts = fields[13];
					data.cpu.hypervisor = fields[15];
				}
				
				// Read physical memory info
				// KiB,Mem:,8187156,total,6679552,used,1507604,free,416748,buffers
				regexp = /^KiB,Mem:/;
				if(regexp.test(row)) {
					data.memory = {};
					data.memory.total = fields[2];
					data.memory.used = fields[4];
					data.memory.free = fields[6];
					data.memory.buffers = fields[8];
				}
				
				// Read swap memory info
				// KiB,Swap:,8263676,total,688,used,8262988,free.,3044124,cached,Mem
				regexp = /^KiB,Swap:/;
				if(regexp.test(row)) {
					data.swap = {};
					data.swap.total = fields[2];
					data.swap.used = fields[4];
					data.swap.free = fields[6];
					data.swap.cached = fields[8];
				}
			}
		}
	}
	
	// Return the extracted information
	return data;
}


