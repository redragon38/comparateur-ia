const PASSWORD = "admin123"; // mot de passe simple

const loginSection = document.getElementById("login-section");
const adminSection = document.getElementById("admin-section");
const loginBtn = document.getElementById("login-btn");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");

loginBtn.addEventListener("click", () => {
  if (passwordInput.value === PASSWORD) {
    loginSection.style.display = "none";
    adminSection.style.display = "block";
    loadProviders();
  } else {
    loginError.textContent = "Mot de passe incorrect";
  }
});

logoutBtn.addEventListener("click", () => {
  adminSection.style.display = "none";
  loginSection.style.display = "block";
  passwordInput.value = "";
});

async function loadProviders() {
  const res = await fetch("info.json");
  const data = await res.json();
  renderTable(data.providers);
}

function renderTable(providers) {
  const tbody = document.querySelector("#providers-table tbody");
  tbody.innerHTML = "";
  providers.forEach((p, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${p.tagline}</td>
      <td>${p.price}</td>
      <td>${p.rating}</td>
      <td>${p.domains.join(", ")}</td>
      <td>${p.features.join(", ")}</td>
      <td><a href="${p.url}" target="_blank">Lien</a></td>
      <td>
        <button onclick="editProvider(${index})">✏️</button>
        <button onclick="deleteProvider(${index})">🗑️</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

document.getElementById("provider-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const editIndex = document.getElementById("edit-index").value;
  const provider = {
    id: document.getElementById("id").value,
    name: document.getElementById("name").value,
    tagline: document.getElementById("tagline").value,
    price: parseFloat(document.getElementById("price").value) || 0,
    rating: parseFloat(document.getElementById("rating").value) || 0,
    domains: document.getElementById("domains").value.split(",").map(s => s.trim()),
    features: document.getElementById("features").value.split(",").map(s => s.trim()),
    url: document.getElementById("url").value
  };

  const action = editIndex ? `edit&index=${editIndex}` : "save";

  const res = await fetch(`admin.php?action=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(provider)
  });

  const msg = await res.text();
  alert(msg);
  loadProviders();
  e.target.reset();
  document.getElementById("edit-index").value = "";
});

async function editProvider(index) {
  const res = await fetch("info.json");
  const data = await res.json();
  const p = data.providers[index];
  document.getElementById("edit-index").value = index;
  document.getElementById("id").value = p.id;
  document.getElementById("name").value = p.name;
  document.getElementById("tagline").value = p.tagline;
  document.getElementById("price").value = p.price;
  document.getElementById("rating").value = p.rating;
  document.getElementById("domains").value = p.domains.join(", ");
  document.getElementById("features").value = p.features.join(", ");
  document.getElementById("url").value = p.url;
}

async function deleteProvider(index) {
  if (confirm("Supprimer ce fournisseur ?")) {
    const res = await fetch(`admin.php?action=delete&index=${index}`);
    const msg = await res.text();
    alert(msg);
    loadProviders();
  }
}
