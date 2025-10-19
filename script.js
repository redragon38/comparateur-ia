async function loadProviders() {
  const res = await fetch("info.json");
  const data = await res.json();
  return data.providers;
}

function renderProviders(providers) {
  const container = document.getElementById("providers-container");
  container.innerHTML = "";

  providers.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${p.name}</h3>
      <p><em>${p.tagline}</em></p>
      <p><strong>Prix :</strong> ${p.price} $/mois</p>
      <p><strong>Note :</strong> ⭐ ${p.rating}</p>
      <p><strong>Domaines :</strong> ${p.domains.join(", ")}</p>
      <p><strong>Fonctionnalités :</strong> ${p.features.join(", ")}</p>
      <p><a href="${p.url}" target="_blank">Visiter le site</a></p>
    `;
    container.appendChild(card);
  });
}

function setupFilters(providers) {
  const searchInput = document.getElementById("search");
  const sortSelect = document.getElementById("sort");

  function update() {
    let filtered = [...providers];
    const search = searchInput.value.toLowerCase();

    if (search) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.tagline.toLowerCase().includes(search)
      );
    }

    const sortBy = sortSelect.value;
    filtered.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "price") return a.price - b.price;
      if (sortBy === "rating") return b.rating - a.rating;
    });

    renderProviders(filtered);
  }

  searchInput.addEventListener("input", update);
  sortSelect.addEventListener("change", update);
  update();
}

loadProviders().then(providers => {
  setupFilters(providers);
});
