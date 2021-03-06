// Domoticz Platform Shim for HomeBridge
// Written by Joep Verhaeg (http://www.joepverhaeg.nl)
//
// Revisions:
//
// 12 June 2015 [GizMoCuz]
// - Added support for RGB lights
// - Added support for Scenes
// - Sorting device names
//
// Domoticz JSON API required
// https://www.domoticz.com/wiki/Domoticz_API/JSON_URL's#Lights_and_switches
//
// Remember to add platform to config.json. Example:
// "platforms": [
//     {
//         "platform": "Domoticz",
//         "name": "Domoticz",
//         "server": "127.0.0.1",
//         "port": "8080"
//     }
// ],
//
// When you attempt to add a device, it will ask for a "PIN code".
// The default code for all HomeBridge accessories is 031-45-154.
//
var types = require("../lib/HAP-NodeJS/accessories/types.js");
var request = require("request");

function DomoticzPlatform(log, config){
	this.log     = log;
	this.server  = config["server"];
	this.port    = config["port"];
}

function sortByKey(array, key) {
    return array.sort(function(a, b) {
        var x = a[key]; var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}

DomoticzPlatform.prototype = {
	accessories: function(callback) {
	    this.log("Fetching Domoticz lights and switches...");

	    var that = this;
	    var foundAccessories = [];
	    //Get Lights
		request.get({
			url: "http://" + this.server + ":" + this.port + "/json.htm?type=devices&filter=light&used=true&order=Name",
	      	json: true
	    }, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				if (json['result'] != undefined) {
					var sArray=sortByKey(json['result'],"Name");
					sArray.map(function(s) {
						accessory = new DomoticzAccessory(that.log, that.server, that.port, false, s.idx, s.Name, s.HaveDimmer, s.MaxDimLevel, (s.SubType=="RGB")||(s.SubType=="RGBW"));
						foundAccessories.push(accessory);
	          		})
				}
				callback(foundAccessories);
			} else {
				that.log("There was a problem connecting to Domoticz.");
	      	}
		});
		//Get Scenes
		request.get({
			url: "http://" + this.server + ":" + this.port + "/json.htm?type=scenes",
	      	json: true
	    }, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				if (json['result'] != undefined) {
					var sArray=sortByKey(json['result'],"Name");
					sArray.map(function(s) {
						accessory = new DomoticzAccessory(that.log, that.server, that.port, true, s.idx, s.Name, false, 0, false);
						foundAccessories.push(accessory);
	          		})
				}
				callback(foundAccessories);
			} else {
				that.log("There was a problem connecting to Domoticz.");
	      	}
		});
	}
}

function DomoticzAccessory(log, server, port, IsScene, idx, name, HaveDimmer, MaxDimLevel, HaveRGB) {
  // device info
  this.IsScene		= IsScene;
  this.idx			= idx;
  this.name			= name;
  this.HaveDimmer	= HaveDimmer;
  this.MaxDimLevel	= MaxDimLevel;
  this.HaveRGB		= HaveRGB;
  this.log 			= log;
  this.server		= server;
  this.port			= port;
}

