/**
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

        http://aws.amazon.com/apache2.0/

    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * App ID for the skill
 */
var APP_ID; //replace with 'amzn1.echo-sdk-ams.app.[your-unique-value-here]';

var https = require('https');

/**
 * The AlexaSkill Module that has the AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');

/**
 * Variable defining number of events to be read at one time
 */
var paginationSize = 3;

/**
 * Variable defining the length of the delimiter between events
 */
var delimiterSize = 2;

/**
 * SalsifySkill is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var SalsifySkill = function() {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
SalsifySkill.prototype = Object.create(AlexaSkill.prototype);
SalsifySkill.prototype.constructor = SalsifySkill;

SalsifySkill.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("SalsifySkill onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);

    // any session init logic would go here
};

SalsifySkill.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("SalsifySkill onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    getWelcomeResponse(response);
};

SalsifySkill.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);

    // any session cleanup logic would go here
};

SalsifySkill.prototype.intentHandlers = {

    "GetProductIntent": function (intent, session, response) {
        var accessToken = session['user']['accessToken'];
        console.log("=== INTENT SLOTS ===", intent.slots);
        getProductProperties(intent, session, response, accessToken);
    },

    "GetProductFilterIntent": function(intent, session, response) {
        console.log("=== INTENT SLOTS ===", intent.slots);
        var productName = intent.slots.productName && intent.slots.productName.value ? intent.slots.productName.value.charAt(0).toUpperCase() + intent.slots.productName.value.slice(1) : '';

        var propertyName = intent.slots.property && intent.slots.property.value ? intent.slots.property.value.charAt(0).toUpperCase() + intent.slots.property.value.slice(1) : '';
        var propertyValue = intent.slots.propertyValue && intent.slots.propertyValue.value ? intent.slots.propertyValue.value.charAt(0).toUpperCase() + intent.slots.propertyValue.value.slice(1) : '';

        var accessToken = session['user']['accessToken'];

        var filterURL = session.attributes.filterURL || `https://app.salsify.com/api/products?access_token=${accessToken}&filter=='Product Name':'${productName}'`;
        if (propertyName && propertyValue) {
            filterURL += `,'${propertyName}':'${propertyValue}'`;
        }

        session.attributes.filterURL = filterURL;
        console.log('filterURL', filterURL);

        var filterCount = filterURL.split(',').length;

        if (filterCount >= 3) {
            https.get(filterURL, function(res) {
                if (res.statusCode !== 200 && res.statusCode !== 304) {
                    handleErrorExplanation(response);
                    return;
                }

                var body = '';

                res.on('data', function (chunk) {
                    body += chunk;
                });

                res.on('end', function () {
                    var bodyJson = JSON.parse(body);
                    handleProductFilterIntent(intent, session, response, bodyJson);
                });
            });
        } else {
            handleAdditionalProductFilterIntents(intent, session, response, filterCount);
        }
    },

    "GetNextEventIntent": function (intent, session, response) {
        handleNextEventRequest(intent, session, response);
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        var speechText = "With Ask Salsif-eye, you can ask for information about products you have stored in Salsif-eye.  " +
            "For example, you could say 'Ask Salsif-eye about product 123,' or 'Ask Salsify what is the color of product 123.' Now, how can I assist?";
        var repromptText = "What would you like me to ask Salsif-eye about?";
        var speechOutput = {
            speech: speechText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        var repromptOutput = {
            speech: repromptText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.ask(speechOutput, repromptOutput);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye.",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = {
                speech: "Goodbye.",
                type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        response.tell(speechOutput);
    }
};

/**
 * Function to handle the onLaunch skill behavior
 */

function getWelcomeResponse(response) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var cardTitle = "Welcome to Salsify!";
    var repromptText = "With Ask Salsif-eye, you can ask for information about products you have stored in Salsif-eye.  " +
            "For example, you could say 'Ask Salsif-eye about product 123,' or 'Ask Salsify what is the color of product 123.' Now, how can I assist?";
    var speechText = "What product ID would you like to look up?";
    var cardOutput = "What product ID would you like to look up?";
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.

    var speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    var repromptOutput = {
        speech: repromptText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };
    response.askWithCard(speechOutput, repromptOutput, cardTitle, cardOutput);
}

