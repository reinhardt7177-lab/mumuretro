import * as THREE from 'three';
import { heritagePart } from '../core/HeritageAssets.js';

// The Blender book is a visual layer. HTML retains sharp text, focus and touch.
// Render only while opening/turning; no additional perpetual game loop.
export function attachNotebookArt(el) {
  let renderer = null, scene, camera, leaf, frame = 0, closed = true, canvas;
  let leafBase = null;
  function render() { if (renderer) renderer.render(scene, camera); }
  function resize() {
    if (!renderer) return;
    const w = el.clientWidth, h = el.clientHeight;
    renderer.setSize(w, h); camera.left = -w / 2; camera.right = w / 2; camera.top = h / 2; camera.bottom = -h / 2; camera.updateProjectionMatrix();
    const book = scene.getObjectByName('heritage-explorer-notebook');
    const page = el.querySelector('.page').getBoundingClientRect();
    const width = Math.min(w * .995, page.width + 46), height = Math.min(h * .975, page.height + 44);
    book.scale.set(width / 9.4, height / 6.28, width / 9.4); render();
  }
  function open() {
    closed = false;
    if (renderer) return;
    const book = heritagePart('explorer-notebook'); if (!book) return;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
    catch { return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
    canvas = renderer.domElement; canvas.setAttribute('aria-hidden', 'true'); canvas.className = 'notebook-art';
    Object.assign(canvas.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '0' }); el.prepend(canvas);
    scene = new THREE.Scene(); scene.add(book, new THREE.HemisphereLight(0xfff5e4, 0x3d534d, 2));
    const light = new THREE.DirectionalLight(0xffecd0, 3); light.position.set(-3, 5, -8); scene.add(light);
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 5000); camera.position.set(0, 0, -1500); camera.lookAt(0, 0, 0);
    leaf = book.getObjectByName('Leaf'); leaf.visible = false;
    leaf.traverse(o => { if (o.isMesh) { o.geometry = o.geometry.clone(); leafBase = o.geometry.attributes.position.array.slice(); } });
    Object.assign(el.querySelector('.page').style, { position: 'relative', zIndex: '1', boxShadow: 'none' });
    resize();
  }
  function turn(forward = true) {
    if (!renderer || closed || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cancelAnimationFrame(frame); leaf.visible = true; canvas.style.zIndex = '2';
    const started = performance.now();
    function animate(now) {
      if (closed || !renderer) return;
      const t = Math.min(1, (now - started) / 580), eased = t * t * (3 - 2 * t);
      leaf.rotation.y = (forward ? eased : 1 - eased) * Math.PI;
      leaf.traverse(o => { if (o.isMesh) {
        const p = o.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, leafBase[i * 3 + 2] - Math.sin(t * Math.PI) * Math.sin(Math.min(1, Math.abs(leafBase[i * 3]) / 4.4) * Math.PI) * .35);
        p.needsUpdate = true; o.geometry.computeVertexNormals();
      } });
      render();
      if (t < 1) frame = requestAnimationFrame(animate);
      else { leaf.visible = false; canvas.style.zIndex = '0'; render(); }
    }
    frame = requestAnimationFrame(animate);
  }
  function close() {
    closed = true; cancelAnimationFrame(frame);
    if (!renderer) return;
    leaf?.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); renderer = null; leafBase = null;
  }
  addEventListener('resize', resize);
  return { open, close, turn, get isRendering() { return !!renderer; } };
}
