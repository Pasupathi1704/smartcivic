/* Shared work-list UI module.
   Kept separate from role features so every workspace gets the same
   search, status filtering, and result feedback. */
function renderFilteredLedger(list, opts = {}) {
  const module = el(`<section class="work-list" aria-label="${opts.label || "Reports"}">
    <div class="work-list__controls">
      <label class="search-field">
        <span class="sr-only">Search reports</span>
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder="Search by report, place, or category" />
      </label>
      <div class="filter-group" role="group" aria-label="Filter by status">
        <button class="filter-chip is-active" type="button" data-status="all">All <span>${list.length}</span></button>
        ${["submitted", "assigned", "in-progress", "completed"].map(status => {
          const count = list.filter(p => p.status === status).length;
          return count ? `<button class="filter-chip" type="button" data-status="${status}">${statusLabel(status)} <span>${count}</span></button>` : "";
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

  /* ── Dynamic #8: Highlight search matches in rendered rows ── */
  function highlightMatches(query) {
    if (!query) return;
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${safeQuery})`, "gi");
    results.querySelectorAll(".ledger-row__title, .ledger-row__meta span").forEach(el => {
      if (el.querySelector("mark")) return; // skip already-highlighted children
      const orig = el.textContent;
      if (re.test(orig)) {
        el.innerHTML = orig.replace(re, `<mark class="search-hl">$1</mark>`);
      }
      re.lastIndex = 0;
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
        // Delay to let progress bar rAF settle before we patch innerHTML
        requestAnimationFrame(() => highlightMatches(query));
      }
    } else {
      results.appendChild(el(`<div class="no-results"><span>⌕</span><strong>No matching reports</strong><p>Try another search or clear the status filter.</p></div>`));
    }
    summary.textContent = `${matching.length} ${matching.length === 1 ? "report" : "reports"} shown`;
  }

  input.addEventListener("input", update);
  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-status]");
    if (!button) return;
    activeStatus = button.dataset.status;
    controls.querySelectorAll("button").forEach(b => b.classList.toggle("is-active", b === button));
    update();
  });
  update();
  return module;
}