function handleErrorExplanation(response, message) {
    response.tell({
        speech: `There was an error looking up this product. ${message}`,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    });
}

function handleProductFilterIntent(intent, session, response, productList) {
    console.log('HANDLING', productList);
    var accessToken = session['user']['accessToken'];
    var productID = productList.products.length > 0 ? productList.products[0].id : '';
    if (productID) {
        getProductProperties(intent, session, response, accessToken, productList.products[0].id, true);
    } else {
        response.tell({
            speech: "No results found.",
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        });
    }
}

/**
 * Gets a poster prepares the speech to reply to the user.
 */
function handleFirstEventRequest(intent, session, response, productData, tellSummary) {
    var propertyName = intent.slots.property ? intent.slots.property.value : '';
    var numberSlot = intent.slots.number;

    var repromptText = "What would you like me to ask Salsif-eye about?";
    var speechText = "";

    var defaultProperties = ['Description', 'Inventory'];

    if (tellSummary) {
        speechText = `${productData['Full Product Name']}. `;
        defaultProperties.forEach(prop => {
           speechText += `${prop} is ${productData[prop]}. `;
        });
    } else if (propertyName) {
        var property = "unknown";
        for (var key in productData) {
            if (key.toLowerCase() === propertyName) {
                property = productData[key];
                break;
            }
        }
        speechText = `This product's ${propertyName} is ${property}. `;
    } else {
        //  for now, by default, give the material
        speechText = `${productData['Full Product Name']}. `;
        defaultProperties.forEach(prop => {
           speechText += `${prop} is ${productData[prop]}. `;
        });
    }

    speechText += 'Would you like to know more about this product?'

    var speechOutput = {
        speech: "<speak>" + speechText + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
    };
    var repromptOutput = {
        speech: repromptText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };

    session.attributes = { productData };

    // response.askWithCard(speechOutput, repromptOutput, cardTitle, cardContent);
    response.askWithCard(speechOutput);
}

/**
 * Gets a poster prepares the speech to reply to the user.
 */
function handleNextEventRequest(intent, session, response) {
    var propertyName = intent.slots.property ? intent.slots.property.value : '';
    var productData = session.attributes.productData;

    console.log(intent.slots);

    var property = "unknown";
    for (var key in productData) {
        // console.log('propertyName', propertyName, key.toLowerCase(), propertyName === key.toLowerCase);
        if (key.toLowerCase() === propertyName) {
            property = productData[key];
            break;
        }
    }

    var speechOutput = {
        speech: `This product's ${propertyName} is ${property}. Anything else?`,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    };

    response.askWithCard(speechOutput);
}

function getProductProperties(intent, session, response, accessToken, id, tellSummary) {
    var productID = id || intent.slots.number.value;
    console.log('The product is is ' + productID);
    console.log('Making request to ' + `https://app.salsify.com/api/v1/products/${productID}?access_token=${accessToken}`);
    https.get(`https://app.salsify.com/api/v1/products/${productID}?access_token=${accessToken}`, function(res) {
        if (res.statusCode !== 200 && res.statusCode !== 304) {
            return;
        }

        var body = '';

        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function () {
            var bodyJson = JSON.parse(body);
            handleFirstEventRequest(intent, session, response, bodyJson, tellSummary);
        });
    });
}

function handleAdditionalProductFilterIntents(intent, session, response, filterCount) {
    var speachText = "I'll start looking. Any requirements?";
    if (filterCount > 1) {
        speachText = "Okay cool.  Anything else?";
    }
    response.askWithCard({
        speech: speachText,
        type: AlexaSkill.speechOutputType.PLAIN_TEXT
    });
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the HistoryBuff Skill.
    var skill = new SalsifySkill();
    skill.execute(event, context);
};
