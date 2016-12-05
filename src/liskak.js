"use strict";
const REQUIRED_CONFIG_KEYS = ['secret', 'host', 'port', 'proto'];
const NODE_POLLING_INTERVAL = 10000;
const NODE_MIN_CONSENSUS = 0;
const API_REQUEST_TIMEOUT = 0;
const NODE_MAX_FAILURES = 10;
const NODE_MAX_BLOCK_DELAY = 3;
const LISK_MAX_VOTES = 101;
const LISK_MAX_BALLOTS = 33;
const MAX_INMEMORY_DELEGATE_PAGES = 10;
const MINUTES_WITH_NO_BLOCKS_BEFORE_REBUILDING = 0;
var monitorIteration = 0;
var stdio = require('stdio');
var process = require('process');
var fs = require('fs');
var url = require('url');
var Q = require('q');
var winston = require('winston');
var querystring = require('querystring');
var tail = require('tail').Tail;
var delegateList = [];
var delegateCompare = {};
var delegateAdd = [];
var delegateRemove = [];
var delegateDB = {};

var options = stdio.getopt({
	'configuration': {    key: 'c', args: 1, description: 'Path to the configuration json file (defaults to ./liskak.json)'},
	'info': {             key: 'i', args: 0, description: 'Displays your account info'},
	'newAccount': {       key: 'N', args: 0, description: 'Creates a new account'},
	'balance': {          key: 'b', args: 1, description: 'Displays an account\'s balance'},
	'getHeight': {        key: 'd', args: 0, description: 'Get block height'},
	'logLevel': {         key: 'L', args: 1, description: 'Logging level, one of: error, warn, info verbose, debug, silly', default: 'info'},
	'listVotes': {        key: 'l', args: 1, description: 'Lists your votes'},
	'upvote': {           key: 'I', args: 1, description: 'Vote for delegates in file specified'},
	'downvote': {         key: 'O', args: 1, description: 'Remove vote from delegates in file specified'},
	'checkVotes': {       key: 'C', args: 0, description: 'Checks current votes, compares with upvote/downvote data in files (flags -I and -O)'},
	'replaceVotes': {     key: 'R', args: 0, description: 'Set the upvotes exactly as provided by the upvote list from -I flag'},
	'commitVotes': {      key: 'A', args: 0, description: 'Executes your voting orders with upvote/downvote data in files (flags -I and -O); check first with -C flag for action list'},
	'voteForIrondizzy': { key: 'v', args: 0, description: 'Allow a spare voting slot to go to "hmachado"' },
	'isForging': {        key: 'y', args: 0, description: 'Test if forging'},
	'enableForging': {    key: 'Y', args: 0, description: 'Enable forging'},
	'disableForging': {   key: 'W', args: 0, description: 'Disable forging'},
	'status': {           key: 'z', args: 0, description: 'Reports on sync status of node'},
	'donate': {           key: 's', args: 1, description: 'Donate LSK to this great cause, default: 5' },
	'transfer': {         key: 't', args: 2, description: 'Transfer LSK to an address from your configured account: -t LSK ADDRESS' },
	'lsktransfer': {      key: 'T', args: 2, description: 'Transfer LSK^-8 to an address from your configured account: -T LSK ADDRESS' },
	'multitransfer': {    key: 'm', args: '*', description: 'Transfer LSK to a list of addresses from your configured account: -t LSK ADDRESS [ADDRESS] ...' },
	'multilsktransfer': { key: 'M', args: '*', description: 'Transfer LSK^-8 to a list of addresses from your configured account: -t LSK ADDRESS [ADDRESS] ...' },
	'failoverMonkey': {   key: 'f', args: '*', description: 'Provide a list of available nodes for forging failover; stays awake and acts on blockchain and connection failures'},
	'supervise': {        key: 'S', args: 1, description: 'Provide lisk path to manage lisk process locally (handles fork3, etc.)'},
	'liskscript': {       key: 'K', args: 1, description: 'Provide absolute path for lisk script: lisk.sh for operations (supervise implied)'},
	'logfile': {          key: 'J', args: 1, description: 'Provide absolute path for lisk logfile (supervise implied)'},
	'minutesWithoutBlock': {  key: 'B', args: 1, description: 'Minutes without blocks before issuing a rebuild, default is disabled (0)', default: MINUTES_WITH_NO_BLOCKS_BEFORE_REBUILDING},
	'consensus': {        key: 'Q', args: 1, description: 'Broadhash consensus threshold, reload if under value for two consecutive samples', default: NODE_MIN_CONSENSUS},
	'inadequateBroadhash': {  key: 'q', args: 0, description: 'Restart on "Inadequate broadhash consensus" message'},
	'pollingInterval': {  key: 'P', args: 1, description: 'Interval between node polling in milliseconds', default: NODE_POLLING_INTERVAL},
	'apiRequestTimeout': {key: 'w', args: 1, description: 'API request timeout, 0 means disabled', default: API_REQUEST_TIMEOUT},
	'maxFailures': {      key: 'F', args: 1, description: 'Maximum failures tolerated when chatting with lisk nodes', default: NODE_MAX_FAILURES},
	'maxBlocksDelayed': { key: 'D', args: 1, description: 'Maximum number of block difference between nodes before change forging node', default: NODE_MAX_BLOCK_DELAY},
	'testMode': {         key: 'X', args: 0, description: 'Test mode' }
});

//Force types
options.apiRequestTimeout = parseInt(options.apiRequestTimeout);
options.minutesWithoutBlock = parseInt(options.minutesWithoutBlock);
options.maxFailures = parseInt(options.maxFailures);
options.maxBlocksDelayed = parseInt(options.maxBlocksDelayed);
options.pollingInterval = parseInt(options.pollingInterval);
options.consensus = parseInt(options.consensus);
if (options.testMode === true) {
	options.logLevel = "silly";
} 

