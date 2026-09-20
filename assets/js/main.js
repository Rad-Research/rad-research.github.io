(function () {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const grid = document.getElementById("project-grid");
  if (grid && Array.isArray(window.PROJECTS || PROJECTS)) {
    const source = window.PROJECTS || PROJECTS;
    grid.innerHTML = source.map((p) => {
      const tags = p.tags.map((t) => `<span>${t}</span>`).join("");
      return `
        <article class="card reveal">
          <div class="card-top">
            <p class="meta">${p.type} • ${p.year}</p>
            <h3>${p.title}</h3>
            <p>${p.summary}</p>
          </div>
          <div class="tag-row">${tags}</div>
          <a class="card-link" href="project.html?id=${encodeURIComponent(p.id)}">Lire le detail</a>
        </article>
      `;
    }).join("");
  }

  const reveals = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("in");
    });
  }, { threshold: 0.12 });

  reveals.forEach((el) => io.observe(el));

  const contactForm = document.getElementById("contactForm");
  const contactStatus = document.getElementById("contactStatus");
  if (contactForm && contactStatus) {
    contactForm.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const submitBtn = contactForm.querySelector("button[type=submit]");

      contactStatus.hidden = false;
      contactStatus.className = "form-status";
      contactStatus.textContent = "Envoi en cours...";
      if (submitBtn) submitBtn.disabled = true;

      try {
        const response = await fetch(contactForm.action, {
          method: "POST",
          body: new FormData(contactForm),
          headers: { Accept: "application/json" }
        });

        if (response.ok) {
          contactStatus.textContent = "Message envoye, merci ! Je reponds au plus vite.";
          contactStatus.classList.add("ok");
          contactForm.reset();
        } else {
          contactStatus.textContent = "Erreur d'envoi. Reessaie ou passe par LinkedIn.";
          contactStatus.classList.add("error");
        }
      } catch (err) {
        contactStatus.textContent = "Erreur reseau. Reessaie ou passe par LinkedIn.";
        contactStatus.classList.add("error");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
})();