"use client";

import { useEffect, useRef } from "react";
import { carState } from "@/lib/carState";
import s from "./CarScene.module.css";

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // in-out
const out = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The 3D car behind the hero. three.js is loaded on the client only, after first paint.
 * It reads carState (written by the hero's scroll timeline) and renders only when something changed.
 */
export default function CarScene() {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
      const { buildCar } = await import("./carModel");
      await document.fonts?.ready;
      const el = wrap.current;
      if (!alive || !el) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        return; // no WebGL: the hero simply has no car
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      renderer.setClearColor(0x000000, 0);
      el.appendChild(renderer.domElement);
      const stage = el.parentElement as HTMLElement;

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.55;
      const key = new THREE.DirectionalLight(0xffffff, 1.8);
      key.position.set(3, 6, 4);
      const rim = new THREE.DirectionalLight(0xffffff, 2.2);
      rim.position.set(-5, 3, -4);
      scene.add(key, rim);

      const font = getComputedStyle(document.documentElement).getPropertyValue("--f-kanit") || "sans-serif";
      const car = buildCar(THREE, font);
      scene.add(car.root);

      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
      const target = new THREE.Vector3(0, 0.45, 0);
      const FRONT = new THREE.Vector3(7.4, 2.6, 6.8); // front three-quarter, nose to the right
      const SIDE = new THREE.Vector3(0.2, 0.9, 12.4); // straight side-on
      const camPos = new THREE.Vector3();

      let w = 1, h = 1, mobile = false;
      const resize = () => {
        w = el.clientWidth || 1;
        h = el.clientHeight || 1;
        mobile = w < 768;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.fov = mobile ? 40 : 28;
        last = "";
      };
      const ro = new ResizeObserver(resize);
      ro.observe(el);

      let last = "";
      let prevX = 0;
      const frame = () => {
        const { drive, side, spin } = carState;
        const sig = `${drive.toFixed(4)}|${side.toFixed(4)}|${spin.toFixed(4)}|${w}x${h}`;
        if (sig !== last) {
          last = sig;
          // where the car is: launches off right, then rolls back in from the left for the side view
          const x = side > 0 ? -13 * (1 - out(side)) : drive * drive * 15;
          car.root.position.x = x;
          const dx = x - prevX;
          prevX = x;
          car.wheels.forEach((wh) => (wh.rotation.z -= dx / 0.36));
          car.spinner.rotation.y = spin * Math.PI * 2;
          // camera swings from the three-quarter view to side-on
          const k = ease(side);
          camPos.lerpVectors(FRONT, SIDE, k);
          camera.position.copy(camPos);
          camera.lookAt(target);
          // desktop: keep the car on the right of the headline; phones: low and centred
          const offX = mobile ? 0 : -w * (0.16 - 0.01 * k);
          const offY = mobile ? -h * (0.26 - 0.04 * k) : -h * (0.14 - 0.02 * k);
          camera.setViewOffset(w, h, offX, offY, w, h);
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        }
      };

      // run only while the hero is on screen
      let raf = 0;
      let visible = true;
      const loop = () => {
        frame();
        raf = visible ? requestAnimationFrame(loop) : 0;
      };
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(loop);
      });
      io.observe(el);
      resize();
      raf = requestAnimationFrame(loop);
      stage.dataset.ready = "true";

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        renderer.dispose();
        pmrem.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      alive = false;
      cleanup();
    };
  }, []);

  return (
    <div className={s.stage} aria-hidden="true">
      {/* the hero timeline fades this inner layer; the outer one only fades in once the scene is ready */}
      <div className={s.layer} ref={wrap} data-stage-fade />
    </div>
  );
}