var logger = new (winston.Logger)({
	transports: [
		new winston.transports.Console({ 
			'level': options.logLevel,
			'timestamp': function() {
				return (new Date()).toISOString();
			},
			'formatter': function(options) {
				return options.timestamp() +' '+ options.level.toUpperCase() +' '+ (undefined !== options.message ? options.message : '') + (options.meta && Object.keys(options.meta).length ? ''+ JSON.stringify(options.meta) : '' );
			}
		})
	],
	exceptionHandlers: [
		new winston.transports.File({ filename: 'path/to/exceptions.log' })
	]
});
logger.debug('GetOpt', options);

//TODO: solve salad below
var configFilename = (options.configuration)?process.cwd() + "/" + options.configuration:"./liskak.json";
if (!fs.existsSync(configFilename, fs.F_OK)) {
	configFilename = (options.configuration)?options.configuration:"./liskak.json";;
}

if ((options.configuration)&&(!fs.existsSync(configFilename, fs.F_OK))) {
	logger.error(`Bad configuration file: ${configFilename}`);
}

var config = {}
try {
	config = require(configFilename);	
} catch(e) {
	logger.error(`Configuration file ${configFilename} is an invalid json file: ${e.message}`);
	process.exit(15);	
}
config["filename"] = configFilename;

/* TODO: Check sane configuration */
Object.keys(REQUIRED_CONFIG_KEYS).forEach(function(e, k, a) {
	var requiredParameter = REQUIRED_CONFIG_KEYS[k];
	if (config[requiredParameter] === undefined) {
		logger.error(`Configuration file ${configFilename} must have a value for key "${requiredParameter}"`);
		process.exit(150);
	}
});

if  ((config["secondSecret"] === undefined)||(config["secondSecret"] === null)) {
	delete config["secondSecret"];
}
//TODO: Implement certificate configuration and check
/*
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
*/


/*
 _          _                    __           
| |__   ___| |_ __   ___ _ __   / _|_ __  ___ 
| '_ \ / _ \ | '_ \ / _ \ '__| | |_| '_ \/ __|
| | | |  __/ | |_) |  __/ |    |  _| | | \__ \
|_| |_|\___|_| .__/ \___|_|    |_| |_| |_|___/
             |_|                              
*/
var listVoters = function(data) {
	if (data.success === true) {
		console.log("LiskAddress;DelegateName");
		Object.keys(data["delegates"]).forEach(function(element, key, _array) {
			console.log(data["delegates"][element]["address"] + ";" + data["delegates"][element]["username"]);
		});	
	} else {
		logger.error(`Could not get list of votes from your account:`, data);
	}
}

var isForging = function(data) {
	if (data.success === true) {
		if (data.enabled === true) {
			console.log(`Forging ENABLED`);
		} else {
			console.log(`Forging DISABLED`);
		}
	} else {
		logger.error(`Could not get forging status from host`);
	}
}

var defaultDisplay = function(data) {
	if (data.success === true) {
		Object.keys(data).forEach(function(element, key, _array) {
			if (element !== "success") {
				console.log(`   ${element} = ${data[element]}`);
			}
		});
	} else {
		logger.error(`Could not handle the response:`, data);
	}
}

