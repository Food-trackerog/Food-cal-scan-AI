/* ============================================================
   PREMIUM LOGIN — Interaction & 3D Scene Engine
   Requires: Three.js (r128), GSAP (3.x) loaded before this file
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    /* ---------------------------------------------------------
       1. STARFIELD BACKGROUND (lightweight canvas twinkle layer)
       --------------------------------------------------------- */
    function initStarfield() {
        const canvas = document.getElementById('starfield');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let stars = [];

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const count = Math.floor((canvas.width * canvas.height) / 9000);
            stars = Array.from({ length: count }, () => ({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                r: Math.random() * 1.4 + 0.2,
                phase: Math.random() * Math.PI * 2,
                speed: Math.random() * 0.02 + 0.005
            }));
        }

        function draw(time) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const s of stars) {
                const twinkle = 0.5 + 0.5 * Math.sin(time * s.speed + s.phase);
                ctx.globalAlpha = 0.15 + twinkle * 0.65;
                ctx.fillStyle = '#e8ecff';
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fill();
            }
            requestAnimationFrame(draw);
        }

        window.addEventListener('resize', resize);
        resize();
        requestAnimationFrame(draw);
    }

    /* ---------------------------------------------------------
       2. FLOATING-LABEL PASSWORD VISIBILITY TOGGLES
       --------------------------------------------------------- */
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    });

    /* ---------------------------------------------------------
       3. MAGNETIC BUTTON EFFECT
       --------------------------------------------------------- */
    document.querySelectorAll('.magnetic').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.12}px, ${y * 0.3}px)`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0, 0)';
        });
    });

    /* ---------------------------------------------------------
       4. LOGIN <-> SIGNUP PANEL SWITCH (GSAP crossfade)
       --------------------------------------------------------- */
    const loginPanel = document.getElementById('loginPanel');
    const signupPanel = document.getElementById('signupPanel');
    const glassCard = document.getElementById('glassCard');

    function showPanel(which) {
        const showEl = which === 'signup' ? signupPanel : loginPanel;
        const hideEl = which === 'signup' ? loginPanel : signupPanel;

        gsap.to(hideEl, {
            opacity: 0, y: -12, duration: 0.25, ease: 'power2.in',
            onComplete: () => {
                hideEl.style.display = 'none';
                showEl.style.display = 'block';
                gsap.fromTo(showEl,
                    { opacity: 0, y: 12 },
                    { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
                );
            }
        });
    }

    document.querySelectorAll('.switch-link').forEach(link => {
        link.addEventListener('click', () => showPanel(link.dataset.switch));
    });

    /* Apply the panel the backend told us to show initially (no animation) */
    const initialPanel = window.__INITIAL_PANEL__ === 'signup' ? 'signup' : 'login';
    if (initialPanel === 'signup') {
        loginPanel.style.display = 'none';
        signupPanel.style.display = 'block';
    }

    /* ---------------------------------------------------------
       5. PAGE-LOAD ENTRANCE TIMELINE (GSAP)
       --------------------------------------------------------- */
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to(glassCard, { opacity: 1, y: 0, duration: 0.7 })
      .from('.brand-mark', { opacity: 0, y: -10, duration: 0.4 }, '-=0.5')
      .from('.form-title, .form-subtitle', { opacity: 0, y: 10, stagger: 0.08, duration: 0.4 }, '-=0.3')
      .from('.field', { opacity: 0, y: 16, stagger: 0.09, duration: 0.4 }, '-=0.2')
      .from('.form-row', { opacity: 0, y: 10, duration: 0.35 }, '-=0.15')
      .from('.cta-btn', { opacity: 0, scale: 0.85, duration: 0.45, ease: 'back.out(1.7)' }, '-=0.15')
      .from('.divider, .social-row, .switch-text', { opacity: 0, y: 10, stagger: 0.08, duration: 0.35 }, '-=0.2');

    initStarfield();
    initScene(); // 3D scene, defined below
});


/* ============================================================
   3D SCENE — Three.js
   Floating cubes, glass spheres, rings, particles, mouse parallax
   ============================================================ */
function initScene() {
    const canvas = document.getElementById('webgl-scene');
    if (!canvas || window.innerWidth <= 900 || typeof THREE === 'undefined') return;

    const container = canvas.parentElement;
    let width = container.clientWidth;
    let height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    /* ---------- Lights ---------- */
    const ambient = new THREE.AmbientLight(0x8899ff, 0.5);
    scene.add(ambient);

    const cyanLight = new THREE.PointLight(0x00f5ff, 6, 20);
    cyanLight.position.set(4, 3, 4);
    scene.add(cyanLight);

    const purpleLight = new THREE.PointLight(0xa855f7, 6, 20);
    purpleLight.position.set(-4, -2, 3);
    scene.add(purpleLight);

    const violetLight = new THREE.PointLight(0x6c63ff, 4, 18);
    violetLight.position.set(0, 4, -3);
    scene.add(violetLight);

    /* ---------- Objects ---------- */
    const group = new THREE.Group();
    scene.add(group);

    const objects = [];

    function makeGlassMaterial(color) {
        return new THREE.MeshPhysicalMaterial({
            color,
            transparent: true,
            opacity: 0.35,
            roughness: 0.15,
            metalness: 0.2,
            transmission: 0.6,
            thickness: 1.2,
            clearcoat: 1,
            clearcoatRoughness: 0.1,
        });
    }

    // Floating cubes
    const cubeColors = [0x00f5ff, 0x6c63ff, 0xa855f7];
    for (let i = 0; i < 4; i++) {
        const size = 0.5 + Math.random() * 0.6;
        const geo = new THREE.BoxGeometry(size, size, size);
        const mat = makeGlassMaterial(cubeColors[i % cubeColors.length]);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4);
        mesh.userData = { type: 'cube', floatSpeed: 0.4 + Math.random() * 0.4, floatOffset: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.4 };
        group.add(mesh);
        objects.push(mesh);
    }

    // Rotating glass spheres
    for (let i = 0; i < 3; i++) {
        const radius = 0.4 + Math.random() * 0.5;
        const geo = new THREE.SphereGeometry(radius, 32, 32);
        const mat = makeGlassMaterial(cubeColors[(i + 1) % cubeColors.length]);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4);
        mesh.userData = { type: 'sphere', floatSpeed: 0.3 + Math.random() * 0.3, floatOffset: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.3 };
        group.add(mesh);
        objects.push(mesh);
    }

    // Floating rings (torus)
    for (let i = 0; i < 3; i++) {
        const geo = new THREE.TorusGeometry(0.55 + Math.random() * 0.3, 0.05, 16, 100);
        const mat = new THREE.MeshBasicMaterial({ color: cubeColors[i % cubeColors.length], transparent: true, opacity: 0.55 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4);
        mesh.rotation.x = Math.random() * Math.PI;
        mesh.userData = { type: 'ring', floatSpeed: 0.25 + Math.random() * 0.3, floatOffset: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.5 };
        group.add(mesh);
        objects.push(mesh);
    }

    // Particle system (ambient dust)
    const particleCount = 220;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 14;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.025, transparent: true, opacity: 0.6 });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    /* ---------- Entrance: assemble from random directions (GSAP) ---------- */
    objects.forEach((obj) => {
        const targetPos = obj.position.clone();
        obj.position.set(
            targetPos.x + (Math.random() - 0.5) * 12,
            targetPos.y + (Math.random() - 0.5) * 12,
            targetPos.z - 8
        );
        obj.scale.setScalar(0.01);
        gsap.to(obj.position, { x: targetPos.x, y: targetPos.y, z: targetPos.z, duration: 1.8, ease: 'power3.out', delay: 0.1 + Math.random() * 0.4 });
        gsap.to(obj.scale, { x: 1, y: 1, z: 1, duration: 1.4, ease: 'back.out(1.4)', delay: 0.2 + Math.random() * 0.4 });
    });

    /* ---------- Mouse parallax (camera rotation + object tilt + light direction) ---------- */
    let mouseX = 0, mouseY = 0;
    let targetRotX = 0, targetRotY = 0;

    window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    });

    /* ---------- Resize handling ---------- */
    window.addEventListener('resize', () => {
        width = container.clientWidth;
        height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });

    /* ---------- Animation loop ---------- */
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        // Inertial camera parallax
        targetRotX += (mouseY * 0.25 - targetRotX) * 0.04;
        targetRotY += (mouseX * 0.35 - targetRotY) * 0.04;
        camera.position.x += (mouseX * 1.2 - camera.position.x) * 0.03;
        camera.position.y += (-mouseY * 0.8 - camera.position.y) * 0.03;
        camera.lookAt(0, 0, 0);
        group.rotation.y = targetRotY * 0.4;
        group.rotation.x = targetRotX * 0.4;

        // Object float + rotation + cursor tilt
        objects.forEach((obj) => {
            const { floatSpeed, floatOffset, rotSpeed } = obj.userData;
            obj.position.y += Math.sin(t * floatSpeed + floatOffset) * 0.0025;
            obj.rotation.x += rotSpeed * 0.006;
            obj.rotation.y += rotSpeed * 0.008;
        });

        // Light direction reacts to mouse (simulated dynamic lighting)
        cyanLight.position.x = 4 + mouseX * 2;
        cyanLight.position.y = 3 - mouseY * 2;
        purpleLight.position.x = -4 - mouseX * 2;
        purpleLight.position.y = -2 + mouseY * 2;

        // Slow particle drift
        particles.rotation.y = t * 0.01;

        renderer.render(scene, camera);
    }

    animate();
}
