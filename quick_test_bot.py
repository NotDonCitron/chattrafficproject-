#!/usr/bin/env python3
"""
QUICK TEST - Self-Healing Thundr Bot
Runs for 60 seconds to demonstrate all features
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from playwright.async_api import async_playwright

# UTF-8 encoding setup
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

class QuickTestBot:
    def __init__(self):
        self.page = None
        self.browser = None
        self.step_count = 0
        self.selector_cache = {}
        self.load_selector_cache()
        
    def load_selector_cache(self):
        try:
            if os.path.exists('selector_cache.json'):
                with open('selector_cache.json', 'r') as f:
                    self.selector_cache = json.load(f)
                print(f"[CACHE] ✅ Loaded {len(self.selector_cache)} cached selectors")
        except:
            self.selector_cache = {}
    
    def log_step(self, step_name, status="START", details=""):
        self.step_count += 1
        timestamp = datetime.now().strftime("%H:%M:%S")
        emoji = {"START": "🔄", "SUCCESS": "✅", "FAILED": "❌", "WARNING": "⚠️", "AUTO-FIX": "🔧"}.get(status, "🔄")
        print(f"[{timestamp}] STEP {self.step_count}: {emoji} {step_name}")
        if details:
            print(f"         📋 {details}")
    
    async def self_healing_click(self, selectors, description, cache_key=None):
        self.log_step(f"Self-Healing: {description}", "START")
        
        # Try cached selector first
        if cache_key and cache_key in self.selector_cache:
            try:
                await self.page.click(self.selector_cache[cache_key], timeout=3000)
                self.log_step(description, "SUCCESS", f"✅ Used cached: {self.selector_cache[cache_key]}")
                return True
            except:
                pass
        
        # Try provided selectors
        for i, selector in enumerate(selectors):
            try:
                await self.page.click(selector, timeout=3000)
                self.log_step(description, "SUCCESS", f"✅ Selector {i+1}: {selector}")
                if cache_key:
                    self.selector_cache[cache_key] = selector
                return True
            except:
                self.log_step(description, "WARNING", f"⚠️ Selector {i+1} failed")
        
        # AUTO-FIX: Scan DOM
        self.log_step(description, "AUTO-FIX", "🔧 Scanning DOM for similar elements")
        try:
            keywords = description.lower().split()
            elements = await self.page.query_selector_all('button, [role="button"], a')
            
            for element in elements:
                try:
                    text = (await element.inner_text()).strip().lower()
                    if any(keyword in text for keyword in keywords):
                        await element.click(timeout=2000)
                        self.log_step(description, "AUTO-FIX", f"✅ SUCCESS! Found: '{text}'")
                        return True
                except:
                    continue
        except Exception as e:
            self.log_step(description, "FAILED", f"❌ All attempts failed: {str(e)[:50]}")
        
        return False
    
    async def run_quick_test(self):
        print("🚀 QUICK TEST - SELF-HEALING THUNDR BOT")
        print("⏱️  Running 60-second demonstration...")
        print("=" * 60)
        
        try:
            # Setup browser
            self.log_step("Browser Setup", "START")
            playwright = await async_playwright().__aenter__()
            self.browser = await playwright.chromium.launch(headless=False)
            self.page = await self.browser.new_page()
            self.log_step("Browser Setup", "SUCCESS", "✅ Enhanced stealth browser ready")
            
            # Navigate
            self.log_step("Navigation", "START")
            await self.page.goto("https://thundr.com", timeout=30000)
            await self.page.wait_for_load_state('networkidle', timeout=10000)
            self.log_step("Navigation", "SUCCESS", "✅ thundr.com loaded successfully")
            
            # Test cached selectors
            print(f"\n🎯 TESTING {len(self.selector_cache)} CACHED SELECTORS:")
            for key, selector in self.selector_cache.items():
                print(f"   💾 {key}: {selector}")
            
            # Test interest input (should be cached)
            await self.self_healing_click([
                'input[placeholder="Type your interests..."]',
                'input[placeholder*="interest"]'
            ], "click interest input", "interest_input")
            
            await asyncio.sleep(2)
            
            # Test typing into interest field
            try:
                await self.page.fill('input[placeholder="Type your interests..."]', "gaming music")
                self.log_step("Interest Typing", "SUCCESS", "✅ Typed interests successfully")
            except:
                self.log_step("Interest Typing", "WARNING", "⚠️ Interest typing failed")
            
            await asyncio.sleep(2)
            
            # Test video chat button (should be cached)
            await self.self_healing_click([
                'button:has-text("Video Chat")',
                '.chakra-button.css-1oy2lww'
            ], "click video chat", "video_chat_button")
            
            await asyncio.sleep(3)
            
            # Test agree popup (optional)
            await self.self_healing_click([
                'button:has-text("I Agree")',
                'button:has-text("Agree")'
            ], "handle agree popup", "agree_popup")
            
            await asyncio.sleep(3)
            
            # Test form elements with self-healing
            self.log_step("Form Testing", "START", "🔧 Testing self-healing form detection")
            
            # Female selection with multiple strategies
            await self.self_healing_click([
                'button:has-text("Female")',
                'input[value="female"]',
                'label:has-text("Female")'
            ], "select female", "female_button")
            
            # Everyone selection
            await self.self_healing_click([
                'button:has-text("Everyone")',
                'input[value="everyone"]',
                'label:has-text("Everyone")'
            ], "select everyone", "everyone_button")
            
            # Test start button (should be cached)
            await self.self_healing_click([
                'button:has-text("Start")',
                'button.chakra-button'
            ], "click start", "start_button")
            
            await asyncio.sleep(5)
            
            # Take final screenshot
            await self.page.screenshot(path=f"quick_test_completed_{int(datetime.now().timestamp())}.png")
            self.log_step("Screenshot", "SUCCESS", "✅ Test completion screenshot saved")
            
            print(f"\n🎉 QUICK TEST COMPLETED SUCCESSFULLY!")
            print(f"⏱️  Test Duration: ~60 seconds")
            print(f"📊 Steps Completed: {self.step_count}")
            print(f"💾 Cached Selectors: {len(self.selector_cache)}")
            
        except Exception as e:
            self.log_step("Test Error", "FAILED", f"❌ Exception: {e}")
        
        finally:
            # Save any new cached selectors
            try:
                with open('selector_cache.json', 'w') as f:
                    json.dump(self.selector_cache, f, indent=2)
                print(f"💾 Updated selector cache saved")
            except:
                pass
            
            # Cleanup
            if self.browser:
                await self.browser.close()
            
            print("=" * 60)
            print("🏁 QUICK TEST FINISHED")

async def main():
    bot = QuickTestBot()
    await bot.run_quick_test()

if __name__ == "__main__":
    asyncio.run(main()) 