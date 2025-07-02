# -*- coding: utf-8 -*-
import os
import sys
from typing import Optional, List, Dict, Any
import asyncio
import random
import json
from datetime import datetime, timedelta
import logging
import time

print('=== THUNDR BOT DEBUG MODE - SINGLE CLIENT ===')

# Fix Windows Unicode encoding issues
if sys.platform.startswith('win'):
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    
    # Reconfigure stdout to handle Unicode (Python 3.7+)
    try:
        import codecs
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
        else:
            # Fallback for older Python versions
            sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'replace')
            sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'replace')
    except Exception:
        pass  # Continue if reconfiguration fails

# Import playwright after encoding setup
try:
    from playwright.async_api import async_playwright, Page, BrowserContext, Browser
except ImportError:
    print("Please install playwright: pip install playwright")
    sys.exit(1)

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DebugThundrBot:
    def __init__(self):
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.current_step = "INITIALIZATION"
        self.step_start_time = time.time()
        self.debug_log = []
        self.stuck_timeout = 60
        self.session_birth_date: Optional[Dict[str, str]] = None
        self.session_interests: Optional[List[str]] = None
        self.messages = ["Write me on Snapchat for Free nude ;* Snapchat : LaLiLuLaara"]

    def log_step(self, step_name: str, status: str, details: str = "") -> None:
        current_time = time.time()
        duration = current_time - self.step_start_time
        
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "step": step_name,
            "previous_step": self.current_step,
            "status": status,
            "duration": round(duration, 2),
            "details": details
        }
        
        self.debug_log.append(log_entry)
        
        status_icon = {
            "SUCCESS": "✅", "ERROR": "❌", "WARNING": "⚠️", 
            "IN_PROGRESS": "🔄", "STUCK": "🚫"
        }.get(status, "ℹ️")
        
        print(f"{status_icon} [{step_name}] {status} ({duration:.1f}s) - {details}")
        
        self.current_step = step_name
        self.step_start_time = current_time

    def save_debug_report(self) -> None:
        try:
            os.makedirs("logs", exist_ok=True)
            report = {
                "session_id": f"debug_{int(time.time())}",
                "total_steps": len(self.debug_log),
                "session_duration": sum(step["duration"] for step in self.debug_log),
                "steps": self.debug_log,
                "final_status": self.debug_log[-1]["status"] if self.debug_log else "UNKNOWN"
            }
            
            with open("logs/debug_session.json", "w", encoding="utf-8") as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
                
            print(f"📊 Debug report saved: {len(self.debug_log)} steps analyzed")
            
        except Exception as e:
            print(f"❌ Failed to save debug report: {e}")

    async def run_debug_session(self) -> bool:
        print("\n🔍 === STARTING DEBUG SESSION ===")
        
        try:
            # Step 1: Setup browser
            self.log_step("BROWSER_SETUP", "IN_PROGRESS", "Launching browser")
            if not await self.setup_browser():
                return False
            
            # Step 2: Load page
            self.log_step("LOAD_PAGE", "IN_PROGRESS", "Loading thundr.com")
            if not await self.goto_thundr():
                return False
            
            # Step 3: Handle interests
            self.log_step("INTERESTS", "IN_PROGRESS", "Handling interests")
            await self.handle_interests()
            
            # Step 4: Find video chat
            self.log_step("VIDEO_CHAT", "IN_PROGRESS", "Finding video chat button")
            if not await self.click_video_chat():
                return False
            
            # Step 5: Handle popups
            self.log_step("POPUPS", "IN_PROGRESS", "Handling popups")
            await self.handle_popups()
            
            # Step 6: Fill form
            self.log_step("FORM", "IN_PROGRESS", "Filling form")
            if not await self.fill_form():
                return False
            
            # Step 7: Wait for chat
            self.log_step("WAIT_CHAT", "IN_PROGRESS", "Waiting for chat")
            if not await self.wait_for_chat():
                return False
            
            # Step 8: Test chat
            self.log_step("TEST_CHAT", "IN_PROGRESS", "Testing chat")
            await self.test_chat()
            
            self.log_step("COMPLETE", "SUCCESS", "All steps completed!")
            return True
            
        except Exception as e:
            self.log_step("FATAL_ERROR", "ERROR", f"Fatal error: {str(e)}")
            return False
        finally:
            await self.cleanup()
            self.save_debug_report()

    async def setup_browser(self) -> bool:
        try:
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch(
                headless=False,
                slow_mo=1000,
                args=['--no-sandbox', '--disable-web-security']
            )
            self.context = await self.browser.new_context(
                viewport={'width': 1280, 'height': 720},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            )
            self.page = await self.context.new_page()
            self.log_step("BROWSER_SETUP", "SUCCESS", "Browser launched successfully")
            return True
        except Exception as e:
            self.log_step("BROWSER_SETUP", "ERROR", f"Browser setup failed: {str(e)}")
            return False

    async def goto_thundr(self) -> bool:
        if not self.page:
            self.log_step("LOAD_PAGE", "ERROR", "No page available")
            return False
        
        try:
            await self.page.goto('https://thundr.com/', wait_until='domcontentloaded')
            await asyncio.sleep(3)
            title = await self.page.title()
            await self.page.screenshot(path=f"debug_loaded_{int(time.time())}.png")
            self.log_step("LOAD_PAGE", "SUCCESS", f"Page loaded: {title}")
            return True
        except Exception as e:
            self.log_step("LOAD_PAGE", "ERROR", f"Failed to load page: {str(e)}")
            return False

    async def handle_interests(self) -> bool:
        if not self.page:
            return False
        
        try:
            # Look for interest input
            interest_selectors = [
                'input[placeholder*="interest"]',
                'input[placeholder*="Interest"]'
            ]
            
            for selector in interest_selectors:
                try:
                    element = await self.page.query_selector(selector)
                    if element:
                        await element.click()
                        self.log_step("INTERESTS", "SUCCESS", f"Interest input clicked: {selector}")
                        break
                except:
                    continue
            
            await asyncio.sleep(2)
            
            # Try to select some interests
            interests = ["Movies", "Music", "Gaming"]
            selected = 0
            
            for interest in interests:
                try:
                    option = await self.page.query_selector(f'[role="option"]:has-text("{interest}")')
                    if option:
                        await option.click()
                        selected += 1
                        await asyncio.sleep(0.5)
                except:
                    continue
            
            self.log_step("INTERESTS", "SUCCESS" if selected > 0 else "WARNING", 
                         f"Selected {selected} interests")
            return True
            
        except Exception as e:
            self.log_step("INTERESTS", "ERROR", f"Interest handling failed: {str(e)}")
            return False

    async def click_video_chat(self) -> bool:
        if not self.page:
            return False
        
        try:
            selectors = [
                'button:has-text("Video Chat")',
                'a:has-text("Video Chat")',
                'button:has-text("video chat")'
            ]
            
            for selector in selectors:
                try:
                    button = await self.page.wait_for_selector(selector, timeout=10000)
                    if button:
                        await button.click()
                        await asyncio.sleep(3)
                        await self.page.screenshot(path=f"debug_video_chat_{int(time.time())}.png")
                        self.log_step("VIDEO_CHAT", "SUCCESS", f"Video chat clicked: {selector}")
                        return True
                except:
                    continue
            
            self.log_step("VIDEO_CHAT", "ERROR", "Video chat button not found")
            return False
            
        except Exception as e:
            self.log_step("VIDEO_CHAT", "ERROR", f"Video chat failed: {str(e)}")
            return False

    async def handle_popups(self) -> bool:
        if not self.page:
            return True
        
        try:
            await asyncio.sleep(2)
            
            # Check for I Agree popup
            agree_selectors = ['button:has-text("I Agree")', 'button:has-text("Agree")']
            
            for selector in agree_selectors:
                try:
                    button = await self.page.query_selector(selector)
                    if button and await button.is_visible():
                        await button.click()
                        self.log_step("POPUPS", "SUCCESS", f"I Agree popup closed: {selector}")
                        return True
                except:
                    continue
            
            self.log_step("POPUPS", "SUCCESS", "No popups found")
            return True
            
        except Exception as e:
            self.log_step("POPUPS", "ERROR", f"Popup handling failed: {str(e)}")
            return True

    async def fill_form(self) -> bool:
        if not self.page:
            return False
        
        try:
            await asyncio.sleep(2)
            
            # Try to fill form fields
            filled_fields = 0
            
            # Gender
            try:
                gender_span = await self.page.query_selector('span:has-text("Male")')
                if gender_span:
                    await gender_span.click()
                    filled_fields += 1
                    self.log_step("FORM_GENDER", "SUCCESS", "Male selected")
            except:
                self.log_step("FORM_GENDER", "WARNING", "Gender selection failed")
            
            await asyncio.sleep(1)
            
            # Looking for
            try:
                looking_span = await self.page.query_selector('span:has-text("Everyone")')
                if looking_span:
                    await looking_span.click()
                    filled_fields += 1
                    self.log_step("FORM_LOOKING", "SUCCESS", "Everyone selected")
            except:
                self.log_step("FORM_LOOKING", "WARNING", "Looking for selection failed")
            
            await asyncio.sleep(1)
            
            # Birth date
            try:
                day_input = await self.page.query_selector('input[placeholder="DD"]')
                if day_input:
                    await day_input.fill("25")
                    filled_fields += 1
            except:
                pass
            
            # Terms
            try:
                checkbox = await self.page.query_selector('svg[data-state="unchecked"]')
                if checkbox:
                    await checkbox.click()
                    filled_fields += 1
                    self.log_step("FORM_TERMS", "SUCCESS", "Terms checkbox activated")
            except:
                self.log_step("FORM_TERMS", "WARNING", "Terms checkbox failed")
            
            await asyncio.sleep(1)
            
            # Start button
            try:
                start_button = await self.page.query_selector('button.chakra-button')
                if start_button:
                    await start_button.click()
                    filled_fields += 1
                    self.log_step("FORM_START", "SUCCESS", "Start button clicked")
            except:
                self.log_step("FORM_START", "ERROR", "Start button not found")
                return False
            
            await asyncio.sleep(3)
            await self.page.screenshot(path=f"debug_form_{int(time.time())}.png")
            
            self.log_step("FORM", "SUCCESS", f"Form filled - {filled_fields} fields completed")
            return True
            
        except Exception as e:
            self.log_step("FORM", "ERROR", f"Form filling failed: {str(e)}")
            return False

    async def wait_for_chat(self) -> bool:
        if not self.page:
            return False
        
        try:
            chat_selectors = [
                'input[placeholder*="message"]',
                'textarea[placeholder*="message"]',
                '.chat-input'
            ]
            
            for i in range(60):  # 60 second timeout
                for selector in chat_selectors:
                    try:
                        chat_input = await self.page.query_selector(selector)
                        if chat_input and await chat_input.is_visible():
                            await self.page.screenshot(path=f"debug_chat_found_{int(time.time())}.png")
                            self.log_step("WAIT_CHAT", "SUCCESS", f"Chat found: {selector}")
                            return True
                    except:
                        continue
                
                if (i + 1) % 10 == 0:
                    self.log_step("WAIT_CHAT", "IN_PROGRESS", f"Still waiting... {i+1}/60 seconds")
                
                await asyncio.sleep(1)
            
            await self.page.screenshot(path=f"debug_chat_timeout_{int(time.time())}.png")
            self.log_step("WAIT_CHAT", "ERROR", "Chat timeout after 60 seconds")
            return False
            
        except Exception as e:
            self.log_step("WAIT_CHAT", "ERROR", f"Chat wait failed: {str(e)}")
            return False

    async def test_chat(self) -> bool:
        if not self.page:
            return False
        
        try:
            chat_input = await self.page.query_selector('input[placeholder*="message"]')
            if not chat_input:
                chat_input = await self.page.query_selector('textarea[placeholder*="message"]')
            
            if chat_input:
                message = "Write me on Snapchat for Free nude ;* Snapchat : LaLiLuLaara"
                await chat_input.fill(message)
                await asyncio.sleep(1)
                await chat_input.press('Enter')
                
                await asyncio.sleep(3)
                await self.page.screenshot(path=f"debug_message_sent_{int(time.time())}.png")
                
                self.log_step("TEST_CHAT", "SUCCESS", f"Message sent: {message}")
                return True
            else:
                self.log_step("TEST_CHAT", "ERROR", "Chat input not found")
                return False
                
        except Exception as e:
            self.log_step("TEST_CHAT", "ERROR", f"Chat test failed: {str(e)}")
            return False

    async def cleanup(self) -> None:
        self.log_step("CLEANUP", "IN_PROGRESS", "Cleaning up")
        try:
            if self.page:
                await self.page.close()
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            self.log_step("CLEANUP", "SUCCESS", "Cleanup completed")
        except Exception as e:
            self.log_step("CLEANUP", "ERROR", f"Cleanup failed: {str(e)}")

async def main():
    print("🚀 Starting Thundr Bot Debug Mode")
    
    bot = DebugThundrBot()
    success = await bot.run_debug_session()
    
    if success:
        print("\n✅ DEBUG SESSION COMPLETED!")
    else:
        print("\n❌ DEBUG SESSION FAILED!")
    
    print("📊 Check logs/debug_session.json for analysis")
    print("🖼️ Check debug_*.png screenshots")
    print("🌐 Dashboard at http://localhost:8080/dashboard.html")

if __name__ == "__main__":
    asyncio.run(main()) 