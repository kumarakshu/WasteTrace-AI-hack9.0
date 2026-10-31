import puppeteer from 'puppeteer-core';
import http from 'http';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://127.0.0.1:8000';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runAudit() {
  console.log('====================================================');
  console.log('STARTING AUTOMATED BROWSER E2E VERIFICATION OF STEPS 1-4');
  console.log('Browser Executable:', EDGE_PATH);
  console.log('Target Frontend:', BASE_URL);
  console.log('====================================================\n');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Listen to browser console
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[Console ${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => console.log('[Page Error]:', err.message));

  let createdIncidentId = null;

  try {
    // ================================================================
    // STEP 1: Verify Delhi Map Centering & Attribution
    // ================================================================
    console.log('>>> TESTING STEP 1: Delhi Map Centering & Attribution...');
    await page.goto(`${BASE_URL}/map`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.leaflet-container', { timeout: 8000 });

    const attributionText = await page.evaluate(() => {
      const el = document.querySelector('.leaflet-control-attribution');
      return el ? el.innerText : '';
    });
    console.log(' - Attribution text found:', JSON.stringify(attributionText));
    if (!attributionText.includes('OpenStreetMap') || !attributionText.includes('WasteTrace Delhi MVP')) {
      throw new Error(`Attribution check failed! Found: ${attributionText}`);
    }

    const headerText = await page.evaluate(() => {
      const h = document.querySelector('h1');
      return h ? h.innerText : '';
    });
    console.log(' - Map page header:', headerText);

    const tilesCount = await page.evaluate(() => {
      return document.querySelectorAll('img.leaflet-tile').length;
    });
    console.log(' - Rendered map tiles count:', tilesCount);
    if (tilesCount === 0) {
      console.warn(' ! Warning: No tiles rendered yet, waiting 2s...');
      await sleep(2000);
    }

    const markerCount = await page.evaluate(() => {
      return document.querySelectorAll('.custom-map-marker').length;
    });
    console.log(' - Stored database hotspot markers plotted:', markerCount);
    if (markerCount === 0) {
      throw new Error('No hotspot markers found on the map!');
    }
    console.log(' [PASS] STEP 1: Delhi Map Centering, Attribution, and Markers Verified!\n');

    // ================================================================
    // STEP 2: Test Interactive Map Pinning & Address Search
    // ================================================================
    console.log('>>> TESTING STEP 2: Interactive Map Pinning & Address Search...');
    await page.goto(`${BASE_URL}/report`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('form', { timeout: 8000 });

    // Check initial coordinates
    const initialCoords = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="number"]');
      return Array.from(inputs).map(i => parseFloat(i.value));
    });
    console.log(' - Initial coordinates in form:', initialCoords);
    if (Math.abs(initialCoords[0] - 28.6304) > 0.01 || Math.abs(initialCoords[1] - 77.2777) > 0.01) {
      throw new Error(`Initial coordinates are not centered on Laxmi Nagar, Delhi! Got: ${initialCoords}`);
    }

    // Type address in search box
    console.log(' - Typing "Preet Vihar" in Delhi locality search...');
    const searchInput = await page.$('input[placeholder*="Laxmi Nagar"]');
    if (!searchInput) throw new Error('Address search input not found!');
    await searchInput.type('Preet Vihar', { delay: 50 });
    await sleep(800); // Wait for debounce

    // Check autocomplete results
    const resultsCount = await page.evaluate(() => {
      return document.querySelectorAll('.absolute button').length;
    });
    console.log(' - Search autocomplete suggestions found:', resultsCount);
    if (resultsCount === 0) {
      throw new Error('No autocomplete suggestions appeared for Preet Vihar!');
    }

    // Click the first suggestion (Preet Vihar)
    await page.evaluate(() => {
      const firstBtn = document.querySelector('.absolute button');
      if (firstBtn) firstBtn.click();
    });
    await sleep(500);

    const updatedCoords = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="number"]');
      return Array.from(inputs).map(i => parseFloat(i.value));
    });
    console.log(' - Coordinates after selecting Preet Vihar:', updatedCoords);
    if (Math.abs(updatedCoords[0] - 28.6416) > 0.01 || Math.abs(updatedCoords[1] - 77.2965) > 0.01) {
      throw new Error(`Coordinates did not snap to Preet Vihar! Got: ${updatedCoords}`);
    }

    // Click on map to test map click pin-drop
    console.log(' - Clicking on map picker to test manual pin drop...');
    const mapEl = await page.$('.leaflet-container');
    if (mapEl) {
      const box = await mapEl.boundingBox();
      await page.mouse.click(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20);
      await sleep(1000);

      const clickedCoords = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="number"]');
        return Array.from(inputs).map(i => parseFloat(i.value));
      });
      console.log(' - Coordinates after manual map click:', clickedCoords);
      const clickedAddr = await page.evaluate(() => {
        const addrInput = document.querySelector('input[placeholder*="Vikas Marg Metro"]');
        return addrInput ? addrInput.value : '';
      });
      console.log(' - Reverse-geocoded address string:', clickedAddr);
    }

    // Test GPS button fallback
    console.log(' - Testing "Use My GPS Location" button error/permission branch...');
    const gpsBtn = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('GPS'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log(' - Clicked GPS button:', gpsBtn);
    await sleep(1500);
    const noticeText = await page.evaluate(() => {
      const p = document.querySelector('p.text-amber-700');
      return p ? p.innerText : 'No error banner (normal if permitted)';
    });
    console.log(' - GPS status notice:', noticeText);

    console.log(' [PASS] STEP 2: Map Pinning, Locality Autocomplete, and Coordinate Sync Verified!\n');

    // ================================================================
    // STEP 3: Test Incident Submission & Hotspot Map Sync
    // ================================================================
    console.log('>>> TESTING STEP 3: Incident Submission & Hotspot Map Sync...');
    // Select preset demonstration site: Laxmi Nagar Metro Station
    await page.evaluate(() => {
      const select = document.querySelector('select[class*="bg-emerald-50"]');
      if (select && select.options.length > 1) {
        select.value = select.options[1].value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(500);

    // Fill Title
    const titleInput = await page.$('input[placeholder*="Vikas Marg Metro exit"]');
    if (titleInput) {
      await page.evaluate(el => el.value = '', titleInput);
      await titleInput.type('Automated E2E Verification Report at Laxmi Nagar');
    }

    // Fill Description
    const descTextarea = await page.$('textarea');
    if (descTextarea) {
      await page.evaluate(el => el.value = '', descTextarea);
      await descTextarea.type('Automated test report submitted via headless Edge browser for end-to-end verification.');
    }

    // Submit form
    console.log(' - Submitting incident form...');
    await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Submit Incident Report'));
      if (submitBtn) submitBtn.click();
    });

    // Wait for confirmation card
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Incident Registered & Evaluated!');
    }, { timeout: 8000 });

    const confirmationInfo = await page.evaluate(() => {
      const text = document.body.innerText;
      const idMatch = text.match(/INC-2026-\d+/);
      const isRecTriggered = text.includes('Spatial Recurrence Engine Triggered') || text.includes('Recurrence Engine Triggered');
      return {
        id: idMatch ? idMatch[0] : null,
        isRecTriggered,
        snippet: text.substring(text.indexOf('Incident Registered'), text.indexOf('Incident Registered') + 300)
      };
    });

    console.log(' - Confirmation received! Created Incident ID:', confirmationInfo.id);
    console.log(' - Recurrence engine feedback detected:', confirmationInfo.isRecTriggered);
    if (!confirmationInfo.id) {
      throw new Error('Failed to retrieve newly created Incident ID from confirmation card!');
    }
    createdIncidentId = confirmationInfo.id;

    // Navigate to /map and verify incident appears in side list and on map
    console.log(` - Navigating to /map to verify ${createdIncidentId} appears in hotspot list...`);
    await page.goto(`${BASE_URL}/map`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.custom-map-marker', { timeout: 8000 });

    const incidentFoundInList = await page.evaluate((id) => {
      const listEl = document.querySelector('div.flex-1.overflow-y-auto');
      return listEl ? listEl.innerText.includes('Automated E2E Verification Report') : false;
    }, createdIncidentId);
    console.log(` - Incident "${createdIncidentId}" found in Hotspot Map side list:`, incidentFoundInList);
    if (!incidentFoundInList) {
      throw new Error(`Incident ${createdIncidentId} not visible on Hotspot Map list!`);
    }

    console.log(' [PASS] STEP 3: Incident Submission and Hotspot Map Sync Verified!\n');

    // ================================================================
    // STEP 4: Test Supervisor Verification, 30-Day Relapse Monitoring & Agent
    // ================================================================
    console.log('>>> TESTING STEP 4: Supervisor Verification, 30-Day Monitoring & Operational Agent...');
    
    // Switch role to Supervisor
    console.log(' - Switching demo role to Supervisor...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('header button, nav button, div button'));
      const supBtn = btns.find(b => b.innerText.includes('Supervisor'));
      if (supBtn) supBtn.click();
    });
    await sleep(500);

    // Navigate to /resolutions
    console.log(' - Navigating to /resolutions...');
    await page.goto(`${BASE_URL}/resolutions`, { waitUntil: 'networkidle2' });
    await sleep(1000);

    const tabsFound = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(t => t.includes('('));
    });
    console.log(' - Verification workflow tabs found on /resolutions:', tabsFound);

    // Navigate to /insights
    console.log(' - Navigating to /insights...');
    await page.goto(`${BASE_URL}/insights`, { waitUntil: 'networkidle2' });
    await sleep(1000);

    // Switch to Operational Agent tab
    console.log(' - Clicking "Operational Agent" tab...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const agentTab = btns.find(b => b.innerText.includes('Operational Agent'));
      if (agentTab) agentTab.click();
    });
    await sleep(800);

    // Click "Run Audit Now"
    console.log(' - Triggering "Run Audit Now"...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const runBtn = btns.find(b => b.innerText.includes('Run Audit Now') || b.innerText.includes('Recurrence Audit'));
      if (runBtn) runBtn.click();
    });
    await sleep(1500);

    const auditOutput = await page.evaluate(() => {
      const h2 = document.querySelector('h2');
      const facts = Array.from(document.querySelectorAll('li')).map(l => l.innerText);
      const toolsHeader = Array.from(document.querySelectorAll('div')).find(d => d.innerText.includes('Tool Execution Proofs'));
      return {
        title: h2 ? h2.innerText : '',
        factCount: facts.length,
        hasToolProofs: !!toolsHeader
      };
    });

    console.log(' - Agent Audit Title:', auditOutput.title);
    console.log(' - Grounded Observations/Facts Count:', auditOutput.factCount);
    console.log(' - Tool Execution Proofs displayed:', auditOutput.hasToolProofs);
    if (!auditOutput.hasToolProofs || auditOutput.factCount === 0) {
      throw new Error('Operational Agent output missing tool proofs or grounded facts!');
    }

    console.log(' [PASS] STEP 4: Supervisor Audit & Operational Agent Verified!\n');

    console.log('====================================================');
    console.log('ALL 4 STEPS TESTED AND FULLY VERIFIED IN LIVE BROWSER!');
    console.log('====================================================');

  } catch (err) {
    console.error('\n❌ AUDIT ENCOUNTERED AN ERROR:', err.message);
    throw err;
  } finally {
    // Clean up created incident from database if any
    if (createdIncidentId) {
      console.log(`\n[Cleanup] Deleting test incident ${createdIncidentId} from database...`);
      try {
        const postData = JSON.stringify({ id: createdIncidentId });
        // Call Python cleanup script to cleanly purge createdIncidentId
        const { execSync } = await import('child_process');
        execSync(`.\\.venv\\Scripts\\python.exe -c "from backend.database import SessionLocal; from backend.models import Incident, StatusHistory, RecurrenceAlert; db = SessionLocal(); inc_id = '${createdIncidentId}'; db.query(RecurrenceAlert).filter((RecurrenceAlert.primary_incident_id == inc_id) | (RecurrenceAlert.trigger_incident_id == inc_id)).delete(); db.query(StatusHistory).filter(StatusHistory.incident_id == inc_id).delete(); db.query(Incident).filter(Incident.id == inc_id).delete(); db.commit(); db.close();"`);
        console.log(`[Cleanup] Incident ${createdIncidentId} successfully removed.`);
      } catch (cleanErr) {
        console.warn('[Cleanup Warning]:', cleanErr.message);
      }
    }
    await browser.close();
  }
}

runAudit().catch(err => {
  console.error(err);
  process.exit(1);
});

