/* eslint-disable  func-names */
/* eslint-disable  no-console */

//https://github.com/alexa/skill-sample-nodejs-audio-player/blob/mainline/multiple-streams/lambda/src/index.js
//e https://github.com/ndg63276/alexa-youtube/blob/master/lambda_function.py

const Alexa = require('ask-sdk-core')
const request = require('request-promise')

const API_BASE_URI = "http://YOUR-DOMAIN" //Put here URL of the API, e.g: http://192.168.88.1:3288

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest'
  },
  async handle(handlerInput) {
    const { responseBuilder } = handlerInput
    const requestSong = await getNextSong({
      playingFrom: "LaunchRequest"
    })
    if (!requestSong) {
      responseBuilder.speak(`Niente in coda. Aggiungi qualcosa alla coda`) //Nothing in queue, add something from alexa-youtube-player-web
      return responseBuilder
        .getResponse()
    }

    responseBuilder.speak(`Riproduco ${requestSong.title}`).withShouldEndSession(true) //Playing song
    addAudioPlayerPlayDirective(responseBuilder, 'REPLACE_ALL', requestSong)

    return responseBuilder
      .getResponse()
  },
}

const PlayNextIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      (
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NextIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.ResumeIntent'
      )
  },
  async handle(handlerInput) {
    const { responseBuilder } = handlerInput
    const requestSong = await getEnqueuedSong()
    if (!requestSong) {
      responseBuilder.speak(`Niente in coda. Aggiungi qualcosa alla coda`) //Nothing in queue, add something from alexa-youtube-player-web
      return responseBuilder
        .getResponse()
    }

    responseBuilder.speak(`Riproduco ${requestSong.title}`).withShouldEndSession(true) //Playing song
    addAudioPlayerPlayDirective(responseBuilder, 'REPLACE_ALL', requestSong)

    return responseBuilder
      .getResponse()
  }
}

const VaInFigaHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      (
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.LoopOnIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PreviousIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.RepeatIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.ShuffleOnIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StartOverIntent'
      )
  },
  async handle(handlerInput) {
    handlerInput.responseBuilder.speak("Madonna bidone dell'immondizia Alexa è un cumulo di rifiuti. This intent is not working at this moment.")
    return handlerInput.responseBuilder.getResponse()
  },
}

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PauseIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.LoopOffIntent' ||
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.ShuffleOffIntent'
      )
  },
  async handle(handlerInput) {
    handlerInput.responseBuilder
      .addAudioPlayerStopDirective()

    return handlerInput.responseBuilder
      .getResponse()
  },
}

const PlaybackStoppedIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'PlaybackController.PauseCommandIssued' ||
      handlerInput.requestEnvelope.request.type === 'AudioPlayer.PlaybackStopped'
  },
  handle(handlerInput) {
    handlerInput.responseBuilder
      .addAudioPlayerStopDirective()

    return handlerInput.responseBuilder
      .getResponse()
  },
}

const PlaybackNearlyFinishedIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'AudioPlayer.PlaybackNearlyFinished'
  },
  async handle(handlerInput) {
    const { responseBuilder } = handlerInput
    const requestSong = await getNextSong({
      playingFrom: "PlaybackNearlyFinished"
    })
    if (!requestSong) return responseBuilder.getResponse()

    addAudioPlayerPlayDirective(responseBuilder, 'ENQUEUE', requestSong)

    return responseBuilder
      .getResponse()
  }
}

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest'
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`)

    return handlerInput.responseBuilder
      .getResponse()
  },
}

//System.ExceptionEncountered
const ExceptionEncounteredRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'System.ExceptionEncountered'
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`)

    return true
  },
}

const ErrorHandler = {
  canHandle() {
    return true
  },
  async handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`)
    return handlerInput.responseBuilder
      .getResponse()
  },
}

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent'
  },
  handle(handlerInput) {
    const speechText = 'This skill gets songs from your api and then plays them'

    return handlerInput.responseBuilder
      .speak(speechText)
      .getResponse()
  },
}

const getNextSong = async (body) => {
  const options = {
    url: `${API_BASE_URI}/api/next-song`,
    method: "POST",
    json: true,
    body: body || undefined
  }
  return ((await request(options)).data || {}).song
}

const getEnqueuedSong = async () => {
  const options = {
    url: `${API_BASE_URI}/api/enqueued-song`,
    method: "POST",
    json: true
  }
  return ((await request(options)).data || {}).song
}

const addAudioPlayerPlayDirective = (responseBuilder, type, song, offset = 0, streamId = "stream-id", previousStreamId = "stream-id") => {
  if (type !== "ENQUEUE") previousStreamId = null
  responseBuilder.addAudioPlayerPlayDirective(type, song.url, streamId, offset, previousStreamId, {
    "title": song.title,
    "subtitle": song.artist,
    "art": {
      "sources": [
        {
          "url": song.thumbnail
        }
      ]
    },
    "backgroundImage": {
      "sources": [
        {
          "url": song.thumbnail
        }
      ]
    }
  })
}

const skillBuilder = Alexa.SkillBuilders.custom()

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    PlaybackNearlyFinishedIntentHandler,
    PlayNextIntentHandler,
    CancelAndStopIntentHandler,
    PlaybackStoppedIntentHandler,
    HelpIntentHandler,
    ExceptionEncounteredRequestHandler,
    SessionEndedRequestHandler,
    VaInFigaHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda()
