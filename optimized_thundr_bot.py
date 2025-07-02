# type: ignore
"""
Optimized Thundr Bot - Streamlined automation with enhanced reliability
This bot focuses on simplicity and robustness over complex self-healing features.
"""
import asyncio
import random
import logging
from datetime import datetime, timedelta
from playwright.async_api import async_playwright  # type: ignore
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class OptimizedThundrBot:
    def __init__(self, debug=False, headless=True):
        self.debug = debug
        self.headless = headless
        self.message = "Hey! How are you?"
        self.dob_start = datetime(2002, 1, 1)
        self.dob_end = datetime(2004, 1, 1)
        self.screenshots_dir = Path("screenshots")
        self.screenshots_dir.mkdir(exist_ok=True)
        
    def log(self, msg, level="info"):
        if level == "error":
            logger.error(msg)
        elif level == "warning":
            logger.warning(msg)
        else:
            logger.info(msg)
            
    async def screenshot(self, page, name):
        if self.debug:
            try:
                await page.screenshot(path=f"screenshots/{name}_{datetime.now().strftime('%H%M%S')}.png")
            except Exception as e:
                self.log(f"Screenshot failed: {e}", "warning")
    
    def get_random_dob(self):
        days = (self.dob_end - self.dob_start).days
        dob = self.dob_start + timedelta(days=random.randint(0, days))
        return dob.strftime('%d'), dob.strftime('%m'), dob.strftime('%Y')
    
    async def safe_click(self, page, selectors, description):
        for sel in selectors:
            try:
                element = await page.wait_for_selector(sel, timeout=5000)
                if element and await element.is_visible():
                    await element.click()
                    self.log(f"✅ {description} via {sel}")
                    return True
            except Exception as e:
                self.log(f"❌ {description} failed with {sel}: {str(e)[:100]}", "warning")
                continue
        await self.screenshot(page, f"failed_{description.replace(' ', '_')}")
        return False
    
    async def safe_fill(self, page, selectors, value, description):
        for sel in selectors:
            try:
                element = await page.wait_for_selector(sel, timeout=5000)
                if element and await element.is_visible():
                    await element.fill(value)
                    self.log(f"✅ {description} filled via {sel}")
                    return True
            except Exception as e:
                self.log(f"❌ {description} failed with {sel}: {str(e)[:100]}", "warning")
                continue
        await self.screenshot(page, f"failed_{description.replace(' ', '_')}")
        return False
    
    async def select_interests(self, page):
        try:
            # Click interest input
            await page.click('input[placeholder*="interest"]', timeout=10000)
            await page.wait_for_selector('li[role="option"]', timeout=10000)
            await asyncio.sleep(1)  # Wait for all options to load
            
            # Get all available interests
            options = await page.query_selector_all('li[role="option"]')
            all_interests = []
            for option in options:
                try:
                    text = await option.inner_text()
                    if text and text.strip():
                        all_interests.append(text.strip())
                except:
                    continue
            
            self.log(f"Found {len(all_interests)} interests")
            
            # Select random interests (up to 15 for speed)
            max_select = min(15, len(all_interests))
            selected = random.sample(all_interests, max_select)
            self.log(f"Selecting {len(selected)} interests")
            
            selected_count = 0
            for interest in selected:
                try:
                    await page.click(f'li[role="option"]:has-text("{interest}")', timeout=2000)
                    selected_count += 1
                    await asyncio.sleep(0.1)  # Small delay between selections
                except:
                    continue
                    
            self.log(f"Successfully selected {selected_count} interests")
            return True
            
        except Exception as e:
            self.log(f"Interest selection failed: {e}", "error")
            await self.screenshot(page, "interest_selection_failed")
            return False
    
    async def fill_form(self, page):
        day, month, year = self.get_random_dob()
        self.log(f"Using DOB: {day}.{month}.{year}")
        
        # Female selection
        female_selectors = [
            'button:has-text("Female")',
            'input[value="female"]',
            'label:has-text("Female")',
            '[data-value="female"]',
            'span:has-text("Female")'
        ]
        await self.safe_click(page, female_selectors, "Female selection")
        
        # Everyone selection
        everyone_selectors = [
            'button:has-text("Everyone")',
            'input[value="everyone"]',
            'label:has-text("Everyone")',
            '[data-value="everyone"]',
            'span:has-text("Everyone")'
        ]
        await self.safe_click(page, everyone_selectors, "Everyone selection")
        
        # Date fields with enhanced selectors
        day_selectors = [
            'input[placeholder*="Day"]', 
            'input[name*="day"]', 
            'select[name*="day"]',
            'input[aria-label*="Day"]'
        ]
        month_selectors = [
            'input[placeholder*="Month"]', 
            'input[name*="month"]', 
            'select[name*="month"]',
            'input[aria-label*="Month"]'
        ]
        year_selectors = [
            'input[placeholder*="Year"]', 
            'input[name*="year"]', 
            'select[name*="year"]',
            'input[aria-label*="Year"]'
        ]
        
        await self.safe_fill(page, day_selectors, day, "Day")
        await self.safe_fill(page, month_selectors, month, "Month")
        await self.safe_fill(page, year_selectors, year, "Year")
        
        # Terms checkbox
        terms_selectors = [
            'input[type="checkbox"]', 
            'label:has-text("terms")', 
            'label:has-text("agree")',
            ':has-text("terms")',
            ':has-text("agree")'
        ]
        await self.safe_click(page, terms_selectors, "Terms acceptance")
        
        # Start button
        start_selectors = [
            'button:has-text("Start")', 
            'input[type="submit"]', 
            'button[type="submit"]',
            'button.chakra-button',
            '[role="button"]:has-text("Start")'
        ]
        await self.safe_click(page, start_selectors, "Start button")
        
        return True
    
    async def wait_for_chat_ready(self, page):
        """Wait for chat interface to be ready"""
        chat_selectors = [
            'input[placeholder*="message"]',
            'textarea[placeholder*="message"]',
            '.chat-input',
            '[data-testid="message-input"]'
        ]
        
        for attempt in range(3):
            for selector in chat_selectors:
                try:
                    element = await page.wait_for_selector(selector, timeout=20000)
                    if element and await element.is_visible():
                        self.log(f"Chat ready with selector: {selector}")
                        return selector
                except:
                    continue
            
            self.log(f"Chat not ready, attempt {attempt + 1}/3")
            await asyncio.sleep(5)
            await self.screenshot(page, f"chat_wait_attempt_{attempt + 1}")
        
        return None
    
    async def send_message(self, page, input_selector):
        """Send message using the found input selector"""
        try:
            await page.fill(input_selector, self.message)
            await asyncio.sleep(0.5)
            
            # Try different ways to send
            send_methods = [
                lambda: page.keyboard.press('Enter'),
                lambda: page.click('button[type="submit"]'),
                lambda: page.click('.send-button'),
                lambda: page.click('[data-testid="send-button"]')
            ]
            
            for method in send_methods:
                try:
                    await method()
                    self.log("Message sent")
                    return True
                except:
                    continue
                    
            return False
            
        except Exception as e:
            self.log(f"Failed to send message: {e}", "error")
            return False
    
    async def skip_partner(self, page):
        """Try to skip to next partner"""
        skip_methods = [
            # Double escape method
            lambda: self._double_escape(page),
            # Button click methods
            lambda: page.click('button.chakra-button.css-1nb04tj'),
            lambda: page.click('button:has-text("Next")'),
            lambda: page.click('button:has-text("Skip")'),
            lambda: page.click('[data-testid="next-button"]'),
            lambda: page.keyboard.press('F5')  # Refresh as last resort
        ]
        
        for method in skip_methods:
            try:
                await method()
                self.log("Partner skipped")
                return True
            except:
                continue
        
        return False
    
    async def _double_escape(self, page):
        """Helper method for double escape"""
        await page.keyboard.press('Escape')
        await asyncio.sleep(0.2)
        await page.keyboard.press('Escape')
    
    async def chat_loop(self, page):
        chat_count = 0
        max_chats = 50  # Limit chats per session
        
        while chat_count < max_chats:
            try:
                self.log(f"=== CHAT {chat_count + 1} ===")
                
                # Wait for chat to be ready
                input_selector = await self.wait_for_chat_ready(page)
                if not input_selector:
                    self.log("Chat interface not found, ending session", "error")
                    return False
                
                # Send message
                if await self.send_message(page, input_selector):
                    self.log("Message sent successfully")
                else:
                    self.log("Failed to send message", "warning")
                
                # Wait before skipping
                await asyncio.sleep(random.uniform(8, 12))
                
                # Skip to next partner
                if not await self.skip_partner(page):
                    self.log("Failed to skip partner", "warning")
                    await asyncio.sleep(5)  # Wait before trying again
                
                chat_count += 1
                await asyncio.sleep(random.uniform(2, 5))
                
            except Exception as e:
                self.log(f"Chat loop error: {e}", "error")
                await self.screenshot(page, f"chat_error_{chat_count}")
                chat_count += 1
                
                if chat_count >= max_chats:
                    break
                    
                await asyncio.sleep(5)
        
        self.log(f"Completed {chat_count} chats")
        return True
    
    async def run_session(self):
        async with async_playwright() as p:
            try:
                # Launch browser with enhanced args
                browser = await p.chromium.launch(
                    headless=self.headless,
                    args=[
                        '--no-sandbox',
                        '--disable-blink-features=AutomationControlled',
                        '--disable-web-security',
                        '--use-fake-ui-for-media-stream',
                        '--use-fake-device-for-media-stream',
                        '--allow-running-insecure-content'
                    ]
                )
                
                # Create context with enhanced settings
                context = await browser.new_context(
                    permissions=["camera", "microphone"],
                    viewport={'width': 1280, 'height': 720},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
                
                page = await context.new_page()
                
                # Navigate to Thundr
                self.log("Loading Thundr.com...")
                await page.goto("https://thundr.com", wait_until='domcontentloaded')
                await asyncio.sleep(3)
                await self.screenshot(page, "page_loaded")
                
                # Handle I Agree popup
                try:
                    await page.click('button:has-text("I Agree")', timeout=5000)
                    self.log("I Agree clicked")
                    await asyncio.sleep(2)
                except:
                    self.log("No I Agree popup found")
                
                # Select interests first (new order)
                self.log("Selecting interests...")
                if not await self.select_interests(page):
                    self.log("Interest selection failed", "warning")
                await asyncio.sleep(2)
                
                # Then fill form
                self.log("Filling entry form...")
                await self.fill_form(page)
                await asyncio.sleep(3)
                
                # Start video chat
                video_chat_selectors = [
                    'button:has-text("Video Chat")',
                    'button:has-text("Start Chat")',
                    '.video-chat-btn',
                    '.css-1oy2lww'  # Common Thundr button class
                ]
                if not await self.safe_click(page, video_chat_selectors, "Video Chat start"):
                    self.log("Failed to start video chat", "error")
                    return False
                
                await asyncio.sleep(5)  # Wait for chat to initialize
                
                # Start chat loop
                self.log("Starting chat loop...")
                await self.chat_loop(page)
                
                return True
                
            except Exception as e:
                self.log(f"Session error: {e}", "error")
                try:
                    await self.screenshot(page, "session_error")
                except:
                    pass
                return False
            finally:
                try:
                    await browser.close()
                except:
                    pass

async def main():
    # Debug mode: headless=False, debug=True for development
    # Production: headless=True, debug=False
    bot = OptimizedThundrBot(debug=True, headless=False)
    
    session_count = 0
    max_sessions = 10
    
    while session_count < max_sessions:
        logger.info(f"=== SESSION {session_count + 1}/{max_sessions} ===")
        
        success = await bot.run_session()
        
        if success:
            logger.info("Session completed successfully!")
        else:
            logger.info("Session failed, restarting...")
        
        session_count += 1
        
        # Random delay between sessions
        if session_count < max_sessions:
            delay = random.uniform(10, 30)
            logger.info(f"Waiting {delay:.1f}s before next session...")
            await asyncio.sleep(delay)
    
    logger.info("All sessions completed!")

if __name__ == "__main__":
    asyncio.run(main()) 