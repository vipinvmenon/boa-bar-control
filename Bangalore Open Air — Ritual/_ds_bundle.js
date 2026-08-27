/* @ds-bundle: {"format":4,"namespace":"BangaloreOpenAirRitual_1f354d","components":[{"name":"CTAButton","sourcePath":"components/actions/CTAButton.jsx"},{"name":"PriceSticker","sourcePath":"components/actions/PriceSticker.jsx"},{"name":"TicketBadge","sourcePath":"components/actions/TicketBadge.jsx"},{"name":"DateVenueBar","sourcePath":"components/content/DateVenueBar.jsx"},{"name":"HeadlineBlock","sourcePath":"components/content/HeadlineBlock.jsx"},{"name":"LineupBlock","sourcePath":"components/content/LineupBlock.jsx"},{"name":"SponsorStrip","sourcePath":"components/content/SponsorStrip.jsx"},{"name":"LogoLockup","sourcePath":"components/marks/LogoLockup.jsx"},{"name":"Motif","sourcePath":"components/marks/Motif.jsx"}],"sourceHashes":{"components/actions/CTAButton.jsx":"c2d382229712","components/actions/PriceSticker.jsx":"51fbe671bf0d","components/actions/TicketBadge.jsx":"2175f19fb170","components/content/DateVenueBar.jsx":"c9c59f063e1f","components/content/HeadlineBlock.jsx":"be0fa9b1276b","components/content/LineupBlock.jsx":"bd1833675ded","components/content/SponsorStrip.jsx":"4307ec5a232e","components/marks/LogoLockup.jsx":"c8a50a6fae78","components/marks/Motif.jsx":"8a8e7b75fd3d"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.BangaloreOpenAirRitual_1f354d = window.BangaloreOpenAirRitual_1f354d || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/actions/CTAButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * CTAButton — primary: ritual-gold fill / ink-black text. ghost: poison-green outline.
 * Condensed uppercase caps. Sharp corners with a subtle glow.
 */
