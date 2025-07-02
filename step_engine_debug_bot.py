#!/usr/bin/env python3
"""
STEP ENGINE THUNDR BOT - DEBUG VERSION
Implements step-by-step architecture with auto-fallbacks and comprehensive logging
"""

import asyncio
import random
import sys
import os
from datetime import datetime, timedelta
from playwright.async_api import async_playwright

# UTF-8 encoding setup for Windows
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

class StepEngineBot:
    def __init__(self):
        self.page = None
        self.browser = None
        self.step_count = 0
        self.session_data = {}
        
        # Messages for chat
        self.messages = [
            "Hi there! How's your day going?",
            "Hello! Nice to meet you!",
            "Hey! What's up?",
            "Hi! How are you doing?",
            "Hello! What brings you here today?"
        ]
    
    def log_step(self, step_name, status="START", details=""):
        """Enhanced step logging with timestamps"""
        self.step_count += 1
        timestamp = datetime.now().strftime("%H:%M:%S")
        status_emoji = {"START": "🔄", "SUCCESS": "✅", "FAILED": "❌", "WARNING": "⚠️", "INFO": "ℹ️"}
        emoji = status_emoji.get(status, "🔄")
        
        print(f"[{timestamp}] STEP {self.step_count}: {emoji} {step_name} - {status}")
        if details:
            print(f"         {details}")
    
    async def step_with_fallbacks(self, step_name, selectors, action="click", text="", timeout=5000):
        """Execute a step with multiple selector fallbacks"""
        self.log_step(step_name, "START", f"Trying {len(selectors)} selectors")
        
        for i, selector in enumerate(selectors):
            try:
                self.log_step(step_name, "INFO", f"Attempt {i+1}: {selector}")
                
                if action == "click":
                    await self.page.click(selector, timeout=timeout)
                elif action == "fill":
                    await self.page.fill(selector, text, timeout=timeout)
                elif action == "wait":
                    await self.page.wait_for_selector(selector, timeout=timeout)
                
                self.log_step(step_name, "SUCCESS", f"Selector {i+1} worked: {selector}")
                return True
                
            except Exception as e:
                self.log_step(step_name, "WARNING", f"Selector {i+1} failed: {str(e)[:100]}")
                continue
        
        self.log_step(step_name, "FAILED", "All selectors failed")
        await self.take_debug_screenshot(f"failed_{step_name.lower().replace(' ', '_')}")
        return False
    
    async def take_debug_screenshot(self, suffix=""):
        """Take debug screenshot with timestamp"""
        try:
            timestamp = int(datetime.now().timestamp())
            filename = f"debug_{suffix}_{timestamp}.png"
            await self.page.screenshot(path=filename)
            self.log_step("Screenshot", "SUCCESS", f"Saved: {filename}")
        except Exception as e:
            self.log_step("Screenshot", "FAILED", str(e))
    
    async def debug_page_elements(self, element_type="input"):
        """Debug helper to analyze page elements"""
        try:
            self.log_step("Debug Analysis", "START", f"Analyzing all {element_type} elements")
            
            elements = await self.page.query_selector_all(element_type)
            self.log_step("Debug Analysis", "INFO", f"Found {len(elements)} {element_type} elements")
            
            for i, elem in enumerate(elements[:10]):  # Show first 10
                try:
                    if element_type == "input":
                        placeholder = await elem.get_attribute('placeholder')
                        input_type = await elem.get_attribute('type')
                        name = await elem.get_attribute('name')
                        self.log_step("Debug Analysis", "INFO", f"{element_type} {i+1}: type='{input_type}' placeholder='{placeholder}' name='{name}'")
                    
                    elif element_type == "button":
                        text = await elem.inner_text()
                        class_name = await elem.get_attribute('class')
                        self.log_step("Debug Analysis", "INFO", f"{element_type} {i+1}: '{text}' class='{class_name}'")
                    
                    else:
                        text = await elem.inner_text()
                        self.log_step("Debug Analysis", "INFO", f"{element_type} {i+1}: '{text[:50]}'")
                        
                except:
                    pass
                    
        except Exception as e:
            self.log_step("Debug Analysis", "FAILED", str(e))
    
    async def step_setup_browser(self):
        """Step 1: Setup browser with stealth"""
        self.log_step("Browser Setup", "START")
        
        try:
            playwright = await async_playwright().__aenter__()
            self.browser = await playwright.chromium.launch(
                headless=False,
                args=['--no-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor']
            )
            
            self.page = await self.browser.new_page()
            
            # Enhanced stealth setup
            await self.page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
                Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
            """)
            
            self.log_step("Browser Setup", "SUCCESS")
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
            self.log_step("Navigation", "SUCCESS", "Homepage loaded")
            return True
            
        except Exception as e:
            self.log_step("Navigation", "FAILED", str(e))
            return False
    
    async def step_select_interests(self):
        """Step 3: Select interests with live scraping"""
        self.log_step("Interest Selection", "START")
        
        # First, try to click interest input
        input_selectors = [
            'input[placeholder*="interest"]',
            'input[placeholder*="Interest"]',
            'input[type="text"]',
            '.interest-input'
        ]
        
        if not await self.step_with_fallbacks("Click Interest Input", input_selectors):
            self.log_step("Interest Selection", "WARNING", "No interest input found, trying direct buttons")
        
        await asyncio.sleep(2)  # Wait for dropdown
        
        # Try to find dropdown options with various selectors
        dropdown_selectors = [
            '[role="option"]',
            '.chakra-menu__menuitem',
            '.menu-item',
            '[data-index]',
            'li',
            'div[role="button"]',
            '[data-value]',
            'button[data-testid*="interest"]',
            '.interest-option'
        ]
        
        selected_count = 0
        for selector in dropdown_selectors:
            try:
                elements = await self.page.query_selector_all(selector)
                if len(elements) > 5:  # Likely interest options
                    self.log_step("Interest Selection", "SUCCESS", f"Found {len(elements)} options with: {selector}")
                    
                    # Select random interests
                    max_select = min(8, len(elements))
                    for i in range(max_select):
                        try:
                            await elements[i].click()
                            selected_count += 1
                            await asyncio.sleep(0.2)
                        except:
                            continue
                    
                    self.log_step("Interest Selection", "SUCCESS", f"Selected {selected_count} interests")
                    return True
                    
            except:
                continue
        
        # Fallback: Try predefined interests
        self.log_step("Interest Selection", "WARNING", "Using fallback interest buttons")
        fallback_interests = ["Gaming", "Music", "Movies", "Sports", "Art", "Food", "Travel", "Technology"]
        
        for interest in fallback_interests[:5]:
            selectors = [f'button:has-text("{interest}")', f'[data-value="{interest.lower()}"]']
            if await self.step_with_fallbacks(f"Select {interest}", selectors):
                selected_count += 1
        
        self.log_step("Interest Selection", "SUCCESS" if selected_count > 0 else "WARNING", f"Total selected: {selected_count}")
        return True
    
    async def step_click_video_chat(self):
        """Step 4: Click Video Chat button"""
        selectors = [
            'button:has-text("Video Chat")',
            'a:has-text("Video Chat")',
            'button:has-text("Start Video")',
            '[data-action="video-chat"]',
            '.video-chat-button'
        ]
        
        return await self.step_with_fallbacks("Click Video Chat", selectors, timeout=10000)
    
    async def step_handle_agree_popup(self):
        """Step 5: Handle I Agree popup"""
        selectors = [
            'button:has-text("I Agree")',
            'button:has-text("Agree")',
            'button:has-text("Accept")',
            'button:has-text("Continue")',
            '.agree-button'
        ]
        
        # This step is optional - popup might not appear
        await asyncio.sleep(2)
        result = await self.step_with_fallbacks("Handle Agree Popup", selectors, timeout=5000)
        
        if not result:
            self.log_step("Handle Agree Popup", "INFO", "No popup found - continuing")
        
        return True  # Always continue regardless
    
    async def step_fill_form(self):
        """Step 6: Fill entry form with comprehensive debugging"""
        self.log_step("Form Filling", "START")
        
        # Generate random birth date
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
        
        # Wait for form
        await asyncio.sleep(3)
        await self.debug_page_elements("button")
        await self.debug_page_elements("input")
        
        # 1. Select Female
        female_selectors = [
            'button:has-text("Female")',
            'input[value="female"]',
            'label:has-text("Female")',
            'span:has-text("Female")',
            '[data-value="female"]',
            'input[type="radio"][value="female"]'
        ]
        await self.step_with_fallbacks("Select Female", female_selectors)
        
        # 2. Select Everyone
        everyone_selectors = [
            'button:has-text("Everyone")',
            'input[value="everyone"]',
            'label:has-text("Everyone")',
            'span:has-text("Everyone")',
            '[data-value="everyone"]',
            'input[type="radio"][value="everyone"]'
        ]
        await self.step_with_fallbacks("Select Everyone", everyone_selectors)
        
        # 3. Fill birth date
        day_selectors = ['input[placeholder*="Day"]', 'input[name*="day"]', 'input[aria-label*="Day"]']
        month_selectors = ['input[placeholder*="Month"]', 'input[name*="month"]', 'input[aria-label*="Month"]']
        year_selectors = ['input[placeholder*="Year"]', 'input[name*="year"]', 'input[aria-label*="Year"]']
        
        await self.step_with_fallbacks("Fill Day", day_selectors, "fill", self.session_data['day'])
        await self.step_with_fallbacks("Fill Month", month_selectors, "fill", self.session_data['month'])
        await self.step_with_fallbacks("Fill Year", year_selectors, "fill", self.session_data['year'])
        
        # 4. Accept terms
        terms_selectors = [
            'input[type="checkbox"]',
            'svg[data-state="unchecked"]',
            '[role="checkbox"]',
            'label:has-text("terms")',
            'label:has-text("agree")'
        ]
        await self.step_with_fallbacks("Accept Terms", terms_selectors)
        
        # 5. Click Start
        start_selectors = [
            'button:has-text("Start")',
            'button[type="button"].chakra-button',
            'button.css-fw0t89',
            'button:has-text("Begin")',
            'input[type="submit"]'
        ]
        await self.step_with_fallbacks("Click Start", start_selectors)
        
        await asyncio.sleep(5)  # Wait for form submission
        await self.take_debug_screenshot("form_completed")
        
        return True
    
    async def step_wait_for_chat(self):
        """Step 7: Wait for chat window"""
        selectors = [
            'input[placeholder*="message"]',
            'textarea[placeholder*="message"]',
            'input[placeholder*="type"]',
            '.chat-input',
            '.message-input',
            '[role="textbox"]'
        ]
        
        self.log_step("Wait for Chat", "START", "Looking for chat window")
        
        for attempt in range(3):
            if await self.step_with_fallbacks("Find Chat Input", selectors, "wait", timeout=15000):
                return True
            
            self.log_step("Wait for Chat", "WARNING", f"Attempt {attempt + 1}/3 failed, waiting...")
            await asyncio.sleep(10)
            await self.take_debug_screenshot(f"chat_search_attempt_{attempt}")
        
        self.log_step("Wait for Chat", "FAILED", "Chat window not found after 3 attempts")
        return False
    
    async def step_chat_loop(self):
        """Step 8: Chat loop with partner switching"""
        self.log_step("Chat Loop", "START")
        
        chat_input_selectors = [
            'input[placeholder*="message"]',
            'textarea[placeholder*="message"]',
            'input[placeholder*="type"]',
            '.chat-input'
        ]
        
        chat_count = 0
        while chat_count < 5:  # Limit for debug
            chat_count += 1
            self.log_step("Chat Session", "START", f"Chat #{chat_count}")
            
            # Find and use chat input
            for selector in chat_input_selectors:
                try:
                    input_elem = await self.page.query_selector(selector)
                    if input_elem and await input_elem.is_visible():
                        message = random.choice(self.messages)
                        await input_elem.fill(message)
                        await input_elem.press('Enter')
                        
                        self.log_step("Chat Session", "SUCCESS", f"Sent: {message}")
                        break
                except:
                    continue
            
            # Wait and switch partner
            await asyncio.sleep(10)
            self.log_step("Chat Session", "INFO", "Switching partner (ESC x2)")
            
            await self.page.keyboard.press('Escape')
            await asyncio.sleep(0.5)
            await self.page.keyboard.press('Escape')
            await asyncio.sleep(3)
            
            # Handle boost popup
            boost_selectors = ['button:has-text("Maybe Later")', 'button:has-text("Close")', '.close-button']
            await self.step_with_fallbacks("Handle Boost Popup", boost_selectors, timeout=3000)
        
        return True
    
    async def run_debug_session(self):
        """Run complete debug session with step engine"""
        self.log_step("DEBUG SESSION", "START", "Starting Step Engine Debug Bot")
        
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
        
        for step_name, step_func in steps:
            try:
                result = await step_func()
                if not result:
                    self.log_step("DEBUG SESSION", "FAILED", f"Step failed: {step_name}")
                    break
                
                await asyncio.sleep(1)  # Brief pause between steps
                
            except Exception as e:
                self.log_step("DEBUG SESSION", "FAILED", f"Exception in {step_name}: {e}")
                await self.take_debug_screenshot(f"exception_{step_name.lower().replace(' ', '_')}")
                break
        
        self.log_step("DEBUG SESSION", "SUCCESS", "Session completed")
        
        # Cleanup
        if self.browser:
            await self.browser.close()

async def main():
    bot = StepEngineBot()
    await bot.run_debug_session()

if __name__ == "__main__":
    print("🚀 STEP ENGINE THUNDR BOT - ULTRA DEBUG VERSION")
    print("=" * 60)
    asyncio.run(main()) 