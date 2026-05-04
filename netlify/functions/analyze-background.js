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
