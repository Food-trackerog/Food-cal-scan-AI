/* ============================================================
   DietMitra LOGIN — Interaction Engine
   Requires: GSAP (3.x) loaded before this file
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    /* ---------------------------------------------------------
       1. FLOATING-LABEL PASSWORD VISIBILITY TOGGLES
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
       2. MAGNETIC BUTTON EFFECT
       --------------------------------------------------------- */
    document.querySelectorAll('.magnetic').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.08}px, ${y * 0.2}px)`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0, 0)';
        });
    });

    /* ---------------------------------------------------------
       3. LOGIN <-> SIGNUP PANEL SWITCH (GSAP crossfade)
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
       4. PAGE-LOAD ENTRANCE TIMELINE (GSAP)
       --------------------------------------------------------- */
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to(glassCard, { opacity: 1, y: 0, duration: 0.6 })
      .from('.brand-mark', { opacity: 0, y: -10, duration: 0.4 }, '-=0.4')
      .from('.form-title, .form-subtitle', { opacity: 0, y: 10, stagger: 0.08, duration: 0.4 }, '-=0.25')
      .from('.field', { opacity: 0, y: 16, stagger: 0.09, duration: 0.4 }, '-=0.15')
      .from('.form-row', { opacity: 0, y: 10, duration: 0.35 }, '-=0.1')
      .from('.cta-btn', { opacity: 0, scale: 0.9, duration: 0.4, ease: 'back.out(1.6)' }, '-=0.1')
      .from('.divider, .social-row, .switch-text', { opacity: 0, y: 10, stagger: 0.08, duration: 0.35 }, '-=0.15');
});
