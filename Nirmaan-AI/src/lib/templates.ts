export const SystemTemplates = {
    globalCSS: `
  :root {
    --primary: #2563eb;
    --secondary: #475569;
    --bg-main: #ffffff;
    --bg-alt: #f8fafc;
    --text-main: #0f172a;
    --text-muted: #64748b;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: var(--bg-main); color: var(--text-main); line-height: 1.6; }
  .container { width: 100%; max-width: 1280px; margin: 0 auto; padding: 0 24px; }
  
  /* Shared Base Layouts */
  .section { padding: 80px 0; }
  .section-alt { background: var(--bg-alt); }
  
  /* Navbar Template Base */
  .navbar { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid #e2e8f0; background: var(--bg-main); position: sticky; top: 0; z-index: 100; }
  .nav-logo { font-size: 24px; font-weight: 800; text-decoration: none; color: var(--text-main); letter-spacing: -0.05em; }
  .nav-links { display: flex; gap: 32px; align-items: center; }
  .nav-links a { text-decoration: none; color: var(--text-muted); font-weight: 500; font-size: 15px; transition: color 0.2s; }
  .nav-links a:hover { color: var(--primary); }
  .menu-btn { display: none; background: none; border: none; cursor: pointer; font-size: 24px; color: var(--text-main); }
  
  /* Mobile Responsive */
  @media (max-width: 768px) {
    .menu-btn { display: block; }
    .nav-links { display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-main); flex-direction: column; gap: 16px; padding: 24px; border-bottom: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
    .nav-links.active { display: flex; }
    .hero { min-height: 50vh; }
    .hero-content { padding: 24px; }
  }
  
  /* Hero Base */
  .hero { min-height: 70vh; display: flex; align-items: center; justify-content: center; text-align: center; background-size: cover; background-position: center; position: relative; }
  .hero-content { position: relative; z-index: 10; max-width: 800px; padding: 40px; border-radius: 24px; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px); }
  
  /* Responsive Grid Cards Base */
  .grid { display: grid; gap: 32px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); margin-top: 48px; }
  .card { padding: 32px; background: white; border: 1px solid #e2e8f0; border-radius: 24px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; }
  .card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.08); border-color: var(--primary); }
  
  /* Button Base */
  .btn { display: inline-flex; align-items: center; justify-content: center; padding: 14px 28px; border-radius: 12px; background: var(--primary); color: white; text-decoration: none; font-weight: 600; transition: opacity 0.2s, transform 0.2s; }
  .btn:hover { opacity: 0.9; transform: translateY(-1px); }
  
  /* Strict Image Enforcements */
  img { max-width: 100%; height: auto; border-radius: 16px; object-fit: cover; }
  `,
    navbar: `
  <nav class="navbar">
    <div class="container" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <a href="index.html" class="nav-logo">Brand.</a>
      <button class="menu-btn" onclick="document.querySelector('.nav-links').classList.toggle('active')">☰</button>
      <div class="nav-links">
        <a href="index.html">Home</a>
        <a href="about.html">About</a>
        <a href="services.html">Services</a>
        <a href="contact.html">Contact</a>
      </div>
    </div>
  </nav>
  `
  };
