const socket = io('/')
const videoGrid = document.getElementById('video-grid')
const screenShareContainer = document.querySelector('.screen-share-container')
const screenShareVideo = document.querySelector('.screen-share-video')
const participantsColumn = document.querySelector('.participants-column')
const myPeer = new Peer(undefined, {
  path: '/peerjs',
  host: '/',
  port: '443'
})
let myVideoStream;
const myVideo = document.createElement('video')
myVideo.muted = true;
const peers = {}
let isHost = false;
let screenShareStream = null;

navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  myVideoStream = stream;
  addVideoStream(myVideo, stream)

  myPeer.on('call', call => {
    call.answer(stream)
    const video = document.createElement('video')
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream)
    })
  })

  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream)
  })

  socket.on('host-joined', (userId) => {
    isHost = true;
    console.log('You are the host of this room')
  })

  socket.on('request-permission', ({ roomId, userId }) => {
    if (isHost) {
      if (confirm('A user is requesting to join. Allow?')) {
        socket.emit('permission-granted', { roomId, userId })
      } else {
        socket.emit('permission-denied', { roomId, userId })
      }
    }
  })

  socket.on('access-denied', (roomId) => {
    alert('Access to the room was denied')
    window.location.href = '/'
  })

  socket.on('host-left', () => {
    alert('The host has left the meeting. The meeting will now end.')
    window.location.href = '/'
  })

  socket.on('screen-share-started', (userId) => {
    screenShareContainer.style.display = 'block'
    videoGrid.style.display = 'none'
    if (userId !== myPeer.id) {
      const call = myPeer.call(userId, stream)
      call.on('stream', userVideoStream => {
        screenShareVideo.srcObject = userVideoStream
      })
    }
  })

  socket.on('screen-share-stopped', () => {
    screenShareContainer.style.display = 'none'
    videoGrid.style.display = 'flex'
    screenShareVideo.srcObject = null
  })

  let text = $("input");
  $('html').keydown(function (e) {
    if (e.which == 13 && text.val().length !== 0) {
      socket.emit('message', text.val());
      text.val('')
    }
  });
  socket.on("createMessage", (message, userId) => {
    $(".messages").append(`<li class="message"><b>${userId === myPeer.id ? 'me' : 'user'}</b><br/>${message}</li>`);
    scrollToBottom()
  })
})

socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close()
})

myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id)
})

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream)
  const video = document.createElement('video')
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream)
  })
  call.on('close', () => {
    video.remove()
  })

  peers[userId] = call
}

function addVideoStream(video, stream) {
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
  if (screenShareStream) {
    participantsColumn.appendChild(video)
    video.classList.add('participant-video')
  } else {
    videoGrid.append(video)
  }
}

const scrollToBottom = () => {
  var d = $('.main__chat_window');
  d.scrollTop(d.prop("scrollHeight"));
}

const muteUnmute = () => {
  const enabled = myVideoStream.getAudioTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getAudioTracks()[0].enabled = false;
    setUnmuteButton();
  } else {
    setMuteButton();
    myVideoStream.getAudioTracks()[0].enabled = true;
  }
}

const playStop = () => {
  let enabled = myVideoStream.getVideoTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getVideoTracks()[0].enabled = false;
    setPlayVideo()
  } else {
    setStopVideo()
    myVideoStream.getVideoTracks()[0].enabled = true;
  }
}

const toggleScreenShare = () => {
  if (!screenShareStream) {
    navigator.mediaDevices.getDisplayMedia({ cursor: true }).then(stream => {
      screenShareStream = stream;
      let videoTrack = screenShareStream.getVideoTracks()[0];
      videoTrack.onended = () => {
        stopScreenSharing()
      }
      if (myPeer) {
        let sender = myPeer.getSenders().find(function (s) {
          return s.track.kind == videoTrack.kind;
        })
        sender.replaceTrack(videoTrack)
      }
      screenShareVideo.srcObject = stream
      screenShareContainer.style.display = 'block'
      videoGrid.style.display = 'none'
      socket.emit('start-screen-share')
    })
  } else {
    stopScreenSharing()
  }
}

function stopScreenSharing() {
  if (!screenShareStream) return;
  let tracks = screenShareStream.getTracks();
  tracks.forEach(track => track.stop());
  screenShareStream = null;
  screenShareContainer.style.display = 'none'
  videoGrid.style.display = 'flex'
  socket.emit('stop-screen-share')
  if (myPeer) {
    let videoTrack = myVideoStream.getVideoTracks()[0];
    let sender = myPeer.getSenders().find(function (s) {
      return s.track.kind == videoTrack.kind;
    })
    sender.replaceTrack(videoTrack)
  }
}

const setMuteButton = () => {
  const html = `
    <i class="fas fa-microphone"></i>
    <span>Mute</span>
  `
  document.querySelector('.main__mute_button').innerHTML = html;
}

const setUnmuteButton = () => {
  const html = `
    <i class="unmute fas fa-microphone-slash"></i>
    <span>Unmute</span>
  `
  document.querySelector('.main__mute_button').innerHTML = html;
}

const setStopVideo = () => {
  const html = `
    <i class="fas fa-video"></i>
    <span>Stop Video</span>
  `
  document.querySelector('.main__video_button').innerHTML = html;
}

const setPlayVideo = () => {
  const html = `
  <i class="stop fas fa-video-slash"></i>
    <span>Play Video</span>
  `
  document.querySelector('.main__video_button').innerHTML = html;
}