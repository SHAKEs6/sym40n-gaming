const startBtn = document.getElementById('startBtn');
const localVideo = document.getElementById('localVideo');
const socket = io();
const pcs = {}; // viewerId -> RTCPeerConnection

async function startStream() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = stream;
    socket.emit('join', { role: 'admin' });

    socket.on('viewer-join', async ({ viewerId }) => {
      // create peer connection per viewer
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcs[viewerId] = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('ice', { target: viewerId, candidate: e.candidate });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { target: viewerId, sdp: pc.localDescription });
    });

    socket.on('answer', async ({ from, sdp }) => {
      const pc = pcs[from];
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on('ice', async ({ from, candidate }) => {
      const pc = pcs[from];
      if (!pc || !candidate) return;
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { console.warn(e); }
    });

    socket.on('viewer-left', ({ viewerId }) => {
      if (pcs[viewerId]) {
        try { pcs[viewerId].close(); } catch (e) {}
        delete pcs[viewerId];
      }
    });
  } catch (e) {
    alert('Could not start camera/mic: ' + e.message);
    console.error(e);
  }
}

startBtn.addEventListener('click', () => startStream());
