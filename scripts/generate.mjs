// Generates the SVGs used by README.md. Run nightly by .github/workflows/update-profile.yml
// Local test with fake data:  MOCK=1 GH_USER=yourname node scripts/generate.mjs
import fs from "node:fs";

// ───────────── EDIT THIS ─────────────
const CONFIG = {
  displayName: "Jhmeel",
  initial: "J",
  tagline: "Senior AI/ML engineer building intelligent systems that ship.",
  badge: "@jhmeel_", // orange tilted tag, top-right of banner ("" to hide)
  tags: [
    { text: "machine learning", fill: "#2c4f94" },
    { text: "LLMs & agents", fill: "#a8661f" },
    { text: "MLOps", fill: "#5a3f9a" },
    { text: "AI infrastructure", fill: "#8a3a45" },
  ],
  socials: [
    { id: "instagram", text: "Instagram  @jhmeel_", fill: "#c2324f" },
    { id: "linkedin", text: "LinkedIn", fill: "#1f5f99" },
    { id: "github", text: "GitHub", fill: "#2b3150" },
  ],
};
// ─────────────────────────────────────

const USER = process.env.GH_USER || process.env.GITHUB_REPOSITORY_OWNER;
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const MOCK = !!process.env.MOCK;
const OUT = "assets";
fs.mkdirSync(OUT, { recursive: true });

const SANS = `'Trebuchet MS','Segoe UI',Verdana,sans-serif`;
const MONO = `'SFMono-Regular',Consolas,'Liberation Mono',monospace`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const iso = (d) => d.toISOString().slice(0, 10);
const fmt = (n) => n.toLocaleString("en-US");
const dm = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const write = (name, svg) => fs.writeFileSync(`${OUT}/${name}`, svg);