function CTAButton({
  children,
  variant = 'primary',
  // 'primary' | 'ghost' | 'green'
  size = 'md',
  // 'sm' | 'md' | 'lg'
  as = 'button',
  style,
  ...rest
}) {
  const pad = {
    sm: '8px 16px',
    md: '13px 26px',
    lg: '18px 40px'
  }[size];
  const fs = {
    sm: '13px',
    md: '15px',
    lg: '19px'
  }[size];
  const variants = {
    primary: {
      background: 'var(--ritual-gold)',
      color: 'var(--ink-black)',
      border: '1.5px solid var(--deep-gold)',
      boxShadow: 'var(--glow-gold-sm)'
    },
    green: {
      background: 'var(--poison-green)',
      color: 'var(--ink-black)',
      border: '1.5px solid var(--venom-green)',
      boxShadow: 'var(--glow-green-md)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--poison-green)',
      border: '2px solid var(--poison-green)',
      boxShadow: 'inset 0 0 0 rgba(0,0,0,0), var(--glow-green-sm)'
    }
  };
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--sp-2)',
      padding: pad,
      fontFamily: 'var(--font-condensed)',
      fontWeight: 700,
      fontSize: fs,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      textDecoration: 'none',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      transition: 'transform var(--dur-fast) var(--ease-ritual), filter var(--dur-fast) var(--ease-ritual)',
      ...variants[variant],
      ...style
    },
    onMouseDown: e => e.currentTarget.style.transform = 'translateY(1px) scale(0.99)',
    onMouseUp: e => e.currentTarget.style.transform = 'none',
    onMouseLeave: e => e.currentTarget.style.transform = 'none'
  }, rest), children);
}
Object.assign(__ds_scope, { CTAButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/CTAButton.jsx", error: String((e && e.message) || e) }); }

// components/actions/PriceSticker.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * PriceSticker — an urgency stamp for the Phase-2 price step ("PRICE RISES SOON").
 * Rotated wax-seal look with a hard drop shadow. Green or gold tone.
 */
function PriceSticker({
  kicker = 'Price Rises Soon',
  price,
  // e.g. '₹2,499'
  strike,
  // e.g. '₹1,999' old price shown struck
  tone = 'green',
  // 'green' | 'gold'
  rotate = -8,
  style,
  ...rest
}) {
  const bg = tone === 'gold' ? 'var(--ritual-gold)' : 'var(--poison-green)';
  const glow = tone === 'gold' ? 'var(--glow-gold-sm)' : 'var(--glow-green-md)';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px',
      padding: '12px 20px',
      background: bg,
      color: 'var(--ink-black)',
      border: '2px solid var(--ink-black)',
      borderRadius: 'var(--radius-sm)',
      boxShadow: `var(--shadow-sticker), ${glow}`,
      transform: `rotate(${rotate}deg)`,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-eyebrow)',
      fontSize: '12px',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      lineHeight: 1.1,
      textAlign: 'center'
    }
  }, kicker), price && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: '8px'
    }
  }, strike && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-condensed)',
      fontWeight: 600,
      fontSize: '15px',
      textDecoration: 'line-through',
      opacity: 0.6
    }
  }, strike), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-headline)',
      fontSize: '30px',
      letterSpacing: '0.02em',
      lineHeight: 1
    }
  }, price)));
}
Object.assign(__ds_scope, { PriceSticker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/PriceSticker.jsx", error: String((e && e.message) || e) }); }

// components/actions/TicketBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * TicketBadge — a ticket-tier pill (Headbangers Pass, Combo, Eddies Lounge, …).
 * tone: 'green' (standard), 'gold' (premium/headliner), 'ghost' (sold-out / muted).
 */
function TicketBadge({
  tier,
  price,
  tone = 'green',
  // 'green' | 'gold' | 'ghost'
  soldOut = false,
  style,
  ...rest
}) {
  const tones = {
    green: {
      border: 'var(--poison-green)',
      text: 'var(--poison-green)',
      glow: 'var(--glow-green-sm)'
    },
    gold: {
      border: 'var(--ritual-gold)',
      text: 'var(--ritual-gold)',
      glow: 'var(--glow-gold-sm)'
    },
    ghost: {
      border: 'var(--line-hairline)',
      text: 'var(--sage-bone)',
      glow: 'none'
    }
  };
  const t = soldOut ? tones.ghost : tones[tone];
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--sp-3)',
      padding: '8px 16px',
      background: 'var(--surface-sunken)',
      border: `1.5px solid ${t.border}`,
      borderRadius: 'var(--radius-pill)',
      boxShadow: t.glow,
      opacity: soldOut ? 0.6 : 1,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-condensed)',
      fontWeight: 700,
      fontSize: '14px',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: t.text,
      textDecoration: soldOut ? 'line-through' : 'none'
    }
  }, tier), price && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-condensed)',
      fontWeight: 600,
      fontSize: '13px',
      color: 'var(--bone-white)',
      paddingLeft: 'var(--sp-3)',
      borderLeft: '1px solid var(--line-hairline)'
    }
  }, soldOut ? 'Sold Out' : price));
}
Object.assign(__ds_scope, { TicketBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/TicketBadge.jsx", error: String((e && e.message) || e) }); }

// components/content/DateVenueBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * DateVenueBar — the gold data line: bold condensed caps, pipe separators.
 * e.g. SATURDAY | 10TH OCTOBER 2026 | BENGALURU, INDIA
 */
function DateVenueBar({
  items = [],
  align = 'center',
  bordered = true,
  // hairline rules top & bottom
  glow = true,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: align === 'center' ? 'center' : 'flex-start',
      alignItems: 'center',
      gap: 'var(--sp-3)',
      padding: bordered ? 'var(--sp-3) 0' : 0,
      borderTop: bordered ? '1.5px solid var(--line-gold)' : 'none',
      borderBottom: bordered ? '1.5px solid var(--line-gold)' : 'none',
      ...style
    }
  }, rest), items.map((it, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--deep-gold)',
      fontFamily: 'var(--font-condensed)',
      fontSize: '18px'
    }
  }, "|"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-condensed)',
      fontWeight: 700,
      fontSize: 'clamp(14px,1.9vw,20px)',
      letterSpacing: 'var(--tr-data)',
      textTransform: 'uppercase',
      color: 'var(--ritual-gold)',
      textShadow: glow ? 'var(--glow-gold-text)' : 'none'
    }
  }, it))));
}
Object.assign(__ds_scope, { DateVenueBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/DateVenueBar.jsx", error: String((e && e.message) || e) }); }

// components/content/HeadlineBlock.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * HeadlineBlock — eyebrow + condensed headline + subhead. The core message unit
 * for ads. Headline in bone-white (or gold when `accent`), eyebrow in poison-green.
 */
function HeadlineBlock({
  eyebrow,
  headline,
  subhead,
  accent = false,
  // headline in ritual-gold instead of bone-white
  align = 'left',
  // 'left' | 'center'
  size = 'md',
  // 'sm' | 'md' | 'lg'
  style,
  ...rest
}) {
  const hlSize = {
    sm: 'clamp(28px,5vw,40px)',
    md: 'clamp(40px,7vw,64px)',
    lg: 'clamp(52px,9vw,88px)'
  }[size];
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--sp-3)',
      alignItems: align === 'center' ? 'center' : 'flex-start',
      textAlign: align,
      ...style
    }
  }, rest), eyebrow && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-condensed)',
      fontWeight: 700,
      fontSize: 'var(--fs-small)',
      letterSpacing: '0.24em',
      textTransform: 'uppercase',
      color: 'var(--poison-green)',
      textShadow: 'var(--glow-green-sm)'
    }
  }, eyebrow), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-headline)',
      fontSize: hlSize,
      lineHeight: 'var(--lh-tight)',
      letterSpacing: 'var(--tr-headline)',
      textTransform: 'uppercase',
      color: accent ? 'var(--ritual-gold)' : 'var(--bone-white)',
      textShadow: accent ? 'var(--glow-gold-text)' : 'none',
      textWrap: 'balance'
    }
  }, headline), subhead && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--fs-body)',
      lineHeight: 'var(--lh-body)',
      color: 'var(--text-body)',
      maxWidth: '46ch',
      textWrap: 'pretty'
    }
  }, subhead));
}
Object.assign(__ds_scope, { HeadlineBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/HeadlineBlock.jsx", error: String((e && e.message) || e) }); }

// components/content/LineupBlock.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * LineupBlock — festival bill. Headliners emphasised in ritual-gold, supports in
 * bone-white/sage-bone. Pass artists as an array of { name, tier }.
 * tier: 'headliner' | 'support' | 'special'.
 */
function LineupBlock({
  artists = [],
  align = 'center',
  columns = 1,
  // wrap supports into N columns
  style,
  ...rest
}) {
  const headliners = artists.filter(a => a.tier === 'headliner');
  const specials = artists.filter(a => a.tier === 'special');
  const supports = artists.filter(a => !a.tier || a.tier === 'support');
  const wrapAlign = align === 'center' ? 'center' : 'flex-start';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--sp-5)',
      alignItems: wrapAlign,
      textAlign: align,
      ...style
    }
  }, rest), headliners.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--sp-2)',
      alignItems: wrapAlign
    }
  }, headliners.map((a, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontFamily: 'var(--font-headline)',
      fontSize: 'clamp(32px,6vw,56px)',
      lineHeight: 0.98,
      textTransform: 'uppercase',
      letterSpacing: 'var(--tr-headline)',
      color: 'var(--ritual-gold)',
      textShadow: 'var(--glow-gold-text)'
    }
  }, a.name))), specials.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0 var(--sp-4)',
      justifyContent: wrapAlign
    }
  }, specials.map((a, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontFamily: 'var(--font-condensed)',
      fontWeight: 700,
      fontSize: 'clamp(18px,2.6vw,26px)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--poison-green)'
    }
  }, a.name))), supports.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, auto)`,
      gap: 'var(--sp-2) var(--sp-5)',
      justifyContent: wrapAlign
    }
  }, supports.map((a, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontFamily: 'var(--font-condensed)',
      fontWeight: 600,
      fontSize: 'clamp(15px,2vw,20px)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: 'var(--bone-white)'
    }
  }, a.name))));
}
Object.assign(__ds_scope, { LineupBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/LineupBlock.jsx", error: String((e && e.message) || e) }); }

// components/content/SponsorStrip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * SponsorStrip — partner logos/names on ink, equal optical weight. Renders text
 * names by default; pass `logos` (array of {src, alt}) to use real logo images
 * (preserve each partner's native lockup — don't recolour).
 */
function SponsorStrip({
  label = 'Presented with',
  sponsors = [],
  // string[] fallback names
  logos = null,
  // [{ src, alt, height }]
  align = 'center',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: align === 'center' ? 'center' : 'flex-start',
      gap: 'var(--sp-3)',
      ...style
    }
  }, rest), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-condensed)',
      fontWeight: 600,
      fontSize: 'var(--fs-caption)',
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: 'var(--sage-bone)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: align === 'center' ? 'center' : 'flex-start',
      gap: 'var(--sp-4) var(--sp-6)'
    }
  }, logos ? logos.map((l, i) => /*#__PURE__*/React.createElement("img", {
    key: i,
    src: l.src,
    alt: l.alt,
    style: {
      height: l.height || 26,
      opacity: 0.92,
      filter: 'grayscale(1) brightness(1.4)'
    }
  })) : sponsors.map((s, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontFamily: 'var(--font-condensed)',
      fontWeight: 700,
      fontSize: 'clamp(13px,1.6vw,17px)',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: 'var(--bone-white)',
      opacity: 0.85
    }
  }, s))));
}
Object.assign(__ds_scope, { SponsorStrip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/SponsorStrip.jsx", error: String((e && e.message) || e) }); }

// components/marks/LogoLockup.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * LogoLockup — the OFFICIAL Bangalore Open Air logo (spiky green-glow wordmark + OPEN AIR).
 * Renders the supplied PNG artwork. Pass `src` with the correct relative path from the
 * consuming page (defaults to a root-level 'assets/boa-logo-2026.png').
 */
function LogoLockup({
  src = 'assets/boa-logo-2026.png',
  size = 'md',
  // 'sm' | 'md' | 'lg'
  variant = 'full',
  // 'full' | 'mono' (mono = desaturated bone-white, for busy photos)
  glow = true,
  style,
  ...rest
}) {
  const width = {
    sm: 220,
    md: 380,
    lg: 560
  }[size] ?? 380;
  const mono = variant === 'mono';
  const filter = [glow && !mono ? 'drop-shadow(0 0 16px rgba(0,245,165,0.45))' : '', mono ? 'grayscale(1) brightness(1.7) contrast(1.05)' : ''].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("img", _extends({
    src: src,
    alt: "Bangalore Open Air",
    style: {
      width,
      height: 'auto',
      filter: filter || 'none',
      display: 'block',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { LogoLockup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marks/LogoLockup.jsx", error: String((e && e.message) || e) }); }

// components/marks/Motif.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Motif — drop-in ritual atmosphere layer: green aura, grain/halftone texture,
 * and a bottom venom-wash. Place BEHIND or OVER hero content (position it absolutely
 * and let it fill its container). Purely decorative; aria-hidden.
 */
function Motif({
  aura = true,
  // radial green glow
  texture = 'grain',
  // 'grain' | 'halftone' | 'none'
  wash = false,
  // bottom venom->ink protection wash (over photos)
  intensity = 1,
  // 0..1 multiplier on aura opacity
  style,
  ...rest
}) {
  const texBg = texture === 'halftone' ? {
    backgroundImage: 'var(--texture-halftone)',
    backgroundSize: 'var(--texture-halftone-size)'
  } : texture === 'grain' ? {
    backgroundImage: 'var(--texture-grain)',
    backgroundSize: 'var(--texture-grain-size)'
  } : {};
  return /*#__PURE__*/React.createElement("div", _extends({
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      ...style
    }
  }, rest), aura && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--bg-aura)',
      opacity: intensity
    }
  }), texture !== 'none' && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      ...texBg
    }
  }), wash && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--bg-venom-wash)'
    }
  }));
}
Object.assign(__ds_scope, { Motif });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marks/Motif.jsx", error: String((e && e.message) || e) }); }

__ds_ns.CTAButton = __ds_scope.CTAButton;

__ds_ns.PriceSticker = __ds_scope.PriceSticker;

__ds_ns.TicketBadge = __ds_scope.TicketBadge;

__ds_ns.DateVenueBar = __ds_scope.DateVenueBar;

__ds_ns.HeadlineBlock = __ds_scope.HeadlineBlock;

__ds_ns.LineupBlock = __ds_scope.LineupBlock;

__ds_ns.SponsorStrip = __ds_scope.SponsorStrip;

__ds_ns.LogoLockup = __ds_scope.LogoLockup;

__ds_ns.Motif = __ds_scope.Motif;

})();
