console.log("✅ Script script.js chargé");

const DATA_URL = "https://raw.githubusercontent.com/redragon38/comparateur-ia/main/info.json";

async function loadProviders() {
  console.log("📡 Chargement du JSON depuis GitHub...");
  try {
    const res = await fetch(DATA_URL + "?t=" + Date.now(), {
      headers: { 'Accept': 'application/json; charset=utf-8' }
    });
    if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
    const data = await res.json();
    console.log("✅ Données reçues :", data);
    displayProviders(data);
  } catch (err) {
    console.error("❌ Erreur:", err);
    document.getElementById("providers").innerHTML = `<p style="color:red;">Erreur: ${err.message}</p>`;
  }
}

function displayProviders(providers) {
  const container = document.getElementById("providers");
  container.innerHTML = "";
  providers.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h2>${p.name}</h2>
      <p>${p.short}</p>
      <p><strong>Prix :</strong> ${p.pricing?.from || 'N/A'} ${p.pricing?.currency || ''}</p>
      <p><strong>Note :</strong> ⭐ ${p.rating?.value || 'N/A'} (${p.rating?.count || 0} avis)</p>
      <a href="${p.website}" target="_blank">Visiter le site</a>
    `;
    container.appendChild(card);
  });
}

loadProviders();