// ───────────── data ─────────────
async function gql(query, variables) {
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

async function loadData() {
  if (MOCK) {
    const days = new Map();
    const start = new Date(Date.now() - 365 * 6 * 864e5);
    for (let d = new Date(start); d <= new Date(); d = new Date(+d + 864e5)) {
      days.set(iso(d), Math.random() < 0.25 ? 0 : Math.floor(Math.random() ** 2 * 60));
    }
    return { days, repos: 21, stars: 15, downloads: 159 };
  }
  const u = await gql(
    `query($u:String!){user(login:$u){contributionsCollection{contributionYears}}}`,
    { u: USER }
  );
  const years = u.user.contributionsCollection.contributionYears;
  const days = new Map();
  for (const y of years) {
    const d = await gql(
      `query($u:String!,$f:DateTime!,$t:DateTime!){user(login:$u){contributionsCollection(from:$f,to:$t){contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`,
      { u: USER, f: `${y}-01-01T00:00:00Z`, t: `${y}-12-31T23:59:59Z` }
    );
    for (const w of d.user.contributionsCollection.contributionCalendar.weeks)
      for (const c of w.contributionDays) days.set(c.date, c.contributionCount);
  }
  let repos = 0, stars = 0, after = null, names = [];
  for (;;) {
    const r = await gql(
      `query($u:String!,$a:String){user(login:$u){repositories(ownerAffiliations:OWNER,privacy:PUBLIC,isFork:false,first:100,after:$a){pageInfo{hasNextPage endCursor} nodes{name stargazerCount}}}}`,
      { u: USER, a: after }
    );
    const rp = r.user.repositories;
    for (const n of rp.nodes) { repos++; stars += n.stargazerCount; names.push(n.name); }
    if (!rp.pageInfo.hasNextPage) break;
    after = rp.pageInfo.endCursor;
  }
  let downloads = 0;
  for (const n of names) {
    try {
      const r = await fetch(`https://api.github.com/repos/${USER}/${n}/releases?per_page=100`, {
        headers: { Authorization: `bearer ${TOKEN}` },
      });
      if (!r.ok) continue;
      for (const rel of await r.json()) for (const a of rel.assets || []) downloads += a.download_count;
    } catch {}
  }
  return { days, repos, stars, downloads };
}

// ───────────── drawing helpers ─────────────
const defs = `<defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#2a3158"/></pattern></defs>`;
const panel = (w, h, inner, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}
<rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="22" fill="#12162b" stroke="#252c52" stroke-width="2"/>
<rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="22" fill="url(#dots)"/>${extra}${inner}</svg>`;

const pill = (x, y, text, fill, size = 13) => {
  const tw = Math.round(text.length * size * 0.6);
  const w = tw + 26, h = size + 14;
  return {
    w,
    svg: `<rect x="${x}" y="${y + 3}" width="${w}" height="${h}" rx="8" fill="#0a0d1c"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="#ffffff22"/>
<text x="${x + 13}" y="${y + h / 2 + size * 0.36}" font-family="${SANS}" font-weight="700" font-size="${size}" fill="#fff" textLength="${tw}" lengthAdjust="spacingAndGlyphs">${esc(text)}</text>`,
  };
};

// ───────────── static: header + socials ─────────────
function header() {
  const name = CONFIG.displayName;
  const hiW = 190, nameW = Math.round(name.length * 29);
  let x = 175 + hiW + 16;
  const tags = [];
  let tx = 175;
  for (const t of CONFIG.tags) {
    const p = pill(tx, 160, t.text, t.fill, 12);
    tags.push(p.svg);
    tx += p.w + 12;
  }
  const badge = CONFIG.badge
    ? (() => {
        const tw = Math.round(CONFIG.badge.length * 14 * 0.6), w = tw + 30;
        return `<g transform="translate(${760 - w} 34) rotate(3 ${w / 2} 18)"><rect x="0" y="5" width="${w}" height="38" rx="8" fill="#7a3a12"/><rect width="${w}" height="38" rx="8" fill="#f08a3c"/><text x="15" y="25" font-family="${SANS}" font-weight="800" font-size="14" fill="#2a1406" textLength="${tw}" lengthAdjust="spacingAndGlyphs">${esc(CONFIG.badge)}</text></g>`;
      })()
    : "";
  const inner = `
<rect x="52" y="76" width="100" height="100" rx="24" fill="#c8571c"/>
<rect x="48" y="70" width="100" height="100" rx="24" fill="#f4eedf" stroke="#1b1f33" stroke-width="5"/>
<text x="98" y="140" text-anchor="middle" font-family="${SANS}" font-weight="900" font-size="72" fill="#1b1f33">${esc(CONFIG.initial)}</text>
<text x="175" y="118" font-family="${SANS}" font-weight="800" font-size="46" fill="#fff" textLength="${hiW}" lengthAdjust="spacingAndGlyphs">Hi, I'm</text>
<rect x="${x - 10}" y="76" width="${nameW + 20}" height="58" rx="10" fill="#8a3a45"/>
<text x="${x}" y="119" font-family="${SANS}" font-weight="800" font-size="46" fill="#fff" textLength="${nameW}" lengthAdjust="spacingAndGlyphs">${esc(name)}</text>
<text x="175" y="152" font-family="${SANS}" font-weight="600" font-size="16" fill="#e8ebff">${esc(CONFIG.tagline)}</text>
${tags.join("\n")}${badge}`;
  write("header.svg", panel(800, 230, inner));
}

function socials() {
  for (const s of CONFIG.socials) {
    const p = pill(4, 2, s.text, s.fill, 14);
    write(
      `social-${s.id}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w + 8}" height="42" viewBox="0 0 ${p.w + 8} 42">${p.svg}</svg>`
    );
  }
}