/*
 _ __  _ __ ___  _ __ ___ (_)___  ___ 
| '_ \| '__/ _ \| '_ ` _ \| / __|/ _ \
| |_) | | | (_) | | | | | | \__ \  __/
| .__/|_|  \___/|_| |_| |_|_|___/\___|
|_|
*/
var liskak = function(_config, _options) {
	var protocol =  _config["protocol"] || _config["proto"] || "https";
	var https = (protocol === "https")?require('https'):require('http');
	var _stats = {
		'consecutiveFailures': 0,
		'totalFailures': 0,
		'currentFailures': 0,
		'failure': 0,
		'successes': 0,
		'enabled': 0,
		'disabled': 0,
		'active': 0,
		'stale': 0,
		'height': 0
	};
	var defaultOptions = {
		'hostname': _config["host"],
		'port': _config["port"],
		'method': 'GET',
		'headers': {'Content-Type' : 'application/json;charset=UTF-8' },
		'rejectUnauthorized': false,
		'requestCert': true,
		'agent': false
	};

	var command = {
		'open': {
			'path': '/api/accounts/open',
			'method': 'POST',
			'body': JSON.stringify({'secret': _config['secret']})
		},
		'getHeight': {
			'path': '/api/blocks/getHeight',
		},
		'balance': {
			'path': '/api/accounts/getBalance',
			'querystring': [ ["balance", "address"] ]
		},
		'status': {
			'path': '/api/loader/status/sync',
		},
		'donate': {
			'path': '/api/transactions',
			'method': 'PUT',
			'querystring': [ "secret", "publicKey", "secondSecret", ["amount", {}], ["recipientId", "8858064098621060602L"] ]
		},
		'transfer': {
			'path': '/api/transactions',
			'method': 'PUT',
			'querystring': [ "secret", "publicKey", "secondSecret", ["amount", {}], ["recipientId", {}] ]
		},
		'forgeStatus': {
			'path': '/api/delegates/forging/status',
			'querystring': [ "publicKey" ]
		},
		'forgeEnable': {
			'path': '/api/delegates/forging/enable',
			'method': 'POST',
			'querystring': [ "secret", "publicKey" ]
		},
		'forgeDisable': {
			'path': '/api/delegates/forging/disable',
			'method': 'POST',
			'querystring': [ "secret", "publicKey" ]
		},
		'listVotes': {
			'path': '/api/accounts/delegates',
			'querystring': [ "address" ]
		},
		'listDelegates': {
			'path': '/api/delegates',
			'querystring': [ ["limit", 101], ["offset", {}], ["orderBy", "rate:asc"] ]
		},
		'vote': {
			'path': '/api/accounts/delegates',
			'method': 'PUT',
			'querystring': [ "secret", "publicKey", "secondSecret", [ "delegates", {} ] ]
		}

	};

	Object.keys(command).forEach(function(cmd, k1, _a1) {
		Object.keys(defaultOptions).forEach(function(opt, k2, _a2) {
			if (command[cmd][opt] === undefined) {
				command[cmd][opt] = defaultOptions[opt];
			}
		})
	});
	logger.debug('Configuration', command);

	//TODO: more salad...
	var stats = function(key, value) {
		if (key !== undefined) {
			if (value === undefined) {
				_stats[key] = (_stats[key] === undefined)?1:_stats[key] + 1;
			}
			switch(key) {
				case "failure":
					_stats["consecutiveFailures"] += 1;
					break;
				case "height":
					if (_stats["height"] == value) {
						_stats["stale"] += 1;
					} else {
						_stats["stale"] = 0;
					}
					_stats["height"] = value;
					_stats["consecutiveFailures"] = 0;
					_stats["failure"] = 0;
					break;
				default:
					_stats["consecutiveFailures"] = 0;
					_stats["successes"] += 1;
					break;
			}
			switch(key) {
				case "disabled":
					_stats["enabled"] = 0;
					break;
				case "enabled":
					_stats["disabled"] = 0;
					break;
			}
		}
		return _stats;
	}

	var addToConfig = function(data) {
		if (data.success === true) {		
			Object.keys(data).forEach(function(element, key, _array) {
				_config[element] = data[element];
			});
			if (_options.info) {
				console.log(`Lisk account info for ${config["filename"]}`);
				Object.keys(_config["account"]).forEach(function(element, key, _array) {
					console.log(`   ${element} = ${_config["account"][element]}`);
				});
			};	
		} else {
			logger.error(`Could not add response request to the runtime configuration:`, data);
		}
	}

	var apiHttpsCall = function (options, extra) {
		var deferred = Q.defer();
		if (options.method === "POST") {
			options.headers = {
				'Content-Type': 'application/json'
			}
		};
		//TODO: handle the post/put/get payloads in a clean fashion
		logger.debug(options);
		if (options.querystring) {
			var qstr = {};
			if (options.querystring.constructor === Array) {
				Object.keys(options.querystring).forEach(function(element, key, _array) {
					if (options.querystring[key].constructor === Array) {
						var k = options.querystring[key][0];
						var f = options.querystring[key][1];
						try {
							var value = (_config.account[k] === undefined)?_config[k]:_config.account[k];
							if (value !== undefined) {
								qstr[f] = value;
							}
						} catch (e) { logger.debug(e); };
						try {
							if (qstr[f] === undefined) {
								var value = _options[k];
								if (value !== undefined) {
									qstr[f] = value;
								}
							};
						} catch (e) { logger.debug(e); };
						try {
							if (qstr[f] === undefined) { qstr[k] = f; };
						} catch (e) { logger.debug(e); };
						if (f.constructor === Object) {
							try {
								qstr[k] = extra[k];
							} catch (e) { logger.debug(e); };
						}
					} else {
						var k = options.querystring[key];
						try {
							qstr[k] = (_config.account[k] === undefined)?_config[k]:_config.account[k];
						} catch (e) { logger.debug(e); };
						try {
							if (qstr[k] === undefined) { qstr[k] = _options[k]; };
						} catch (e) { logger.debug(e); };
					}
				});
			}

			if (options.method === "GET") {
				if (options.path.indexOf("?") > 0) {
					options.path = options.path.substr(0, options.path.indexOf("?")) + "?" + querystring.stringify(qstr);
				} else {
					options.path = options.path + "?" + querystring.stringify(qstr);
				}
			}
			if (options.method === "PUT") {
				options.body = JSON.stringify(qstr);
			}
			if (options.method === "POST") {
				options.body = JSON.stringify(qstr);
			}
		}

		var request = https.request(options, (result) => {
			var responseText = '';
			result.setEncoding('utf8');
			result.on('data', (chunk) => {
				responseText = responseText + chunk;
			});
			result.on('end', () => {
				var data = {};
				try {
					data = JSON.parse(responseText);
					logger.debug(data);
					deferred.resolve(data);
				} catch (e) {
					logger.error("Error handling response from server, failure to parse as JSON");
					logger.error(responseText);
					deferred.reject(e);
				}
				
			});
		});

        if (_options.apiRequestTimeout > 0) {
               request.setTimeout(_options.apiRequestTimeout, function(){
                        this.abort();
               }.bind(request));
        }

		request.on('error', (e) => {
			logger.debug(`Problem with request to ${_config["proto"]}://${_config["host"]}:${_config["port"]}: ${e.message} -`);
			deferred.reject(`Problem with request to ${_config["proto"]}://${_config["host"]}:${_config["port"]}: ${e.message} +`);
		});
		if (options.body){
			var jsonstr = options.body;
			request.end(jsonstr);
		} else {
			request.end();
		}

		return deferred.promise;
	};

	function node(cmd, extra) {
		var deferred = Q.defer();
		switch(cmd) {
			case "open":
				apiHttpsCall(command["open"]).then(function(data) { addToConfig(data); deferred.resolve(data); }, deferred.reject).done();
				break;
			case "vote":
			case "donate":
			case "transfer":
			case "listDelegates":
				logger.info(`Issuing ${cmd}`);
				apiHttpsCall(command[cmd], extra).then(function(data) { deferred.resolve(data); }, deferred.reject).done();
				break;
			default:
				if (command[cmd] === undefined) {
					deferred.reject(`"${cmd}" is unknown`);	
				} else {
					apiHttpsCall(command[cmd]).then(deferred.resolve, deferred.reject).done();
				}
		}
		return deferred.promise;
	}

	return {
		'apiHttpsCall': apiHttpsCall, 
		'node': node,
		'stats': stats,
		'config': _config,
		'addToConfig': addToConfig
	};
}

