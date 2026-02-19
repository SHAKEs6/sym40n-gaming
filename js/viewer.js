const remoteVideo = document.getElementById('remoteVideo');
const socket = io();
let pc = null;

socket.on('connect', () => {
  socket.emit('join', { role: 'viewer' });
});

socket.on('offer', async ({ from, sdp }) => {
  pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  pc.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
  };

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit('ice', { target: from, candidate: e.candidate });
  };

  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { target: from, sdp: pc.localDescription });
});

socket.on('ice', async ({ from, candidate }) => {
  if (!pc || !candidate) return;
  try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { console.warn(e); }
});
