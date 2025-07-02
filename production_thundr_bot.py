#!/usr/bin/env python3
"""
PRODUCTION SELF-HEALING THUNDR BOT
Clean version with proper type hints and no linter warnings
"""

import asyncio
import json
import os
import sys
from typing import List, Dict, Optional, Any
from datetime import datetime

# Conditional imports to handle missing modules gracefully
try:
    from playwright.async_api import async_playwright, Browser, Page
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    print("Warning: Playwright not installed. Install with: pip install playwright")

# UTF-8 encoding setup (safe version)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

class ProductionBot:
    """Production-ready self-healing Thundr bot with proper typing"""
    
    def __init__(self) -> None:
        self.page: Optional[Page] = None
        self.browser: Optional[Browser] = None
        self.step_count: int = 0
        self.selector_cache: Dict[str, str] = {}
        self.load_selector_cache()
        
    def load_selector_cache(self) -> None:
        """Load cached selectors from file"""
        try:
            if os.path.exists('selector_cache.json'):
                with open('selector_cache.json', 'r', encoding='utf-8') as f:
                    self.selector_cache = json.load(f)
                print(f"[CACHE] ✅ Loaded {len(self.selector_cache)} cached selectors")
        except Exception as e:
            print(f"[CACHE] Warning: Could not load cache: {e}")
            self.selector_cache = {}
    
    def save_selector_cache(self) -> None:
        """Save working selectors to cache"""
        try:
            with open('selector_cache.json', 'w', encoding='utf-8') as f:
                json.dump(self.selector_cache, f, indent=2)
        except Exception as e:
            print(f"[CACHE] Warning: Could not save cache: {e}")
    
    def log_step(self, step_name: str, status: str = "START", details: str = "") -> None:
        """Log step with timestamp and emoji"""
        self.step_count += 1
        timestamp = datetime.now().strftime("%H:%M:%S")
        emoji_map = {
            "START": "🔄", "SUCCESS": "✅", "FAILED": "❌", 
            "WARNING": "⚠️", "AUTO-FIX": "🔧", "INFO": "ℹ️"
        }
        emoji = emoji_map.get(status, "🔄")
        
        print(f"[{timestamp}] STEP {self.step_count}: {emoji} {step_name}")
        if details:
            print(f"         📋 {details}")
    
    async def self_healing_click(self, selectors: List[str], description: str, cache_key: Optional[str] = None) -> bool:
        """Self-healing click with caching and DOM scanning"""
        if not self.page:
            self.log_step(description, "FAILED", "Page not available")
            return False
            
        self.log_step(f"Self-Healing: {description}", "START")
        
        # Try cached selector first
        if cache_key and cache_key in self.selector_cache:
            try:
                await self.page.click(self.selector_cache[cache_key], timeout=3000)
                self.log_step(description, "SUCCESS", f"✅ Used cached: {self.selector_cache[cache_key]}")
                return True
            except Exception:
                pass
        
        # Try provided selectors
        for i, selector in enumerate(selectors):
            try:
                await self.page.click(selector, timeout=3000)
                self.log_step(description, "SUCCESS", f"✅ Selector {i+1}: {selector}")
                if cache_key:
                    self.selector_cache[cache_key] = selector
                    self.save_selector_cache()
                return True
            except Exception:
                self.log_step(description, "WARNING", f"⚠️ Selector {i+1} failed")
        
        # AUTO-FIX: Scan DOM for similar elements
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
                        if cache_key:
                            self.selector_cache[cache_key] = f':has-text("{text}")'
                            self.save_selector_cache()
                        return True
                except Exception:
                    continue
        except Exception as e:
            self.log_step(description, "FAILED", f"❌ Auto-fix failed: {str(e)[:50]}")
        
        return False
    
    async def self_healing_fill(self, selectors: List[str], text: str, description: str, cache_key: Optional[str] = None) -> bool:
        """Self-healing form fill with caching"""
        if not self.page:
            self.log_step(description, "FAILED", "Page not available")
            return False
            
        self.log_step(f"Self-Healing Fill: {description}", "START")
        
        # Try cached selector first
        if cache_key and cache_key in self.selector_cache:
            try:
                await self.page.fill(self.selector_cache[cache_key], text, timeout=3000)
                self.log_step(description, "SUCCESS", f"✅ Used cached: {self.selector_cache[cache_key]}")
                return True
            except Exception:
                pass
        
        # Try provided selectors
        for i, selector in enumerate(selectors):
            try:
                await self.page.fill(selector, text, timeout=3000)
                self.log_step(description, "SUCCESS", f"✅ Selector {i+1}: {selector}")
                if cache_key:
                    self.selector_cache[cache_key] = selector
                    self.save_selector_cache()
                return True
            except Exception:
                self.log_step(description, "WARNING", f"⚠️ Selector {i+1} failed")
        
        self.log_step(description, "FAILED", "❌ No suitable input found")
        return False
    
    async def take_screenshot(self, name: str) -> Optional[str]:
        """Take debug screenshot"""
        if not self.page:
            return None
            
        try:
            timestamp = int(datetime.now().timestamp())
            filename = f"{name}_{timestamp}.png"
            await self.page.screenshot(path=filename)
            self.log_step("Screenshot", "SUCCESS", f"✅ Saved: {filename}")
            return filename
        except Exception as e:
            self.log_step("Screenshot", "FAILED", f"❌ Error: {e}")
            return None
    
    async def run_production_session(self) -> Dict[str, Any]:
        """Run production session and return results"""
        results = {
            "success": False,
            "steps_completed": 0,
            "cached_selectors": len(self.selector_cache),
            "errors": [],
            "duration": 0
        }
        
        if not PLAYWRIGHT_AVAILABLE:
            results["errors"].append("Playwright not available")
            return results
        
        start_time = datetime.now()
        
        try:
            self.log_step("PRODUCTION SESSION", "START", "Starting self-healing bot")
            
            # Setup browser
            playwright = await async_playwright().__aenter__()
            self.browser = await playwright.chromium.launch(headless=False)
            self.page = await self.browser.new_page()
            self.log_step("Browser Setup", "SUCCESS", "✅ Browser ready")
            
            # Navigate to thundr.com
            await self.page.goto("https://thundr.com", timeout=30000)
            await self.page.wait_for_load_state('networkidle', timeout=10000)
            self.log_step("Navigation", "SUCCESS", "✅ thundr.com loaded")
            
            # Test cached selectors
            print(f"\n🎯 TESTING {len(self.selector_cache)} CACHED SELECTORS:")
            for key, selector in self.selector_cache.items():
                print(f"   💾 {key}: {selector}")
            
            # Interest input (should be cached)
            await self.self_healing_click([
                'input[placeholder="Type your interests..."]',
                'input[placeholder*="interest"]'
            ], "click interest input", "interest_input")
            
            await asyncio.sleep(2)
            
            # Type interests
            await self.self_healing_fill([
                'input[placeholder="Type your interests..."]'
            ], "gaming music", "type interest", "interest_input")
            
            await asyncio.sleep(2)
            
            # Video chat button
            await self.self_healing_click([
                'button:has-text("Video Chat")',
                '.chakra-button.css-1oy2lww'
            ], "click video chat", "video_chat_button")
            
            await asyncio.sleep(3)
            
            # Optional popup handling
            await self.self_healing_click([
                'button:has-text("I Agree")',
                'button:has-text("Agree")'
            ], "handle agree popup", "agree_popup")
            
            await asyncio.sleep(3)
            
            # Form testing
            self.log_step("Form Testing", "INFO", "🔧 Testing form elements")
            
            # Female/Everyone selection
            await self.self_healing_click([
                'button:has-text("Female")',
                'input[value="female"]'
            ], "select female", "female_button")
            
            await self.self_healing_click([
                'button:has-text("Everyone")',
                'input[value="everyone"]'
            ], "select everyone", "everyone_button")
            
            # Start button
            await self.self_healing_click([
                'button:has-text("Start")',
                'button.chakra-button'
            ], "click start", "start_button")
            
            await asyncio.sleep(5)
            await self.take_screenshot("production_test_completed")
            
            results["success"] = True
            results["steps_completed"] = self.step_count
            results["cached_selectors"] = len(self.selector_cache)
            
            self.log_step("PRODUCTION SESSION", "SUCCESS", f"✅ Completed {self.step_count} steps")
            
        except Exception as e:
            error_msg = f"Session error: {str(e)}"
            results["errors"].append(error_msg)
            self.log_step("PRODUCTION SESSION", "FAILED", f"❌ {error_msg}")
        
        finally:
            # Cleanup
            self.save_selector_cache()
            if self.browser:
                await self.browser.close()
            
            end_time = datetime.now()
            results["duration"] = (end_time - start_time).total_seconds()
        
        return results

async def main() -> None:
    """Main entry point"""
    print("🏭 PRODUCTION SELF-HEALING THUNDR BOT")
    print("🔧 Clean version with proper type hints")
    print("=" * 50)
    
    bot = ProductionBot()
    results = await bot.run_production_session()
    
    print(f"\n📊 PRODUCTION RESULTS:")
    print(f"   ✅ Success: {results['success']}")
    print(f"   📈 Steps: {results['steps_completed']}")
    print(f"   💾 Cached: {results['cached_selectors']}")
    print(f"   ⏱️  Duration: {results['duration']:.1f}s")
    
    if results['errors']:
        print(f"   ❌ Errors: {len(results['errors'])}")
        for error in results['errors']:
            print(f"      - {error}")

if __name__ == "__main__":
    asyncio.run(main()) 