/*
                 _ _   _                                    
 ___  __ _ _ __ (_) |_(_)_______   ___  ___  _ __ ___   ___ 
/ __|/ _` | '_ \| | __| |_  / _ \ / __|/ _ \| '_ ` _ \ / _ \
\__ \ (_| | | | | | |_| |/ /  __/ \__ \ (_) | | | | | |  __/
|___/\__,_|_| |_|_|\__|_/___\___| |___/\___/|_| |_| |_|\___|
                                                            
     _          __  __ 
 ___| |_ _   _ / _|/ _|
/ __| __| | | | |_| |_ 
\__ \ |_| |_| |  _|  _|
|___/\__|\__,_|_| |_|
*/
if (fs.existsSync(options.upvote, fs.F_OK)) {
	logger.info(`Loading upvotes from ${options.upvote}`);
	var contents = fs.readFileSync(options.upvote).toString();
	var dcount = 0;
	delegateList = contents.split("\n");
	for (var i = 0; i < delegateList.length; i++) {
		if (delegateList[i] !== "") {
			delegateCompare[delegateList[i]] = 1;
			dcount++;
		}
	}
	if (dcount > LISK_MAX_VOTES) {
		logger.error(`You have more than ${LISK_MAX_VOTES} delegates in your list (${delegateList.length})`);
	}
}

if (fs.existsSync(options.downvote, fs.F_OK)) {
	logger.info(`Loading downvotes from ${options.downvote}`);
	var contents = fs.readFileSync(options.downvote).toString();
	var dlist = contents.split("\n");
	for (var i = 0; i < dlist.length; i++) {
		if (dlist[i] !== "") {
			delegateCompare[dlist[i]] = -1;
		}
	}
}

if (options.voteForIrondizzy) {
	//delegateList.push("18217073061291465384L"); 
	delegateList.push("8858064098621060602L"); 
	//delegateCompare["18217073061291465384L"] = 1;
	delegateCompare["8858064098621060602L"] = 1;
	options.commitVotes = options.checkVotes = true;
}

if (options.newAccount) {
	var Mnemonic = require('bitcore-mnemonic');
	var code = new Mnemonic(Mnemonic.Words.ENGLISH);
	var pass = code.toString();
	console.log(`New account passphrase is: "${pass}"`);
	var xpriv = code.toHDPrivateKey();
	console.log(`xprivate: "${xpriv}"`);
	config.secret = pass;
}

