const socket = io();
let myId = null;

// 生成带头、身体、手、腿的 Avatar 实体
function createAvatarEntity(id) {
  const container = document.createElement('a-entity');
  container.setAttribute('id', id);

  // 身体
  const body = document.createElement('a-box');
  body.setAttribute('height', 0.6);
  body.setAttribute('width', 0.4);
  body.setAttribute('depth', 0.2);
  body.setAttribute('position', '0 1.2 0');
  body.setAttribute('color', id === myId ? '#4CC3D9' : '#EF2D5E');
  container.appendChild(body);
  
  // 头部
  const head = document.createElement('a-sphere');
  head.setAttribute('radius', 0.2);
  head.setAttribute('position', '0 1.55 0');
  head.setAttribute('color', '#F0C419');
  container.appendChild(head);

  // 左臂
  ['-0.35', '0.35'].forEach((x, idx) => {
    const arm = document.createElement('a-cylinder');
    arm.setAttribute('radius', 0.05);
    arm.setAttribute('height', 0.5);
    arm.setAttribute('position', `${x} 1.2 0`);
    arm.setAttribute('rotation', '0 0 90');
    arm.setAttribute('color', '#AAA');
    container.appendChild(arm);
  });

  // 左腿，右腿
  ['-0.15', '0.15'].forEach((x) => {
    const leg = document.createElement('a-box');
    leg.setAttribute('height', 0.6);
    leg.setAttribute('width', 0.1);
    leg.setAttribute('depth', 0.1);
    leg.setAttribute('position', `${x} 0.6 0`);
    leg.setAttribute('color', '#888');
    container.appendChild(leg);
  });

  return container;
}

// 向服务器发送自己的位置与朝向
AFRAME.registerComponent('moving', {
  init() {
    this.interval = 100;
    this.prevTime = 0;
    this.prevPos = new THREE.Vector3();
    this.prevRot = new THREE.Euler();
    this.el.object3D.position.clone(this.prevPos);
    this.el.object3D.rotation.clone(this.prevRot);
  },
  tick(time) {
    if (time - this.prevTime < this.interval) return;
    const pos = this.el.object3D.position;
    const rot = this.el.object3D.rotation;
    if (pos.distanceTo(this.prevPos) > 0.05 || !pos.equals(this.prevPos) || !rot.equals(this.prevRot)) {
      socket.emit('send_my_state', {
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: rot.x, y: rot.y, z: rot.z }
      });
      this.prevPos.copy(pos);
      this.prevRot.copy(rot);
      this.prevTime = time;
    }
  }
});

// 连接建立后设置 ID
socket.on('connect', () => {
  myId = socket.id;
  document.getElementById('me').setAttribute('id', myId);
});

// 接收并处理其他用户的状态更新
socket.on('update_user_state', ([id, data]) => {
  let avatar = document.getElementById(id);
  if (!avatar) {
    avatar = createAvatarEntity(id);
    document.querySelector('a-scene').appendChild(avatar);
  }
  avatar.setAttribute('position', `${data.position.x} ${data.position.y} ${data.position.z}`);
  avatar.object3D.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
});

// 处理用户断开
socket.on('remove_user', (id) => {
  const el = document.getElementById(id);
  if (el) el.parentNode.removeChild(el);
});
