import Phaser from 'phaser';

export interface OfficeArenaObjects {
  obstacles: Phaser.Physics.Arcade.StaticGroup;
  officeGlow: Phaser.GameObjects.Rectangle;
  chaosOverlay: Phaser.GameObjects.Rectangle;
}

export function createOfficeArena(scene: Phaser.Scene): OfficeArenaObjects {
  // Match Arcade Physics to the visible office floor so the player cannot
  // escape into the HUD/letterbox area during a dash.
  scene.physics.world.setBounds(78, 194, 1124, 440);

  const background = scene.add.graphics().setDepth(-100);
  background.fillStyle(0x071328).fillRect(0, 0, 1280, 720);
  background.fillStyle(0x0d2b4d).fillRoundedRect(38, 76, 1204, 606, 24);
  background.fillStyle(0x15385c).fillRoundedRect(64, 102, 1152, 550, 16);
  background.fillStyle(0x173f63).fillRect(64, 102, 1152, 82);
  background.fillStyle(0xe8d8b7, 0.92).fillRoundedRect(78, 194, 1124, 440, 12);

  background.lineStyle(1, 0xb1a88f, 0.28);
  for (let x = 78; x <= 1202; x += 48) background.lineBetween(x, 194, x, 634);
  for (let y = 194; y <= 634; y += 48) background.lineBetween(78, y, 1202, y);

  background.fillStyle(0x071328, 0.85).fillRoundedRect(96, 116, 258, 48, 8);
  background.fillStyle(0x27d9ff, 0.8).fillRect(111, 130, 9, 20);
  scene.add.text(133, 128, 'CHAOS CORP  ·  FLOOR 01', {
    color: '#dffaff', fontFamily: 'Arial', fontSize: '16px', fontStyle: 'bold', letterSpacing: 2,
  }).setDepth(-90);
  scene.add.text(1023, 128, '09:00—17:00', {
    color: '#8fa8c9', fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', letterSpacing: 2,
  }).setDepth(-90);

  const obstacles = scene.physics.add.staticGroup();
  const addObstacle = (x: number, y: number, texture: string) => {
    const sprite = obstacles.create(x, y, texture) as Phaser.Physics.Arcade.Sprite;
    sprite.setDepth(4).refreshBody();
  };
  addObstacle(236, 238, 'desk');
  addObstacle(548, 238, 'desk');
  addObstacle(860, 238, 'desk');
  addObstacle(1042, 516, 'sofa');
  addObstacle(238, 538, 'sofa');
  addObstacle(915, 380, 'printer');

  scene.add.image(118, 205, 'plant').setDepth(3);
  scene.add.image(1162, 205, 'plant').setDepth(3);
  scene.add.image(1150, 596, 'plant').setDepth(3);

  background.lineStyle(3, 0x27d9ff, 0.28).strokeRoundedRect(438, 302, 360, 230, 18);
  background.fillStyle(0x27d9ff, 0.04).fillRoundedRect(438, 302, 360, 230, 18);
  scene.add.text(466, 325, 'OPEN PLAN · HIGH RISK', {
    color: '#446782', fontFamily: 'Arial', fontSize: '12px', fontStyle: 'bold', letterSpacing: 2,
  }).setDepth(-90);
  scene.add.text(98, 590, 'BREAK ROOM', {
    color: '#8b704f', fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', letterSpacing: 2,
  }).setDepth(-90);
  scene.add.text(1035, 590, 'HR SAFE SPACE', {
    color: '#8b704f', fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', letterSpacing: 2,
  }).setDepth(-90);
  scene.add.text(1005, 330, 'EXECUTIVE LIFT', {
    color: '#8b704f', fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', letterSpacing: 2,
  }).setDepth(-90);

  return {
    obstacles,
    officeGlow: scene.add.rectangle(640, 360, 1280, 720, 0x27d9ff, 0).setDepth(90).setBlendMode(Phaser.BlendModes.ADD),
    chaosOverlay: scene.add.rectangle(640, 360, 1280, 720, 0xff3aa7, 0).setDepth(91).setBlendMode(Phaser.BlendModes.ADD),
  };
}