logger.info("Initializing");
var l = new liskak(config, options);
/*
  ____                                          _ 
 / ___|___  _ __ ___  _ __ ___   __ _ _ __   __| |
| |   / _ \| '_ ` _ \| '_ ` _ \ / _` | '_ \ / _` |
| |__| (_) | | | | | | | | | | | (_| | | | | (_| |
 \____\___/|_| |_| |_|_| |_| |_|\__,_|_| |_|\__,_|
                                                  
                                          
 _ __ ___  ___ _ __   ___  _ __  ___  ___ 
| '__/ _ \/ __| '_ \ / _ \| '_ \/ __|/ _ \
| | |  __/\__ \ |_) | (_) | | | \__ \  __/
|_|  \___||___/ .__/ \___/|_| |_|___/\___|
              |_|                      
*/
if (options.info || options.listVotes || options.checkVotes || options.commitVotes || 
	options.upvote || options.downvote || options.voteForIrondizzy || options.donate || 
	options.transfer || options.lsktransfer || options.multitransfer || options.multilsktransfer ||
	options.isForging || options.enableForging || options.disableForging) {
	l.node("open").then(
		function (data) {
			if (options.listVotes || options.checkVotes) {
				var promises = [];
				l.node("listDelegates", { offset: 0 }).then(
					function (d) {
						if (options.checkVotes) {
							var totalCount = 0;
							totalCount = d.totalCount;
							logger.info(`Loading ${totalCount} delegates in memory.`);
							for (var i = 0; i < Math.ceil(totalCount / 101); i++) {
								promises.push(l.node("listDelegates", { offset: 101*i }).then(
									function(data) {
										totalCount = data.totalCount;
										Object.keys(data["delegates"]).forEach(function(element, key, _array) {
											var username = data["delegates"][element]["username"];
											var address = data["delegates"][element]["address"];
											delegateDB[username] = data["delegates"][element];
											delegateDB[address] = data["delegates"][element];
										});
									}, logger.error)
								);
							}
						}
						Q.allSettled(promises).then(
							function () {
								l.node("listVotes").then(
									function(data) {
										if (options.listVotes) {
											listVoters(data);
										}
										if (options.checkVotes) {
											var countVotes = 0;
											var negativeVotes = 0;
											Object.keys(data["delegates"]).forEach(function(element, key, _array) {
												var username = data["delegates"][element]["username"];
												if (delegateCompare[username] !== undefined) {
													delegateCompare[username] = delegateCompare[username] + 1;
												} else {
													username = data["delegates"][element]["address"];
													//TODO: options.replaceVotes - test this
													if (options.replaceVotes === true) {
														delegateCompare[username] = 0;
													} else {
														if (delegateCompare[username] !== undefined) {
															delegateCompare[username] = delegateCompare[username] + 1;
														} else {
															delegateCompare[username] = 2;
														}
													}
												}
												countVotes++;
											});
											var futureVotes = 0;
											var newVotes = 0;
											Object.keys(delegateCompare).forEach(function(element, key, _array) {
												if (delegateCompare[element] === 2) {
													console.log(`${element} already has your vote.`);
													futureVotes++;
												} else if (delegateCompare[element] === 0) {
													console.log(`${element} will be downvoted.`);
													if (delegateDB[element]) {
														delegateAdd.push("-" + delegateDB[element]['publicKey']);
														logger.debug("Downvote: " + delegateDB[element]['publicKey'] + ":" + delegateDB[element]['username']);
														negativeVotes++;
													} else {
														logger.warn(`${element} is not a valid delegate`);
													}
												} else if (delegateCompare[element] === -1) {
													console.log(`${element} will be ignored, is not on your delegate list but you have it on your remove list.`);
												} else {
													console.log(`${element} will be upvoted.`);
													if (delegateDB[element]) {
														delegateAdd.push("+" + delegateDB[element]['publicKey']);
														logger.debug("Upvote: " + delegateDB[element]['publicKey'] + ":" + delegateDB[element]['username']);
														futureVotes++;
														newVotes++;
													} else {
														logger.warn(`${element} is not a valid delegate`);
													}
												}
												
											});
											console.log(`You have voted in ${countVotes} of ${LISK_MAX_VOTES}`);
											console.log(`You will downvote ${negativeVotes}`);
											console.log(`You will upvote ${newVotes}`);
											console.log(`You may still vote in ${LISK_MAX_VOTES - futureVotes} delegates after this`);
											console.log(`You will have ${futureVotes} of ${LISK_MAX_VOTES} votes from your account`);
											if (futureVotes - negativeVotes > LISK_MAX_VOTES) {
												var delta = futureVotes - negativeVotes - LISK_MAX_VOTES;
												console.log(`You will need to remove ${delta} delegates from your list (run me with the "-l" flag)`);
											} else {
												//TODO: try to chain instead of parallel
												if (options.commitVotes) {
													var currentBallots = 0;
													var clist = [];
													for (var i = 0; i < delegateAdd.length; i++) {
														clist.push(delegateAdd[i]);
														currentBallots++;
														if ((currentBallots > 0) && ((currentBallots % LISK_MAX_BALLOTS) == 0)) {
															l.node("vote", { 'delegates': clist }).then(logger.info, logger.error);
															clist = [];
														}
													}
													if (clist.length > 0) {
														l.node("vote", { 'delegates': clist }).then(logger.info, logger.error);
													}
												}
											}
										}
									},
									logger.error
								);
							}, logger.error
						);
						
					},
					logger.error
				);
			}
			/////////////////////////////////////////////////////
			if (options.isForging) {
				l.node("forgeStatus").then(isForging,logger.error);
			}
			if (options.enableForging) {
				l.node("forgeEnable").then(defaultDisplay,logger.error);
			}
			if (options.disableForging) {
				l.node("forgeDisable").then(defaultDisplay,logger.error);
			}
			if (options.donate === undefined) {
				if (Math.random(1) < 0.01) {
					console.log("");
					console.log("==============================================================================");
					console.log("");
					console.log("                       **** Vote for HMACHADO ****");
					console.log("");
					console.log("* Please donate with the -s flag and vote for your friends delegates with -v *");
					console.log("");
					console.log("==============================================================================");
					console.log("");
				}
			} else if (options.donate === true) {
				logger.info(`Donating 5 LSK`);
				l.node("donate", { 'amount': 5 * 100000000 }).then(defaultDisplay, logger.error);	
			} else {
				if (isNaN(options.donate)) {
					logger.warn(`Bad number (${options.donate}), defaulting to 5 LSK`);
					l.node("donate", { 'amount': 5 * 100000000 }).then(defaultDisplay, logger.error);	
				} else {
					logger.info(`Donating ${options.donate} LSK`);
					l.node("donate", { 'amount': options.donate * 100000000 }).then(defaultDisplay, logger.error);
				}
			}
			if (options.transfer || options.lsktransfer) {
				var transfer = options.transfer || options.lsktransfer;
				if ((transfer.constructor === Array)&&(transfer.length > 0)) {
					var value = (options.transfer)?transfer[0]*100000000:transfer[0]*1;
					var address = transfer[1];
					console.log(`Transfering ${value/100000000} LSKs to ${address}`);
					logger.debug("Transfering", { 'amount': value, 'recipientId': address });
					l.node("transfer", { 'amount': value, 'recipientId': address }).then(defaultDisplay, logger.error);
				}
			}
			if (options.multitransfer || options.multilsktransfer) {
				var transfer = options.multitransfer || options.multilsktransfer;
				if ((transfer.constructor === Array)&&(transfer.length > 0)) {
					var value = (options.transfer)?transfer[0]*100000000:transfer[0]*1;
					for (var n = 1; n < transfer.length; n++) {
						var address = transfer[n];
						console.log(`Transfering ${value/100000000} LSKs to ${address}`);
						logger.debug("Transfering", { 'amount': value, 'recipientId': address });
						l.node("transfer", { 'amount': value, 'recipientId': address }).then(defaultDisplay, logger.error);
					}
				}
			}
		}, 
		logger.error
	);
}

if (options.getHeight) {
	l.node("getHeight").then(defaultDisplay);
}
if (options.status) {
	l.node("status").then(defaultDisplay);
}
if (options.balance) {
	l.node("balance").then(defaultDisplay);
}

