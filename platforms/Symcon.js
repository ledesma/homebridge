// IP-Symcon JSON-RPC API
var types = require("../lib/HAP-NodeJS/accessories/types.js");
var rpc = require("node-json-rpc");
var async = require("async");

function SymconPlatform(log, options) {
	this.log = log;
	this.options = options;
	this.client = new rpc.Client(this.options.rpcClientOptions);
}

SymconPlatform.prototype = {
	accessories : function (callback) {
		this.log("Fetching Symcon instances...");

		var that = this;
		var foundAccessories = [];

		async.waterfall([
				function (waterfallCallback) {
					that.client.call({
						"jsonrpc" : "2.0",
						"method" : "IPS_GetInstanceListByModuleID",
						"params" : ['{101352E1-88C7-4F16-998B-E20D50779AF6}'],
						"id" : 0
					},
					function (err, res) {
						waterfallCallback(null, err, res);
					});
				},
				function (err, res, waterfallCallback) {
					if (err) {
						that.log("Error: " + JSON.stringify(err));
						return;
					}

					async.each(res.result, function (instanceId, eachCallback) {

						async.parallel([
								function (parallelCallback) {
									that.client.call({
										"jsonrpc" : "2.0",
										"method" : "IPS_GetName",
										"params" : [instanceId],
										"id" : 0
									},
									function (err, res) {
										parallelCallback(null, res.result);
									});
								},
								function (parallelCallback) {
									that.client.call({
										"jsonrpc" : "2.0",
										"method" : "IPS_GetInstance",
										"params" : [instanceId],
										"id" : 0
									},
									function (err, res) {
										parallelCallback(null, res.result);
									});
								},
								function (parallelCallback) {
									that.client.call({
										"jsonrpc" : "2.0",
										"method" : "IPS_GetConfiguration",
										"params" : [instanceId],
										"id" : 0
									},
									function (err, res) {
										parallelCallback(null, res.result);
									});
								}
							],
							function (err, results) {
								var name = results[0];
								var instance = typeof results[1] === 'object' ? results[1] : JSON.parse(results[1]);
								var instanceConfig = typeof results[2] === 'object' ? results[2] : JSON.parse(results[2]);
								//that.log(JSON.stringify(instanceConfig));
								var instance = new SymconAccessory(that.log, that.options.rpcClientOptions, instanceId, name, instance, instanceConfig);
								
								if (instance.type == 0 || instance.type == 1) {
									foundAccessories.push(instance);
									that.log("new instance found: " + results[0]);
								}
								
								eachCallback();
						});
					},
					function (err) {
						waterfallCallback(null);
					});
				}
			],
			function (err, result) {
				that.log(foundAccessories.length + " instances found");
				callback(foundAccessories);
		});
	}
}

function SymconAccessory(log, rpcClientOptions, instanceId, name, instance, instanceConfig) {
	this.log = log;
	this.rpcClientOptions = rpcClientOptions;
	this.instanceId = instanceId;
	this.name = instanceId.toString();
	this.displayName = name + " [" + instanceId + "]";
	this.instance = instance;
	this.instanceConfig = instanceConfig;
	this.defaultRamp = 3; // default ramp in seconds
	this.commands = [];
	this.type = null;

	switch (this.instance.ModuleInfo.ModuleID) {
		case '{101352E1-88C7-4F16-998B-E20D50779AF6}': // Zwave Module
			modes = eval(this.instanceConfig.NodeClasses);
			for(i in modes) { 
				if(modes[i] == 37) {
					this.type = 1;
				}
				else if (modes[i] == 38) {
					this.type = 0; 
				}
			};

			this.writeLogEntry('adding commands for ZWave Module ' + this.displayName + ' (Modes: ' + modes + ')...');
			switch (this.type) {
				case 0: // dimmer
					this.commands.push('SetBrightness');
					this.commands.push('SetPowerState');
					break;
				case 1: // switch
					this.commands.push('SetPowerState');
					break;
			}
			break;
	}
}

