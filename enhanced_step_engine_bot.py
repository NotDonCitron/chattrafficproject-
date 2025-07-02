# -*- coding: utf-8 -*-
import os
import sys
from typing import Optional, List, Dict, Any, Callable
import asyncio
import random
import json
from datetime import datetime, timedelta
import logging
import time

print('=== THUNDR BOT STEP-ENGINE VERSION ===')

# Fix Windows Unicode encoding issues
if sys.platform.startswith('win'):
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    
    try:
        import codecs
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
        else:
            sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'replace')
            sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'replace')
    except Exception:
        pass

try:
    from playwright.async_api import async_playwright, Page, BrowserContext, Browser
except ImportError:
    print("Please install playwright: pip install playwright")
    sys.exit(1)

# Set up enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/step_engine.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class StepEngine:
    """
    Advanced Step Engine with automatic error detection, logging, and self-fixing capabilities
    """
    
    def __init__(self, page: Page):
        self.page = page
        self.step_results = []
        self.error_count = 0
        self.auto_fixes_applied = 0
        self.session_start = time.time()
        
        # Step tracking
        self.current_step = None
        self.step_times = {}
        
        # Error patterns for auto-fixing
        self.known_errors = {
            'TimeoutError': 'Element not found - trying alternative selectors',
            'ElementNotVisibleError': 'Element exists but not visible - waiting longer',
            'ClickError': 'Click failed - trying different click strategies'
        }
        
        # Selector fallback strategies
        self.selector_strategies = {
            'gender_radio': [
                'span[data-scope="radio-group"][data-part="item-control"][id*="radio:control"]',
                'span[data-scope="radio-group"][data-part="item-control"][data-state="unchecked"]',
                'span[data-scope="radio-group"][data-part="item-control"]',
                'span:has-text("Male"), span:has-text("Female")',
                'label:has-text("Male"), label:has-text("Female")',
                'input[type="radio"]'
            ],
            'looking_for_radio': [
                '#radio-group\\:\\:r1\\:\\:radio\\:control\\:a',
                'span[id="radio-group::r1::radio:control:a"]',
                'span[data-scope="radio-group"][data-part="item-control"][id*="radio:control:a"]',
                'span[data-scope="radio-group"][data-part="item-control"][data-state="unchecked"]',
                'span:has-text("Male"), span:has-text("Female"), span:has-text("Everyone")',
                'label:has-text("Male"), label:has-text("Female"), label:has-text("Everyone")'
            ],
            'start_button': [
                'button[type="button"].chakra-button.css-fw0t89',
                'button.chakra-button.css-fw0t89:has-text("Start")',
                'button.chakra-button:has-text("Start")',
                'button:has-text("Start")',
                'button[type="submit"]',
                'button.primary'
            ],
            'chat_input': [
                'input[placeholder*="message"]',
                'textarea[placeholder*="message"]',
                'input[placeholder*="type"]',
                '.chat-input',
                '[role="textbox"]',
                'input[type="text"]:visible'
            ]
        }

    async def run_step(self, step_func: Callable, step_name: str, critical: bool = True, max_retries: int = 3) -> bool:
        """
        Execute a step with comprehensive error handling and auto-fixing
        
        Args:
            step_func: The function to execute
            step_name: Human-readable step name
            critical: Whether failure should stop the entire process
            max_retries: Number of retry attempts
        """
        self.current_step = step_name
        step_start = time.time()
        
        logger.info(f"🔄 ==> Starting Step: {step_name}")
        
        for attempt in range(max_retries):
            try:
                result = await step_func()
                
                step_duration = time.time() - step_start
                self.step_times[step_name] = step_duration
                
                if result:
                    logger.info(f"✅ Step successful: {step_name} ({step_duration:.1f}s)")
                    self.step_results.append((step_name, "SUCCESS", step_duration, attempt + 1))
                    return True
                else:
                    logger.warning(f"⚠️ Step returned False: {step_name} (attempt {attempt + 1})")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2)  # Wait before retry
                        continue
                    
            except Exception as e:
                error_type = type(e).__name__
                error_msg = str(e)
                
                logger.error(f"❌ Error in step {step_name} (attempt {attempt + 1}): {error_type}: {error_msg}")
                
                # Take error screenshot
                screenshot_path = f"logs/error_{step_name}_attempt_{attempt + 1}_{int(time.time())}.png"
                try:
                    await self.page.screenshot(path=screenshot_path)
                    logger.info(f"📸 Error screenshot saved: {screenshot_path}")
                except:
                    pass
                
                # Try auto-fix if this is not the last attempt
                if attempt < max_retries - 1:
                    auto_fix_applied = await self.try_auto_fix(step_name, error_type, error_msg)
                    if auto_fix_applied:
                        self.auto_fixes_applied += 1
                        logger.info(f"🔧 Auto-fix applied for {step_name}, retrying...")
                        await asyncio.sleep(3)  # Wait after auto-fix
                        continue
                
                self.error_count += 1
                
                if attempt == max_retries - 1:
                    step_duration = time.time() - step_start
                    self.step_results.append((step_name, f"FAILED: {error_type}", step_duration, max_retries))
                    
                    if critical:
                        logger.error(f"🚨 Critical step failed: {step_name} - Stopping execution")
                        return False
                    else:
                        logger.warning(f"⚠️ Non-critical step failed: {step_name} - Continuing")
                        return False
        
        return False

    async def try_auto_fix(self, step_name: str, error_type: str, error_msg: str) -> bool:
        """
        Attempt automatic fixes for common issues
        """
        logger.info(f"🔧 Attempting auto-fix for {step_name}: {error_type}")
        
        # Auto-fix 1: Page refresh for timeout errors
        if 'timeout' in error_msg.lower() or 'TimeoutError' in error_type:
            logger.info("🔧 Auto-fix: Refreshing page for timeout error")
            try:
                await self.page.reload(wait_until='domcontentloaded')
                await asyncio.sleep(3)
                return True
            except:
                pass
        
        # Auto-fix 2: Clear popups that might be blocking
        if 'click' in error_msg.lower() or 'element' in error_msg.lower():
            logger.info("🔧 Auto-fix: Checking for blocking popups")
            try:
                # Try to close any popups
                popup_selectors = [
                    'button:has-text("Close")',
                    'button:has-text("X")',
                    '[aria-label="Close"]',
                    '.modal-close',
                    '.popup-close'
                ]
                
                for selector in popup_selectors:
                    try:
                        popup = await self.page.query_selector(selector)
                        if popup and await popup.is_visible():
                            await popup.click()
                            logger.info(f"🔧 Auto-fix: Closed popup with selector: {selector}")
                            await asyncio.sleep(1)
                            return True
                    except:
                        continue
            except:
                pass
        
        # Auto-fix 3: Press Escape to clear any overlay
        if 'element' in error_msg.lower():
            logger.info("🔧 Auto-fix: Pressing Escape to clear overlays")
            try:
                await self.page.keyboard.press('Escape')
                await asyncio.sleep(1)
                return True
            except:
                pass
        
        return False

    async def click_with_fallbacks(self, strategy_name: str, timeout: int = 5000) -> bool:
        """
        Try multiple selectors with intelligent fallbacks
        """
        if strategy_name not in self.selector_strategies:
            logger.error(f"❌ Unknown selector strategy: {strategy_name}")
            return False
        
        selectors = self.selector_strategies[strategy_name]
        
        for i, selector in enumerate(selectors):
            try:
                logger.info(f"🎯 Trying selector {i+1}/{len(selectors)}: {selector}")
                
                element = await self.page.wait_for_selector(selector, timeout=timeout)
                if element and await element.is_visible():
                    await element.click()
                    logger.info(f"✅ Successfully clicked with selector: {selector}")
                    return True
                else:
                    logger.info(f"⚠️ Element found but not visible: {selector}")
                    
            except Exception as e:
                logger.warning(f"⚠️ Selector failed: {selector} - {str(e)}")
                continue
        
        logger.error(f"❌ All selectors failed for strategy: {strategy_name}")
        return False

    async def fill_with_fallbacks(self, strategy_name: str, text: str, timeout: int = 5000) -> bool:
        """
        Try multiple input selectors for filling text
        """
        if strategy_name not in self.selector_strategies:
            logger.error(f"❌ Unknown selector strategy: {strategy_name}")
            return False
        
        selectors = self.selector_strategies[strategy_name]
        
        for i, selector in enumerate(selectors):
            try:
                logger.info(f"📝 Trying input selector {i+1}/{len(selectors)}: {selector}")
                
                element = await self.page.wait_for_selector(selector, timeout=timeout)
                if element and await element.is_visible():
                    await element.fill(text)
                    logger.info(f"✅ Successfully filled text with selector: {selector}")
                    return True
                else:
                    logger.info(f"⚠️ Input found but not visible: {selector}")
                    
            except Exception as e:
                logger.warning(f"⚠️ Input selector failed: {selector} - {str(e)}")
                continue
        
        logger.error(f"❌ All input selectors failed for strategy: {strategy_name}")
        return False

    def generate_summary_report(self) -> Dict[str, Any]:
        """
        Generate comprehensive session summary report
        """
        session_duration = time.time() - self.session_start
        
        successful_steps = [r for r in self.step_results if r[1] == "SUCCESS"]
        failed_steps = [r for r in self.step_results if r[1].startswith("FAILED")]
        
        return {
            "session_summary": {
                "total_duration": round(session_duration, 2),
                "total_steps": len(self.step_results),
                "successful_steps": len(successful_steps),
                "failed_steps": len(failed_steps),
                "error_count": self.error_count,
                "auto_fixes_applied": self.auto_fixes_applied,
                "success_rate": round(len(successful_steps) / len(self.step_results) * 100, 1) if self.step_results else 0
            },
            "step_details": self.step_results,
            "step_timings": self.step_times,
            "recommendations": self.generate_recommendations()
        }

    def generate_recommendations(self) -> List[str]:
        """
        Generate intelligent recommendations based on step results
        """
        recommendations = []
        
        failed_steps = [r for r in self.step_results if r[1].startswith("FAILED")]
        
        if len(failed_steps) > 3:
            recommendations.append("High failure rate detected. Consider updating selectors or checking for website changes.")
        
        if self.error_count > self.auto_fixes_applied * 2:
            recommendations.append("Many errors couldn't be auto-fixed. Manual intervention may be needed.")
        
        # Check for specific step failures
        for step_name, status, duration, attempts in self.step_results:
            if status.startswith("FAILED"):
                if "radio" in step_name.lower():
                    recommendations.append(f"Radio button selection failed in '{step_name}'. Check for Chakra UI component updates.")
                elif "start" in step_name.lower():
                    recommendations.append(f"Start button not found in '{step_name}'. Check for form submission changes.")
                elif "chat" in step_name.lower():
                    recommendations.append(f"Chat detection failed in '{step_name}'. Verify chat interface changes.")
        
        if not recommendations:
            recommendations.append("All steps executed successfully! No recommendations needed.")
        
        return recommendations

    async def save_report(self):
        """
        Save comprehensive report to file
        """
        os.makedirs("logs", exist_ok=True)
        
        report = self.generate_summary_report()
        report_path = f"logs/step_engine_report_{int(time.time())}.json"
        
        try:
            with open(report_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            
            logger.info(f"📊 Comprehensive report saved: {report_path}")
            
            # Also create a readable summary
            summary_path = f"logs/step_summary_{int(time.time())}.txt"
            with open(summary_path, 'w', encoding='utf-8') as f:
                f.write("=== THUNDR BOT STEP ENGINE REPORT ===\n\n")
                f.write(f"Session Duration: {report['session_summary']['total_duration']}s\n")
                f.write(f"Total Steps: {report['session_summary']['total_steps']}\n")
                f.write(f"Success Rate: {report['session_summary']['success_rate']}%\n")
                f.write(f"Auto-fixes Applied: {report['session_summary']['auto_fixes_applied']}\n\n")
                
                f.write("=== STEP RESULTS ===\n")
                for step_name, status, duration, attempts in self.step_results:
                    f.write(f"{step_name}: {status} ({duration:.1f}s, {attempts} attempts)\n")
                
                f.write("\n=== RECOMMENDATIONS ===\n")
                for rec in report['recommendations']:
                    f.write(f"• {rec}\n")
            
            logger.info(f"📄 Summary report saved: {summary_path}")
            
        except Exception as e:
            logger.error(f"❌ Failed to save report: {e}")

class ThundrStepBot:
    """
    Enhanced Thundr Bot using Step Engine architecture
    """
    
    def __init__(self):
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.step_engine: Optional[StepEngine] = None
        
        # Bot configuration
        self.messages = ["Write me on Snapchat for Free nude ;* Snapchat : LaLiLuLaara"]
        self.session_birth_date: Optional[Dict[str, str]] = None
        self.session_interests: Optional[List[str]] = None

    async def init_browser(self) -> bool:
        """Initialize browser with step engine monitoring"""
        async def _init():
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch(
                headless=False,
                slow_mo=1000,  # Slow for debugging
                args=[
                    '--no-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream'
                ]
            )
            
            self.context = await self.browser.new_context(
                viewport={'width': 1280, 'height': 720},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                permissions=['camera', 'microphone']
            )
            
            self.page = await self.context.new_page()
            
            # Initialize step engine
            self.step_engine = StepEngine(self.page)
            
            # Grant permissions
            await self.context.grant_permissions(['camera', 'microphone'], origin='https://thundr.com')
            
            return True
        
        return await self.step_engine.run_step(_init, "Browser Initialization", critical=True) if self.step_engine else await _init()

    async def load_thundr_page(self) -> bool:
        """Load Thundr.com with step monitoring"""
        async def _load():
            await self.page.goto('https://thundr.com/', wait_until='domcontentloaded')
            await asyncio.sleep(3)
            
            title = await self.page.title()
            if 'thundr' in title.lower():
                await self.page.screenshot(path=f"logs/step_page_loaded_{int(time.time())}.png")
                return True
            return False
        
        return await self.step_engine.run_step(_load, "Load Thundr Page", critical=True)

    async def handle_interests(self) -> bool:
        """Handle interest selection with step monitoring"""
        async def _interests():
            # Click interest input
            if await self.step_engine.click_with_fallbacks('chat_input', timeout=3000):  # Using chat_input as placeholder
                await asyncio.sleep(2)
                
                # Try to select some interests
                interests = ["Movies", "Music", "Gaming"]
                selected = 0
                
                for interest in interests:
                    try:
                        option = await self.page.query_selector(f'[role="option"]:has-text("{interest}")')
                        if option and await option.is_visible():
                            await option.click()
                            selected += 1
                            await asyncio.sleep(0.5)
                    except:
                        continue
                
                logger.info(f"Selected {selected} interests")
                return selected > 0
            
            return True  # Non-critical, continue even if failed
        
        return await self.step_engine.run_step(_interests, "Interest Selection", critical=False)

    async def click_video_chat(self) -> bool:
        """Click video chat button with step monitoring"""
        return await self.step_engine.run_step(
            lambda: self.step_engine.click_with_fallbacks('start_button', timeout=10000),
            "Click Video Chat Button",
            critical=True
        )

    async def handle_popups(self) -> bool:
        """Handle I Agree popup with step monitoring"""
        async def _popups():
            agree_selectors = [
                'button:has-text("I Agree")',
                'button:has-text("Agree")',
                'button:has-text("Accept")'
            ]
            
            for selector in agree_selectors:
                try:
                    button = await self.page.query_selector(selector)
                    if button and await button.is_visible():
                        await button.click()
                        logger.info(f"Closed popup with: {selector}")
                        return True
                except:
                    continue
            
            return True  # No popup found is also success
        
        return await self.step_engine.run_step(_popups, "Handle Popups", critical=False)

    async def fill_form_with_radio_fix(self) -> bool:
        """Fill form with radio button fixes"""
        async def _form():
            await asyncio.sleep(2)
            
            # Gender selection with radio button fix
            gender_success = await self.step_engine.run_step(
                lambda: self.step_engine.click_with_fallbacks('gender_radio'),
                "Select Gender Radio",
                critical=True,
                max_retries=5
            )
            
            if not gender_success:
                return False
            
            await asyncio.sleep(1)
            
            # Looking for selection with specific radio fix
            looking_success = await self.step_engine.run_step(
                lambda: self.step_engine.click_with_fallbacks('looking_for_radio'),
                "Select Looking For Radio",
                critical=True,
                max_retries=5
            )
            
            if not looking_success:
                return False
            
            await asyncio.sleep(1)
            
            # Terms checkbox
            try:
                checkbox = await self.page.query_selector('svg[data-state="unchecked"], input[type="checkbox"]')
                if checkbox and await checkbox.is_visible():
                    await checkbox.click()
                    logger.info("Terms checkbox activated")
            except:
                pass
            
            await asyncio.sleep(1)
            
            # Start button with enhanced detection
            start_success = await self.step_engine.run_step(
                lambda: self.step_engine.click_with_fallbacks('start_button'),
                "Click Start Button",
                critical=True,
                max_retries=5
            )
            
            if start_success:
                await asyncio.sleep(5)  # Wait for form submission
                await self.page.screenshot(path=f"logs/step_form_completed_{int(time.time())}.png")
                return True
            
            return False
        
        return await self.step_engine.run_step(_form, "Fill Entry Form", critical=True)

    async def wait_for_chat(self) -> bool:
        """Wait for chat window with step monitoring"""
        async def _chat_wait():
            for i in range(60):  # 60 second timeout
                try:
                    if await self.step_engine.fill_with_fallbacks('chat_input', '', timeout=1000):  # Just test if input exists
                        logger.info("Chat window found!")
                        await self.page.screenshot(path=f"logs/step_chat_found_{int(time.time())}.png")
                        return True
                except:
                    pass
                
                if (i + 1) % 10 == 0:
                    logger.info(f"Still waiting for chat... {i+1}/60 seconds")
                
                await asyncio.sleep(1)
            
            return False
        
        return await self.step_engine.run_step(_chat_wait, "Wait for Chat Window", critical=True)

    async def test_chat_message(self) -> bool:
        """Send test message with step monitoring"""
        async def _test_message():
            message = random.choice(self.messages)
            success = await self.step_engine.fill_with_fallbacks('chat_input', message)
            
            if success:
                try:
                    await self.page.keyboard.press('Enter')
                    await asyncio.sleep(3)
                    await self.page.screenshot(path=f"logs/step_message_sent_{int(time.time())}.png")
                    logger.info(f"Message sent: {message}")
                    return True
                except:
                    pass
            
            return False
        
        return await self.step_engine.run_step(_test_message, "Send Test Message", critical=False)

    async def run_full_session(self) -> bool:
        """Run complete bot session with step engine monitoring"""
        logger.info("🚀 Starting Thundr Bot Step Engine Session")
        
        # Create logs directory
        os.makedirs("logs", exist_ok=True)
        
        try:
            # Step 1: Initialize browser
            if not await self.init_browser():
                return False
            
            # Step 2: Load page
            if not await self.load_thundr_page():
                return False
            
            # Step 3: Handle interests (non-critical)
            await self.handle_interests()
            
            # Step 4: Click video chat
            if not await self.click_video_chat():
                return False
            
            # Step 5: Handle popups
            await self.handle_popups()
            
            # Step 6: Fill form with radio fixes
            if not await self.fill_form_with_radio_fix():
                return False
            
            # Step 7: Wait for chat
            if not await self.wait_for_chat():
                return False
            
            # Step 8: Test chat
            await self.test_chat_message()
            
            logger.info("✅ Session completed successfully!")
            return True
            
        except Exception as e:
            logger.error(f"❌ Session failed: {e}")
            return False
        
        finally:
            # Generate comprehensive report
            if self.step_engine:
                await self.step_engine.save_report()
            
            # Cleanup
            await self.cleanup()

    async def cleanup(self):
        """Cleanup browser resources"""
        try:
            if self.page:
                await self.page.close()
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            logger.info("🧹 Browser cleanup completed")
        except Exception as e:
            logger.error(f"❌ Cleanup error: {e}")

async def main():
    """Main execution function"""
    print("🚀 Starting Thundr Bot with Step Engine Architecture")
    print("📊 Comprehensive logging and auto-fixing enabled")
    
    bot = ThundrStepBot()
    success = await bot.run_full_session()
    
    if success:
        print("\n✅ STEP ENGINE SESSION COMPLETED SUCCESSFULLY!")
    else:
        print("\n❌ STEP ENGINE SESSION FAILED!")
    
    print("📊 Check logs/ directory for detailed reports and screenshots")
    print("🔧 Auto-fix suggestions available in the report")

if __name__ == "__main__":
    asyncio.run(main()) 