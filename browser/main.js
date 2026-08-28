import * as THREE from "three";

const viewport = document.querySelector("#viewport");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1512);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(4.1, 2.9, 5.2);
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
const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0x6f9368,
  metalness: 0.32,
  roughness: 0.38,
});
const darkMaterial = new THREE.MeshStandardMaterial({
  color: 0x16251f,
  metalness: 0.18,
  roughness: 0.6,
});
const glassMaterial = new THREE.MeshStandardMaterial({
  color: 0x5d91a0,
  metalness: 0.15,
  roughness: 0.22,
});
const wheelMaterial = new THREE.MeshStandardMaterial({
  color: 0x101614,
  metalness: 0.2,
  roughness: 0.68,
});
const hubMaterial = new THREE.MeshStandardMaterial({
  color: 0xb8ef75,
  metalness: 0.55,
  roughness: 0.25,
});
const headlightMaterial = new THREE.MeshStandardMaterial({
  color: 0xf4e6a3,
  emissive: 0x6b5a1d,
  emissiveIntensity: 0.8,
});
const taillightMaterial = new THREE.MeshStandardMaterial({
  color: 0xe66b62,
  emissive: 0x56130f,
  emissiveIntensity: 0.7,
});

const chassis = new THREE.Mesh(
  new THREE.BoxGeometry(2.65, 0.42, 1.42),
  bodyMaterial,
);
chassis.position.y = 0.02;
chassis.castShadow = true;
chassis.receiveShadow = true;
device.add(chassis);

const hood = new THREE.Mesh(
  new THREE.BoxGeometry(0.92, 0.16, 1.26),
  bodyMaterial,
);
hood.position.set(0.76, 0.31, 0);
hood.castShadow = true;
device.add(hood);

const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 0.62, 1.18),
  new THREE.MeshStandardMaterial({
    color: 0x3e6656,
    metalness: 0.25,
    roughness: 0.32,
  }),
);
cabin.position.set(-0.18, 0.48, 0);
cabin.castShadow = true;
device.add(cabin);

const windshield = new THREE.Mesh(
  new THREE.BoxGeometry(0.06, 0.38, 1.02),
  glassMaterial,
);
windshield.position.set(0.41, 0.52, 0);
windshield.rotation.z = -0.18;
device.add(windshield);

const rearWindow = new THREE.Mesh(
  new THREE.BoxGeometry(0.06, 0.34, 1.02),
  glassMaterial,
);
rearWindow.position.set(-0.77, 0.53, 0);
rearWindow.rotation.z = 0.18;
device.add(rearWindow);

const roof = new THREE.Mesh(
  new THREE.BoxGeometry(0.92, 0.08, 1.1),
  darkMaterial,
);
roof.position.set(-0.18, 0.82, 0);
roof.castShadow = true;
device.add(roof);

const wheelGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.18, 24);
const hubGeometry = new THREE.CylinderGeometry(0.13, 0.13, 0.19, 16);

function addWheel(x, z) {
  const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(x, -0.28, z);
  wheel.castShadow = true;
  device.add(wheel);

  const hub = new THREE.Mesh(hubGeometry, hubMaterial);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(x, -0.28, z + (z > 0 ? 0.1 : -0.1));
  hub.castShadow = true;
  device.add(hub);
}

addWheel(0.86, 0.76);
addWheel(0.86, -0.76);
addWheel(-0.86, 0.76);
addWheel(-0.86, -0.76);

function addLight(x, z, material) {
  const light = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.13, 0.3),
    material,
  );
  light.position.set(x, 0.12, z);
  light.castShadow = true;
  device.add(light);
}

addLight(1.36, 0.43, headlightMaterial);
addLight(1.36, -0.43, headlightMaterial);
addLight(-1.36, 0.43, taillightMaterial);
addLight(-1.36, -0.43, taillightMaterial);

const frontBadge = new THREE.Mesh(
  new THREE.BoxGeometry(0.05, 0.13, 0.22),
  hubMaterial,
);
frontBadge.position.set(1.39, 0.32, 0);
device.add(frontBadge);

scene.add(device);

const ambientGrid = new THREE.GridHelper(12, 24, 0x6fae78, 0x315b3d);
ambientGrid.rotation.x = Math.PI / 2;
ambientGrid.position.set(0, 0, -2.3);
ambientGrid.material.transparent = true;
ambientGrid.material.opacity = 0.12;
ambientGrid.material.depthWrite = false;
scene.add(ambientGrid);

const ambientSpotGeometry = new THREE.PlaneGeometry(0.16, 0.16);
const ambientSpots = [];

function resetAmbientSpot(spot, initial = false) {
  spot.duration = 1.6 + Math.random() * 2.6;
  spot.age = initial ? Math.random() * spot.duration : 0;
  spot.mesh.position.set(
    -5.4 + Math.random() * 10.8,
    -3.1 + Math.random() * 6.2,
    -2.2,
  );
}

