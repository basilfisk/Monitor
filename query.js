var client = require('mongodb').MongoClient,
	query = require('./query.json'),
	names, name, dump;

// Read and check argument 1 for name of query
names = Object.keys(query);
name = process.argv[2];
dump = process.argv[3];
if(name === undefined) {
	console.log("Query name is missing");
}
else if (names.indexOf(name) == -1) {
	console.log("Unrecognised query name");
	console.log(names);
}
else {
	// List of valid queries
	// Connect to database
	client.connect(query[name].url, function(err, db) {
		var ref, rows, cols, order, limit;
		
		// Connect to collection
		ref = db.collection(query[name].collection);
		
		// Query parts
		rows = query[name].rows;
		cols = query[name].cols;
		order = query[name].order;
		limit = parseInt(query[name].limit);
		
		// Dump the query
		if(dump) {
			console.log("find("+JSON.stringify(rows)+
						", "+JSON.stringify(cols)+
						").sort("+JSON.stringify(order)+
						").limit("+JSON.stringify(limit)+")");
		}
		
		// Run the query
		ref.find(rows, cols).sort(order).limit(limit).toArray(function (err, docs) {
			console.log(docs);
			db.close();
		});
	});
}

// TEST: db.apiEvents.find({fn:"process_request"}, {time:1,fn:1,username:1}).sort({_id:-1}).limit({10})

