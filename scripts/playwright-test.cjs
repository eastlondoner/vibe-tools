/* eslint-env node */
/* eslint no-console: "off" */
const { chromium } = require('playwright');

async function connectToChromeAndNavigate() {
  let browser;
  try {
    console.log('Connecting to Chrome browser on port 9222...');
    
    // Connect to the existing Chrome browser via Chrome DevTools Protocol
    browser = await chromium.connectOverCDP('http://localhost:9222');
    
    console.log('✓ Connected to Chrome browser');
    
    // Get the default context and create a new page
    const context = browser.contexts()[0] || await browser.newContext();
    const page = await context.newPage();
    
    console.log('✓ Created new page');
    
    const targetUrl = 'https://chrome.google.com/webstore/devconsole/0a7be50b-f54f-4e7b-82c9-622a380cafc9/miplldbnkopaghnkiebdkefnmokobeco/edit';
    
    console.log(`Navigating to: ${targetUrl}`);
    
    // Navigate to the specified URL
    await page.goto(targetUrl, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('✓ Successfully navigated to Chrome Web Store developer console');
    
    // Wait a bit to see the page
    await page.waitForTimeout(2000);
    
    console.log('Script completed successfully');
    
  } catch (error) {
    console.error('Error:', error.message);
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
      console.error('\nMake sure Chrome is running with remote debugging enabled on port 9222.');
      console.error('You can start Chrome with debugging using:');
      console.error('open -a "Google Chrome" --args --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir="/tmp/chrome-remote-debugging"');
    }
    
    process.exit(1);
  } finally {
    if (browser) {
      console.log('Disconnecting from browser...');
      await browser.close();
    }
  }
}

// If this script is run directly
if (require.main === module) {
  connectToChromeAndNavigate();
}

module.exports = { connectToChromeAndNavigate }; 