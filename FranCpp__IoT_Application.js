// Version 1.2
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var app = express();
	
///////////////Parameters/////////////////
//CSE Params
var cseIP = "127.0.0.1";
var csePort = "8080";
var csePoA = "http://" + cseIP + ":" + csePort;
var cseName = "cse-in";
var cseRelease = "3";
var poa_in_nu = true;

//AE params
var monitorId = "Cae-monitor";
var monitorIP = "127.0.0.1";
var monitorPort = "3333";
var monitorPoA = "http://" + monitorIP + ":" + monitorPort;
var body;
var requestNr = 0;

//////////////// IoT application //////////////////
app.use(bodyParser.json({type : ['application/*+json','application/json']}));

// start http server
app.listen(monitorPort, function () { console.log("Listening on: " + monitorIP + ":" + monitorPort); });

// handle received http messages
app.post('/ButtonSensorNotify', process_ButtonSensor_Notification);
app.post('/Hall1SensorNotify' , process_Hall1Sensor_Notification);
app.post('/Hall2SensorNotify' , process_Hall2Sensor_Notification);	

// Create Monitor AE at the remote CSE
createAE();

function process_ButtonSensor_Notification(req, res) {
	var  vrq  = req.body["m2m:sgn"]["vrq"];
	if  (!vrq) {
		var buttonSensorValue = req.body["m2m:sgn"].nev.rep["m2m:cin"].con;
		console.log("Receieved sensor value : " + buttonSensorValue);
	
		createContentInstance("ESP","[BP]");

	}
	res.set('X-M2M-RSC', 2000)
	if(cseRelease != "1") res.set('X-M2M-RVI', cseRelease)
	res.status(200);
	res.send();
}
function process_Hall1Sensor_Notification(req, res) {
	var  vrq  = req.body["m2m:sgn"]["vrq"];
	if  (!vrq) {
		var Hall1SensorValue = req.body["m2m:sgn"].nev.rep["m2m:cin"].con;
		console.log("Receieved sensor value : " + Hall1SensorValue);
        
        createContentInstance("ESP","[H1]");

	} 
	res.set('X-M2M-RSC', 2000)
	if(cseRelease != "1") res.set('X-M2M-RVI', cseRelease)
	res.status(200);
	res.send();
}
function process_Hall2Sensor_Notification(req, res) {
	var  vrq  = req.body["m2m:sgn"]["vrq"];
	if  (!vrq) {
		var Hall2SensorValue = req.body["m2m:sgn"].nev.rep["m2m:cin"].con;
		console.log("Receieved sensor value : " + Hall2SensorValue);
	
		createContentInstance("ESP","[H2]");
	}
	res.set('X-M2M-RSC', 2000)
	if(cseRelease != "1") res.set('X-M2M-RVI', cseRelease)
	res.status(200);
	res.send();
}

function createAE(){
	
	var options = {
		uri: csePoA+"/"+cseName,
		method: "POST",
		headers: {
			"X-M2M-Origin": monitorId,
			"X-M2M-RI": "req"+requestNr,
			"Content-Type": "application/vnd.onem2m-res+json;ty=2"
		},
		json: { 
			"m2m:ae":{
				"rn":"MONITOR",			
				"api":"N.app.company.com",
				"rr":true,
				"poa":["http://"+monitorIP+":"+monitorPort+"/"]
			}
		}
	};

	console.log("");
	console.log(options.method + " " + options.uri);
	console.log(options.json);

	options.headers = Object.assign(options.headers, {"X-M2M-RVI":cseRelease});
	options.json["m2m:ae"] = Object.assign(options.json["m2m:ae"], {"srv":[cseRelease]});
	
	requestNr += 1;
	request(options, function (err, resp, body) {
		if(err){
			console.log("AE Creation error : " + err);
		} else {
			console.log("AE Creation :" + resp.statusCode);
			
			// Creation fo the necessary subscriptions
			console.log("Subscribing to Button Sensor ...");
			createSubscription("ButtonSensor");
			console.log("Button Sensor - Subscription OK !");
			
			console.log("Subscribing to Hall 1 Sensor ...");
			createSubscription("Hall1Sensor");
			console.log("Hall 1 Sensor - Subscription OK !");
			
			console.log("Subscribing to Hall 2 Sensor ...");
			createSubscription("Hall2Sensor");
			console.log("Hall 2 Sensor - Subscription OK !");
		}
	});
}

function createSubscription(sensorToMonitor){
	var options = {
		uri: csePoA + "/" + cseName + "/" + sensorToMonitor + "/DATA",
		method: "POST",
		headers: {
			"X-M2M-Origin": monitorId,
			"X-M2M-RI": "req"+requestNr,
			"Content-Type": "application/vnd.onem2m-res+json;ty=23"
		},
		json: {
			"m2m:sub": {
				"rn": "SUB_MONITOR",
				"nu": [monitorPoA + "/" + sensorToMonitor + "Notify" ], 
				"nct": 1,
				"enc": {
					"net": [3]
				}
			}
		}
	};

	console.log("");
	console.log(options.method + " " + options.uri);
	console.log(options.json);

	options.headers = Object.assign(options.headers, {"X-M2M-RVI":cseRelease});
	
	requestNr += 1;
	request(options, function (err, resp, body) {
		if(err){
			console.log("SUB Creation error : " + err);
		}else{
			console.log("SUB Creation : " + resp.statusCode);
		}
	});
}

function createContentInstance(actuatorToTrigger, commandName){
	var options = {
		uri: csePoA + "/" + cseName + "/" + actuatorToTrigger + "/COMMAND",
		method: "POST",
		headers: {
			"X-M2M-Origin": monitorId,
			"X-M2M-RI": "req"+requestNr,
			"Content-Type": "application/vnd.onem2m-res+json;ty=4"
		},
		json: {
			"m2m:cin":{
					"con": commandName
				}
			}
	};

	console.log("");
	console.log(options.method + " " + options.uri);
	console.log(options.json);
	options.headers = Object.assign(options.headers, {"X-M2M-RVI":cseRelease});
	
	requestNr += 1;
	request(options, function (err, resp, body) {
		if(err){
			console.log("CIN Creation error : " + err);
		}else{
			console.log("CIN Creation : " + resp.statusCode);
		}
	});
}
