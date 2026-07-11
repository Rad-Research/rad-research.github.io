(function () {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const root = document.getElementById("project-root");
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const source = window.PROJECTS || PROJECTS;
  const project = source.find((p) => p.id === id);

  if (!project) {
    root.innerHTML = `
      <section class="section-head">
        <h1>Projet introuvable</h1>
        <p>Verifie l'URL ou retourne a la liste des projets.</p>
        <a class="btn" href="index.html#projects">Retour aux projets</a>
      </section>
    `;
    return;
  }

  const tags = project.tags.map((t) => `<span>${t}</span>`).join("");
  const links = (project.links || [])
    .map((l) => `<a class="btn btn-ghost" href="${l.href}">${l.label}</a>`)
    .join("");

  document.title = `${project.title} | Sylvain Vayssier`;

  root.innerHTML = `
    <section class="section-head reveal in">
      <p class="eyebrow">${project.type} • ${project.year}</p>
      <h1>${project.title}</h1>
      <p>${project.summary}</p>
      <div class="tag-row">${tags}</div>
    </section>

    <section class="detail-grid">
      <article class="detail-card">
        <h2>Challenge</h2>
        <p>${project.challenge}</p>
      </article>
      <article class="detail-card">
        <h2>Approach</h2>
        <p>${project.approach}</p>
      </article>
      <article class="detail-card">
        <h2>Results</h2>
        <p>${project.results}</p>
      </article>
      <article class="detail-card">
        <h2>Lessons Learned</h2>
        <p>${project.lessons}</p>
      </article>
    </section>

    <section class="section">
      ${links}
    </section>
  `;
})();