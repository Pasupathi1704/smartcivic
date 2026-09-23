
/* Shared work-list UI module: search, status filtering, safe
   highlighting, and result feedback for every role's ledger. */
function renderFilteredLedger(list, opts = {}) {
  const module = el(`<section class="work-list" aria-label="${opts.label || "Reports"}">
    <div class="work-list__controls">
      <label class="search-field">
        <span class="sr-only">Search reports</span>
        <span aria-hidden="true">?</span>
        <input type="search" placeholder="Search by report, place, or category" />
      </label>
      <div class="filter-group" role="group" aria-label="Filter by status">
        <button class="filter-chip is-active" type="button" data-status="all" aria-pressed="true">All <span>${list.length}</span></button>
        ${["submitted", "assigned", "in-progress", "completed"].map(status => {
          const count = list.filter(p => p.status === status).length;
          if (!count) return "";
          return `<button class="filter-chip" type="button" data-status="${status}" aria-pressed="false">${statusLabel(status)} <span>${count}</span></button>`;
        }).join("")}
      </div>
    </div>
    <p class="work-list__summary" aria-live="polite"></p>
    <div class="work-list__results"></div>
  </section>`);

  const input = module.querySelector("input");
  const controls = module.querySelector(".filter-group");
  const results = module.querySelector(".work-list__results");
  const summary = module.querySelector(".work-list__summary");
  let activeStatus = "all";

  /* Highlight search matches safely: we only ever wrap existing text
     nodes, so a report title containing markup can never be re-parsed. */
  function highlightInElement(root, query) {
    if (!query || query.length < 2) return;
    const needle = query.toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && node.parentElement.closest("mark")) continue;
      if (node.nodeValue.toLowerCase().includes(needle)) targets.push(node);
    }
    targets.forEach(textNode => {
      const text = textNode.nodeValue;
      const lower = text.toLowerCase();
      const frag = document.createDocumentFragment();
      let cursor = 0;
      let idx;
      while ((idx = lower.indexOf(needle, cursor)) !== -1) {
        if (idx > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, idx)));
        const mark = document.createElement("mark");
        mark.className = "search-hl";
        mark.textContent = text.slice(idx, idx + needle.length);
        frag.appendChild(mark);
        cursor = idx + needle.length;
      }
      if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  function update() {
    const query = input.value.trim().toLowerCase();
    const matching = list.filter(p => {
      const searchable = `${p.id} ${p.title} ${p.category} ${p.description} ${p.citizenName} ${p.assignedToName || ""}`.toLowerCase();
      return (activeStatus === "all" || p.status === activeStatus) && (!query || searchable.includes(query));
    });

    results.innerHTML = "";
    if (matching.length) {
      results.appendChild(renderLedger(matching, opts));
      if (query) {
        const scopes = results.querySelectorAll(".ledger-row__id, .ledger-row__title, .ledger-row__meta");
        scopes.forEach(scope => highlightInElement(scope, query));
      }
    } else {
      results.appendChild(el(`<div class="no-results"><span aria-hidden="true">?</span><strong>No matching reports</strong><p>Try another search or clear the status filter.</p><button class="btn btn--sm" type="button" data-reset>Clear filters</button></div>`));
      const reset = results.querySelector("[data-reset]");
      if (reset) reset.addEventListener("click", () => {
        input.value = "";
        activeStatus = "all";
        controls.querySelectorAll("button").forEach(b => {
          const on = b.dataset.status === "all";
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", String(on));
        });
        update();
        input.focus();
      });
    }
    summary.textContent = `${matching.length} ${matching.length === 1 ? "report" : "reports"} shown`;
  }

  input.addEventListener("input", update);
  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-status]");
    if (!button) return;
    activeStatus = button.dataset.status;
    controls.querySelectorAll("button").forEach(b => {
      const on = b === button;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    update();
  });
  update();
  return module;
}

