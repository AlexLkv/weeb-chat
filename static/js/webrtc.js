// WebRTC configuration
const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
}

// Global variables
let socket
let localStream
let peerConnections = {}
let currentRoom
let currentUsername
let isVideoEnabled = true
let isAudioEnabled = true

// Initialize the room
async function initializeRoom(roomId, username) {
  currentRoom = roomId
  currentUsername = username

  // Connect to signaling server
  socket = io()

  // Get local media stream
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    document.getElementById("localVideo").srcObject = localStream
  } catch (error) {
    console.error("Error accessing media devices:", error)
    alert("Could not access camera or microphone. Please check permissions.")
  }

  // Socket event listeners
  setupSocketListeners()

  // Join the room
  socket.emit("join", { username: currentUsername, room: currentRoom })

  // Set up UI controls
  setupUIControls()
}

// Set up socket event listeners
function setupSocketListeners() {
  // When a new user joins the room
  socket.on("user_joined", (data) => {
    console.log(`${data.username} joined the room`)
    document.getElementById("participantCount").textContent = data.count

    // Create a new peer connection for the new user
    createPeerConnection(data.username)

    // Send offer to the new user
    createOffer(data.username)
  })

  // When a user leaves the room
  socket.on("user_left", (data) => {
    console.log(`${data.username} left the room`)
    document.getElementById("participantCount").textContent = data.count

    // Close and remove the peer connection
    if (peerConnections[data.username]) {
      peerConnections[data.username].close()
      delete peerConnections[data.username]
    }

    // Remove the video element
    const videoElement = document.getElementById(`video-${data.username}`)
    if (videoElement) {
      videoElement.parentNode.remove()
    }
  })

  // When receiving an offer
  socket.on("offer", async (data) => {
    console.log("Received offer from", data.sender)

    // Create peer connection if it doesn't exist
    if (!peerConnections[data.sender]) {
      createPeerConnection(data.sender)
    }

    // Set remote description
    try {
      await peerConnections[data.sender].setRemoteDescription(new RTCSessionDescription(data.offer))

      // Create answer
      const answer = await peerConnections[data.sender].createAnswer()
      await peerConnections[data.sender].setLocalDescription(answer)

      // Send answer to the sender
      socket.emit("answer", {
        sender: currentUsername,
        target: data.sender,
        answer: answer,
      })
    } catch (error) {
      console.error("Error handling offer:", error)
    }
  })

  // When receiving an answer
  socket.on("answer", async (data) => {
    console.log("Received answer from", data.sender)

    try {
      await peerConnections[data.sender].setRemoteDescription(new RTCSessionDescription(data.answer))
    } catch (error) {
      console.error("Error handling answer:", error)
    }
  })

  // When receiving an ICE candidate
  socket.on("ice_candidate", async (data) => {
    console.log("Received ICE candidate from", data.sender)

    try {
      if (peerConnections[data.sender]) {
        await peerConnections[data.sender].addIceCandidate(new RTCIceCandidate(data.candidate))
      }
    } catch (error) {
      console.error("Error adding ICE candidate:", error)
    }
  })

  // When receiving the list of users in the room
  socket.on("room_users", (data) => {
    document.getElementById("participantCount").textContent = data.usernames.length
  })
}

// Create a peer connection for a specific user
function createPeerConnection(username) {
  const peerConnection = new RTCPeerConnection(configuration)
  peerConnections[username] = peerConnection

  // Add local tracks to the peer connection
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream)
  })

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice_candidate", {
        sender: currentUsername,
        target: username,
        candidate: event.candidate,
      })
    }
  }

  // Handle incoming tracks
  peerConnection.ontrack = (event) => {
    if (!document.getElementById(`video-${username}`)) {
      const videoContainer = document.getElementById("videoContainer")

      const videoItem = document.createElement("div")
      videoItem.className = "video-item"

      const video = document.createElement("video")
      video.id = `video-${username}`
      video.autoplay = true
      video.playsInline = true
      video.srcObject = event.streams[0]

      const label = document.createElement("div")
      label.className = "video-label"
      label.textContent = username

      videoItem.appendChild(video)
      videoItem.appendChild(label)
      videoContainer.appendChild(videoItem)
    }
  }

  return peerConnection
}

// Create and send an offer to a specific user
async function createOffer(username) {
  try {
    const offer = await peerConnections[username].createOffer()
    await peerConnections[username].setLocalDescription(offer)

    socket.emit("offer", {
      sender: currentUsername,
      target: username,
      offer: offer,
    })
  } catch (error) {
    console.error("Error creating offer:", error)
  }
}

// Set up UI controls
function setupUIControls() {
  // Toggle video
  document.getElementById("toggleVideoBtn").addEventListener("click", () => {
    isVideoEnabled = !isVideoEnabled
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = isVideoEnabled
    })

    const videoIcon = document.querySelector("#toggleVideoBtn .material-icons")
    videoIcon.textContent = isVideoEnabled ? "videocam" : "videocam_off"
  })

  // Toggle audio
  document.getElementById("toggleAudioBtn").addEventListener("click", () => {
    isAudioEnabled = !isAudioEnabled
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = isAudioEnabled
    })

    const audioIcon = document.querySelector("#toggleAudioBtn .material-icons")
    audioIcon.textContent = isAudioEnabled ? "mic" : "mic_off"
  })
}

// Leave the room
function leaveRoom() {
  if (socket) {
    socket.emit("leave", { username: currentUsername, room: currentRoom })
  }

  // Stop all tracks
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop())
  }

  // Close all peer connections
  for (const username in peerConnections) {
    peerConnections[username].close()
  }
  peerConnections = {}
}

// Handle page unload
window.addEventListener("beforeunload", () => {
  leaveRoom()
})

