const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return;

  const { linkedin_url, email, jobId } = JSON.parse(event.body || '{}');
  if (!jobId || !email) return;

  const store = getStore({ name: 'email-counters', siteID: process.env.SITE_ID, token: process.env.NETLIFY_TOKEN });
  const key = email.toLowerCase().trim();

  let entry = null;
  try {
    const raw = await store.get(key);
    entry = raw ? JSON.parse(raw) : null;
    if (entry?.state === 'in_progress' || (entry?.count || 0) >= 2) return;

    await store.set(key, JSON.stringify({ state: 'in_progress', count: 0 }));

    if (email.toLowerCase().trim() === 'thomas.servais@servais-consulting.com') {
      console.log('[mock] email de test détecté, faux délai de 30s');
      await new Promise(resolve => setTimeout(resolve, 30_000));
      await store.set(key, JSON.stringify({ state: 'done', count: (entry?.count || 0) + 1 }));
      return;
    }

    const rapidResp = await fetch(
      `https://fresh-linkedin-profile-data.p.rapidapi.com/enrich-lead?linkedin_url=${encodeURIComponent(linkedin_url)}&include_skills=false&include_certifications=false&include_profile_status=false&include_company_public_url=false`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'fresh-linkedin-profile-data.p.rapidapi.com'
        }
      }
    );

    if (!rapidResp.ok) throw new Error(`RapidAPI: ${rapidResp.status}`);
    const rapidData = await rapidResp.json();
    const p = rapidData.data || {};

    const profileText = [
      `Nom: ${p.full_name || ''}`,
      `Titre: ${p.headline || ''}`,
      `Poste: ${p.job_title || ''}`,
      `Entreprise: ${p.company || ''}`,
      `Localisation: ${p.hq_city || ''}, ${p.country || ''}`,
      `Abonnés: ${p.follower_count || ''}`,
      `École: ${p.school || ''}`,
      `Secteur: ${p.company_industry || ''}`,
      `Taille entreprise: ${p.company_employee_range || ''}`,
      `About: ${(p.about || '').replace(/[\n\r\t]/g, ' ').substring(0, 1500)}`
    ].join('\n');

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Tu es un expert en personal branding LinkedIn et en lecture de signaux implicites. Tu analyses les profils comme un recruteur senior qui scanne en 8 secondes — mais aussi comme un stratège qui lit entre les lignes.

Analyse ce profil LinkedIn en mode recherche d'emploi avec un ton direct, bienveillant, vouvoiement détendu. Reponds UNIQUEMENT avec un JSON brut valide, sans backticks ni markdown.

RÈGLES ABSOLUES pour les personas :
- P1 et P2 sont toujours des personas "voulu" — des interlocuteurs que le profil attire intentionnellement
- Les chasseurs de têtes et recruteurs exec sont TOUJOURS classés en P1 ou P2 (jamais ailleurs) — ce sont les interlocuteurs naturels d'un candidat en recherche
- P3 est un persona "peu_pertinent" — quelqu'un que le profil attire involontairement et qui n'a aucune valeur pour la recherche d'emploi (ex: pair du secteur, consultant, étudiant, curieux)
- P4 est un persona "possible" — un décideur ou recruteur réel que le profil POURRAIT attirer mais ne cible pas encore. Ce doit être une VRAIE PERSONNE avec un poste concret (ex: "DG d'une PME industrielle", "Head of HR chez un fonds PE"). JAMAIS l'algorithme LinkedIn, jamais un concept abstrait, jamais un outil
- Ne jamais mentionner "Open to Work", "disponibilité", "mode recherche active" dans les analyses — parle uniquement de ce que le profil communique ou ne communique pas sur la valeur professionnelle
- Pour le "premier diagnostic", parle de ce que le profil fait ou ne fait pas pour convaincre un recruteur — pas de ce qu'il "signale" en termes de recherche

Profil LinkedIn:
${profileText}

