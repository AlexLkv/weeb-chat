// Chat functionality
document.addEventListener("DOMContentLoaded", () => {
  const messageInput = document.getElementById("messageInput")
  const sendBtn = document.getElementById("sendBtn")
  const chatMessages = document.getElementById("chatMessages")

  // Assuming socket is defined elsewhere, e.g., in a separate script tag or WebSocket initialization
  // Example: const socket = io();
  // If not defined, you'll need to establish a WebSocket connection here.
  const socket = io() // Initialize socket.io-client

  // Assuming currentUsername and currentRoom are defined elsewhere, e.g., from server-side rendering or user input
  // Example: const currentUsername = document.getElementById('username').value;
  // Example: const currentRoom = document.getElementById('room').value;
  const currentUsername = "User" // Default username
  const currentRoom = "General" // Default room

  // Send message when clicking the send button
  sendBtn.addEventListener("click", sendMessage)

  // Send message when pressing Enter
  messageInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      sendMessage()
    }
  })

  // Listen for incoming chat messages
  socket.on("chat_message", (data) => {
    displayMessage(data.username, data.message, data.username !== currentUsername)
  })

  // Function to send a message
  function sendMessage() {
    const message = messageInput.value.trim()

    if (message) {
      // Send the message to the server
      socket.emit("chat_message", {
        username: currentUsername,
        room: currentRoom,
        message: message,
      })

      // Display the message locally
      displayMessage(currentUsername, message, false)

      // Clear the input field
      messageInput.value = ""
    }
  }

  // Function to display a message in the chat
  function displayMessage(username, message, isReceived) {
    const messageElement = document.createElement("div")
    messageElement.className = `message ${isReceived ? "received" : "sent"}`

    const messageInfo = document.createElement("div")
    messageInfo.className = "message-info"
    messageInfo.textContent = isReceived ? username : "You"

    const messageText = document.createElement("div")
    messageText.textContent = message

    messageElement.appendChild(messageInfo)
    messageElement.appendChild(messageText)

    chatMessages.appendChild(messageElement)

    // Scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight
  }
})

