// =====================================================
//  SCINTILLA BASKETS — app.js
//  Client-side UI interactivity (non-Supabase)
// =====================================================

// ==================== MOBILE NAV ====================
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobileNav');

function openMobileNav() {
  mobileNav.classList.add('active');
  document.body.style.overflow = 'hidden';
  // Animate hamburger to X
  const spans = hamburger.querySelectorAll('span');
  spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
  spans[1].style.opacity = '0';
  spans[1].style.transform = 'translateX(-10px)';
  spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
}

function closeMobileNav() {
  mobileNav.classList.remove('active');
  document.body.style.overflow = '';
  // Reset hamburger
  const spans = hamburger.querySelectorAll('span');
  spans[0].style.transform = '';
  spans[1].style.opacity = '';
  spans[1].style.transform = '';
  spans[2].style.transform = '';
}

if (hamburger) {
  hamburger.addEventListener('click', () => {
    if (mobileNav.classList.contains('active')) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  });
}

// Close mobile nav when clicking outside (on the overlay)
if (mobileNav) {
  mobileNav.addEventListener('click', (e) => {
    if (e.target === mobileNav) {
      closeMobileNav();
    }
  });
}

// Close mobile nav on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMobileNav();
});

// ==================== SCROLL EFFECTS ====================
// Smooth scroll-triggered reveal for sections
const revealTargets = document.querySelectorAll(
  '.section-header, .wedding-layout, .corporate-grid, .corp-card, .testimonial-card, .contact-layout, .footer-brand'
);

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

revealTargets.forEach(el => revealObserver.observe(el));
