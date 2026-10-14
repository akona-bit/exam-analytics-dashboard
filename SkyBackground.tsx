import React from 'react';

/**
 * SkyBackground: Pure CSS + inline SVG procedural anime dawn/twilight sky
 * Inspired by Makoto Shinkai aesthetic:
 * - Gradient sky: light blue (#6fa8f5 -> #9cc3fb) -> lavender (#c8cdf8) -> pastel pink (#f6bed0) -> peach gold (#fad0a0)
 * - Warm sunbeam glow at bottom-left and rose glow at right
 * - Fluffy cumulus clouds on sides & bottom, center airy and open
 * - 2 mountain ranges (#c9c2f0 and #7d86c8) with shoreline city lights
 * - Mirror lake reflection with gentle ripples and gradient mask
 * - Pure SVG/CSS, zero external images, < 30KB payload, GPU-accelerated
 */
export function SkyBackground() {
  return (
    <div 
      className="fixed inset-0 w-full h-full pointer-events-none select-none overflow-hidden" 
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <svg
        className="w-full h-full object-cover"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* 1. Main Sky Gradient */}
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1080" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6fa8f5" />
            <stop offset="26%" stopColor="#9cc3fb" />
            <stop offset="48%" stopColor="#c8cdf8" />
            <stop offset="65%" stopColor="#f6bed0" />
            <stop offset="74%" stopColor="#fad0a0" />
            <stop offset="100%" stopColor="#fed7aa" />
          </linearGradient>

          {/* 2. Left Sunrise Horizon Glow */}
          <radialGradient id="sunGlowLeft" cx="240" cy="740" r="700" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fff1de" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#fcd3a8" stopOpacity="0.45" />
            <stop offset="65%" stopColor="#fbcfe8" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#fbcfe8" stopOpacity="0" />
          </radialGradient>

          {/* 3. Right Soft Rose Horizon Glow */}
          <radialGradient id="sunGlowRight" cx="1700" cy="730" r="600" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fbcfe8" stopOpacity="0.5" />
            <stop offset="45%" stopColor="#f472b6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
          </radialGradient>

          {/* 4. Fluffy Cloud Shading Gradient (White top -> Peach/Pink bottom) */}
          <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#fff8f2" stopOpacity="0.92" />
            <stop offset="70%" stopColor="#fce4e4" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#f5b8b8" stopOpacity="0.82" />
          </linearGradient>

          <linearGradient id="cloudGradSoft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#faece8" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#f7c5cb" stopOpacity="0.65" />
          </linearGradient>

          <linearGradient id="cloudGradWarm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
            <stop offset="40%" stopColor="#fff4e6" stopOpacity="0.92" />
            <stop offset="80%" stopColor="#fcd3a8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#f8a792" stopOpacity="0.78" />
          </linearGradient>

          {/* 5. Cloud Softness Blur Filter */}
          <filter id="cloudSoftness" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" />
          </filter>

          <filter id="cloudLight" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
          </filter>

          <filter id="waterBlur" x="0" y="0" width="100%" height="100%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>

          <filter id="starGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* 6. Water Reflection Mask (fades downward) */}
          <linearGradient id="waterMaskGrad" x1="0" y1="740" x2="0" y2="1080" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.15" />
          </linearGradient>
          <mask id="waterMask">
            <rect x="0" y="740" width="1920" height="340" fill="url(#waterMaskGrad)" />
          </mask>
        </defs>

        {/* ─── LAYER 1: BASE SKY GRADIENT ─── */}
        <rect x="0" y="0" width="1920" height="1080" fill="url(#skyGrad)" />

        {/* ─── LAYER 2: WARM HORIZON GLOWS & SUNBEAMS ─── */}
        <rect x="0" y="200" width="1920" height="600" fill="url(#sunGlowLeft)" />
        <rect x="0" y="300" width="1920" height="500" fill="url(#sunGlowRight)" />

        {/* Sunbeam rays on left horizon */}
        <g opacity="0.35" style={{ mixBlendMode: 'screen' }}>
          <polygon points="180,740 60,0 160,0" fill="#fff5ea" />
          <polygon points="200,740 260,0 380,0" fill="#fff5ea" />
          <polygon points="220,740 480,0 600,0" fill="#fde8d0" />
          <polygon points="230,740 700,0 820,0" fill="#fad7bd" />
        </g>

        {/* ─── LAYER 3: TWINKLING STARS & SHOOTING STAR ─── */}
        <g id="stars" filter="url(#starGlow)">
          {/* Subtle twinkling morning/twilight stars */}
          <circle cx="280" cy="70" r="1.8" fill="#ffffff" className="sky-star animate-pulse" style={{ animationDuration: '3s' }} />
          <circle cx="520" cy="110" r="1.4" fill="#ffffff" className="sky-star animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }} />
          <circle cx="780" cy="60" r="2.0" fill="#ffffff" className="sky-star animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
          <circle cx="950" cy="95" r="1.2" fill="#ffffff" opacity="0.7" />
          <circle cx="1180" cy="55" r="1.9" fill="#ffffff" className="sky-star animate-pulse" style={{ animationDuration: '3.5s', animationDelay: '1.5s' }} />
          <circle cx="1420" cy="85" r="1.6" fill="#ffffff" className="sky-star animate-pulse" style={{ animationDuration: '4.2s', animationDelay: '0.8s' }} />
          <circle cx="1680" cy="65" r="2.2" fill="#ffffff" className="sky-star animate-pulse" style={{ animationDuration: '2.8s', animationDelay: '0.3s' }} />
          <circle cx="1820" cy="115" r="1.4" fill="#ffffff" opacity="0.8" />
          
          {/* 4-point Diamond Star */}
          <path d="M 1250,90 Q 1250,102 1255,102 Q 1250,102 1250,114 Q 1250,102 1245,102 Q 1250,102 1250,90 Z" fill="#ffffff" opacity="0.9" />

          {/* Shooting Star with soft fading trail */}
          <g className="sky-shooting-star" opacity="0.85">
            <line x1="1580" y1="40" x2="1480" y2="105" stroke="url(#skyGrad)" strokeWidth="2" strokeLinecap="round" />
            <line x1="1560" y1="53" x2="1480" y2="105" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="1480" cy="105" r="2" fill="#ffffff" />
          </g>
        </g>

        {/* ─── LAYER 4: SCENIC CLOUD FORMATIONS (Surrounding borders, keeping center clear) ─── */}
        <g id="sky-clouds" filter="url(#cloudSoftness)">
          
          {/* Cloud Group 1: Left Towering Sunset Cloud */}
          <g id="cloud-left-main">
            {/* Base fluff */}
            <ellipse cx="60" cy="600" rx="140" ry="85" fill="url(#cloudGradWarm)" />
            <ellipse cx="140" cy="550" rx="110" ry="90" fill="url(#cloudGradWarm)" />
            <ellipse cx="220" cy="580" rx="95" ry="75" fill="url(#cloudGradWarm)" />
            {/* Upper puff */}
            <ellipse cx="110" cy="480" rx="80" ry="75" fill="url(#cloudGrad)" />
            <ellipse cx="180" cy="495" rx="70" ry="65" fill="url(#cloudGrad)" />
            <ellipse cx="50" cy="510" rx="75" ry="70" fill="url(#cloudGrad)" />
            {/* Top crest highlight */}
            <ellipse cx="120" cy="450" rx="55" ry="45" fill="#ffffff" opacity="0.95" />
            <ellipse cx="160" cy="465" rx="45" ry="40" fill="#ffffff" opacity="0.9" />
          </g>

          {/* Cloud Group 2: Left Mid-Level Cloud Puff */}
          <g id="cloud-left-mid" className="cloud-desktop-only">
            <ellipse cx="280" cy="420" rx="90" ry="60" fill="url(#cloudGradSoft)" />
            <ellipse cx="330" cy="390" rx="70" ry="55" fill="url(#cloudGrad)" />
            <ellipse cx="260" cy="380" rx="60" ry="50" fill="#ffffff" opacity="0.9" />
            <ellipse cx="310" cy="360" rx="45" ry="40" fill="#ffffff" opacity="0.95" />
          </g>

          {/* Cloud Group 3: Left Far Horizon Low Bank */}
          <g id="cloud-left-low">
            <ellipse cx="-40" cy="660" rx="180" ry="90" fill="url(#cloudGradWarm)" />
            <ellipse cx="120" cy="670" rx="130" ry="70" fill="url(#cloudGradWarm)" />
            <ellipse cx="250" cy="690" rx="110" ry="60" fill="url(#cloudGradWarm)" />
          </g>

          {/* Cloud Group 4: Right Big Billowy Cumulus */}
          <g id="cloud-right-main">
            <ellipse cx="1820" cy="530" rx="160" ry="110" fill="url(#cloudGrad)" />
            <ellipse cx="1700" cy="570" rx="130" ry="90" fill="url(#cloudGradSoft)" />
            <ellipse cx="1620" cy="620" rx="110" ry="80" fill="url(#cloudGradSoft)" />
            {/* Higher puffy lobes */}
            <ellipse cx="1770" cy="440" rx="100" ry="85" fill="url(#cloudGrad)" />
            <ellipse cx="1690" cy="470" rx="85" ry="75" fill="url(#cloudGrad)" />
            <ellipse cx="1840" cy="410" rx="80" ry="70" fill="#ffffff" opacity="0.95" />
            <ellipse cx="1750" cy="415" rx="65" ry="55" fill="#ffffff" opacity="0.95" />
          </g>

          {/* Cloud Group 5: Right Lower Cloud Bank */}
          <g id="cloud-right-low">
            <ellipse cx="1520" cy="670" rx="120" ry="70" fill="url(#cloudGradWarm)" />
            <ellipse cx="1420" cy="690" rx="100" ry="60" fill="url(#cloudGradWarm)" />
            <ellipse cx="1650" cy="680" rx="140" ry="75" fill="url(#cloudGradWarm)" />
          </g>

          {/* Cloud Group 6: Right High Floating Cloud Puff */}
          <g id="cloud-right-high" className="cloud-desktop-only">
            <ellipse cx="1660" cy="320" rx="85" ry="50" fill="url(#cloudGradSoft)" />
            <ellipse cx="1720" cy="300" rx="65" ry="45" fill="#ffffff" opacity="0.9" />
            <ellipse cx="1620" cy="310" rx="55" ry="40" fill="#ffffff" opacity="0.9" />
          </g>

          {/* Cloud Group 7: Center Distant Cloud Puff (Very gentle, low opacity so center stays open) */}
          <g id="cloud-center-distant" opacity="0.45">
            <ellipse cx="980" cy="680" rx="140" ry="55" fill="url(#cloudGradSoft)" />
            <ellipse cx="1040" cy="660" rx="90" ry="45" fill="#ffffff" opacity="0.8" />
            <ellipse cx="930" cy="665" rx="80" ry="40" fill="#ffffff" opacity="0.8" />
          </g>

          {/* High Wispy Clouds */}
          <g id="cloud-wisps" opacity="0.5" className="cloud-desktop-only">
            <ellipse cx="600" cy="240" rx="90" ry="25" fill="#ffffff" />
            <ellipse cx="680" cy="250" rx="70" ry="20" fill="#ffffff" />
            <ellipse cx="1320" cy="210" rx="110" ry="30" fill="#ffffff" />
            <ellipse cx="1240" cy="220" rx="80" ry="22" fill="#ffffff" />
          </g>
        </g>

        {/* ─── LAYER 5: MOUNTAINS & SHORELINE (Horizon at y ≈ 740) ─── */}
        <g id="mountains">
          {/* Far Mountain Range: Soft Lavender/Purple #c9c2f0 */}
          <path
            d="M 0,742 
               L 0,695
               Q 90,680 180,670 
               T 380,660 
               Q 480,650 580,668 
               T 780,675 
               Q 880,672 980,660 
               T 1180,670 
               Q 1290,680 1390,665 
               T 1580,650 
               Q 1690,642 1780,660 
               T 1920,685 
               L 1920,742 Z"
            fill="#c9c2f0"
            opacity="0.92"
          />

          {/* Mid/Near Mountain Range: Deeper Bluish Violet #7d86c8 */}
          <path
            d="M 0,742 
               L 0,715 
               Q 120,712 240,722 
               T 460,718 
               Q 560,724 660,714 
               T 880,698 
               Q 980,692 1080,705 
               T 1300,718 
               Q 1420,722 1540,712 
               T 1760,704 
               Q 1840,710 1920,708 
               L 1920,742 Z"
            fill="#7d86c8"
          />

          {/* Shoreline Coast Strip: Darker Slate-Violet Accent #5b64a4 */}
          <rect x="0" y="738" width="1920" height="4" fill="#5b64a4" opacity="0.8" />

          {/* Shoreline City Lights: Sparkling warm gold & white points along coast */}
          <g id="city-lights">
            {/* Cluster 1: Left coast (x: 80 - 450) */}
            <circle cx="95" cy="736" r="1.5" fill="#fff7ed" opacity="0.9" />
            <circle cx="120" cy="735" r="1.2" fill="#fef08a" opacity="0.85" />
            <circle cx="145" cy="737" r="1.6" fill="#ffffff" opacity="0.95" />
            <circle cx="180" cy="736" r="1.3" fill="#fed7aa" opacity="0.9" />
            <circle cx="210" cy="738" r="1.8" fill="#ffffff" opacity="0.9" />
            <circle cx="240" cy="735" r="1.1" fill="#fef08a" opacity="0.85" />
            <circle cx="285" cy="737" r="1.5" fill="#fff7ed" opacity="0.95" />
            <circle cx="320" cy="736" r="1.4" fill="#bae6fd" opacity="0.8" />
            <circle cx="370" cy="738" r="1.7" fill="#ffffff" opacity="0.95" />
            <circle cx="410" cy="735" r="1.2" fill="#fed7aa" opacity="0.85" />

            {/* Cluster 2: Center-left (x: 500 - 850) */}
            <circle cx="530" cy="737" r="1.4" fill="#fef08a" opacity="0.9" />
            <circle cx="580" cy="735" r="1.6" fill="#ffffff" opacity="0.95" />
            <circle cx="630" cy="738" r="1.2" fill="#fff7ed" opacity="0.8" />
            <circle cx="690" cy="736" r="1.5" fill="#bae6fd" opacity="0.85" />
            <circle cx="740" cy="737" r="1.7" fill="#ffffff" opacity="0.9" />
            <circle cx="810" cy="735" r="1.3" fill="#fef08a" opacity="0.85" />

            {/* Cluster 3: Center-right town (x: 920 - 1350) */}
            <circle cx="940" cy="737" r="1.6" fill="#ffffff" opacity="0.95" />
            <circle cx="990" cy="735" r="1.3" fill="#fed7aa" opacity="0.85" />
            <circle cx="1040" cy="738" r="1.8" fill="#fef08a" opacity="0.9" />
            <circle cx="1090" cy="736" r="1.2" fill="#ffffff" opacity="0.95" />
            <circle cx="1140" cy="737" r="1.5" fill="#fff7ed" opacity="0.85" />
            <circle cx="1200" cy="735" r="1.4" fill="#bae6fd" opacity="0.8" />
            <circle cx="1260" cy="738" r="1.6" fill="#ffffff" opacity="0.9" />
            <circle cx="1320" cy="736" r="1.3" fill="#fef08a" opacity="0.85" />

            {/* Cluster 4: Far right shore (x: 1400 - 1880) */}
            <circle cx="1420" cy="737" r="1.5" fill="#fff7ed" opacity="0.9" />
            <circle cx="1480" cy="735" r="1.3" fill="#ffffff" opacity="0.85" />
            <circle cx="1540" cy="738" r="1.7" fill="#fed7aa" opacity="0.9" />
            <circle cx="1610" cy="736" r="1.2" fill="#bae6fd" opacity="0.8" />
            <circle cx="1670" cy="737" r="1.6" fill="#ffffff" opacity="0.95" />
            <circle cx="1730" cy="735" r="1.4" fill="#fef08a" opacity="0.85" />
            <circle cx="1800" cy="738" r="1.5" fill="#fff7ed" opacity="0.9" />
            <circle cx="1860" cy="736" r="1.3" fill="#ffffff" opacity="0.85" />
          </g>
        </g>

        {/* ─── LAYER 6: TRANQUIL LAKE REFLECTION (Bottom ~25%, y: 742 -> 1080) ─── */}
        <g id="lake-reflection">
          {/* Base lake water tint */}
          <rect x="0" y="742" width="1920" height="338" fill="#9db1dc" opacity="0.75" />

          {/* Inverted mirror group of sky, clouds, and mountains with water mask */}
          <g 
            transform="translate(0, 1484) scale(1, -1)" 
            mask="url(#waterMask)" 
            opacity="0.7"
            filter="url(#waterBlur)"
          >
            {/* Mirrored Far Mountain */}
            <path
              d="M 0,742 
                 L 0,695
                 Q 90,680 180,670 
                 T 380,660 
                 Q 480,650 580,668 
                 T 780,675 
                 Q 880,672 980,660 
                 T 1180,670 
                 Q 1290,680 1390,665 
                 T 1580,650 
                 Q 1690,642 1780,660 
                 T 1920,685 
                 L 1920,742 Z"
              fill="#c9c2f0"
            />
            {/* Mirrored Near Mountain */}
            <path
              d="M 0,742 
                 L 0,715 
                 Q 120,712 240,722 
                 T 460,718 
                 Q 560,724 660,714 
                 T 880,698 
                 Q 980,692 1080,705 
                 T 1300,718 
                 Q 1420,722 1540,712 
                 T 1760,704 
                 Q 1840,710 1920,708 
                 L 1920,742 Z"
              fill="#7d86c8"
            />
            {/* Mirrored Clouds */}
            <ellipse cx="140" cy="550" rx="140" ry="90" fill="url(#cloudGradWarm)" opacity="0.8" />
            <ellipse cx="1700" cy="570" rx="150" ry="95" fill="url(#cloudGradSoft)" opacity="0.8" />
            <ellipse cx="980" cy="680" rx="140" ry="55" fill="url(#cloudGradSoft)" opacity="0.6" />
          </g>

          {/* Water Surface Haze & Gradient Overlay */}
          <rect 
            x="0" 
            y="742" 
            width="1920" 
            height="338" 
            fill="url(#skyGrad)" 
            opacity="0.32" 
            style={{ mixBlendMode: 'soft-light' }} 
          />

          {/* Delicate Horizontal Water Shimmer Ripples */}
          <g id="water-ripples" opacity="0.6">
            <line x1="100" y1="755" x2="380" y2="755" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.45" strokeDasharray="40 15 20 10" />
            <line x1="550" y1="765" x2="950" y2="765" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="60 25 35 15" />
            <line x1="1200" y1="760" x2="1650" y2="760" stroke="#ffffff" strokeWidth="1.3" strokeOpacity="0.4" strokeDasharray="50 20 30 15" />

            <line x1="50" y1="790" x2="520" y2="790" stroke="#ffffff" strokeWidth="1.4" strokeOpacity="0.4" strokeDasharray="70 30 40 20" />
            <line x1="720" y1="800" x2="1280" y2="800" stroke="#ffffff" strokeWidth="1.6" strokeOpacity="0.45" strokeDasharray="80 35 50 25" />
            <line x1="1450" y1="795" x2="1880" y2="795" stroke="#ffffff" strokeWidth="1.4" strokeOpacity="0.4" strokeDasharray="65 25 45 20" />

            <line x1="200" y1="845" x2="800" y2="845" stroke="#ffffff" strokeWidth="1.8" strokeOpacity="0.35" strokeDasharray="100 45 60 30" />
            <line x1="1050" y1="855" x2="1750" y2="855" stroke="#ffffff" strokeWidth="1.7" strokeOpacity="0.35" strokeDasharray="90 40 50 25" />

            <line x1="100" y1="920" x2="950" y2="920" stroke="#ffffff" strokeWidth="2.2" strokeOpacity="0.25" strokeDasharray="140 60 80 40" />
            <line x1="1100" y1="935" x2="1850" y2="935" stroke="#ffffff" strokeWidth="2.0" strokeOpacity="0.25" strokeDasharray="120 50 70 35" />

            <line x1="300" y1="1010" x2="1600" y2="1010" stroke="#ffffff" strokeWidth="2.5" strokeOpacity="0.2" strokeDasharray="180 80 120 50" />
          </g>
        </g>
      </svg>
    </div>
  );
}