// ───────────── stats ─────────────
function streaks(days) {
  const all = [...days.keys()].sort();
  const first = new Date(all[0] + "T00:00:00Z");
  const today = new Date(iso(new Date()) + "T00:00:00Z");
  let longest = 0, run = 0;
  for (let d = first; d <= today; d = new Date(+d + 864e5)) {
    if ((days.get(iso(d)) || 0) > 0) { run++; longest = Math.max(longest, run); } else run = 0;
  }
  let d = new Date(today);
  if ((days.get(iso(d)) || 0) === 0) d = new Date(+d - 864e5); // today not done yet
  let cur = 0, since = null;
  while ((days.get(iso(d)) || 0) > 0) { cur++; since = new Date(d); d = new Date(+d - 864e5); }
  return { cur, longest, since };
}

function stats({ days, repos, stars, downloads }) {
  const today = new Date();
  const yearAgo = iso(new Date(+today - 365 * 864e5));
  let lastYear = 0, total = 0;
  for (const [d, c] of days) { total += c; if (d >= yearAgo) lastYear += c; }
  const { cur, longest, since } = streaks(days);
  const firstYear = [...days.keys()].sort()[0].slice(0, 4);

  const card = (x, y, w, h, fill, shadow, icon, big, lines, bigSize = 34) => `
<rect x="${x}" y="${y + 6}" width="${w}" height="${h}" rx="16" fill="${shadow}"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}" stroke="#ffffff26" stroke-width="2"/>
<text x="${x + w - 16}" y="${y + 28}" text-anchor="end" font-size="18">${icon}</text>
<text x="${x + 16}" y="${y + 52}" font-family="${SANS}" font-weight="800" font-size="${bigSize}" fill="#fff">${esc(big)}</text>
${lines.map((l, i) => `<text x="${x + 16}" y="${y + 74 + i * 16}" font-family="${MONO}" font-size="12" fill="#ffffffcc">${esc(l)}</text>`).join("")}`;

  const w1 = 178, g = 12, x0 = 26, y1 = 74;
  const row1 = [
    ["#2a4f94", "#17294f", "📅", fmt(lastYear), ["contributions in", "the last year"]],
    ["#2f6b46", "#173a26", "🔥", `${cur} days`, ["current streak,", since ? `since ${dm(since)}` : "start today"]],
    ["#8a5a22", "#4a3010", "🏆", `${longest} days`, ["longest streak", "ever"]],
    ["#5a3f9a", "#2f2056", "📊", fmt(total), ["contributions", `since ${firstYear}`]],
  ]
    .map((c, i) => card(x0 + i * (w1 + g), y1, w1, 100, c[0], c[1], c[2], c[3], c[4]))
    .join("");

  const w2 = Math.floor((748 - 2 * g) / 3), y2 = 196;
  const mini = (i, fill, sh, icon, big, label) => {
    const x = x0 + i * (w2 + g);
    return `<rect x="${x}" y="${y2 + 5}" width="${w2}" height="52" rx="14" fill="${sh}"/>
<rect x="${x}" y="${y2}" width="${w2}" height="52" rx="14" fill="${fill}" stroke="#ffffff26" stroke-width="2"/>
<text x="${x + 18}" y="${y2 + 34}" font-size="20">${icon}</text>
<text x="${x + 50}" y="${y2 + 35}" font-family="${SANS}" font-weight="800" font-size="26" fill="#fff">${esc(big)}</text>
<text x="${x + 50 + String(big).length * 15 + 10}" y="${y2 + 34}" font-family="${MONO}" font-size="12" fill="#ffffffcc">${esc(label)}</text>`;
  };
  const row2 =
    mini(0, "#25686a", "#123a3b", "📁", fmt(repos), "public repos") +
    mini(1, "#8a3a45", "#4a1d25", "⭐", fmt(stars), "stars earned") +
    mini(2, "#2f7a4a", "#173f26", "⬇️", fmt(downloads), "release downloads");

  const inner = `
<text x="30" y="52" font-family="${SANS}" font-weight="800" font-size="24" fill="#fff">On GitHub</text>
<text x="770" y="50" text-anchor="end" font-family="${MONO}" font-size="12" fill="#c5cae9">redrawn every night · ${dm(today)} ${today.getUTCFullYear()}</text>
${row1}${row2}`;
  write("stats.svg", panel(800, 280, inner));
}

