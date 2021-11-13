// Version 2
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

// Application Logic
const FSM_STATE = {
	 State0				: 0,	
	 BothRED1			: 1,
	 FirstRoadGreen		: 2,
	 BothRED2			: 3,
	 SecondRoadGreen	: 4,
	 EmergencyVehicle	: 5
}
var FSM_Input = {
	BP : 0,
	H1 : 0,
	H2 : 0
};
var FSM_Internal = {
	CurrentState : 0,
	TimeOut : false,
};
var FSM_Output = {
	red4 : 0, 
	red23 : 0, 
	red1 : 0, 
	green1 : 0, 
	green23 : 0, 
	green4 : 0, 
	pedestrians : 0
};

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

// Application Logic
function process_ButtonSensor_Notification(req, res) {
	var  vrq  = req.body["m2m:sgn"]["vrq"];
	if  (!vrq) {
		var buttonSensorValue = req.body["m2m:sgn"].nev.rep["m2m:cin"].con;
		console.log("Receieved sensor value : " + buttonSensorValue);
		
		FSM_Input.BP   = 1 ; //stored variable, when push button has been pressed
		FiniteStateMachine(); //call of the State Machine
		UpdateActuators();	//update the outputs
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
		
		FSM_Input.H1  = 1 ; //stored variable, when an emergency vehicle has passed through the sensor  
		FiniteStateMachine(); //call of the State Machine
		UpdateActuators();//update the outputs
	}
	res.set('X-M2M-RSC', 2000)
	if(cseRelease != "1") res.set('X-M2M-RVI', cseRelease)
	res.status(200);
	res.send();
}
function process_Hall2Sensor_Notification(req, res,) {
	var  vrq  = req.body["m2m:sgn"]["vrq"];
	if  (!vrq) {
		var Hall2SensorValue = req.body["m2m:sgn"].nev.rep["m2m:cin"].con;
		console.log("Receieved sensor value : " + Hall2SensorValue);
	
		FSM_Input.H2 = 1 ; //stored variable, when an emergency vehicle has passed through the sensor 
		FiniteStateMachine();//call of the State Machine
		UpdateActuators();//update the outputs
	}
	res.set('X-M2M-RSC', 2000)
	if(cseRelease != "1") res.set('X-M2M-RVI', cseRelease)
	res.status(200);
	res.send();
}
function FiniteStateMachine() {
	
	//default value of each light
	FSM_Output.red1 = 0; 
	FSM_Output.red23 = 0;
	FSM_Output.red4 = 0;
	FSM_Output.green1 = 0;
	FSM_Output.green23 = 0;
	FSM_Output.green4 = 0;
	FSM_Output.pedestrians = 0;

	switch (FSM_Internal.CurrentState)
	{
		case FSM_STATE.State0: //initialization
			//all lights are red
			FSM_Output.red1 = 1; 
			FSM_Output.red23 = 1;
			FSM_Output.red4 = 1;			
			setTimeout(HandleTimer, 1000); //set up of 1s timer
			FSM_Internal.CurrentState = FSM_STATE.BothRED1; //can directly go to the first state, only a timer set up state
		break;

		case FSM_STATE.BothRED1:
			//all lights are red
			FSM_Output.red1 = 1;
			FSM_Output.red23 = 1;
			FSM_Output.red4 = 1;
			if ((FSM_Input.H1 == 1) || (FSM_Input.H2 == 1)) { //if an emergency vehicle passed through one of the sensor
				FSM_Internal.CurrentState = FSM_STATE.EmergencyVehicle;
			}
			else 
				if ( FSM_Internal.TimeOut ) { //when 1s timer is over
					FSM_Internal.TimeOut = false; //timer reset
					FSM_Internal.CurrentState = FSM_STATE.FirstRoadGreen; //next state : first road lights are green
					setTimeout(HandleTimer, 3000); //timer_start(3000); //set up 3s timer
				}
		break;

		case FSM_STATE.FirstRoadGreen:
			//only first road lights are green
			FSM_Output.green1 = 1;
			FSM_Output.green4 = 1;
			FSM_Output.red23 = 1;
			if ((FSM_Input.H1 == 1) || (FSM_Input.H2 == 1)) { //if an emergency vehicle passed through one of the sensor
				FSM_Internal.CurrentState = FSM_STATE.EmergencyVehicle;
			}
			else 
				if ( FSM_Internal.TimeOut ) { //when 3s timer is over
					FSM_Internal.TimeOut = false; //timer reset
					FSM_Internal.CurrentState = FSM_STATE.BothRED2; //next state : all lights are red
					setTimeout(HandleTimer, 1000); //set up 1s timer
				}
		break;

		case FSM_STATE.BothRED2:
			//all lights are red
			FSM_Output.red1 = 1;
			FSM_Output.red23 = 1;
			FSM_Output.red4 = 1;
			if ((FSM_Input.H1 == 1) || (FSM_Input.H2 == 1)) { //if an emergency vehicle passed through one of the sensor
				FSM_Internal.CurrentState = FSM_STATE.EmergencyVehicle;
			}
			else 
				if ( FSM_Internal.TimeOut ) { //when 1s timer is over
					FSM_Internal.TimeOut = false; //timer reset
					FSM_Internal.CurrentState = FSM_STATE.SecondRoadGreen; //next state : only second road lights are green
					if (FSM_Input.BP == 1) //different timer according to limited mobility button
					{
						setTimeout(HandleTimer, 6000); //6s timer if there is a limited mobility person
						FSM_Input.BP = 0; //limited mobility button reset
					}
					else
						setTimeout(HandleTimer, 3000); //3s timer if there isn't a limited mobility person
				}
		break;

		case FSM_STATE.SecondRoadGreen: 
			//only second road and pedestrians lights are green
			FSM_Output.red1 = 1;
			FSM_Output.red4 = 1;
			FSM_Output.green23 = 1;
			FSM_Output.pedestrians = 1;
			if ((FSM_Input.H1 == 1) || (FSM_Input.H2 == 1)) {  //if an emergency vehicle passed through one of the sensor
				FSM_Internal.CurrentState = FSM_STATE.EmergencyVehicle;
			}
			else 
				if ( FSM_Internal.TimeOut ) { //when 3s or 6s timer is over 
					FSM_Internal.TimeOut = false; //timer reset
					FSM_Internal.CurrentState = FSM_STATE.BothRED1; //next state : all lights are red
					timer_start(1000); //1s timer set up
				}
		break;

		case FSM_STATE.EmergencyVehicle: //When an emergency vehicle passed through one of the sensor
			
			if ((FSM_Input.H1 == 1) && (FSM_Input.H2==0)) { //Emergency Vehicle is coming from the same road as the number 1 light 
				//only number 1 light is green
				FSM_Output.green1 =1; 
				FSM_Output.red23 = 1;
				FSM_Output.red4 = 1;
			} 
			else
				if (FSM_Input.H2 == 1) { //Emergency Vehicle is coming from the same road as the number 4 light 
					// only number 4 light in green
					FSM_Output.green4 = 1; 
					FSM_Output.red1 = 1;
					FSM_Output.red23 = 1;
				}
		
			if ((FSM_Input.H1 == 1) && (FSM_Output == 1)) { //Emergency Vehicle totally crossed the road //
				FSM_Internal.CurrentState = FSM_STATE.BothRED1; //trafic can return to normal  
				//sensor reset
				FSM_Input.H1=0;
				FSM_Input.H2=0;
			}
			break;

		default:
			FSM_Internal.CurrentState = FSM_STATE.State0;
		break;
	}
}
function UpdateActuators() {
	createContentInstane("RedLed1Actuator", FSM_Output.red1==1 ? "[switchOn]" : "[switchOff]");
	createContentInstane("RedLed23Actuator", FSM_Output.red23==1 ? "[switchOn]" : "[switchOff]");
	createContentInstane("RedLed4Actuator", FSM_Output.red4==1 ? "[switchOn]" : "[switchOff]");
	createContentInstane("GreenLed1Actuator", FSM_Output.green1==1 ? "[switchOn]" : "[switchOff]");
	createContentInstane("GreenLed23Actuator", FSM_Output.green23==1 ? "[switchOn]" : "[switchOff]");
	createContentInstane("GreenLed4Actuator", FSM_Output.green4==1 ? "[switchOn]" : "[switchOff]");
	createContentInstane("GreenLed5Actuator", FSM_Output.pedestrians==1 ? "[switchOn]" : "[switchOff]");
}
function HandleTimer() {
	FSM_Internal.TimeOut = true;
}


// oneM2M primitives
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

