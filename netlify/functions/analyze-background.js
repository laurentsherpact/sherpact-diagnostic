const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return;

  try {
    const { linkedin_url, email, jobId } = JSON.parse(event.body);
    if (!jobId) throw new Error('Missing jobId');

    // 1. RapidAPI scrape
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

    // 2. Claude analyse
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
          content: `Tu es un expert en personal branding LinkedIn. Analyse ce profil en mode recherche emploi avec un ton direct, bienveillant et vouvoiement détendu. Reponds UNIQUEMENT avec un JSON brut valide, sans backticks ni markdown.

Profil LinkedIn:
${profileText}

JSON à remplir (TOUS les champs, analyses précises et concrètes):
{"nom":"","titre":"","entreprise":"","localisation":"","intro":"","p1_nom":"","p1_qui":"","p1_percoit":"","p1_verdict":"","p2_nom":"","p2_qui":"","p2_percoit":"","p2_verdict":"","p3_nom":"","p3_qui":"","p3_percoit":"","p3_verdict":"","p4_nom":"","p4_qui":"","p4_blocage":"","p4_verdict":"","algo_kw1":"","algo_text1":"","algo_kw2":"","algo_text2":"","algo_kw3":"","algo_text3":"","algo_kw4":"","algo_text4":"","algo_note":"","titre_citation":"","titre_analyse":"","titre_chip":"","about_citation":"","about_analyse":"","about_chip1":"","about_chip2":"","exp_analyse":"","posts_analyse":"","banniere_analyse":"","reco1":"","reco2":"","reco3":"","reco4":"","diag_positif_1":"","diag_positif_2":"","diag_positif_3":"","diag_negatif_1":"","diag_negatif_2":"","diag_negatif_3":""}`
        }]
      })
    });

    if (!claudeResp.ok) throw new Error(`Claude: ${claudeResp.status}`);
    const claudeData = await claudeResp.json();
    let raw = claudeData.content[0].text.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    const a = JSON.parse(raw);

    // 3. Envoi emails via Resend
    await Promise.all([
      sendResend(email, a, linkedin_url),
      sendNotification(email, a, linkedin_url)
    ]);

  } catch (err) {
    console.error('analyze-background error:', err);
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

  const badge = (type) => {
    const map = {
      voulu: { bg: TEAL_BG, color: TEAL_TEXT, label: 'Voulu' },
      parasite: { bg: CORAL_BG, color: CORAL_TEXT, label: 'Parasite' },
      possible: { bg: '#F1EFE8', color: '#444441', label: 'Possible · à valider' }
    };
    const b = map[type] || map.voulu;
    return `<span style="display:inline-block;font-size:10px;font-weight:500;padding:2px 9px;border-radius:20px;background:${b.bg};color:${b.color};letter-spacing:.05em;text-transform:uppercase;margin-bottom:10px;">${b.label}</span>`;
  };

  const personaCard = (type, nom, qui, percoit, verdict, borderColor) => `
    <td width="25%" style="padding:6px;vertical-align:top;">
      <div style="border:.5px solid #e8e4dc;border-radius:8px;padding:14px;height:100%;border-top:3px solid ${borderColor};">
        ${badge(type)}
        <div style="font-size:13px;font-weight:500;color:#0f0f0f;margin-bottom:8px;">${nom}</div>
        <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Qui</div>
        <div style="font-size:12px;color:${GRIS};line-height:1.5;margin-bottom:8px;">${qui}</div>
        <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Ce qu'il perçoit</div>
        <div style="font-size:12px;color:${GRIS};line-height:1.5;margin-bottom:8px;">${percoit}</div>
        <div style="font-size:11.5px;color:${GRIS};font-style:italic;border-top:.5px solid #e8e4dc;padding-top:8px;line-height:1.55;">${verdict}</div>
      </div>
    </td>`;

  const algoItem = (kw, text, isGreen) => kw ? `
    <tr>
      <td style="padding:6px 0;border-bottom:.5px solid #e8e4dc;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${isGreen ? TEAL : CORAL};margin-right:8px;vertical-align:middle;"></span>
        <strong style="color:#0f0f0f;font-size:12px;">${kw}</strong>
        <span style="font-size:12px;color:${GRIS};"> — ${text}</span>
      </td>
    </tr>` : '';

  const diagItem = (text, color) => text ? `
    <tr>
      <td style="padding:4px 0 4px 12px;border-left:2px solid ${color};margin-bottom:6px;">
        <div style="font-size:12.5px;color:${color === TEAL ? '#0F6E56' : '#993C1D'};line-height:1.55;">${text}</div>
      </td>
    </tr>` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

<table width="100%" cellspacing="0" cellpadding="0" style="background:#f0ede6;padding:24px 0;">
<tr><td align="center">
<table width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#fff;border-radius:10px;overflow:hidden;border:.5px solid #e8e4dc;">

  <!-- TOPBAR -->
  <tr>
    <td style="background:${BLEU};padding:14px 32px;">
      <span style="font-family:Georgia,serif;font-size:13px;color:${OR};letter-spacing:.14em;text-transform:uppercase;">Sherpact</span>
      <span style="color:rgba(255,255,255,.25);margin:0 8px;">·</span>
      <span style="font-size:11px;color:rgba(255,255,255,.35);letter-spacing:.06em;">Diagnostic LinkedIn</span>
    </td>
  </tr>

  <!-- DISCLAIMER -->
  <tr>
    <td style="padding:16px 32px 0;">
      <table width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="background:#fff;border:1px solid #e8e4dc;border-left:4px solid ${OR};border-radius:0 6px 6px 0;padding:12px 16px;">
            <div style="font-size:10px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:${OR};margin-bottom:5px;">Première analyse — Générée par l'IA</div>
            <div style="font-size:12.5px;color:${GRIS};line-height:1.7;">Ce diagnostic est produit automatiquement à partir des informations <strong style="color:#0f0f0f;">visibles publiquement</strong> sur votre profil LinkedIn. Pour qu'il soit complet et ancré dans votre réalité, un échange de 15 minutes avec Laurent suffit.</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- HEADER PROFIL -->
  <tr>
    <td style="padding:24px 32px 20px;border-bottom:.5px solid #e8e4dc;">
      <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${GRIS};margin-bottom:8px;font-weight:500;">Diagnostic de profil · Recherche d'emploi</div>
      <div style="font-family:Georgia,serif;font-size:22px;color:#0f0f0f;margin-bottom:4px;">${a.nom || ''}</div>
      <div style="font-size:13px;color:${GRIS};margin-bottom:14px;">${a.titre || ''} · ${a.entreprise || ''} · ${a.localisation || ''}</div>
      <div style="background:${BLANC};border-left:3px solid ${BLEU};padding:12px 16px;font-size:13.5px;color:#0f0f0f;line-height:1.75;border-radius:0 4px 4px 0;">${a.intro || ''}</div>
    </td>
  </tr>

  <!-- BLOC 1 : PERSONAS -->
  <tr>
    <td style="padding:24px 32px;border-bottom:.5px solid #e8e4dc;">
      <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${GRIS};margin-bottom:16px;font-weight:500;">Bloc 1 — Personas attirés par votre profil</div>
      <table width="100%" cellspacing="0" cellpadding="0">
        <tr>
          ${personaCard('voulu', a.p1_nom||'', a.p1_qui||'', a.p1_percoit||'', a.p1_verdict||'', TEAL)}
          ${personaCard('voulu', a.p2_nom||'', a.p2_qui||'', a.p2_percoit||'', a.p2_verdict||'', TEAL)}
          ${personaCard('parasite', a.p3_nom||'', a.p3_qui||'', a.p3_percoit||'', a.p3_verdict||'', CORAL)}
          ${personaCard('possible', a.p4_nom||'', a.p4_qui||'', a.p4_blocage||'', a.p4_verdict||'', '#B4B2A9')}
        </tr>
      </table>

      <!-- ALGO -->
      <table width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;background:${BLANC};border-radius:6px;padding:14px 16px;">
        <tr><td>
          <div style="font-size:11px;font-weight:500;color:#0f0f0f;margin-bottom:10px;">Visibilité algorithmique — ce que LinkedIn fait (et ne fait pas) pour vous</div>
          <table width="100%" cellspacing="0" cellpadding="0">
            ${algoItem(a.algo_kw1, a.algo_text1, true)}
            ${algoItem(a.algo_kw2, a.algo_text2, true)}
            ${algoItem(a.algo_kw3, a.algo_text3, false)}
            ${algoItem(a.algo_kw4, a.algo_text4, false)}
          </table>
          ${a.algo_note ? `<div style="margin-top:10px;padding-top:10px;border-top:.5px solid #e8e4dc;font-size:12px;color:${GRIS};line-height:1.65;">${a.algo_note}</div>` : ''}
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- PREMIER DIAGNOSTIC -->
  <tr>
    <td style="padding:24px 32px;border-bottom:.5px solid #e8e4dc;">
      <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${GRIS};margin-bottom:16px;font-weight:500;">Premier diagnostic</div>
      <table width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td width="50%" style="padding-right:10px;vertical-align:top;">
            <div style="background:${TEAL_BG};border-radius:6px;padding:14px 16px;">
              <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.07em;color:${TEAL_TEXT};margin-bottom:10px;">Ce que le profil fait</div>
              <table width="100%" cellspacing="0" cellpadding="0">
                ${diagItem(a.diag_positif_1, TEAL)}
                ${diagItem(a.diag_positif_2, TEAL)}
                ${diagItem(a.diag_positif_3, TEAL)}
              </table>
            </div>
          </td>
          <td width="50%" style="padding-left:10px;vertical-align:top;">
            <div style="background:${CORAL_BG};border-radius:6px;padding:14px 16px;">
              <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.07em;color:${CORAL_TEXT};margin-bottom:10px;">Ce que le profil ne fait pas</div>
              <table width="100%" cellspacing="0" cellpadding="0">
                ${diagItem(a.diag_negatif_1, CORAL)}
                ${diagItem(a.diag_negatif_2, CORAL)}
                ${diagItem(a.diag_negatif_3, CORAL)}
              </table>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SIGNATURE LAURENT -->
  <tr>
    <td style="background:${BLEU};padding:28px 32px;">
      <table width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="vertical-align:top;">
            <a href="https://www.linkedin.com/in/laurentgarnier7/" style="font-family:Georgia,serif;font-size:15px;color:#fff;text-decoration:none;display:block;margin-bottom:3px;">Laurent Garnier ↗</a>
            <a href="https://www.linkedin.com/in/laurentgarnier7/" style="font-size:11px;color:${OR};opacity:.8;text-decoration:none;display:block;margin-bottom:10px;">linkedin.com/in/laurentgarnier7</a>
            <div style="font-size:12px;color:rgba(255,255,255,.5);line-height:1.7;max-width:480px;margin-bottom:14px;">Je vous aide à construire un projet solide, à maîtriser l'IA comme levier réel, et à traiter votre recherche comme une campagne — pas comme une attente. Chasseur de têtes pendant 20 ans, je vous donne les codes que les recruteurs ne partagent pas.</div>
            <a href="https://calendly.com/laurent-sherpact/15-min-sherpact-laurent-garnier" style="display:inline-block;padding:10px 22px;border:1px solid ${OR};color:${OR};font-size:11px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;border-radius:2px;">Réserver un échange de 15 min →</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- RGPD -->
  <tr>
    <td style="background:#f0ede6;padding:16px 32px;text-align:center;border-top:.5px solid #e8e4dc;">
      <p style="font-size:11px;color:#999;line-height:1.8;margin:0;">Vos données sont utilisées uniquement pour produire ce diagnostic. Elles ne sont pas stockées durablement.<br>RGPD — droit d'accès et d'effacement : <a href="mailto:laurent@sherpact.fr" style="color:#888;">laurent@sherpact.fr</a></p>
    </td>
  </tr>

</table>
</td></tr>
</table>

</body></html>`;
}
