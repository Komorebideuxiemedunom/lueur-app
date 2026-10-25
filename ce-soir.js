// Lueur web : Kp observé et prévu (NOAA SWPC, domaine public), lu dans le navigateur à chaque visite.
// Seuils par ville écrits dans la page (data-kp), même modèle que l'app (Astro.kpNeeded).
(function () {
  "use strict";
  const SOURCE = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";
  const SLOT = 3 * 3600 * 1000;
  const fmt = (v) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);
  const heure = (d) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const jour = (d) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" });

  function niveau(kp) {
    if (kp >= 5) return `orage G${Math.min(Math.floor(kp) - 4, 5)}`;
    return kp >= 4 ? "actif" : "calme";
  }

  // Le produit est une liste d'objets ; l'ancien format était un tableau de tableaux avec en-tête.
  function lire(json) {
    const rows = Array.isArray(json[0]) ? json.slice(1).map(([t, kp, obs]) => ({ time_tag: t, kp, observed: obs })) : json;
    return rows.map((r) => ({ debut: new Date(r.time_tag + "Z"), kp: parseFloat(r.kp ?? r.Kp), prevu: r.observed === "predicted" }))
      .filter((r) => isFinite(r.kp));
  }

  // Cette nuit : de 18 h (ou maintenant) à 6 h le lendemain, à l'heure de l'appareil.
  function nuit(now) {
    const debut = new Date(now), fin = new Date(now);
    if (now.getHours() < 6) { fin.setHours(6, 0, 0, 0); return [now, fin]; }
    debut.setHours(18, 0, 0, 0);
    fin.setDate(fin.getDate() + 1); fin.setHours(6, 0, 0, 0);
    return [now > debut ? now : debut, fin];
  }

  function afficher(points) {
    const now = new Date();
    const passes = points.filter((p) => p.debut <= now);
    const actuel = passes[passes.length - 1];
    const [d, f] = nuit(now);
    const cetteNuit = points.filter((p) => p.debut.getTime() + SLOT > d && p.debut < f);
    const pic = cetteNuit.reduce((a, p) => (!a || p.kp > a.kp ? p : a), null);
    const max = pic ? pic.kp : actuel ? actuel.kp : 0;

    const jours = new Map();
    points.filter((p) => p.prevu || p.debut.getTime() + SLOT > now).forEach((p) => {
      const cle = p.debut.toDateString();
      jours.set(cle, Math.max(jours.get(cle) ?? 0, p.kp));
    });
    const barres = points.filter((p) => p.debut.getTime() + SLOT > now).slice(0, 16).map((p) =>
      `<div class="barre${p.kp >= 5 ? " orage" : ""}" title="${jour(p.debut)} ${heure(p.debut)} : Kp ${fmt(p.kp)}"><span style="height:${Math.max(p.kp / 9 * 100, 3)}%"></span><small>${p.debut.getHours()}h</small></div>`).join("");

    const verdict = max >= 7 ? "Orage fort annoncé cette nuit : regarde vers le nord dès qu'il fait noir, loin des lumières."
      : max >= 5 ? "Orage géomagnétique annoncé : les aurores descendent sur le nord de l'Europe, la France reste en limite."
      : "Pas d'aurore attendue en France cette nuit : le Kp reste trop bas.";
    document.getElementById("direct").innerHTML =
      `<div class="chiffres"><p><strong>${actuel ? fmt(actuel.kp) : "?"}</strong>Kp maintenant${actuel ? `, ${niveau(actuel.kp)}` : ""}</p>` +
      `<p><strong>${fmt(max)}</strong>Kp maximum cette nuit${pic ? `, vers ${heure(pic.debut)}` : ""}</p></div>` +
      `<p class="constat${max >= 7 ? " ok" : ""}">${verdict}</p>` +
      `<div class="barres" aria-hidden="true">${barres}</div>` +
      `<p class="note">Prochains jours : ${[...jours].slice(1, 4).map(([k, v]) => `${jour(new Date(k))} Kp ${fmt(v)}`).join(" · ")}. Mis à jour ${heure(now)}.</p>`;

    document.querySelectorAll("tr[data-kp]").forEach((tr) => {
      const besoin = parseFloat(tr.dataset.kp);
      const cell = tr.querySelector(".ce-soir");
      cell.textContent = max >= besoin ? "Possible" : `Non (Kp ${fmt(max)})`;
      cell.className = "ce-soir" + (max >= besoin ? " oui" : "");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    fetch(SOURCE, { cache: "no-store" }).then((r) => r.json()).then((j) => afficher(lire(j))).catch(() => {
      document.getElementById("direct").innerHTML = "<p>Les données de la NOAA ne répondent pas pour l'instant. Réessaie dans quelques minutes.</p>";
    });
  });
})();
