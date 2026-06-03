const puppeteer = require('puppeteer');
const path = require('path');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generatePDF(inputFile, outputFile) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    const filePath = path.resolve(__dirname, '..', 'src', inputFile);
    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0', timeout: 90000 });

    // Wait for Mermaid diagrams to render fully
    await page.evaluate(async () => {
      if (window.mermaid && window.mermaid.run) {
        try { await window.mermaid.run(); } catch (e) {}
      }
    });
    await sleep(6000);

    await page.pdf({
      path: path.resolve(__dirname, '..', 'output', outputFile),
      format: 'A4',
      printBackground: true,
      margin: { top: '0.5in', right: '0.6in', bottom: '0.5in', left: '0.6in' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="font-size:9px;color:#94A3B8;width:100%;text-align:center;font-family:Inter,sans-serif;padding-top:2px;">Basilisk &mdash; Confidential &nbsp;&nbsp;|&nbsp;&nbsp; <span class="pageNumber"></span> / <span class="totalPages"></span></div>'
    });

    console.log(`Generated: ${outputFile}`);
  } finally {
    await browser.close();
  }
}

(async () => {
  try {
    // Render only the file(s) requested via CLI arg, or all by default.
    // Usage: node scripts/generate-pdf.js            -> builds all
    //        node scripts/generate-pdf.js plan       -> builds the MVP plan only
    //        node scripts/generate-pdf.js prd        -> builds the PRD only
    const docs = {
      prd:  ['basilisk-prd.html', 'basilisk-prd.pdf'],
      plan: ['basilisk-mvp-plan.html', 'basilisk-mvp-plan.pdf'],
    };
    const which = process.argv[2];
    const targets = which && docs[which] ? [docs[which]] : Object.values(docs);
    for (const [input, output] of targets) {
      await generatePDF(input, output);
    }
    console.log('PDF generation complete.');
  } catch (err) {
    console.error('Error generating PDF:', err);
    process.exit(1);
  }
})();