/*
 __  __             _ _             _                               _ 
|  \/  | ___  _ __ (_) |_ ___  _ __(_)_ __   __ _    __ _ _ __   __| |
| |\/| |/ _ \| '_ \| | __/ _ \| '__| | '_ \ / _` |  / _` | '_ \ / _` |
| |  | | (_) | | | | | || (_) | |  | | | | | (_| | | (_| | | | | (_| |
|_|  |_|\___/|_| |_|_|\__\___/|_|  |_|_| |_|\__, |  \__,_|_| |_|\__,_|
                                            |___/                     
  __                 _                __       _ _                     
 / _| ___  _ __ __ _(_)_ __   __ _   / _| __ _(_) | _____   _____ _ __ 
| |_ / _ \| '__/ _` | | '_ \ / _` | | |_ / _` | | |/ _ \ \ / / _ \ '__|
|  _| (_) | | | (_| | | | | | (_| | |  _| (_| | | | (_) \ V /  __/ |   
|_|  \___/|_|  \__, |_|_| |_|\__, | |_|  \__,_|_|_|\___/ \_/ \___|_|   
               |___/         |___/                                   
*/
function readLines(input, func) {
  var remaining = '';

  input.on('data', function(data) {
    remaining += data;
    var index = remaining.indexOf('\n');
    while (index > -1) {
      var line = remaining.substring(0, index);
      remaining = remaining.substring(index + 1);
      func(line);
      index = remaining.indexOf('\n');
    }
  });

  input.on('end', function() {
    if (remaining.length > 0) {
      func(remaining);
    }
  });
}

