// Copyright (C) 2014 Brian Poteat
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

function supportsMedia() {
  return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || navigator.msGetUserMedia);

}

// cross-browser support for getUserMedia
navigator.getUserMedia = navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia;

window.URL = window.URL || window.webkitURL;

window.requestAnimationFrame = (function () {
  return  window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame
})();

window.AudioContext = window.AudioContext || window.webkitAudioContext;


var mediaStream;

// global variables for showing/encoding the video
var mediaInitialized = false;
var recording = false;

// global variables for recording audio
var audioContext;
var audioRecorder;

// function for requesting the media stream
function setupMedia() {
  if (supportsMedia()) {
    audioContext = new AudioContext();

    navigator.getUserMedia(
      {
        video: true,
        audio: true
      },
      function (localMediaStream) {
        // map the camera

        // setup audio recorder
        var audioInput = audioContext.createMediaStreamSource(localMediaStream);
        //audioInput.connect(audioContext.destination);
        // had to replace the above with the following to mute playback
        // (so you don't get feedback)
        var audioGain = audioContext.createGain();
        audioGain.gain.value = 0;
        audioInput.connect(audioGain);
        audioGain.connect(audioContext.destination);

        audioRecorder = new Recorder(audioInput);
        mediaStream = localMediaStream;
        mediaInitialized = true;

        document.getElementById('uploading').hidden = true;
        document.getElementById('media-error').hidden = true;
        document.getElementById('record').hidden = false;
      },
      function (e) {
        document.getElementById('media-error').hidden = false;
      }
    );
  }
};

// exposed template helpers
Template.record.supportsMedia = supportsMedia;

Template.record.onLoad = function () {
  setupMedia();
};

// template event handlers
Template.record.events = {
  'click #start-recording': function (e) {
    e.preventDefault();

    if (!Meteor.user()) {
      // must be the logged in user
      return;
    }
    document.getElementById('stop-recording').disabled = false;
    document.getElementById('start-recording').disabled = true;
    startRecording();
  },
  'click #stop-recording': function (e) {
    e.preventDefault();

    document.getElementById('stop-recording').disabled = true;
    document.getElementById('start-recording').disabled = false;
    stopRecording();
  }
};


function startRecording() {
  // do request frames until the user stops recording
  recording = true;

  // begin recording audio
  audioRecorder.record();
}

function stopRecording() {
  recording = false;
  completeRecording();
}

function completeRecording() {
  // stop & export the recorder audio
  audioRecorder.stop();

  var user = Meteor.user();
  if (!user) {
    // must be the logged in user
    return;
  }

  document.getElementById('uploading').hidden = false;

  audioRecorder.exportWAV(function (audioBlob) {
    // save to the db
    BinaryFileReader.read(audioBlob, function (err, fileInfo) {
      UserAudios.insert({
        userId: user._id,
        audio: fileInfo,
        save_date: Date.now()
      });
    });

  });


  // stop the stream & redirect to show the video
  mediaStream.stop();
  Router.go('showVideo', { _id: user._id });
}


var BinaryFileReader = {
  read: function (file, callback) {
    var reader = new FileReader;

    var fileInfo = {
      name: file.name,
      type: file.type,
      size: file.size,
      file: null
    }

    reader.onload = function () {
      fileInfo.file = new Uint8Array(reader.result);
      callback(null, fileInfo);
    }
    reader.onerror = function () {
      callback(reader.error);
    }

    reader.readAsArrayBuffer(file);
  }
}
