import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function App() {
  const localVideoRef = useRef();
  const socketRef = useRef();
  const pcsRef = useRef({});
  const localStreamRef = useRef(null);

  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    if (!joined) return;

    socketRef.current = io({ transports: ["websocket"] });
    const socket = socketRef.current;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        localVideoRef.current.srcObject = stream;

        socket.emit("join-room", room);

        socket.on("existing-users", (users) => {
          users.forEach((id) => createPeer(id, stream, true));
        });

        socket.on("new-user", (id) => {
          createPeer(id, stream, false);
        });

        socket.on("signal", async ({ from, data }) => {
          const peer = pcsRef.current[from];
          if (!peer) return;

          if (data.description) {
            await peer.pc.setRemoteDescription(data.description);
            if (data.description.type === "offer") {
              await peer.pc.setLocalDescription(
                await peer.pc.createAnswer()
              );
              socket.emit("signal", {
                to: from,
                data: { description: peer.pc.localDescription },
              });
            }
          }

          if (data.candidate) {
            await peer.pc.addIceCandidate(data.candidate);
          }
        });

        socket.on("user-left", (id) => {
          pcsRef.current[id]?.pc.close();
          delete pcsRef.current[id];
          setRemoteStreams((s) => s.filter((x) => x.id !== id));
        });
      });
  }, [joined, room]);

  function createPeer(id, stream, makeOffer) {
    if (pcsRef.current[id]) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      setRemoteStreams((prev) => {
        if (prev.some((p) => p.id === id)) return prev;
        return [...prev, { id, stream: e.streams[0] }];
      });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit("signal", {
          to: id,
          data: { candidate: e.candidate },
        });
      }
    };

    pcsRef.current[id] = { pc };

    if (makeOffer) {
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer);
        socketRef.current.emit("signal", {
          to: id,
          data: { description: offer },
        });
      });
    }
  }

  /* ---------- CONTROLS ---------- */
  const toggleMic = () => {
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !micOn;
    });
    setMicOn(!micOn);
  };

  const toggleCam = () => {
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !camOn;
    });
    setCamOn(!camOn);
  };

  /* ---------- JOIN SCREEN ---------- */
  if (!joined) {
    return (
      <div style={styles.joinScreen}>
        <div style={styles.joinCard}>
          <h2>Join Video Room</h2>
          <input
            style={styles.input}
            placeholder="Room number"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
          <button style={styles.button} onClick={() => setJoined(true)}>
            Join / Create
          </button>
        </div>
      </div>
    );
  }

  /* ---------- VIDEO GRID ---------- */
  return (
    <div style={styles.app}>
      <div style={styles.grid}>
        {remoteStreams.map(({ id, stream }) => (
          <div key={id} style={styles.remoteBox}>
            <video
              autoPlay
              playsInline
              ref={(el) => el && (el.srcObject = stream)}
              style={styles.video}
            />
          </div>
        ))}
      </div>

      {/* LOCAL VIDEO (SMALL) */}
      <div style={styles.localBox}>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={styles.video}
        />
        <span style={styles.label}>You</span>
      </div>

      {/* CONTROL BAR */}
      <div style={styles.controls}>
        <button style={styles.ctrlBtn} onClick={toggleMic}>
          {micOn ? "Mute" : "Unmute"}
        </button>
        <button style={styles.ctrlBtn} onClick={toggleCam}>
          {camOn ? "Camera Off" : "Camera On"}
        </button>
      </div>
    </div>
  );
}

/* ---------- STYLES ---------- */
const styles = {
  app: {
    height: "100vh",
    backgroundColor: "#0f172a",
    position: "relative",
    overflow: "hidden",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 10,
    padding: 10,
    height: "100%",
  },
  remoteBox: {
    backgroundColor: "#020617",
    borderRadius: 10,
    overflow: "hidden",
  },
  localBox: {
    position: "absolute",
    right: 20,
    bottom: 90,
    width: 200,
    height: 140,
    backgroundColor: "#020617",
    borderRadius: 10,
    overflow: "hidden",
    border: "2px solid #2563eb",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  label: {
    position: "absolute",
    bottom: 6,
    left: 6,
    fontSize: 12,
    background: "rgba(0,0,0,0.6)",
    color: "#fff",
    padding: "2px 6px",
    borderRadius: 4,
  },
  controls: {
    position: "absolute",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 15,
    background: "#020617",
    padding: "10px 20px",
    borderRadius: 30,
  },
  ctrlBtn: {
    background: "#2563eb",
    border: "none",
    color: "#fff",
    padding: "8px 16px",
    borderRadius: 20,
    cursor: "pointer",
  },
  joinScreen: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg,#020617,#0f172a)",
  },
  joinCard: {
    background: "#020617",
    padding: 30,
    borderRadius: 12,
    width: 300,
    textAlign: "center",
  },
  input: {
    width: "100%",
    padding: 10,
    marginBottom: 15,
    borderRadius: 8,
    border: "none",
  },
  button: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
};