JSON à remplir (TOUS les champs, analyses précises et concrètes, jamais de champs vides):
{"nom":"","titre":"","entreprise":"","localisation":"","intro":"","p1_nom":"","p1_qui":"","p1_percoit":"","p1_verdict":"","p2_nom":"","p2_qui":"","p2_percoit":"","p2_verdict":"","p3_nom":"","p3_qui":"","p3_percoit":"","p3_verdict":"","p4_nom":"","p4_qui":"","p4_blocage":"","p4_verdict":"","algo_kw1":"","algo_text1":"","algo_kw2":"","algo_text2":"","algo_kw3":"","algo_text3":"","algo_kw4":"","algo_text4":"","algo_note":"","titre_citation":"","titre_analyse":"","titre_chip":"","about_citation":"","about_analyse":"","about_chip1":"","about_chip2":"","exp_analyse":"","posts_analyse":"","banniere_analyse":"","reco1":"","reco2":"","reco3":"","reco4":"","diag_positif_1":"","diag_positif_2":"","diag_positif_3":"","diag_negatif_1":"","diag_negatif_2":"","diag_negatif_3":""}`
        }]
      })
    });

    if (!claudeResp.ok) throw new Error(`Claude: ${claudeResp.status}`);
    const claudeData = await claudeResp.json();
    const claudeText = claudeData.content[0].text.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    const a = JSON.parse(claudeText);

    await Promise.all([
      sendResend(email, a, linkedin_url),
      sendNotification(email, a, linkedin_url)
    ]);

    await store.set(key, JSON.stringify({ state: 'done', count: (entry?.count || 0) + 1 }));

  } catch (err) {
    console.error('analyze-background error:', err);
    try { await store.set(key, JSON.stringify({ state: 'done', count: entry?.count || 0 })); } catch (_) {}
  }
};
async function sendResend(email, a, linkedin_url) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Sherpact <diagnostic@sherpact.com>',
      to: email,
      subject: `Votre diagnostic LinkedIn — ${a.nom || 'Résultats'}`,
      html: buildEmailHtml(a, linkedin_url)
    })
  });
  if (!resp.ok) console.error('Resend error:', resp.status, await resp.text());
}

async function sendNotification(email, a, linkedin_url) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Sherpact <diagnostic@sherpact.com>',
      to: 'laurent@sherpact.com',
      subject: `Nouveau diagnostic — ${email}`,
      html: `<p style="font-family:sans-serif;font-size:14px;color:#333;"><strong>Nouveau diagnostic soumis</strong><br>Email : ${email}<br>Profil : <a href="${linkedin_url}">${linkedin_url}</a><br>Date : ${new Date().toLocaleString('fr-FR')}</p><hr style="border:none;border-top:1px solid #e8e4dc;margin:20px 0">${buildEmailHtml(a, linkedin_url)}`
    })
  });
  if (!resp.ok) console.error('Resend notification error:', resp.status, await resp.text());
}
function buildEmailHtml(a, linkedin_url) {

  const BLEU = '#1a2840';
  const OR = '#b8975a';
  const TEAL = '#1D9E75';
  const TEAL_BG = '#E1F5EE';
  const TEAL_TEXT = '#085041';
  const CORAL = '#D85A30';
  const CORAL_BG = '#FAECE7';
  const CORAL_TEXT = '#712B13';
  const GRIS = '#6b6b6b';
  const BLANC = '#f8f6f1';
  const GRAY_BG = '#F1EFE8';
  const GRAY_TEXT = '#444441';

  const badge = (type) => {
    const map = {
      voulu:         { bg: TEAL_BG,  color: TEAL_TEXT,  label: 'Voulu' },
      peu_pertinent: { bg: CORAL_BG, color: CORAL_TEXT, label: 'Peu pertinent' },
      possible:      { bg: GRAY_BG,  color: GRAY_TEXT,  label: 'Possible · à valider' }
    };
    const b = map[type] || map.voulu;
    return `<span style="display:inline-block;font-size:10px;font-weight:500;padding:2px 9px;border-radius:20px;background:${b.bg};color:${b.color};letter-spacing:.05em;text-transform:uppercase;margin-bottom:10px;">${b.label}</span>`;
  };

  const borderColor = (type) => ({
    voulu: TEAL,
    peu_pertinent: CORAL,
    possible: '#B4B2A9'
  }[type] || TEAL);

  const personaCard = (type, nom, qui, verdict) => `
    <td width="25%" style="padding:6px;vertical-align:top;">
      <div style="border:.5px solid #e8e4dc;border-radius:8px;padding:14px;border-top:3px solid ${borderColor(type)};">
        ${badge(type)}
        <div style="font-size:13px;font-weight:500;color:#0f0f0f;margin-bottom:8px;">${nom}</div>
        <div style="font-size:12px;color:${GRIS};line-height:1.5;margin-bottom:8px;">${qui}</div>
        <div style="font-size:11.5px;color:${GRIS};font-style:italic;border-top:.5px solid #e8e4dc;padding-top:8px;line-height:1.55;">${verdict}</div>
      </div>
    </td>`;

  const algoItem = (kw, text, isGreen) => kw ? `
    <tr>
      <td style="padding:6px 0;border-bottom:.5px solid #e8e4dc;">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${isGreen ? TEAL : CORAL};margin-right:8px;vertical-align:middle;"></span>
        <strong style="color:#0f0f0f;font-size:12px;">${kw}</strong>
        <span style="font-size:12px;color:${GRIS};"> — ${text}</span>
      </td>
    </tr>` : '';

  const diagItem = (text, color, textColor) => text ? `
    <div style="font-size:12px;color:${textColor};line-height:1.55;padding:4px 0 4px 10px;border-left:2px solid ${color};margin-bottom:5px;">${text}</div>` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellspacing="0" cellpadding="0" style="background:#f0ede6;padding:24px 0;">
<tr><td align="center">
<table width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#fff;border-radius:10px;overflow:hidden;border:.5px solid #e8e4dc;">

  <!-- TOPBAR -->
  <tr><td style="background:${BLEU};padding:14px 32px;">
    <span style="font-family:Georgia,serif;font-size:13px;color:${OR};letter-spacing:.14em;text-transform:uppercase;">Sherpact</span>
    <span style="color:rgba(255,255,255,.25);margin:0 8px;">·</span>
    <span style="font-size:11px;color:rgba(255,255,255,.35);letter-spacing:.06em;">Diagnostic LinkedIn</span>
  </td></tr>

  <!-- DISCLAIMER -->
  <tr><td style="padding:16px 32px 0;">
    <div style="background:#fff;border:1px solid #e8e4dc;border-left:4px solid ${OR};border-radius:0 6px 6px 0;padding:12px 16px;">
      <div style="font-size:10px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:${OR};margin-bottom:5px;">Première analyse — Générée par l'IA</div>
      <div style="font-size:12.5px;color:${GRIS};line-height:1.7;">Ce diagnostic est produit automatiquement à partir des informations <strong style="color:#0f0f0f;">visibles publiquement</strong> sur votre profil LinkedIn. Pour qu'il soit complet et ancré dans votre réalité, cela nécessite un travail approfondi — <a href="mailto:laurent@sherpact.com" style="color:${BLEU};font-weight:500;">contactez-moi pour cela</a>.</div>
    </div>
  </td></tr>

  <!-- HEADER PROFIL -->
  <tr><td style="padding:24px 32px 20px;border-bottom:.5px solid #e8e4dc;">
    <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${GRIS};margin-bottom:8px;font-weight:500;">Diagnostic de profil · Recherche d'emploi</div>
    <div style="font-family:Georgia,serif;font-size:22px;color:#0f0f0f;margin-bottom:4px;">${a.nom || ''}</div>
    <div style="font-size:13px;color:${GRIS};margin-bottom:14px;">${a.titre || ''} · ${a.entreprise || ''} · ${a.localisation || ''}</div>
    <div style="background:${BLANC};border-left:3px solid ${BLEU};padding:12px 16px;font-size:13.5px;color:#0f0f0f;line-height:1.75;border-radius:0 4px 4px 0;">${a.intro || ''}</div>
  </td></tr>

  <!-- BLOC 1 : PERSONAS -->
  <tr><td style="padding:24px 32px;border-bottom:.5px solid #e8e4dc;">
    <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${GRIS};margin-bottom:16px;font-weight:500;">À qui s'adresse votre profil</div>
    <table width="100%" cellspacing="0" cellpadding="0"><tr>
      ${personaCard('voulu',         a.p1_nom||'', a.p1_qui||'', a.p1_verdict||'')}
      ${personaCard('voulu',         a.p2_nom||'', a.p2_qui||'', a.p2_verdict||'')}
      ${personaCard('peu_pertinent', a.p3_nom||'', a.p3_qui||'', a.p3_verdict||'')}
      ${personaCard('possible',      a.p4_nom||'', a.p4_qui||'', a.p4_verdict||'')}
    </tr></table>

    <!-- ALGO -->
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;">
      <tr><td style="background:${BLANC};border-radius:6px;padding:14px 16px;">
        <div style="font-size:11px;font-weight:500;color:#0f0f0f;margin-bottom:10px;">Visibilité algorithmique</div>
        <table width="100%" cellspacing="0" cellpadding="0">
          ${algoItem(a.algo_kw1, a.algo_text1, true)}
          ${algoItem(a.algo_kw2, a.algo_text2, true)}
          ${algoItem(a.algo_kw3, a.algo_text3, false)}
          ${algoItem(a.algo_kw4, a.algo_text4, false)}
        </table>
        ${a.algo_note ? `<div style="margin-top:10px;padding-top:10px;border-top:.5px solid #e8e4dc;font-size:12px;color:${GRIS};line-height:1.65;">${a.algo_note}</div>` : ''}
      </td></tr>
    </table>
  </td></tr>

  <!-- PREMIER DIAGNOSTIC -->
  <tr><td style="padding:24px 32px;border-bottom:.5px solid #e8e4dc;">
    <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${GRIS};margin-bottom:16px;font-weight:500;">Premier diagnostic</div>
    <table width="100%" cellspacing="0" cellpadding="0"><tr>
      <td width="50%" style="padding-right:10px;vertical-align:top;">
        <div style="background:${TEAL_BG};border-radius:6px;padding:14px 16px;">
          <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.07em;color:${TEAL_TEXT};margin-bottom:10px;">Ce que le profil fait</div>
          ${diagItem(a.diag_positif_1, TEAL, '#0F6E56')}
          ${diagItem(a.diag_positif_2, TEAL, '#0F6E56')}
          ${diagItem(a.diag_positif_3, TEAL, '#0F6E56')}
        </div>
      </td>
      <td width="50%" style="padding-left:10px;vertical-align:top;">
        <div style="background:${CORAL_BG};border-radius:6px;padding:14px 16px;">
          <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.07em;color:${CORAL_TEXT};margin-bottom:10px;">Ce que le profil ne fait pas</div>
          ${diagItem(a.diag_negatif_1, CORAL, '#993C1D')}
          ${diagItem(a.diag_negatif_2, CORAL, '#993C1D')}
          ${diagItem(a.diag_negatif_3, CORAL, '#993C1D')}
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- SIGNATURE -->
  <tr><td style="background:${BLEU};padding:28px 32px;">
    <a href="https://www.linkedin.com/in/laurentgarnier7/" style="font-family:Georgia,serif;font-size:15px;color:#fff;text-decoration:none;display:block;margin-bottom:10px;">Laurent Garnier ↗</a>
    <div style="font-size:14px;color:#fff;font-weight:500;margin-bottom:6px;">Vous voulez gérer votre transition comme un pro ?</div>
    <div style="font-size:13px;color:rgba(255,255,255,.7);line-height:1.7;margin-bottom:16px;">Je vous accompagne et vous rends autonome.</div>
    <a href="mailto:laurent@sherpact.com" style="display:inline-block;padding:10px 22px;border:1px solid ${OR};color:${OR};font-size:12px;letter-spacing:.08em;text-decoration:none;border-radius:2px;">laurent@sherpact.com</a>
  </td></tr>

  <!-- RGPD -->
  <tr><td style="background:#f0ede6;padding:16px 32px;text-align:center;">
    <p style="font-size:11px;color:#999;line-height:1.8;margin:0;">Vos données sont utilisées uniquement pour produire ce diagnostic. Elles ne sont pas stockées durablement.<br>RGPD — droit d'accès et d'effacement : <a href="mailto:laurent@sherpact.fr" style="color:#888;">laurent@sherpact.fr</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}