SymconAccessory.prototype = {
		
	setPowerState : function(value) {
		
		var method;
		var params;
		
		switch (this.instance.ModuleInfo.ModuleID) {
			case '{101352E1-88C7-4F16-998B-E20D50779AF6}': // Zwave Module
				switch (this.type) {
					case 0: // dimmer
						method = 'ZW_SwitchMode';
						params = [this.instanceId, value ? true : false];
						break;
					case 1: // switch
						method = 'ZW_SwitchMode';
						params = [this.instanceId, value ? true : false];
						break;
					default:
						return;
				}
				break;
			default:
				return;
		}
		
		this.callRpcMethod(method, params);
	},
	
	setBrightness : function(value) {
		
		var method;
		var params;
		
		switch (this.instance.ModuleInfo.ModuleID) {
			case '{101352E1-88C7-4F16-998B-E20D50779AF6}': // Zwave Module
				switch (this.type) {
					case 0: // dimmer
						method = 'ZW_DimSet';
						params = [this.instanceId, value];
						break;
					default:
						return;
				}
				break;
			default:
				return;
		}
		
		this.callRpcMethod(method, params);
	},
	
	callRpcMethod : function(method, params) {
		this.writeLogEntry("Calling JSON-RPC method " + method + " with params " + JSON.stringify(params));

		var that = this;
		var client = new rpc.Client(this.rpcClientOptions);
		client.call({
			"jsonrpc" : "2.0",
			"method" : method,
			"params" : params,
			"id" : 0
		},
		function (err, res) {
			if (err) {
				that.writeLogEntry("There was a problem calling method " + method);
				return;
			}
			that.writeLogEntry("Called JSON-RPC method " + method);
		});
		
	},

	informationCharacteristics : function () {
		var that = this;
		
		return [{
				cType : types.NAME_CTYPE,
				onUpdate : null,
				perms : ["pr"],
				format : "string",
				initialValue : this.displayName,
				supportEvents : false,
				supportBonjour : false,
				manfDescription : "Name of the accessory",
				designedMaxLength : 255
			}, {
				cType : types.MANUFACTURER_CTYPE,
				onUpdate : null,
				perms : ["pr"],
				format : "string",
				initialValue : "Symcon",
				supportEvents : false,
				supportBonjour : false,
				manfDescription : "Manufacturer",
				designedMaxLength : 255
			}, {
				cType : types.MODEL_CTYPE,
				onUpdate : null,
				perms : ["pr"],
				format : "string",
				initialValue : this.instance.ModuleInfo.ModuleName,
				supportEvents : false,
				supportBonjour : false,
				manfDescription : "Model",
				designedMaxLength : 255
			}, {
				cType : types.SERIAL_NUMBER_CTYPE,
				onUpdate : null,
				perms : ["pr"],
				format : "string",
				initialValue : "A1S2NASF88EW",
				supportEvents : false,
				supportBonjour : false,
				manfDescription : "SN",
				designedMaxLength : 255
			}, {
				cType : types.IDENTIFY_CTYPE,
				onUpdate : function (value) {
					that.writeLogEntry("informationCharacteristics IDENTIFY_CTYPE onUpdate called with value " + value);
				},
				perms : ["pw"],
				format : "bool",
				initialValue : false,
				supportEvents : false,
				supportBonjour : false,
				manfDescription : "Identify Accessory",
				designedMaxLength : 1
			}
		]
	},

	controlCharacteristics : function () {
		var that = this;
		
		var cTypes = [{
				cType : types.NAME_CTYPE,
				onUpdate : null,
				perms : ["pr"],
				format : "string",
				initialValue : this.displayName,
				supportEvents : true,
				supportBonjour : false,
				manfDescription : "Name of service",
				designedMaxLength : 255
			}
		];

		if (this.commands.indexOf('SetPowerState') != -1) {
			this.writeLogEntry('adding control characteristic POWER_STATE_CTYPE...');
			cTypes.push({
				cType : types.POWER_STATE_CTYPE,
				onUpdate : function (value) {
					that.setPowerState(value);
				},
				perms : ["pw", "pr", "ev"],
				format : "bool",
				initialValue : 0,
				supportEvents : true,
				supportBonjour : false,
				manfDescription : "Change the power state",
				designedMaxLength : 1
			});
		}

		if (this.commands.indexOf('SetBrightness') != -1) {
			this.writeLogEntry('adding control characteristic BRIGHTNESS_CTYPE...');
			cTypes.push({
				cType : types.BRIGHTNESS_CTYPE,
				onUpdate : function (value) {
					that.setBrightness(value);
				},
				perms : ["pw", "pr", "ev"],
				format : "int",
				initialValue : 0,
				supportEvents : true,
				supportBonjour : false,
				manfDescription : "Adjust Brightness of Light",
				designedMinValue : 0,
				designedMaxValue : 100,
				designedMinStep : 1,
				unit : "%"
			});
		}

		return cTypes;
	},

	sType : function () {
		return types.LIGHTBULB_STYPE;
		//if (this.commands.indexOf('SetBrightness') != -1) {
		//	return types.LIGHTBULB_STYPE;
		//} else {
		//	return types.SWITCH_STYPE;
		//}
	},

	getServices : function () {
		var services = [{
				sType : types.ACCESSORY_INFORMATION_STYPE,
				characteristics : this.informationCharacteristics(),
			}, {
				sType : this.sType(),
				characteristics : this.controlCharacteristics()
			}
		];
		this.writeLogEntry("services loaded");
		return services;
	},
	
	writeLogEntry: function(message) {
		this.log(this.name + ': ' + message);
	}
};

module.exports.accessory = SymconAccessory;
module.exports.platform = SymconPlatform;
