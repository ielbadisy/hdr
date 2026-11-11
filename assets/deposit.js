// Metadata builder for the deposit page. Everything runs in the browser:
// CSV files are read locally (header line only) and nothing is uploaded.
(function () {
  const form = document.getElementById("builder");
  if (!form) return;
  const out = document.getElementById("yaml-out");
  const list = document.getElementById("checklist");
  const varsBox = document.getElementById("vars");
  const files = []; // {name, rows, cols: [{name, desc}]}

  const q = s => JSON.stringify(String(s ?? ""));          // JSON strings are valid YAML
  const val = n => (form.elements[n].value || "").trim();
  const lines = n => val(n).split("\n").map(s => s.trim()).filter(Boolean);
  const csvList = n => val(n).split(",").map(s => s.trim()).filter(Boolean);
  const slugify = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

  function splitCsvLine(line) {
    const out = []; let cur = "", inq = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inq) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') inq = false; else cur += c; }
      else if (c === '"') inq = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur); return out.map(s => s.trim());
  }

  form.elements.csv.addEventListener("change", async e => {
    files.length = 0;
    for (const f of e.target.files) {
      const text = await f.slice(0, 1 << 20).text();
      const all = text.split(/\r?\n/).filter(Boolean);
      files.push({ name: f.name, rows: f.size > (1 << 20) ? null : all.length - 1,
                   desc: "", cols: splitCsvLine(all[0] || "").map(c => ({ name: c, type: "", desc: "" })) });
    }
    renderVars(); update();
  });

  function renderVars() {
    varsBox.innerHTML = files.map((f, i) => `
      <div class="var-file">
        <div class="var-head"><code>${f.name}</code> ${f.rows != null ? `<span>${f.rows.toLocaleString()} rows</span>` : ""} <span>${f.cols.length} columns</span></div>
        <input data-f="${i}" data-k="desc" placeholder="What one row of this file is">
        <table class="var-table"><thead><tr><th>Column</th><th>Type</th><th>Description •</th></tr></thead><tbody>
        ${f.cols.map((c, j) => `<tr><td><code>${c.name}</code></td>
          <td><select data-f="${i}" data-c="${j}" data-k="type"><option></option><option>integer</option><option>number</option><option>string</option><option>date</option><option>boolean</option></select></td>
          <td><input data-f="${i}" data-c="${j}" data-k="desc" placeholder="Meaning, unit, missing codes"></td></tr>`).join("")}
        </tbody></table></div>`).join("");
  }

  varsBox.addEventListener("input", e => {
    const t = e.target, f = files[+t.dataset.f];
    if (!f) return;
    if (t.dataset.c != null) f.cols[+t.dataset.c][t.dataset.k] = t.value.trim();
    else f[t.dataset.k] = t.value.trim();
    update();
  });
  form.addEventListener("input", update);

  function checks() {
    const url = val("ourl");
    const allDescribed = files.length && files.every(f => f.cols.every(c => c.desc));
    return [
      ["Title and abstract", val("title") && val("abstract").length >= 50],
      ["At least one creator", lines("creators").length > 0],
      ["R1 · Organisation of origin", !!val("oorg")],
      ["R1 · Publication, survey, registry or study", !!val("otitle")],
      ["R1 · Checkable address (URL or DOI)", /^(https?:\/\/|10\.)/.test(url)],
      ["R1 · Country of origin (ISO code)", /^[A-Z]{3}$/.test(val("ocountry").toUpperCase())],
      ["R1 · How the data were obtained", !!val("ohow")],
      ["R3 · Reuse terms of the origin", !!val("oterms")],
      ["R5 · At least one CSV file", files.length > 0],
      ["R6 · Every column described", !!allDescribed],
      ["R9 · Known issues or checks listed", lines("issues").length + lines("checks").length > 0]
    ];
  }

  function yaml() {
    const title = val("title");
    const Y = [];
    Y.push("# HDR deposit metadata, written by the builder at hdr.example.org/deposit",
      "id: \"\"                 # assigned by HDR", `slug: ${q(slugify(title))}`,
      `title: ${q(title)}`, 'version: "1.0.0"', `date: ${new Date().toISOString().slice(0, 10)}`,
      "status: draft", 'doi: ""', `abstract: ${q(val("abstract"))}`,
      `topics: [${csvList("topics").map(q).join(", ")}]`, "language: en", "creators:");
    for (const l of lines("creators")) {
      const [name, orcid, aff] = l.split("|").map(s => (s || "").trim());
      Y.push(`  - name: ${q(name)}`, `    orcid: ${q(orcid)}`, `    affiliation: ${q(aff)}`);
    }
    Y.push("origin:", `  type: ${val("otype")}`, `  organisation: ${q(val("oorg"))}`,
      `  country: ${val("ocountry").toUpperCase()}`, `  title: ${q(val("otitle"))}`,
      `  editions: ${q(val("oeditions"))}`, `  ${val("ourl").startsWith("10.") ? "doi" : "url"}: ${q(val("ourl"))}`,
      `  accessed: ${q(val("oaccessed"))}`, `  tables: ${q(val("otables"))}`,
      `  terms: ${q(val("oterms"))}`, `  how: ${q(val("ohow"))}`,
      "coverage:", `  countries: [${csvList("ccountries").map(s => s.toUpperCase()).join(", ")}]`,
      `  start: ${val("cstart") || '""'}`, `  end: ${val("cend") || '""'}`, `  unit: ${q(val("cunit"))}`,
      `licence: ${val("licence")}`, "files:");
    for (const f of files) {
      Y.push(`  - name: ${q(f.name)}`, `    description: ${q(f.desc)}`, "    variables:");
      for (const c of f.cols)
        Y.push(`      - {name: ${q(c.name)}, type: ${q(c.type)}, description: ${q(c.desc)}}`);
    }
    Y.push("known_issues:", ...lines("issues").map(l => `  - ${q(l)}`), "validation:");
    for (const l of lines("checks")) {
      const [check, hdr, source, gap] = l.split("|").map(s => (s || "").trim());
      Y.push(`  - {check: ${q(check)}, hdr: ${q(hdr)}, source: ${q(source)}, gap: ${q(gap)}, verdict: ${/^0(\.0+)?%?$/.test(gap) ? "pass" : "note"}}`);
    }
    Y.push("versions:", `  - {version: "1.0.0", date: ${new Date().toISOString().slice(0, 10)}, changes: "First release"}`);
    return Y.join("\n") + "\n";
  }

  function update() {
    const c = checks();
    const ok = c.filter(x => x[1]).length;
    list.innerHTML = `<div class="cl-head">${ok} of ${c.length} ready</div>` +
      c.map(([t, v]) => `<div class="cl ${v ? "ok" : "no"}">${v ? "✓" : "○"} ${t}</div>`).join("");
    out.textContent = yaml();
  }

  document.getElementById("dl-yaml").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([yaml()], { type: "text/yaml" }));
    a.download = "dataset.yml"; a.click(); URL.revokeObjectURL(a.href);
  });
  document.getElementById("copy-yaml").addEventListener("click", e => {
    navigator.clipboard.writeText(yaml()).then(() => { e.target.textContent = "Copied"; setTimeout(() => e.target.textContent = "Copy", 1500); });
  });
  update();
})();