for (let index = 0; index < 14; index += 1) {
  const spot = new THREE.Mesh(
    ambientSpotGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x9ee68c,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const state = { mesh: spot, age: 0, duration: 2 };
  resetAmbientSpot(state, true);
  ambientSpots.push(state);
  scene.add(spot);
}

const orientationStatus = document.querySelector("#orientation-status");
const orientationButtons = document.querySelectorAll("[data-orientation]");
const connectionForm = document.querySelector("#connection-form");
const esp32HostInput = document.querySelector("#esp32-host");
const connectionState = document.querySelector("#connection-state");
const connectionToggle = document.querySelector("#connection-toggle");
const connectionPanel = document.querySelector("#connection-panel");
const quaternionReadout = document.querySelector("#quaternion-readout");
const recenterButton = document.querySelector("#recenter-button");
const queryHost = new URLSearchParams(window.location.search).get("esp32");
let socket;
let reconnectTimer;
let latestQuaternion = { w: 1, x: 0, y: 0, z: 0 };
const liveThreeQuaternion = new THREE.Quaternion();
const referenceQuaternion = new THREE.Quaternion();
const relativeQuaternion = new THREE.Quaternion();
const renderedQuaternion = new THREE.Quaternion();
let liveMode = false;
const LIVE_SMOOTHING = 0.18;
const sensorToThreeFrame = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  Math.PI / 2,
);
const threeToSensorFrame = sensorToThreeFrame.clone().invert();
const threeDirectionCorrection = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  Math.PI,
);
const inverseDirectionCorrection = threeDirectionCorrection.clone().invert();
const sensorQuaternionScratch = new THREE.Quaternion();

function mapSensorQuaternionToThreeQuaternion({ w, x, y, z }, target) {
  sensorQuaternionScratch.set(x, y, z, w).normalize();
  target
    .copy(sensorToThreeFrame)
    .multiply(sensorQuaternionScratch)
    .multiply(threeToSensorFrame)
    .premultiply(threeDirectionCorrection)
    .multiply(inverseDirectionCorrection)
    .normalize();
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
  device.quaternion.set(
    orientation.x,
    orientation.y,
    orientation.z,
    orientation.w,
  );
  device.quaternion.normalize();
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

function updateRelativeOrientation() {
  relativeQuaternion.copy(referenceQuaternion).invert();
  relativeQuaternion.multiply(liveThreeQuaternion).normalize();
}

function recenterOrientation() {
  if (!liveMode) {
    return;
  }

  mapSensorQuaternionToThreeQuaternion(latestQuaternion, referenceQuaternion);
  updateRelativeOrientation();
}

function setConnectionState(state) {
  connectionState.dataset.state = state;
  connectionState.textContent = `WebSocket: ${state.toUpperCase()}`;
  connectionToggle.dataset.state = state;
  if (state === "connected") {
    setConnectionPanelVisible(false);
  } else {
    setConnectionPanelVisible(true);
  }
}

function setConnectionPanelVisible(visible) {
  connectionPanel.classList.toggle("is-hidden", !visible);
  connectionToggle.setAttribute("aria-expanded", String(visible));
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
      mapSensorQuaternionToThreeQuaternion(
        latestQuaternion,
        liveThreeQuaternion,
      );
      updateRelativeOrientation();
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

connectionToggle.addEventListener("click", () => {
  setConnectionPanelVisible(connectionPanel.classList.contains("is-hidden"));
});

viewport.addEventListener("click", (event) => {
  if (!connectionPanel.contains(event.target)) {
    setConnectionPanelVisible(false);
  }
});

recenterButton.addEventListener("click", recenterOrientation);

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

function updateAmbientSpots(deltaTime) {
  ambientSpots.forEach((spot) => {
    spot.age += deltaTime;
    if (spot.age >= spot.duration) {
      resetAmbientSpot(spot);
    }

    const progress = spot.age / spot.duration;
    spot.mesh.material.opacity = 0.075 * Math.sin(Math.PI * progress);
  });
}

let previousAnimationTime;

function animate(time) {
  const deltaTime =
    previousAnimationTime === undefined
      ? 0
      : Math.min((time - previousAnimationTime) / 1000, 0.1);
  previousAnimationTime = time;
  updateAmbientSpots(deltaTime);

  if (liveMode) {
    renderedQuaternion.slerp(relativeQuaternion, LIVE_SMOOTHING);
    device.quaternion.copy(renderedQuaternion);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("resize", resize);
resize();
selectOrientation("identity");
renderedQuaternion.identity();
referenceQuaternion.identity();
if (queryHost) {
  esp32HostInput.value = queryHost;
  connectWebSocket();
} else {
  setConnectionState("disconnected");
}
requestAnimationFrame(animate);
