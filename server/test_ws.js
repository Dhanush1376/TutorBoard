import { io } from 'socket.io-client';

const socket = io('http://localhost:3001/teaching', {
  auth: { token: 'guest' },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected!');
  socket.emit('session:start', {
    topic: 'Explain photosynthesis',
    selectedAgent: 'OpenRouter',
    activeMode: 'explain'
  });
});

socket.on('teaching:greeting', (data) => console.log('Greeting:', data));
socket.on('teaching:error', (data) => console.log('Error:', data));
socket.on('teaching:state', (data) => console.log('State:', data.to || data.state));
socket.on('teaching:timeline', (data) => console.log('Timeline generated!'));

setTimeout(() => {
  socket.disconnect();
  process.exit(0);
}, 15000);
