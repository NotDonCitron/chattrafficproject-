#!/usr/bin/env python3
"""
EMERGENCY SELECTOR INSPECTOR
Quick script to find the actual selectors for Thundr.com
"""

import asyncio
from playwright.async_api import async_playwright

async def inspect_thundr_selectors():
    print("🔍 EMERGENCY SELECTOR INSPECTOR")
    print("Analyzing Thundr.com to find correct selectors...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # Go to thundr
        await page.goto("https://thundr.com")
        await asyncio.sleep(3)
        
        print("\n=== STEP 1: FIND INTEREST INPUT ===")
        inputs = await page.query_selector_all('input')
        for i, inp in enumerate(inputs):
            try:
                placeholder = await inp.get_attribute('placeholder')
                aria_label = await inp.get_attribute('aria-label')
                name = await inp.get_attribute('name')
                id_attr = await inp.get_attribute('id')
                
                if placeholder and 'interest' in placeholder.lower():
                    print(f"✅ INTEREST INPUT FOUND: input[placeholder='{placeholder}']")
                    
                    # Click it to open dropdown
                    await inp.click()
                    await asyncio.sleep(2)
                    break
                    
            except:
                continue
        
        print("\n=== STEP 2: ANALYZE DROPDOWN STRUCTURE ===")
        await asyncio.sleep(2)
        
        # Try different dropdown selectors
        dropdown_selectors = [
            'li[role="option"]',
            '[role="option"]',
            '.chakra-menu__menuitem',
            '.menu-item',
            '[data-index]',
            'li',
            'div[role="button"]',
            '[data-value]'
        ]
        
        for selector in dropdown_selectors:
            try:
                elements = await page.query_selector_all(selector)
                if elements and len(elements) > 3:  # Likely dropdown options
                    print(f"✅ DROPDOWN OPTIONS FOUND: {selector} ({len(elements)} elements)")
                    
                    # Get sample text
                    for i, elem in enumerate(elements[:5]):
                        try:
                            text = await elem.inner_text()
                            if text.strip():
                                print(f"   Sample {i+1}: '{text.strip()}'")
                        except:
                            pass
                    break
            except:
                continue
        
        print("\n=== STEP 3: FIND FORM ELEMENTS ===")
        await asyncio.sleep(1)
        
        # Click Video Chat to get to form
        try:
            await page.click('button:has-text("Video Chat")')
            await asyncio.sleep(3)
            
            # Look for I Agree popup
            try:
                await page.click('button:has-text("I Agree")')
                await asyncio.sleep(2)
            except:
                pass
            
            print("\n--- ANALYZING FORM BUTTONS ---")
            buttons = await page.query_selector_all('button')
            for i, btn in enumerate(buttons[:15]):
                try:
                    text = await btn.inner_text()
                    class_name = await btn.get_attribute('class')
                    if text and text.strip():
                        print(f"Button {i+1}: '{text.strip()}' - class='{class_name}'")
                except:
                    pass
            
            print("\n--- ANALYZING FORM INPUTS ---")
            inputs = await page.query_selector_all('input')
            for i, inp in enumerate(inputs):
                try:
                    placeholder = await inp.get_attribute('placeholder')
                    input_type = await inp.get_attribute('type')
                    name = await inp.get_attribute('name')
                    aria_label = await inp.get_attribute('aria-label')
                    
                    print(f"Input {i+1}: type='{input_type}' placeholder='{placeholder}' name='{name}' aria-label='{aria_label}'")
                except:
                    pass
                    
        except Exception as e:
            print(f"Form analysis failed: {e}")
        
        # Take screenshot for manual inspection
        await page.screenshot(path="emergency_selector_debug.png")
        print(f"\n📸 Screenshot saved: emergency_selector_debug.png")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_thundr_selectors()) 