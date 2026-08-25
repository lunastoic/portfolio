import * as THREE from "three";

/**
 * The 3D intro room, primitives only. Everything is grayscale — the shade
 * value IS the ASCII character weight, so shades are chosen per object for
 * legibility (Phase 2 direction: readable first, moody later).
 *
 * Same furniture cast and layout as the 2D scene: desk, monitor, tower,
 * keyboard, mouse, mug, lamp, shelves + books, drawers, and the dog.
 */

export interface ScreenSaver {
  base: THREE.Mesh;
  strips: THREE.Mesh[];
  quad: THREE.Mesh;
}

export interface IntroRoom {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  screenSaver: ScreenSaver;
  lampLight: THREE.PointLight;
  mugTop: THREE.Object3D;
  dog: THREE.Group;
  dispose: () => void;
}

const gray = (v: number) => new THREE.Color(v, v, v);
const lambert = (shade: number) => new THREE.MeshLambertMaterial({ color: gray(shade) });
const basic = (shade: number) => new THREE.MeshBasicMaterial({ color: gray(shade) });

function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  shade: number,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(shade));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

export function buildIntroRoom(): IntroRoom {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(55, 1, 1, 900);
  camera.position.set(0, 122, 122);
  camera.lookAt(0, 94, -104);

  /* ---------------- room shell ---------------- */

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(620, 420), lambert(0.07));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -20);
  scene.add(floor);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(620, 320), lambert(0.05));
  backWall.position.set(0, 160, -164);
  scene.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(400, 320), lambert(0.04));
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-310, 160, -20);
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(400, 320), lambert(0.04));
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(310, 160, -20);
  scene.add(rightWall);

  /* ---------------- desk ---------------- */

  box(scene, 300, 6, 84, 0.72, 0, 76, -102); // top slab
  box(scene, 300, 46, 4, 0.1, 0, 50, -64); // front panel (quiet)
  box(scene, 6, 73, 78, 0.18, -144, 36, -102);
  box(scene, 6, 73, 78, 0.18, 144, 36, -102);

  // drawer unit (right) with bright handles
  box(scene, 62, 46, 4, 0.3, 100, 50, -62);
  box(scene, 50, 16, 2, 0.52, 100, 58, -59.5);
  box(scene, 50, 16, 2, 0.52, 100, 38, -59.5);
  box(scene, 16, 3, 2, 0.9, 100, 58, -58);
  box(scene, 16, 3, 2, 0.9, 100, 38, -58);

  /* ---------------- monitor (screen aspect ≈ the 2D UI's 1.5:1) -------- */

  box(scene, 74, 52, 6, 0.26, 0, 122, -114); // bezel
  const screenGroup = new THREE.Group();
  const screenBase = new THREE.Mesh(new THREE.PlaneGeometry(66, 44), basic(0.6));
  screenGroup.add(screenBase);
  const strips: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(66, 1.8), basic(0.34));
    strip.position.set(0, -17.5 + i * 7, 0.05);
    strips.push(strip);
    screenGroup.add(strip);
  }
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(15, 6.5), basic(0.9));
  quad.position.set(0, 0, 0.1);
  screenGroup.add(quad);
  screenGroup.position.set(0, 122, -110.9);
  scene.add(screenGroup);
  const screenSaver: ScreenSaver = { base: screenBase, strips, quad };
  box(scene, 10, 16, 8, 0.38, 0, 88, -114); // stand
  box(scene, 40, 3, 26, 0.45, 0, 80.5, -114); // base

  /* ---------------- keyboard + mouse ---------------- */

  box(scene, 60, 3, 20, 0.82, -6, 79.4, -72);
  for (let i = 0; i < 4; i++) {
    box(scene, 52, 1.2, 2.2, 0.22, -6, 81.2, -78.5 + i * 4.2); // key rows
  }
  box(scene, 26, 1, 20, 0.26, 44, 78.5, -72);
  box(scene, 7, 3.4, 12, 0.85, 44, 80.7, -72);

  /* ---------------- coffee mug ---------------- */

  const mug = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(7, 6.2, 15, 14), lambert(0.88));
  cup.position.y = 7.5;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(4, 1.3, 8, 14), lambert(0.8));
  handle.position.set(6.6, 6.5, 0);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(5.2, 14), lambert(0.08));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 13.05;
  const mugTop = new THREE.Object3D();
  mugTop.position.set(0, 16, 0); // steam anchor for Phase 3
  mug.add(cup, handle, coffee, mugTop);
  mug.position.set(74, 79, -84);
  scene.add(mug);

  /* ---------------- desk lamp + its light ---------------- */

  const lamp = new THREE.Group();
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 3, 16), lambert(0.5));
  lampBase.position.y = 1.5;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 40, 8), lambert(0.55));
  stem.position.y = 22;
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 13, 16, 14, 1, true),
    new THREE.MeshLambertMaterial({ color: gray(0.78), side: THREE.DoubleSide })
  );
  shade.position.y = 47;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 10), basic(0.95));
  bulb.position.y = 41;
  lamp.add(lampBase, stem, shade, bulb);
  lamp.position.set(-100, 79, -92);
  scene.add(lamp);

  const lampLight = new THREE.PointLight(0xffffff, 2.4, 260, 1.1);
  lampLight.position.set(-100, 122, -88);
  scene.add(lampLight);

  /* ---------------- PC tower ---------------- */

  const tower = new THREE.Group();
  tower.add(new THREE.Mesh(new THREE.BoxGeometry(32, 62, 28), lambert(0.5)));
  for (let i = 0; i < 3; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(20, 2, 1), lambert(0.16));
    slot.position.set(0, 24 - i * 6, 14.6);
    tower.add(slot);
  }
  const led = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 1), basic(1));
  led.position.set(-9, 22, 14.6);
  tower.add(led);
  tower.position.set(124, 110, -112);
  scene.add(tower);

  /* ---------------- shelves + books + globe ---------------- */

  box(scene, 70, 3.5, 20, 0.55, -160, 172, -150);
  const bookShades = [0.62, 0.4, 0.7, 0.48];
  bookShades.forEach((s, i) => {
    box(scene, 5, 20 + (i % 2) * 4, 14, s, -182 + i * 9, 184, -150);
  });

  box(scene, 70, 3.5, 20, 0.55, 160, 178, -150);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 10), lambert(0.68));
  globe.position.set(182, 190, -150);
  scene.add(globe);
  [0.58, 0.42, 0.66].forEach((s, i) => {
    box(scene, 5, 21 - (i % 2) * 3, 14, s, 136 + i * 9, 190, -150);
  });

  /* ---------------- the dog (blocky corgi, floor level) -------------- */

  const dog = new THREE.Group();
  box(dog, 26, 10, 11, 0.8, 0, 13, 0); // loaf body
  const head = box(dog, 10, 9, 9, 0.86, 16, 19, 0);
  box(dog, 5, 3.5, 5, 0.95, 22, 17, 0); // snout
  box(dog, 2.6, 5, 2, 0.75, 13.5, 26, 2.5); // ears
  box(dog, 2.6, 5, 2, 0.75, 13.5, 26, -2.5);
  head.rotation.z = -0.05;
  const legX = [-9, -3, 7, 12];
  legX.forEach((x) => box(dog, 3, 8, 3, 0.7, x, 4, 3));
  legX.forEach((x) => box(dog, 3, 8, 3, 0.62, x, 4, -3));
  box(dog, 3, 3, 3, 0.85, -14, 17, 0); // tail nub
  dog.position.set(-84, 0, -18);
  dog.rotation.y = 0.6;
  dog.scale.setScalar(0.85);
  scene.add(dog);

  /* ---------------- lighting: strong, angled, legible ------------------ */

  const ambient = new THREE.AmbientLight(0xffffff, 0.14);
  // Point light instead of a directional key: distance falloff paints real
  // brightness gradients ACROSS flat surfaces, not just per-face levels.
  const key = new THREE.PointLight(0xffffff, 52000, 0, 2);
  key.position.set(-150, 300, 40);
  const fill = new THREE.DirectionalLight(0xffffff, 0.16);
  fill.position.set(150, 90, 60);
  scene.add(ambient, key, fill);

  const dispose = () => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
  };

  return { scene, camera, screenSaver, lampLight, mugTop, dog, dispose };
}
