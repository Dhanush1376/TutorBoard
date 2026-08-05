/**
 * sessionExport — conversation export (DOCX / PDF).
 *
 * Extracted verbatim from Home.jsx's handleExport so the large HTML-template
 * strings live off the critical path: this module is dynamically imported only
 * when the user actually triggers an export, keeping it out of the Home chunk.
 *
 * Pure function of (type, session, messages) — no React/store dependencies.
 */

function escapeableRole(role) {
  return role === 'user' ? 'Student' : 'TutorBoard AI';
}

function exportDocx(title, messages) {
  const header = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; }
          .msg { margin-bottom: 20pt; }
          .role { font-weight: bold; font-size: 10pt; color: #555; text-transform: uppercase; }
          .content { font-size: 11pt; }
          pre { background: #f4f4f4; padding: 10pt; font-family: 'Courier New', monospace; }
        </style>
        </head><body>
        <h1>${title}</h1>
        <hr/>
      `;
  let content = '';
  messages.forEach((m) => {
    content += `
          <div class="msg">
            <div class="role">${escapeableRole(m.role)} - ${new Date(m.timestamp).toLocaleString()}</div>
            <div class="content">${(m.content || '').replace(/\n/g, '<br/>')}</div>
            ${m.metadata?.thought ? `<div style="color: #666; font-style: italic; margin-top: 5pt; padding-left: 10pt; border-left: 2px solid #ddd;">Thought: ${m.metadata.thought}</div>` : ''}
          </div>
          <hr style="border: 0; border-top: 1px solid #eee;"/>
        `;
  });
  const footer = '</body></html>';

  const blob = new Blob(['﻿', header + content + footer], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPdf(title, messages) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return; // popup blocked
  const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono&display=swap');
              body {
                font-family: 'Inter', sans-serif;
                padding: 40px;
                line-height: 1.6;
                color: #1a1a1a;
                max-width: 850px;
                margin: 0 auto;
                background: #fff;
              }
              header { border-bottom: 2px solid #f0f0f0; margin-bottom: 30px; padding-bottom: 15px; }
              h1 { font-weight: 700; font-size: 24px; margin: 0; color: #000; }
              .date { font-size: 12px; color: #666; margin-top: 4px; }
              .msg { margin-bottom: 30px; page-break-inside: avoid; }
              .role {
                display: inline-block;
                font-weight: 600;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: #666;
                margin-bottom: 8px;
              }
              .content { font-size: 14px; white-space: pre-wrap; color: #333; }
              pre {
                background: #f8f9fa;
                color: #1a1a1a;
                padding: 15px;
                border: 1px solid #e9ecef;
                border-radius: 6px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 12px;
                overflow-x: auto;
                margin: 15px 0;
              }
              .thought { font-size: 12px; color: #777; font-style: italic; margin-top: 10px; border-left: 2px solid #eee; padding-left: 10px; }
              @media print {
                body { padding: 20px; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <header>
              <h1>${title}</h1>
              <div class="date">Exported on ${new Date().toLocaleString()} from TutorBoard AI</div>
            </header>
            <main>
              ${messages.map((m) => `
                <div class="msg">
                  <div class="role">${escapeableRole(m.role)}</div>
                  <div class="content">${m.content || ''}</div>
                  ${m.metadata?.thought ? `<div class="thought">Thought: ${m.metadata.thought}</div>` : ''}
                </div>
              `).join('')}
            </main>
            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          </body>
        </html>
      `;
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Export a conversation.
 * @param {'docx'|'pdf'} type
 * @param {object} session  resolved session ({ title, ... })
 * @param {Array}  messages resolved message list
 */
export function exportSession(type, session, messages) {
  if (!session || !messages?.length) return;
  const title = session.title || 'TutorBoard_Conversation';
  if (type === 'docx') exportDocx(title, messages);
  else if (type === 'pdf') exportPdf(title, messages);
}