DomoticzAccessory.prototype = {
	command: function(c,value) {
		this.log(this.name + " sending command " + c + " with value " + value);
		if (this.IsScene == false) {
			//Lights
			if (c == "On" || c == "Off") {
				url = "http://" + this.server + ":" + this.port + "/json.htm?type=command&param=switchlight&idx=" + this.idx + "&switchcmd=" + c + "&level=0";
			}
			else if (c == "setHue") {
				url = "http://" + this.server + ":" + this.port + "/json.htm?type=command&param=setcolbrightnessvalue&idx=" + this.idx + "&hue=" + value + "&brightness=100" + "&iswhite=false";
			}
			else if (c == "setLevel") {
				url = "http://" + this.server + ":" + this.port + "/json.htm?type=command&param=switchlight&idx=" + this.idx + "&switchcmd=Set%20Level&level=" + value;
			}
			else if (value != undefined) {
				this.log(this.name + " Unhandled Light command! cmd=" + c + ", value=" + value);
			}
		}
		else {
			//Scenes
			if (c == "On" || c == "Off") {
				url = "http://" + this.server + ":" + this.port + "/json.htm?type=command&param=switchscene&idx=" + this.idx + "&switchcmd=" + c;
			}
			else if (value != undefined) {
				this.log(this.name + " Unhandled Scene command! cmd=" + c + ", value=" + value);
			}
		}

    var that = this;
		request.put({ url: url }, function(err, response) {
			if (err) {
				that.log("There was a problem sending command " + c + " to" + that.name);
				that.log(url);
			} else {
				that.log(that.name + " sent command " + c);
      		}
      	})
  	},

  informationCharacteristics: function() {
    return [
      {
        cType: types.NAME_CTYPE,
        onUpdate: null,
        perms: ["pr"],
        format: "string",
        initialValue: this.name,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Name of the accessory",
        designedMaxLength: 255
      },{
        cType: types.MANUFACTURER_CTYPE,
        onUpdate: null,
        perms: ["pr"],
        format: "string",
        initialValue: "Domoticz",
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Manufacturer",
        designedMaxLength: 255
      },{
        cType: types.MODEL_CTYPE,
        onUpdate: null,
        perms: ["pr"],
        format: "string",
        initialValue: "Rev-1",
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Model",
        designedMaxLength: 255
      },{
        cType: types.SERIAL_NUMBER_CTYPE,
        onUpdate: null,
        perms: ["pr"],
        format: "string",
        initialValue: "A1S2NASF88EW",
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "SN",
        designedMaxLength: 255
      },{
        cType: types.IDENTIFY_CTYPE,
        onUpdate: null,
        perms: ["pw"],
        format: "bool",
        initialValue: false,
        supportEvents: false,
        supportBonjour: false,
        manfDescription: "Identify Accessory",
        designedMaxLength: 1
      }
    ]
  },

  controlCharacteristics: function(that) {
    cTypes = [{
      cType: types.NAME_CTYPE,
      onUpdate: null,
      perms: ["pr"],
      format: "string",
      initialValue: this.name,
      supportEvents: true,
      supportBonjour: false,
      manfDescription: "Name of service",
      designedMaxLength: 255
    }]

    if (this.idx != undefined) {
      cTypes.push({
        cType: types.POWER_STATE_CTYPE,
        onUpdate: function(value) {
          if (value == 0) {
            that.command("Off")
          } else {
            that.command("On")
          }
        },
        perms: ["pw","pr","ev"],
        format: "bool",
        initialValue: 0,
        supportEvents: true,
        supportBonjour: false,
        manfDescription: "Change the power state",
        designedMaxLength: 1
      })
    }

    if (this.HaveDimmer == true) {
      cTypes.push({
        cType: types.BRIGHTNESS_CTYPE,
        onUpdate: function(value) { that.command("setLevel", value); },
        perms: ["pw","pr","ev"],
        format: "int",
        initialValue:  0,
        supportEvents: true,
        supportBonjour: false,
        manfDescription: "Adjust Brightness of Light",
        designedMinValue: 0,
        designedMaxValue: this.MaxDimLevel,
        designedMinStep: 1,
        unit: "%"
      })
    }
    if (this.HaveRGB == true) {
      cTypes.push({
        cType: types.HUE_CTYPE,
        onUpdate: function(value) { that.command("setHue", value); },
        perms: ["pw","pr","ev"],
        format: "int",
        initialValue:  0,
        supportEvents: true,
        supportBonjour: false,
        manfDescription: "Adjust Hue of Light",
        designedMinValue: 0,
        designedMaxValue: 360,
        designedMinStep: 1,
        unit: "arcdegrees"
      })
    }

    return cTypes
  },

  sType: function() {
    if (this.HaveDimmer == true) {
      return types.LIGHTBULB_STYPE
    } else {
      return types.SWITCH_STYPE
    }
  },

  getServices: function() {
    var that = this;
    var services = [{
      sType: types.ACCESSORY_INFORMATION_STYPE,
      characteristics: this.informationCharacteristics(),
    },
    {
      sType: this.sType(),
      characteristics: this.controlCharacteristics(that)
    }];
    this.log("Loaded services for " + this.name)
    return services;
  }
};

module.exports.accessory = DomoticzAccessory;
module.exports.platform = DomoticzPlatform;