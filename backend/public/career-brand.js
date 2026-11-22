/* Branding for the student app, taken from the main app's existing settings (org name + uploaded logo from the HR Panel). */
window.Brand = { orgName: 'NavaSetu', tagline: 'Every Journey Needs a Setu', whatsapp: '918556840001', site: 'https://www.navasetu.online', email: 'navasetuinitiatives@gmail.com', hasLogo: false, logoUrl: '' };
window.applyBrand = function () {
  const B = window.Brand;
  document.querySelectorAll('[data-brand]').forEach(el => { const v = B[el.dataset.brand]; if (v) el.textContent = v; });
  document.querySelectorAll('[data-brand-logo]').forEach(el => {
    if (!B.hasLogo) return;
    const img = document.createElement('img'); img.src = B.logoUrl; img.alt = B.orgName + ' logo'; img.setAttribute('data-brand-logo', '');
    img.style.cssText = 'height:46px;width:auto;max-width:150px;object-fit:contain;flex:none;background:#fff;border-radius:8px;padding:3px';
    el.replaceWith(img);
  });
};
window.loadBrand = async function () {
  if (location.protocol.indexOf('http') !== 0) return window.applyBrand();
  try {
    const j = await (await fetch('/api/settings')).json();
    if (j && j.has_logo) { window.Brand.hasLogo = true; window.Brand.logoUrl = '/api/settings/logo?v=' + encodeURIComponent(j.updated_at || ''); }
  } catch (e) { /* keep defaults */ }
  window.applyBrand();
};
