from flask import Flask, render_template, request, session, redirect, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
import uuid

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
socketio = SocketIO(app, cors_allowed_origins="*")

# Store active rooms
rooms = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/create-room')
def create_room():
    room_id = str(uuid.uuid4())[:8]  # Generate a short unique room ID
    rooms[room_id] = {"members": 0, "usernames": []}
    return redirect(url_for('room', room_id=room_id))

@app.route('/room/<room_id>')
def room(room_id):
    if room_id not in rooms:
        return redirect(url_for('index'))
    
    return render_template('room.html', room_id=room_id)

# Socket.IO events
@socketio.on('join')
def on_join(data):
    username = data['username']
    room_id = data['room']
    
    if room_id not in rooms:
        return
    
    join_room(room_id)
    rooms[room_id]["members"] += 1
    rooms[room_id]["usernames"].append(username)
    
    # Notify others that user joined
    emit('user_joined', {'username': username, 'count': rooms[room_id]["members"]}, room=room_id)
    
    # Send list of existing users to the new participant
    emit('room_users', {'usernames': rooms[room_id]["usernames"]})

@socketio.on('leave')
def on_leave(data):
    username = data['username']
    room_id = data['room']
    
    if room_id in rooms:
        leave_room(room_id)
        rooms[room_id]["members"] -= 1
        rooms[room_id]["usernames"].remove(username)
        
        # Notify others that user left
        emit('user_left', {'username': username, 'count': rooms[room_id]["members"]}, room=room_id)
        
        # If room is empty, remove it
        if rooms[room_id]["members"] <= 0:
            del rooms[room_id]

@socketio.on('chat_message')
def on_chat_message(data):
    room_id = data['room']
    emit('chat_message', {
        'username': data['username'],
        'message': data['message']
    }, room=room_id)

# WebRTC signaling
@socketio.on('offer')
def on_offer(data):
    emit('offer', data, room=data['target'])

@socketio.on('answer')
def on_answer(data):
    emit('answer', data, room=data['target'])

@socketio.on('ice_candidate')
def on_ice_candidate(data):
    emit('ice_candidate', data, room=data['target'])

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True )

