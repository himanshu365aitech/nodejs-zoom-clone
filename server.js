const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(server, { debug: true });
const { v4: uuidV4 } = require('uuid')

app.use('/peerjs', peerServer);

app.set('view engine', 'ejs')
app.use(express.static('public'))

const rooms = {}

app.get('/', (req, res) => {
  res.redirect(`/${uuidV4()}`)
})

app.get('/:room', (req, res) => {
  res.render('room', { roomId: req.params.room })
})

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { host: userId, participants: [], screenSharer: null }
      socket.join(roomId)
      socket.emit('host-joined', userId)
    } else {
      socket.emit('request-permission', { roomId, userId })
    }

    socket.on('permission-granted', ({ roomId, userId }) => {
      socket.join(roomId)
      rooms[roomId].participants.push(userId)
      io.to(roomId).emit('user-connected', userId)
      if (rooms[roomId].screenSharer) {
        socket.emit('screen-share-started', rooms[roomId].screenSharer)
      }
    })

    socket.on('permission-denied', ({ roomId, userId }) => {
      io.to(userId).emit('access-denied', roomId)
    })

    socket.on('start-screen-share', () => {
      if (!rooms[roomId].screenSharer) {
        rooms[roomId].screenSharer = userId
        io.to(roomId).emit('screen-share-started', userId)
      }
    })

    socket.on('stop-screen-share', () => {
      if (rooms[roomId].screenSharer === userId) {
        rooms[roomId].screenSharer = null
        io.to(roomId).emit('screen-share-stopped')
      }
    })

    socket.on('message', (message) => {
      io.to(roomId).emit('createMessage', message, userId)
    })

    socket.on('disconnect', () => {
      if (rooms[roomId]) {
        if (rooms[roomId].host === userId) {
          io.to(roomId).emit('host-left')
          delete rooms[roomId]
        } else {
          rooms[roomId].participants = rooms[roomId].participants.filter(id => id !== userId)
          io.to(roomId).emit('user-disconnected', userId)
        }
        if (rooms[roomId] && rooms[roomId].screenSharer === userId) {
          rooms[roomId].screenSharer = null
          io.to(roomId).emit('screen-share-stopped')
        }
      }
    })
  })
})

server.listen(process.env.PORT || 3030)