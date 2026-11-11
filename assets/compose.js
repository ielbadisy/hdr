// Turns a small form into a message that the visitor sends: by e-mail when
// a contact address is set, as a GitHub issue when an issue tracker is set,
// and always as text to copy. Nothing is sent by the page itself.
//
//   <form class="compose" data-subject="HDR error report: HDR-MA-0001">
//     <input name="x" data-label="File" required> ...
//     <div class="compose-actions"></div>
//   </form>
//   <a class="compose-link" data-subject="..." data-body="...">I need this too</a>
(function () {
  const cfg = window.HDR_CONFIG || {};

  function links(subject, body) {
    const s = encodeURIComponent(subject), b = encodeURIComponent(body);
    return {
      mail: cfg.contact ? `mailto:${cfg.contact}?subject=${s}&body=${b}` : "",
      issue: cfg.issues ? `${cfg.issues}?title=${s}&body=${b}` : ""
    };
  }

  function copy(text, note) {
    const done = () => { if (note) note.textContent = "Copied. Paste it into an e-mail to us."; };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);
    else done();
  }

  function labelOf(el) {
    if (el.dataset.label) return el.dataset.label;
    const l = el.closest("label");
    return l ? l.firstChild.textContent.replace(/[•*]/g, "").trim() : el.name;
  }

  document.querySelectorAll("form.compose").forEach(form => {
    const actions = form.querySelector(".compose-actions");
    actions.innerHTML =
      `<a class="btn btn-primary btn-sm c-mail" hidden>Send by e-mail</a>
       <a class="btn btn-outline-primary btn-sm c-issue" target="_blank" rel="noopener" hidden>Open a GitHub issue</a>
       <button type="button" class="btn btn-outline-secondary btn-sm c-copy">Copy the message</button>
       <span class="c-note"></span>`;
    const note = actions.querySelector(".c-note");

    function message() {
      let subject = form.dataset.subject || "HDR";
      const key = form.querySelector("[data-subject-field]");
      if (key && key.value.trim()) subject += ": " + key.value.trim();
      const lines = [form.dataset.intro || ""];
      form.querySelectorAll("input, select, textarea").forEach(el => {
        if (el.value.trim()) lines.push(`${labelOf(el)}: ${el.value.trim()}`);
      });
      if (form.dataset.footer) lines.push("", form.dataset.footer);
      return { subject, body: lines.join("\n").trim() };
    }
    function missing() {
      return [...form.querySelectorAll("[required]")].filter(el => !el.value.trim());
    }
    function update() {
      const m = message(), l = links(m.subject, m.body), miss = missing();
      for (const [cls, href] of [["c-mail", l.mail], ["c-issue", l.issue]]) {
        const a = actions.querySelector("." + cls);
        a.hidden = !href; a.href = href || "#";
        a.classList.toggle("disabled", miss.length > 0);
      }
      note.textContent = miss.length
        ? "Required: " + miss.map(labelOf).join(", ")
        : (cfg.contact || cfg.issues ? "" : "Contact address coming soon: copy the message for now.");
    }
    form.addEventListener("input", update);
    actions.querySelector(".c-copy").addEventListener("click", () => {
      if (missing().length) { update(); return; }
      const m = message(); copy(`Subject: ${m.subject}\n\n${m.body}`, note);
    });
    update();
  });

  document.querySelectorAll("a.compose-link").forEach(a => {
    const subject = a.dataset.subject, body = a.dataset.body || "";
    const l = links(subject, body);
    if (l.mail || l.issue) { a.href = l.mail || l.issue; if (!l.mail) a.target = "_blank"; return; }
    a.href = "#";
    a.addEventListener("click", e => {
      e.preventDefault();
      copy(`Subject: ${subject}\n\n${body}`);
      a.dataset.copied = "Copied: paste it into an e-mail to us";
      setTimeout(() => delete a.dataset.copied, 2500);
    });
  });
})();
