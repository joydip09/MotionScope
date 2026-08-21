import * as THREE from "three";

const viewport = document.querySelector("#viewport");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1512);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(3.4, 2.5, 4.8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdcebd7, 0x17251f, 2.2));

const keyLight = new THREE.DirectionalLight(0xc8f0b4, 3.2);
keyLight.position.set(3, 5, 4);
keyLight.castShadow = true;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x7199ff, 1.3);
rimLight.position.set(-4, 2, -3);
scene.add(rimLight);

const device = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.BoxGeometry(2.4, 0.42, 1.55),
  new THREE.MeshStandardMaterial({
    color: 0x6f9368,
    metalness: 0.32,
    roughness: 0.38,
  }),
);
body.castShadow = true;
body.receiveShadow = true;
device.add(body);

const board = new THREE.Mesh(
  new THREE.BoxGeometry(1.82, 0.05, 1.08),
  new THREE.MeshStandardMaterial({
    color: 0x16251f,
    metalness: 0.18,
    roughness: 0.6,
  }),
);
board.position.y = 0.24;
board.castShadow = true;
device.add(board);

const sensor = new THREE.Mesh(
  new THREE.BoxGeometry(0.48, 0.18, 0.48),
  new THREE.MeshStandardMaterial({
    color: 0xb8ef75,
    metalness: 0.15,
    roughness: 0.3,
  }),
);
sensor.position.set(0, 0.36, 0);
sensor.castShadow = true;
device.add(sensor);

const axisMarker = new THREE.Mesh(
  new THREE.BoxGeometry(0.72, 0.07, 0.07),
  new THREE.MeshStandardMaterial({ color: 0xffa45b, emissive: 0x3d1d08 }),
);
axisMarker.position.set(0.72, 0.39, 0);
device.add(axisMarker);

scene.add(device);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(5.5, 64),
  new THREE.MeshStandardMaterial({
    color: 0x0d1b16,
    roughness: 0.9,
    metalness: 0.05,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.62;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(10, 20, 0x345343, 0x1a2b24);
grid.position.y = -0.6;
grid.material.transparent = true;
grid.material.opacity = 0.34;
scene.add(grid);

const orientationStatus = document.querySelector("#orientation-status");
const orientationButtons = document.querySelectorAll("[data-orientation]");
const connectionForm = document.querySelector("#connection-form");
const esp32HostInput = document.querySelector("#esp32-host");
const connectionState = document.querySelector("#connection-state");
const quaternionReadout = document.querySelector("#quaternion-readout");
const queryHost = new URLSearchParams(window.location.search).get("esp32");
let socket;
let reconnectTimer;
let latestQuaternion = { w: 1, x: 0, y: 0, z: 0 };
const liveThreeQuaternion = new THREE.Quaternion();
let liveMode = false;

function mapEsp32QuaternionToThree({ w, x, y, z }, target) {
  target.set(x, y, z, w).normalize();
}

function createTestQuaternion(axis, angle) {
  const axisVector = new THREE.Vector3(...axis);
  const quaternion = new THREE.Quaternion();
  quaternion.setFromAxisAngle(axisVector, angle);
  return { w: quaternion.w, x: quaternion.x, y: quaternion.y, z: quaternion.z };
}

const testOrientations = {
  identity: { w: 1, x: 0, y: 0, z: 0 },
  x: createTestQuaternion([1, 0, 0], Math.PI / 2),
  y: createTestQuaternion([0, 1, 0], Math.PI / 2),
  z: createTestQuaternion([0, 0, 1], Math.PI / 2),
};

function applyOrientation(orientation, label) {
  mapEsp32QuaternionToThree(orientation, device.quaternion);
  orientationButtons.forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.orientation === label),
    );
  });
  orientationStatus.value =
    label === "identity" ? "Identity" : `${label.toUpperCase()} +90°`;
}

function selectOrientation(label) {
  liveMode = false;
  applyOrientation(testOrientations[label], label);
}

function selectLiveOrientation() {
  liveMode = true;
  orientationButtons.forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.orientation === "live"),
    );
  });
  orientationStatus.value = "Live ESP32";
}

function setConnectionState(state) {
  connectionState.dataset.state = state;
  connectionState.textContent = `WebSocket: ${state.toUpperCase()}`;
}

function updateQuaternionReadout() {
  const { w, x, y, z } = latestQuaternion;
  quaternionReadout.textContent = `W: ${w.toFixed(6)} | X: ${x.toFixed(6)} | Y: ${y.toFixed(6)} | Z: ${z.toFixed(6)}`;
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectWebSocket, 3000);
}

function connectWebSocket() {
  const host = esp32HostInput.value.trim();
  clearTimeout(reconnectTimer);

  if (!host) {
    setConnectionState("disconnected");
    return;
  }

  if (socket) {
    socket.close();
  }

  setConnectionState("connecting");
  const currentSocket = new WebSocket(`ws://${host}:81/`);
  socket = currentSocket;

  currentSocket.addEventListener("open", () => {
    if (socket !== currentSocket) return;
    setConnectionState("connected");
    selectLiveOrientation();
  });
  currentSocket.addEventListener("message", (event) => {
    try {
      const packet = JSON.parse(event.data);
      if (
        packet.type !== "orientation" ||
        !Number.isFinite(packet.w) ||
        !Number.isFinite(packet.x) ||
        !Number.isFinite(packet.y) ||
        !Number.isFinite(packet.z)
      ) {
        return;
      }
      latestQuaternion.w = packet.w;
      latestQuaternion.x = packet.x;
      latestQuaternion.y = packet.y;
      latestQuaternion.z = packet.z;
      mapEsp32QuaternionToThree(latestQuaternion, liveThreeQuaternion);
      updateQuaternionReadout();
    } catch {
      return;
    }
  });
  currentSocket.addEventListener("error", () => currentSocket.close());
  currentSocket.addEventListener("close", () => {
    if (socket !== currentSocket) return;
    socket = undefined;
    setConnectionState("disconnected");
    scheduleReconnect();
  });
}

orientationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.orientation === "live") {
      selectLiveOrientation();
    } else {
      selectOrientation(button.dataset.orientation);
    }
  });
});

connectionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  connectWebSocket();
});

window.addEventListener("keydown", (event) => {
  const keyMap = { 1: "identity", 2: "x", 3: "y", 4: "z" };
  const label = keyMap[event.key];
  if (label) {
    selectOrientation(label);
  }
});

function resize() {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate() {
  if (liveMode) {
    device.quaternion.copy(liveThreeQuaternion);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("resize", resize);
resize();
selectOrientation("identity");
if (queryHost) {
  esp32HostInput.value = queryHost;
  connectWebSocket();
} else {
  setConnectionState("disconnected");
}
requestAnimationFrame(animate);
