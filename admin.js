// admin.js — Version corrigée pour matcher la structure JSON réelle

const tableBody = document.querySelector("#iaTable tbody");
const msg = document.getElementById("msg");
const saveBtn = document.getElementById("saveAll");
const addBtn = document.getElementById("addIA");
let iaData = [];

// Charger les données depuis GitHub via admin.php
async function loadData() {
  msg.textContent = "Chargement des données depuis GitHub...";
  const res = await fetch("admin.php");
  if (!res.ok) {
    msg.textContent = "❌ Erreur de chargement.";
    return;
  }
  iaData = await res.json();  // Le JSON est directement un array, pas un objet avec "providers"
  renderTable();
  msg.textContent = "✅ Données chargées avec succès.";
}

// Afficher le tableau (adapter les champs au JSON réel)
function renderTable() {
  tableBody.innerHTML = "";
  iaData.forEach((ia, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input value="${ia.name || ''}" data-field="name" data-index="${index}"></td>
      <td><input value="${ia.short || ''}" data-field="short" data-index="${index}"></td>  <!-- 'short' au lieu de 'tagline' -->
      <td><input value="${ia.pricing?.from || 0}" type="number" data-field="pricing.from" data-index="${index}"></td>  <!-- 'pricing.from' au lieu de 'price' -->
      <td><input value="${ia.rating?.value || 0}" type="number" step="0.1" data-field="rating.value" data-index="${index}"></td>  <!-- 'rating.value' -->
      <td><input value="${(ia.categories || []).join(', ')}" data-field="categories" data-index="${index}"></td>  <!-- 'categories' au lieu de 'domains' -->
      <td><input value="${(ia.tags || []).join(', ')}" data-field="tags" data-index="${index}"></td>  <!-- 'tags' au lieu de 'features' -->
      <td><input value="${ia.website || ''}" data-field="website" data-index="${index}"></td>  <!-- 'website' au lieu de 'url' -->
      <td><button class="delete-btn" onclick="deleteIA(${index})">🗑️ Supprimer</button></td>
    `;
    tableBody.appendChild(row);
  });
}

// Supprimer une IA
function deleteIA(index) {
  if (confirm("Supprimer cette IA ?")) {
    iaData.splice(index, 1);
    renderTable();
  }
}

// Ajouter une nouvelle IA (avec structure par défaut du JSON)
addBtn.addEventListener("click", () => {
  iaData.push({
    id: "new-" + Date.now(),
    slug: "new-slug",
    name: "Nouvelle IA",
    short: "",
    website: "",
    logo: "",
    categories: [],
    tags: [],
    languages: [],
    pricing: { from: 0, currency: "EUR" },
    affiliateUrl: "",
    status: "published",
    source: "éditeur",
    rating: { value: 0, count: 0 },
    ranking: 0,
    hasReview: false,
    verified: false,
    featured: false,
    alternatives: [],
    updatedAt: new Date().toISOString().split('T')[0],  // Date actuelle
    highlight: "",
    description: ""
  });
  renderTable();
});

// Gérer les modifications directes (adapter les champs)
tableBody.addEventListener("input", (e) => {
  const field = e.target.dataset.field;
  const index = parseInt(e.target.dataset.index);
  let value = e.target.value;
  if (field === "categories" || field === "tags") {
    value = value.split(",").map(v => v.trim());
  } else if (field === "pricing.from" || field === "rating.value") {
    value = parseFloat(value) || 0;
    if (field === "pricing.from") {
      iaData[index].pricing = iaData[index].pricing || {};
      iaData[index].pricing.from = value;
    } else {
      iaData[index].rating = iaData[index].rating || {};
      iaData[index].rating.value = value;
    }
  } else {
    iaData[index][field] = value;
  }
});

// Sauvegarder les données vers GitHub
saveBtn.addEventListener("click", async () => {
  msg.textContent = "💾 Envoi sur GitHub...";
  const res = await fetch("admin.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(iaData)  // Envoyer directement l'array
  });
  const result = await res.json();
  if (result.success) {
    msg.textContent = "✅ Données mises à jour sur GitHub !";
  } else {
    msg.textContent = "❌ Erreur lors de la mise à jour : " + (result.error || "inconnue");
  }
});

// Charger au démarrage
loadData();
