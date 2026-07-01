const { test, expect } = require('@playwright/test');

test('window content fits without vertical overflow', async ({ page }) => {
  // Load the HTML file directly
  await page.goto('file:///home/ryan/repo/gyroclopter/app/index.html');
  
  // Get the body scroll height and viewport height
  const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  
  // Body content should fit within viewport (no overflow)
  // Allow 1px tolerance for sub-pixel rendering
  expect(bodyHeight).toBeLessThanOrEqual(viewportHeight + 1);
  
  // Check that body has overflow: hidden
  const overflowY = await page.evaluate(() => 
    getComputedStyle(document.body).overflowY
  );
  expect(overflowY).toBe('hidden');
  
  // Verify no scrollbar on body
  const hasVerticalScrollbar = await page.evaluate(() => 
    window.innerHeight < document.documentElement.scrollHeight
  );
  expect(hasVerticalScrollbar).toBe(false);
});

test('all cards are visible within viewport', async ({ page }) => {
  await page.goto('file:///home/ryan/repo/gyroclopter/app/index.html');
  
  // Check each card is within viewport
  const cardsVisibility = await page.evaluate(() => {
    const cards = document.querySelectorAll('.card');
    return Array.from(cards).map(card => {
      const rect = card.getBoundingClientRect();
      return {
        class: card.className,
        top: rect.top,
        bottom: rect.bottom,
        inViewport: rect.top >= 0 && rect.bottom <= window.innerHeight
      };
    });
  });
  
  cardsVisibility.forEach(card => {
    expect(card.inViewport).toBe(true);
  });
});

test('footer is visible at bottom', async ({ page }) => {
  await page.goto('file:///home/ryan/repo/gyroclopter/app/index.html');
  
  const footerVisible = await page.evaluate(() => {
    const footer = document.querySelector('.footer');
    const rect = footer.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
  expect(footerVisible).toBe(true);
});

test('instructions card has internal scroll if needed', async ({ page }) => {
  await page.goto('file:///home/ryan/repo/gyroclopter/app/index.html');
  
  // Instructions should have overflow-y: auto for internal scrolling
  const instructionsOverflow = await page.evaluate(() => 
    getComputedStyle(document.querySelector('.instructions')).overflowY
  );
  expect(instructionsOverflow).toBe('auto');
});