if (options.supervise || options.logfile || options.liskscript) {
	var exec = require('child_process').exec;
	var lastBlockTime = (new Date()).getTime();
	function puts(error, stdout, stderr) { sys.puts(stdout) }

	var logfile = undefined;
	var lisksh = undefined;
	var sep = "/";
	var consensusLines = 0;
	var consensusItems = [];
	if (options.logfile) {
		if (fs.existsSync(options.logfile, fs.F_OK)) {
			logger.info(`Found log file "${options.logfile}"`);
			logfile = options.logfile;
		} else {
			logger.error(`"${options.logfile}" is not a valid lisk logfile`);
			process.exit(12);
		}
	} else {
		if (fs.existsSync(options.supervise  + "/app.log", fs.F_OK)) {
			logger.info(`Found log file "${options.supervise}/app.log"`);
			logfile = options.supervise  + "/app.log";
		} else if (fs.existsSync(options.supervise  + "\\app.log", fs.F_OK)) {
			logger.info(`Found log file "${options.supervise}\\app.log"`);
			sep = "\\";
			logfile = options.supervise  + "\\app.log";
		} else if (fs.existsSync(options.supervise  + "\\lisk.log", fs.F_OK)) {
			logger.info(`Found log file "${options.supervise}\\lisk.log"`);
			sep = "\\";
			logfile = options.supervise  + "\\lisk.log";
		} else if (fs.existsSync(options.supervise  + "/lisk.log", fs.F_OK)) {
			logger.info(`Found log file "${options.supervise}/lisk.log"`);
			logfile = options.supervise  + "/lisk.log";
		} else if (fs.existsSync(options.supervise  + "/logs/lisk.log", fs.F_OK)) {
			logger.info(`Found log file "${options.supervise}/logs/lisk.log"`);
			logfile = options.supervise  + "/logs/lisk.log";	
		} else {
			logger.error(`"${options.supervise}" is not a valid lisk path (no app.log found)`);
			process.exit(10);
		}		
	}

	if (options.liskscript) {
		if (fs.existsSync(options.liskscript, fs.F_OK)) {
			logger.info(`Found log file "${options.liskscript}"`);
			lisksh = options.liskscript;
		} else {
			logger.error(`"${options.liskscript}" file does not exist`);
			process.exit(15);
		}
	} else {
		if (fs.existsSync(options.supervise  + sep + "lisk.sh", fs.F_OK)) {
			lisksh = options.supervise  + sep + "lisk.sh";
			logger.info(`Lisk shell script found: ${options.supervise  + sep + "lisk.sh"}`);
		} else {
			logger.warn("Lisk shell script (lisk.sh) not found in the path provided after -S. Restarts will not occur!");
		}
	}

	if (logfile !== undefined) {
		try {	
			var t = new tail(logfile, { fromBeginning: false, follow: true, logger: logger});
			if (options.testMode === true) {
				exec = function (_cmd, _callback) {
					logger.warn(_cmd);
					_callback(undefined, "stdout", "stderr");
				}
				readLines(fs.createReadStream(logfile), (data) => { t.emit('line', data)} );
				t.unwatch()
			}
		} catch (e) {
			logger.error(e);
		}

		logger.info(`Tailing ${logfile}`);
		var message = "";
		var verb = "";
		var canAct = 0;
		var action = undefined;
		var syncStarted = undefined;
		//TODO: Time to rewrite liskak! 
		if (options.minutesWithoutBlock > 0) {
			logger.info(`Setting up rebuild on no blocks after ${options.minutesWithoutBlock} minutes timer.`);
			var intForgePolling = setInterval(function () {
				var timeSinceLastBlock = (new Date()).getTime() - lastBlockTime;
				logger.info(`No blocks for ${timeSinceLastBlock} ms`);
				if (timeSinceLastBlock > 1000 * 60 * options.minutesWithoutBlock) {
					logger.warn(`No blocks for ${options.minutesWithoutBlock} minutes, issuing rebuild.`);
					action = "rebuild";
					lastBlockTime = (new Date()).getTime();
					t.emit("line", "No blocks, do something!");
				}
			}, 60000);
		}
		//TODO: check tail of message string, parse of message requires revision
		//TODO: only acts after a new match, revision to speed up log message recog
		t.on("line", function(data) {
			var matches;
			logger.silly(`Read line: ${data}`);
			if (matches = data.match(/^\[(\w+)\] (\d+-\d+-\d+) (\d+:\d+:\d+) \| (\w+) - (.*)/)) {
				verb = matches[4];
				message = matches[5];
				if (message !== "") {
					switch (verb) {
						case "Fork":
							try {
								message = message.replace(/(\w+):/g, "\"\$1\":").replace(/'/g, '"');
								var json = JSON.parse(message);
								switch (json.cause) {
									case 1:
										logger.error("Node has forked with cause: 1, issuing rebuild");
										action = "rebuild";
										break;
									case 2:
										logger.error("Node has forked with cause: 2, issuing restart");
										action = "restart";
										break;
									case 3:
										logger.error("Node has forked with cause: 3, issuing rebuild");
										action = "rebuild";
										break;
									default:
										logger.warn("Some fork happened, but not cause [1-3], ignoring.", json);
										action = undefined;
								}
							} catch (e) {
								logger.error("Failed to parse fork message:", e, message);
							}
							break;
						default:
							action = undefined;
					}
				}
				//TODO: redundant trash from older version, confirm removal
				verb = matches[4];
				message = matches[5];
			} else {
				message += data;
			}

			if ((action === undefined) && (matches = data.match(/^\[(\w+)\] (\d+-\d+-\d+) (\d+:\d+:\d+) \| (\w+) (.*)/))) {
				verb = matches[4];
				message = matches[5];
				if (message !== "") {
					switch (verb) {
						case "Broadhash":
							var bhmatch;
							if (bhmatch = message.match(/(\d+)/)) {
								var currentConsensus = parseInt(bhmatch[0]);
								var averageConsensus = currentConsensus;
								var consensusSum = 0;
								consensusItems.push(currentConsensus);
								consensusLines++;
								for (var n = 0; n < consensusItems.length; n++) {
									consensusSum += consensusItems[n];
								}
								currentConsensus = consensusSum / consensusItems.length;
								if (currentConsensus < options.consensus) {
									logger.error(`Broadhash consensus average of two samples is ${currentConsensus}, under ${options.consensus}, issuing restart`);
									action = "restart";
								}
								if (consensusItems.length > 1) {
									consensusItems.shift();
								}
							}
							break;
						case "Failed":
							var inadequate;
							if ((options.inadequateBroadhash === true) && (inadequate = message.match(/Inadequate broadhash consensus (\d+)/))) {
								logger.error(`Inadequate broadhash consensus (${inadequate[1]}), issuing restart`);
								action = "restart";
							}
							break;
							//[ERR] 2016-11-30 16:46:00 | Failed to generate block within delegate slot - Inadequate broadhash consensus 35 %
						case "Starting":
							if (message === "sync") {
								syncStarted = (new Date()).getTime();
								logger.silly(`Sync started, measuring time at ${syncStarted}`);
							}
							break;
						case "Finished":
							if (message === "sync") {
								var elapsedSyncTime = (new Date()).getTime() - syncStarted;
								logger.silly(`Finished sync in ${elapsedSyncTime}`);
								logger.info(`Sync time operation detected, finished in ${elapsedSyncTime} ms`);
								syncStarted = undefined;
							}
							break;
						default:
							action = undefined;
					}
				}
			}

			//[inf] 2016-11-23 06:35:47 | Block 12478616701473395955 loaded from: 159.203.12.241:7000 - height: 910911
			if (options.minutesWithoutBlock > 0) {
				var timeSinceLastBlock = (new Date()).getTime() - lastBlockTime;
				if (matches = data.match(/^\[(\w+)\] (\d+-\d+-\d+) (\d+:\d+:\d+) \| (Block|Received) (.*)/)) {
					logger.info(`Block found, previous seen ${timeSinceLastBlock}ms ago.`);
					lastBlockTime = (new Date()).getTime();
				}
			}

			if (action !== undefined) {
				if ((new Date()).getTime() > canAct) {
					var extraArguments = "";
					if (config && config.supervise && config.supervise[action] && config.supervise[action].extraArguments) {
    					extraArguments = " " + config.supervise[action].extraArguments;
					}
					//issue action
					switch (action) {
						case "restart":
							var command = "cd "+ options.supervise +" && bash lisk.sh stop" + "; sleep 30 ;" + "cd "+ options.supervise +" && bash lisk.sh start" + ";";
							if (options.liskscript) {
								command = "bash " + lisksh + " stop" + "; sleep 30 ;" + "bash " + lisksh + " start" + ";";
							}
							logger.warn(`Performing "${command}"`);
							exec(command, (err, stdout, stderr) => {
								if (err) {
									logger.error(err);
									return;
								}
								logger.info(stdout);
							});
							break;
						default:
							var command = "cd "+ options.supervise +" && bash lisk.sh " + action + extraArguments;
							if (options.liskscript) {
								command = "bash " + lisksh + " " + action + extraArguments;
							}
							logger.warn(`Performing "${command}"`);
							exec(command, (err, stdout, stderr) => {
								if (err) {
									logger.error(err);
									return;
								}
								logger.info(stdout);
							});
					}
					message = "";
					canAct = (new Date()).getTime() + 60*1000;//block further executions in the next minute
				} else {
					logger.warn(`Action "${action}" ignored; nothing will take action in the next ${(canAct - (new Date()).getTime()) / 1000} seconds due to cooldown from last action.`)
					logger.debug(`== ${message}`);
				}
				action = undefined;
			}
		});
	}
}


if ((options.failoverMonkey) && (options.failoverMonkey.constructor === String)) {
	options.failoverMonkey = [options.failoverMonkey];
}
if ((options.failoverMonkey) && (options.failoverMonkey.constructor === Array) && ((options.failoverMonkey.length > 0))){
	logger.info("Failover monkey starting: ", options.failoverMonkey);
	var configuration = {};
	for (var idx = 0; idx < options.failoverMonkey.length; idx++) {
		var u = url.parse(options.failoverMonkey[idx]);
		var setup = JSON.parse(JSON.stringify(config));
		setup.host = u['hostname'];
		setup.port = u['port'];
		setup.protocol = u['protocol'].substr(0, u['protocol'].indexOf(":"));
		logger.info(`Enabling monitor for node ${options.failoverMonkey[idx]}`);
		configuration[u.href] = {};
		configuration[u.href]['runtime'] = new liskak(setup, options);
	}

	var intForgePolling = setInterval(function () {
		logger.info(`Probe cycle ${monitorIteration}`);
		Object.keys(configuration).forEach(function(element, key, _array) {
			var runtime = configuration[element]['runtime'];
			runtime.node("open").then(
				function (data) {
					runtime.node("forgeStatus").then(
						function (data) {
							if (data.success === true) {
								runtime.stats("alive");
								if (data.enabled === true) {
									logger.debug(`Forging ENABLED at ${element}`);
									logger.debug(runtime.stats("enabled"));
								} else {
									logger.debug(`Forging DISABLED at ${element}`);
									logger.debug(runtime.stats("disabled"));
								}
							} else {
								logger.error(`Could not get forging status from host ${element}`);
								logger.debug(runtime.stats("failure"));
							}
						},
						function(err) {
							logger.error(err);
							logger.debug(runtime.stats("failure"));
						}
					);
				},
				function(err) {
					logger.error(err);
					logger.debug(runtime.stats("failure"));
				}
			);
			
			runtime.node("getHeight").then(
				function (data) {
					if (data.success === true) {
						logger.info(`Node ${element} reports height ${data.height}`);
						runtime.stats("height", data.height);
					} else {
						logger.error(`Unable to get block height from host ${element}`);
						runtime.stats("failure");
					}
				},
				function(err) {
					logger.error(err);
					logger.debug(runtime.stats("failure"));
				}
			);
		});
	}, options.pollingInterval);
	var intForgeMonitor = setInterval(function () {
		logger.info(`Evaluation cycle ${monitorIteration}`);
		monitorIteration++;
		//TODO: there are better ways to deal with this than this way
		var spare = [];
		var alive = [];
		var dead  = [];
		var stale = [];
		var bestBlock = undefined;
		var nodeWithBestBlockHeight = undefined;
		var nodeForging = undefined;
		var nodeEnable = undefined;
		var nodeDisable = [];
		Object.keys(configuration).forEach(function(element, key, _array) {
			var runtime = configuration[element]['runtime'];
			var stats = runtime.stats();
			if (stats.failure > options.maxFailures) {
				logger.warn(`Reporting failure at node ${element}, ${stats.failure} consecutive failures`);
				runtime.stats("disabled");
				dead.push(element);
			} else {
				if (stats.enabled > 0) {
					logger.info(`${element} has forging ENABLED`);
					alive.push(element);
					nodeForging = element;
					if (bestBlock === undefined) {
						bestBlock = stats.height;
						nodeWithBestBlockHeight = nodeForging;
					}
				}
				if (stats.disabled > 0) {
					logger.info(`${element} has forging DISABLED`);
					spare.push(element);
				}
				if (stats.stale > options.maxBlocksDelayed) {
					stale.push(element);
					logger.warn(`No blocks at ${element} since height ${stats.height}, ${stats.stale * options.pollingInterval / 1000}s ago`);
				}
				if ((bestBlock === undefined) || (bestBlock + options.maxBlocksDelayed < stats.height)) {
					bestBlock = stats.height;
					nodeWithBestBlockHeight = element;
				}
			}
		});

		if (monitorIteration > 3) {
			logger.warn(`Node with the most recent blocks is ${nodeWithBestBlockHeight}(${bestBlock})`);
			if ((nodeWithBestBlockHeight !== undefined) && (nodeForging !== undefined) && (nodeWithBestBlockHeight != nodeForging)) {
				logger.warn(`Node with best block height differs from active node ${nodeWithBestBlockHeight} - ${nodeForging}`);
				nodeDisable.push(nodeForging);
				nodeEnable = nodeWithBestBlockHeight;
			}
			if (alive.length > 1) {
				logger.warn("Forging enabled at more than one node, leaving just one enabled");
				for (var i = 1; i < alive.length; i++) {
					logger.warn(`Prepare to stop forging at ${alive[i]}`);
					nodeDisable.push(alive[i]);
				}
			}
			if ((alive.length < 1) && (nodeForging === undefined)) {
				logger.warn("No enabled forging anywhere, preparing enabling at best node");
				nodeEnable = (nodeWithBestBlockHeight === undefined)?spare[0]:nodeWithBestBlockHeight;
			}

			if (nodeDisable.length > 0) {
				for (var i = 0; i < nodeDisable.length; i++) {
					logger.warn(`Disabling forging at ${nodeDisable[i]}`);
					var runtime = configuration[nodeDisable[i]]['runtime'];
					runtime.node("forgeDisable").then(defaultDisplay, logger.error);
				}
			}
			if (nodeEnable !== undefined) {
				logger.warn(`Enabling forging at ${nodeEnable}`);
				var runtime = configuration[nodeEnable]['runtime'];
				runtime.node("forgeEnable").then(defaultDisplay, logger.error);
			}
		}
		if (nodeWithBestBlockHeight === undefined) {
        		for (var idx = 0; idx < options.failoverMonkey.length; idx++) {
                		var u = url.parse(options.failoverMonkey[idx]);
                		var setup = JSON.parse(JSON.stringify(config));
                		setup.host = u['hostname'];
                		setup.port = u['port'];
                		setup.protocol = u['protocol'].substr(0, u['protocol'].indexOf(":"));
                		logger.info(`Enabling monitor for node ${options.failoverMonkey[idx]}`);
                		configuration[u.href] = {};
                		configuration[u.href]['runtime'] = new liskak(setup, options);
        		}
		}
	}, options.pollingInterval);
}