// ───────────── heatmap ─────────────
function heatmap({ days }) {
  const today = new Date(iso(new Date()) + "T00:00:00Z");
  let start = new Date(+today - 182 * 864e5);
  start = new Date(+start - start.getUTCDay() * 864e5); // back to Sunday
  const weeks = Math.floor((+today - +start) / (7 * 864e5)) + 1;
  const W = 800, padX = 30, gap = 3;
  const cell = Math.floor((W - padX * 2 - 20 - gap * (weeks - 1)) / weeks);
  const gridW = weeks * (cell + gap) - gap;
  const gx = (W - gridW) / 2, gy = 100;
  const H = gy + 7 * (cell + gap) + 70;

  let max = 1, sum = 0;
  const halfYear = iso(new Date(+today - 182 * 864e5));
  for (const [d, c] of days) if (d >= halfYear) { max = Math.max(max, c); sum += c; }
  const colors = ["#2a3a3c", "#2e6b46", "#3a8a52", "#4aa564", "#74d48f"];
  const level = (c) => (c === 0 ? 0 : Math.min(4, Math.ceil((4 * c) / max)));

  let cells = "", months = "", lastM = -1;
  for (let wk = 0; wk < weeks; wk++) {
    const sun = new Date(+start + wk * 7 * 864e5);
    const m = sun.getUTCMonth();
    if (m !== lastM && (wk > 0 || sun.getUTCDate() <= 7)) {
      months += `<text x="${gx + wk * (cell + gap)}" y="${gy - 10}" font-family="${MONO}" font-size="12" fill="#c5cae9">${sun.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</text>`;
    }
    lastM = m;
    for (let r = 0; r < 7; r++) {
      const d = new Date(+sun + r * 864e5);
      if (d > today) continue;
      const c = days.get(iso(d)) || 0;
      const l = level(c);
      const x = gx + wk * (cell + gap), y = gy + r * (cell + gap);
      cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="4" fill="${colors[l]}"/><text x="${x + cell / 2}" y="${y + cell / 2 + 3.5}" text-anchor="middle" font-family="${MONO}" font-size="${cell > 22 ? 11 : 9}" font-weight="700" fill="${l === 4 ? "#0d2416" : l === 0 ? "#6b7a7c" : "#eafff0"}">${c}</text>`;
    }
  }
  const lx = W - 50 - 5 * 18;
  const legend = colors.map((c, i) => `<rect x="${lx + i * 18}" y="${H - 44}" width="14" height="14" rx="3" fill="${c}"/>`).join("");
  const inner = `
<rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="16" fill="#0e1124" stroke="#252c52" stroke-width="2"/>
<text x="${gx}" y="60" font-family="${SANS}" font-weight="800" font-size="20" fill="#fff">${fmt(sum)}<tspan font-family="${MONO}" font-weight="400" font-size="15" fill="#e0e4ff"> contributions in the last 6 months</tspan></text>
${months}${cells}
<text x="${gx}" y="${H - 32}" font-family="${MONO}" font-size="12" fill="#c5cae9">contributions per day</text>
<text x="${lx - 8}" y="${H - 32}" text-anchor="end" font-family="${MONO}" font-size="12" fill="#c5cae9">Less</text>${legend}
<text x="${lx + 5 * 18 + 4}" y="${H - 32}" font-family="${MONO}" font-size="12" fill="#c5cae9">More</text>`;
  write("heatmap.svg", panel(W, H, inner));
}

// ───────────── run ─────────────
header();
socials();
if (!USER && !MOCK) throw new Error("Set GH_USER (the workflow does this for you).");
const data = await loadData();
stats(data);
heatmap(data);
console.log("SVGs written to ./assets");
