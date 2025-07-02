#!/usr/bin/env python3
"""
SELF-HEALING THUNDR BOT
Implements auto-fix, DOM scanning, selector caching, and comprehensive error recovery
"""

import asyncio
import random
import sys
import json
import os
from datetime import datetime, timedelta
from playwright.async_api import async_playwright

# UTF-8 encoding setup for Windows
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

class SelfHealingBot:
    def __init__(self):
        self.page = None
        self.browser = None
        self.step_count = 0
        self.session_data = {}
        self.selector_cache = {}
        self.load_selector_cache()
        
        # Messages for chat
        self.messages = [
            "Hi there! How's your day going?",
            "Hello! Nice to meet you!",
            "Hey! What's up?",
            "Hi! How are you doing?",
            "Hello! What brings you here today?"
        ]
    
    def load_selector_cache(self):
        """Load working selectors from cache file"""
        try:
            if os.path.exists('selector_cache.json'):
                with open('selector_cache.json', 'r') as f:
                    self.selector_cache = json.load(f)
                print(f"[CACHE] Loaded {len(self.selector_cache)} cached selectors")
            else:
                self.selector_cache = {}
        except Exception as e:
            print(f"[CACHE] Failed to load cache: {e}")
            self.selector_cache = {}
    
    def save_selector_cache(self):
        """Save working selectors to cache"""
        try:
            with open('selector_cache.json', 'w') as f:
                json.dump(self.selector_cache, f, indent=2)
            print(f"[CACHE] Saved {len(self.selector_cache)} selectors to cache")
        except Exception as e:
            print(f"[CACHE] Failed to save cache: {e}")
    
    def log_step(self, step_name, status="START", details=""):
        """Enhanced step logging with timestamps"""
        self.step_count += 1
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]  # Include milliseconds
        status_emoji = {"START": "🔄", "SUCCESS": "✅", "FAILED": "❌", "WARNING": "⚠️", "INFO": "ℹ️", "AUTO-FIX": "🔧", "CACHE": "💾"}
        emoji = status_emoji.get(status, "🔄")
        
        print(f"[{timestamp}] STEP {self.step_count}: {emoji} {step_name} - {status}")
        if details:
            print(f"         📋 {details}")
    
    async def take_debug_screenshot(self, suffix=""):
        """Take debug screenshot with timestamp"""
        try:
            timestamp = int(datetime.now().timestamp())
            filename = f"debug_{suffix}_{timestamp}.png"
            await self.page.screenshot(path=filename)
            self.log_step("Screenshot", "SUCCESS", f"Saved: {filename}")
            return filename
        except Exception as e:
            self.log_step("Screenshot", "FAILED", str(e))
            return None
    
    async def self_healing_click(self, selectors, description, cache_key=None):
        """Self-healing click with DOM scanning and auto-fix"""
        self.log_step(f"Self-Healing: {description}", "START")
        
        # Try cached selector first
        if cache_key and cache_key in self.selector_cache:
            try:
                await self.page.click(self.selector_cache[cache_key], timeout=3000)
                self.log_step(description, "SUCCESS", f"Used cached: {self.selector_cache[cache_key]}")
                return True
            except:
                pass
        
        # Try provided selectors
        for i, selector in enumerate(selectors):
            try:
                await self.page.click(selector, timeout=3000)
                self.log_step(description, "SUCCESS", f"Selector {i+1}: {selector}")
                if cache_key:
                    self.selector_cache[cache_key] = selector
                    self.save_selector_cache()
                return True
            except Exception as e:
                self.log_step(description, "WARNING", f"Selector {i+1} failed: {str(e)[:100]}")
        
        # AUTO-FIX: Scan DOM
        self.log_step(description, "AUTO-FIX", "Scanning DOM for similar elements")
        keywords = description.lower().split()
        elements = await self.page.query_selector_all('button, [role="button"], a, input[type="button"]')
        
        for element in elements:
            try:
                text = (await element.inner_text()).strip().lower()
                if any(keyword in text for keyword in keywords):
                    await element.click(timeout=2000)
                    self.log_step(description, "AUTO-FIX", f"SUCCESS! Found: '{text}'")
                    if cache_key:
                        self.selector_cache[cache_key] = f':has-text("{text}")'
                        self.save_selector_cache()
                    return True
            except:
                continue
        
        self.log_step(description, "FAILED", "All attempts failed")
        await self.page.screenshot(path=f"failed_{description.replace(' ', '_')}.png")
        return False
    
    async def self_healing_fill(self, selectors, text, description, cache_key=None):
        """Self-healing form fill with DOM scanning"""
        self.log_step(f"Self-Healing Fill: {description}", "START")
        
        # Try cached selector
        if cache_key and cache_key in self.selector_cache:
            try:
                await self.page.fill(self.selector_cache[cache_key], text, timeout=3000)
                self.log_step(description, "SUCCESS", f"Used cached: {self.selector_cache[cache_key]}")
                return True
            except:
                pass
        
        # Try provided selectors
        for i, selector in enumerate(selectors):
            try:
                await self.page.fill(selector, text, timeout=3000)
                self.log_step(description, "SUCCESS", f"Selector {i+1}: {selector}")
                if cache_key:
                    self.selector_cache[cache_key] = selector
                    self.save_selector_cache()
                return True
            except Exception as e:
                self.log_step(description, "WARNING", f"Selector {i+1} failed: {str(e)[:100]}")
        
        # AUTO-FIX: Find by placeholder/label
        self.log_step(description, "AUTO-FIX", "Scanning input fields")
        keywords = description.lower().split()
        inputs = await self.page.query_selector_all('input, textarea')
        
        for input_elem in inputs:
            try:
                placeholder = await input_elem.get_attribute('placeholder') or ""
                name = await input_elem.get_attribute('name') or ""
                search_text = f"{placeholder} {name}".lower()
                
                if any(keyword in search_text for keyword in keywords):
                    await input_elem.fill(text, timeout=2000)
                    self.log_step(description, "AUTO-FIX", f"SUCCESS! Found: placeholder='{placeholder}'")
                    if cache_key:
                        self.selector_cache[cache_key] = f'input[placeholder="{placeholder}"]'
                        self.save_selector_cache()
                    return True
            except:
                continue
        
        self.log_step(description, "FAILED", "No suitable input found")
        return False
    
    async def debug_clickable_elements(self):
        """Debug helper to show all clickable elements"""
        try:
            elements = await self.page.query_selector_all('button, [role="button"], a, input[type="submit"], input[type="button"]')
            self.log_step("Debug Clickable", "INFO", f"Found {len(elements)} clickable elements")
            
            for i, elem in enumerate(elements[:15]):  # Show first 15
                try:
                    text = await elem.inner_text()
                    tag_name = await elem.evaluate("el => el.tagName.toLowerCase()")
                    class_name = await elem.get_attribute('class')
                    self.log_step("Debug Clickable", "INFO", f"{i+1}. {tag_name}: '{text}' class='{class_name}'")
                except:
                    pass
        except Exception as e:
            self.log_step("Debug Clickable", "FAILED", str(e))
    
    async def debug_input_elements(self):
        """Debug helper to show all input elements"""
        try:
            elements = await self.page.query_selector_all('input, textarea, select')
            self.log_step("Debug Inputs", "INFO", f"Found {len(elements)} input elements")
            
            for i, elem in enumerate(elements):
                try:
                    input_type = await elem.get_attribute('type')
                    placeholder = await elem.get_attribute('placeholder')
                    name = await elem.get_attribute('name')
                    aria_label = await elem.get_attribute('aria-label')
                    
                    self.log_step("Debug Inputs", "INFO", f"{i+1}. type='{input_type}' placeholder='{placeholder}' name='{name}' aria-label='{aria_label}'")
                except:
                    pass
        except Exception as e:
            self.log_step("Debug Inputs", "FAILED", str(e))
    
    async def step_setup_browser(self):
        """Step 1: Setup browser with enhanced stealth"""
        self.log_step("Browser Setup", "START")
        
        try:
            playwright = await async_playwright().__aenter__()
            self.browser = await playwright.chromium.launch(
                headless=False,
                args=[
                    '--no-sandbox', 
                    '--disable-web-security', 
                    '--disable-features=VizDisplayCompositor',
                    '--disable-blink-features=AutomationControlled'
                ]
            )
            
            context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
            
            self.page = await context.new_page()
            
            # Enhanced stealth setup
            await self.page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
                Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
                window.chrome = { runtime: {} };
            """)
            
            self.log_step("Browser Setup", "SUCCESS", "Enhanced stealth browser ready")
            return True
            
        except Exception as e:
            self.log_step("Browser Setup", "FAILED", str(e))
            return False
    
    async def step_navigate_to_thundr(self):
        """Step 2: Navigate to Thundr.com"""
        self.log_step("Navigation", "START", "Going to thundr.com")
        
        try:
            await self.page.goto("https://thundr.com", timeout=30000)
            await self.page.wait_for_load_state('networkidle', timeout=15000)
            
            await self.take_debug_screenshot("homepage")
            self.log_step("Navigation", "SUCCESS", "Homepage loaded successfully")
            return True
            
        except Exception as e:
            self.log_step("Navigation", "FAILED", str(e))
            return False
    
    async def step_select_interests(self):
        """Step 3: Select interests with LIVE DOM scanning"""
        self.log_step("Interest Selection", "START")
        
        # From emergency inspector: input[placeholder='Type your interests...']
        input_selectors = [
            'input[placeholder="Type your interests..."]',  # EXACT from inspector!
            'input[placeholder*="interest"]',
            'input[type="text"]'
        ]
        
        # Click interest input
        if await self.self_healing_click(input_selectors, "click interest input", "interest_input"):
            await asyncio.sleep(2)  # Wait for dropdown/suggestions
            
            # Try typing some interests to trigger suggestions
            await self.self_healing_fill(['input[placeholder="Type your interests..."]'], "gaming", "type interest", "interest_input")
            await asyncio.sleep(1)
            
            # Look for suggestion/dropdown elements
            suggestion_selectors = [
                '[role="option"]',
                '.suggestion',
                '.dropdown-item',
                '.autocomplete-item',
                'li',
                'div[data-index]'
            ]
            
            # Try clicking suggestions
            selected_count = 0
            for selector in suggestion_selectors:
                try:
                    elements = await self.page.query_selector_all(selector)
                    if len(elements) > 2:  # Likely suggestions
                        self.log_step("Interest Selection", "SUCCESS", f"Found {len(elements)} suggestions with: {selector}")
                        
                        # Click a few suggestions
                        for i in range(min(5, len(elements))):
                            try:
                                await elements[i].click()
                                selected_count += 1
                                await asyncio.sleep(0.3)
                            except:
                                continue
                        break
                except:
                    continue
            
            self.log_step("Interest Selection", "SUCCESS", f"Selected {selected_count} interests")
        else:
            self.log_step("Interest Selection", "WARNING", "Interest input not found, continuing anyway")
        
        return True
    
    async def step_click_video_chat(self):
        """Step 4: Click Video Chat button"""
        # From emergency inspector: 'Video Chat' - class='chakra-button css-1oy2lww'
        selectors = [
            'button:has-text("Video Chat")',  # Original
            '.chakra-button.css-1oy2lww',     # From inspector!
            'button.css-1oy2lww',             # Simplified
            'a:has-text("Video Chat")',
            '[data-action="video-chat"]'
        ]
        
        return await self.self_healing_click(selectors, "click video chat", "video_chat_button")
    
    async def step_handle_agree_popup(self):
        """Step 5: Handle I Agree popup (optional)"""
        await asyncio.sleep(2)
        
        selectors = [
            'button:has-text("I Agree")',
            'button:has-text("Agree")',
            'button:has-text("Accept")',
            'button:has-text("Continue")'
        ]
        
        result = await self.self_healing_click(selectors, "handle agree popup", "agree_button")
        if not result:
            self.log_step("Handle Agree Popup", "INFO", "No popup found - continuing")
        
        return True
    
    async def step_fill_form(self):
        """Step 6: Fill entry form with comprehensive self-healing"""
        self.log_step("Form Filling", "START")
        
        # Generate birth date
        start = datetime(2002, 1, 1)
        end = datetime(2004, 1, 1)
        delta = end - start
        random_days = random.randint(0, delta.days)
        dob = start + timedelta(days=random_days)
        
        self.session_data = {
            'day': dob.strftime('%d'),
            'month': dob.strftime('%m'),
            'year': dob.strftime('%Y')
        }
        
        self.log_step("Form Filling", "INFO", f"Generated DOB: {self.session_data['day']}.{self.session_data['month']}.{self.session_data['year']}")
        
        await asyncio.sleep(3)  # Wait for form to appear
        
        # 1. Select Female
        female_selectors = [
            'button:has-text("Female")',
            'input[value="female"]',
            'label:has-text("Female")',
            '[data-value="female"]'
        ]
        await self.self_healing_click(female_selectors, "select female", "female_button")
        
        # 2. Select Everyone  
        everyone_selectors = [
            'button:has-text("Everyone")',
            'input[value="everyone"]',
            'label:has-text("Everyone")',
            '[data-value="everyone"]'
        ]
        await self.self_healing_click(everyone_selectors, "select everyone", "everyone_button")
        
        # 3. Fill birth date fields
        day_selectors = ['input[placeholder*="Day"]', 'input[name*="day"]', 'input[aria-label*="Day"]']
        month_selectors = ['input[placeholder*="Month"]', 'input[name*="month"]', 'input[aria-label*="Month"]']
        year_selectors = ['input[placeholder*="Year"]', 'input[name*="year"]', 'input[aria-label*="Year"]']
        
        await self.self_healing_fill(day_selectors, self.session_data['day'], "fill day", "day_input")
        await self.self_healing_fill(month_selectors, self.session_data['month'], "fill month", "month_input")
        await self.self_healing_fill(year_selectors, self.session_data['year'], "fill year", "year_input")
        
        # 4. Accept terms
        terms_selectors = [
            'input[type="checkbox"]',
            '[role="checkbox"]',
            'label:has-text("terms")',
            'label:has-text("agree")'
        ]
        await self.self_healing_click(terms_selectors, "accept terms", "terms_checkbox")
        
        # 5. Click Start
        start_selectors = [
            'button:has-text("Start")',
            'button.chakra-button',
            'input[type="submit"]',
            'button:has-text("Begin")'
        ]
        await self.self_healing_click(start_selectors, "click start", "start_button")
        
        await asyncio.sleep(5)
        await self.take_debug_screenshot("form_completed")
        
        return True
    
    async def step_wait_for_chat(self):
        """Step 7: Wait for chat window with enhanced detection"""
        self.log_step("Wait for Chat", "START")
        
        chat_selectors = [
            'input[placeholder*="message"]',
            'textarea[placeholder*="message"]',
            'input[placeholder*="type"]',
            '.chat-input',
            '[role="textbox"]'
        ]
        
        for attempt in range(3):
            # Try to find chat input
            for selector in chat_selectors:
                try:
                    element = await self.page.wait_for_selector(selector, timeout=10000)
                    if element and await element.is_visible():
                        self.log_step("Wait for Chat", "SUCCESS", f"Chat found with: {selector}")
                        return True
                except:
                    continue
            
            self.log_step("Wait for Chat", "WARNING", f"Attempt {attempt + 1}/3 failed")
            await asyncio.sleep(10)
            await self.take_debug_screenshot(f"chat_search_{attempt}")
        
        self.log_step("Wait for Chat", "FAILED", "Chat window not found")
        return False
    
    async def step_chat_loop(self):
        """Step 8: Enhanced chat loop with partner switching"""
        self.log_step("Chat Loop", "START")
        
        chat_count = 0
        while chat_count < 3:  # Limit for debug
            chat_count += 1
            self.log_step("Chat Session", "START", f"Chat #{chat_count}")
            
            # Send message using self-healing
            chat_selectors = [
                'input[placeholder*="message"]',
                'textarea[placeholder*="message"]',
                '.chat-input'
            ]
            
            message = random.choice(self.messages)
            if await self.self_healing_fill(chat_selectors, message, "send message", "chat_input"):
                await self.page.keyboard.press('Enter')
                self.log_step("Chat Session", "SUCCESS", f"Sent: {message}")
            
            # Wait and switch
            await asyncio.sleep(10)
            self.log_step("Chat Session", "INFO", "Switching partner...")
            
            await self.page.keyboard.press('Escape')
            await asyncio.sleep(0.5)
            await self.page.keyboard.press('Escape')
            await asyncio.sleep(3)
            
            # Handle boost popup
            boost_selectors = ['button:has-text("Maybe Later")', 'button:has-text("Close")']
            await self.self_healing_click(boost_selectors, "handle boost popup", "boost_popup")
        
        return True
    
    async def run_debug_session(self):
        """Run complete self-healing debug session"""
        self.log_step("SELF-HEALING SESSION", "START", "Starting Self-Healing Thundr Bot")
        
        steps = [
            ("Setup Browser", self.step_setup_browser),
            ("Navigate to Thundr", self.step_navigate_to_thundr),
            ("Select Interests", self.step_select_interests),
            ("Click Video Chat", self.step_click_video_chat),
            ("Handle Agree Popup", self.step_handle_agree_popup),
            ("Fill Form", self.step_fill_form),
            ("Wait for Chat", self.step_wait_for_chat),
            ("Chat Loop", self.step_chat_loop)
        ]
        
        success_count = 0
        for step_name, step_func in steps:
            try:
                result = await step_func()
                if result:
                    success_count += 1
                
                # Brief pause between steps
                await asyncio.sleep(1)
                
            except Exception as e:
                self.log_step("SELF-HEALING SESSION", "FAILED", f"Exception in {step_name}: {e}")
                await self.take_debug_screenshot(f"exception_{step_name.lower().replace(' ', '_')}")
                # Continue to next step instead of breaking
                continue
        
        self.log_step("SELF-HEALING SESSION", "SUCCESS", f"Completed {success_count}/{len(steps)} steps successfully")
        
        # Final selector cache save
        self.save_selector_cache()
        
        # Cleanup
        if self.browser:
            await self.browser.close()

async def main():
    bot = SelfHealingBot()
    await bot.run_debug_session()

if __name__ == "__main__":
    print("🔧 SELF-HEALING THUNDR BOT - AUTO-FIX VERSION")
    print("💾 Features: DOM Scanning, Selector Caching, Auto-Recovery")
    print("=" * 60)
    asyncio.run(main()) 