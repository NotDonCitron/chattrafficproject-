# -*- coding: utf-8 -*-
# type: ignore
"""
Debug Bot - Comprehensive automation script with self-healing capabilities
Note: This file uses dynamic typing for automation flexibility.
All type checking warnings are intentionally suppressed.
"""
import os
import sys

# Fix Windows Unicode encoding issues
if sys.platform.startswith('win'):
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    import codecs
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # type: ignore
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')  # type: ignore

import asyncio
import random
import json
from datetime import datetime, timedelta
from playwright.async_api import async_playwright  # type: ignore
import logging

print('Script gestartet')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ThundrBot:
    def __init__(self, proxies=None, messages=None):
        self.proxies = proxies or []
        self.current_proxy_index = 0
        self.messages = messages or ["Write me on Snapchat for Free nude ;* Snapchat : LaLiLuLaara"]
        self.browser = None
        self.context = None
        self.page = None
        
        self.session_birth_date = None
        self.session_interests = None
        self.session_initialized = False
        
        self.interests_cache_file = "thundr_interests_cache.json"
        self.all_available_interests = []
        self.interests_preloaded = False

    def save_interests_cache(self, interests):
        try:
            with open(self.interests_cache_file, 'w', encoding='utf-8') as f:
                json.dump(interests, f, ensure_ascii=False, indent=2)
            print(f"[OK] {len(interests)} Interests im Cache gespeichert")
        except Exception as e:
            print(f"[WARNING] Fehler beim Speichern des Interest-Cache: {e}")

    def load_interests_cache(self):
        try:
            if os.path.exists(self.interests_cache_file):
                with open(self.interests_cache_file, 'r', encoding='utf-8') as f:
                    interests = json.load(f)
                print(f"[OK] {len(interests)} Interests aus Cache geladen")
                return interests
        except Exception as e:
            print(f"[WARNING] Fehler beim Laden des Interest-Cache: {e}")
        return []

    def init_session_data(self):
        if not self.session_initialized:
            today = datetime.now()
            start_date = today - timedelta(days=25*365)
            end_date = today - timedelta(days=18*365)
            random_date = start_date + timedelta(
                days=random.randint(0, (end_date - start_date).days)
            )
            self.session_birth_date = {
                'day': random_date.strftime('%d'),
                'month': random_date.strftime('%m'),
                'year': random_date.strftime('%Y')
            }
            
            self.all_available_interests = self.load_interests_cache()
            
            if self.all_available_interests and len(self.all_available_interests) >= 33:
                self.session_interests = random.sample(self.all_available_interests, 33)
                print(f"[OK] Selected 33 interests from {len(self.all_available_interests)} available")
            elif self.all_available_interests:
                # Repeat available interests to reach 33
                repeat_count = (33 // len(self.all_available_interests)) + 1
                self.session_interests = (self.all_available_interests * repeat_count)[:33]
                print(f"[REPEAT] Repeated {len(self.all_available_interests)} interests {repeat_count} times to reach 33")
            else:
                fallback_interests = ["Gaming", "Music", "Movies", "Sports", "Technology", "Art", "Travel", "Food", "Photography", "Dancing"]
                self.session_interests = (fallback_interests * 4)[:33]  # 10 * 4 = 40, take first 33
                print(f"[FALLBACK] Using emergency fallback interests, repeated to reach 33")
            
            self.session_initialized = True
            print(f"[TARGET] Session-Daten initialisiert:")
            print(f"   Geburtsdatum: {self.session_birth_date['day']}.{self.session_birth_date['month']}.{self.session_birth_date['year']}")
            print(f"   Interessen ({len(self.session_interests)}): {', '.join(self.session_interests[:5])}")

    def get_next_proxy(self):
        if not self.proxies:
            return None
        proxy = self.proxies[self.current_proxy_index]
        self.current_proxy_index = (self.current_proxy_index + 1) % len(self.proxies)
        return proxy

    async def setup_browser(self, proxy=None):
        playwright = await async_playwright().start()
        browser_args = {
            'headless': False,
            'args': [
                '--no-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream',
                '--allow-running-insecure-content'
            ]
        }
        if proxy:
            browser_args['proxy'] = {
                'server': f"http://{proxy['host']}:{proxy['port']}",
                'username': proxy.get('username'),
                'password': proxy.get('password')
            }
            logger.info(f"Using proxy: {proxy['host']}:{proxy['port']}")
        self.browser = await playwright.chromium.launch(**browser_args)
        context_args = {
            'viewport': {'width': 1280, 'height': 720},
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'permissions': ['camera', 'microphone']
        }
        self.context = await self.browser.new_context(**context_args)
        self.page = await self.context.new_page()
        
        await self.context.grant_permissions(['camera', 'microphone'], origin='https://thundr.com')
        
        await self.page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
                value: async () => [
                    { 
                        kind: 'videoinput', 
                        label: 'HD Pro Webcam C920', 
                        deviceId: 'a1b2c3d4e5f6g7h8i9j0',
                        groupId: 'group1'
                    },
                    { 
                        kind: 'audioinput', 
                        label: 'Microphone (HD Pro Webcam C920)', 
                        deviceId: 'k1l2m3n4o5p6q7r8s9t0',
                        groupId: 'group1'
                    }
                ]
            });
            
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            navigator.mediaDevices.getUserMedia = async (constraints) => {
                try {
                    const stream = await originalGetUserMedia(constraints);
                    Object.defineProperty(stream, '__thundr_real_stream', { 
                        value: true, 
                        writable: false 
                    });
                    return stream;
                } catch (error) {
                    throw error;
                }
            };
            
            console.log('[TARGET] WebRTC spoofing initialized');
        """)

    async def goto_thundr(self):
        try:
            print("Lade Thundr.com...")
            await self.page.goto('https://thundr.com/', wait_until='domcontentloaded')
            await asyncio.sleep(random.uniform(3, 5))  # Longer wait
            
            await self.page.screenshot(path=f"debug_step1_loaded_{int(datetime.now().timestamp())}.png")
            print("[OK] Seite geladen - Screenshot gespeichert")
            return True
        except Exception as e:
            print(f"[ERROR] Fehler beim Laden der Seite: {e}")
            return False

    async def enhanced_interest_selection(self):
        """LIVE INTEREST SCRAPING - Get current interests from dropdown"""
        try:
            print("[LIVE] Live Interest Scraping from Dropdown...")
            
            # 1. Click interest input to open dropdown - try multiple selectors
            input_selectors = [
                'input[placeholder="Type your interests..."]',  # Exact from inspector
                'input[placeholder*="interest"]',
                'input[placeholder*="Type"]',
                '.interest-input',
                '[data-testid="interest-input"]'
            ]
            
            input_clicked = False
            for selector in input_selectors:
                try:
                    await self.page.click(selector, timeout=3000)
                    print(f"[OK] Interest input clicked: {selector}")
                    input_clicked = True
                    break
                except Exception as e:
                    print(f"[DEBUG] Input selector failed: {selector}")
                    continue
            
            if not input_clicked:
                print("[ERROR] Could not find interest input field!")
                return await self.fallback_interest_selection()
            
            # 2. Wait for dropdown options to appear with multiple selectors
            dropdown_selectors = [
                'li[role="option"]',
                '.dropdown-option',
                '[data-option]',
                'div[role="option"]',
                '.interest-option'
            ]
            
            dropdown_found = False
            for selector in dropdown_selectors:
                try:
                    await self.page.wait_for_selector(selector, timeout=3000)
                    print(f"[OK] Dropdown found: {selector}")
                    dropdown_found = True
                    await asyncio.sleep(1)  # Brief wait for all options to load
                    break
                except Exception as e:
                    print(f"[DEBUG] Dropdown selector failed: {selector}")
                    continue
            
            if not dropdown_found:
                print("[ERROR] No dropdown appeared after clicking input!")
                # Take screenshot for debugging
                await self.page.screenshot(path=f"debug_no_dropdown_{int(datetime.now().timestamp())}.png")
                return await self.fallback_interest_selection()
            
            # 3. Get ALL current interests from live dropdown
            interest_elements = await self.page.query_selector_all('li[role="option"]')
            all_current_interests = []
            
            print(f"[DEBUG] Found {len(interest_elements)} interest elements in dropdown")
            
            for i, element in enumerate(interest_elements):
                try:
                    text = await element.inner_text()
                    if text and text.strip():
                        all_current_interests.append(text.strip())
                        print(f"[DEBUG] Interest {i+1}: '{text.strip()}'")
                except Exception as e:
                    print(f"[DEBUG] Failed to get text from element {i}: {e}")
                    continue
            
            print(f"[LIVE] Found {len(all_current_interests)} live interests")
            
            # 4. Select exactly 33 interests
            if all_current_interests:
                max_select = min(33, len(all_current_interests))
                selected_interests = random.sample(all_current_interests, max_select)
                
                print(f"[TARGET] Attempting to select {max_select} interests from {len(all_current_interests)} available")
                print(f"[INTERESTS] Will try: {', '.join(selected_interests[:10])}{'...' if len(selected_interests) > 10 else ''}")
                
                selected_count = 0
                failed_count = 0
                for interest in selected_interests:
                    try:
                        # Use exact text match from live dropdown
                        selector = f'li[role="option"]:has-text("{interest}")'
                        await self.page.click(selector)
                        selected_count += 1
                        print(f"[OK] {interest} selected ({selected_count})")
                        await asyncio.sleep(0.1)  # Faster for 33 selections
                        
                    except Exception as e:
                        failed_count += 1
                        print(f"[WARNING] Failed to select {interest}: {str(e)[:50]}...")
                        continue
                
                print(f"[LIVE] Interest selection completed: {selected_count}/{max_select} interests selected (target: 33)")
                print(f"[STATS] Success: {selected_count}, Failed: {failed_count}, Total attempted: {len(selected_interests)}")
                
                # Validation check - ensure we have enough interests
                if selected_count < 15:  # Minimum threshold 
                    print(f"[ERROR] Only {selected_count} interests selected! This is too few. Exiting session.")
                    return False
                elif selected_count < 33:
                    print(f"[WARNING] Only {selected_count}/33 interests selected. Site may have limits.")
                else:
                    print(f"[SUCCESS] {selected_count} interests selected - target achieved!")
                
                print(f"[ENHANCED] Interest Selection abgeschlossen: {selected_count} Interests")
                return True
            else:
                print("[WARNING] No interests found in dropdown - continuing anyway")
                return True
                
        except Exception as e:
            print(f"[ERROR] Live interest scraping failed: {e}")
            # Fallback to old method
            print("[FALLBACK] Trying cached interests...")
            return await self.fallback_interest_selection()

    async def fallback_interest_selection(self):
        """Fallback method if live scraping fails - try typing interests"""
        try:
            print("[FALLBACK] Trying typed interest selection...")
            interests_to_try = self.session_interests[:15]  # Try first 15 interests
            selected_count = 0
            
            # Find the interest input field
            input_selectors = [
                'input[placeholder="Type your interests..."]',
                'input[placeholder*="interest"]',
                'input[placeholder*="Type"]'
            ]
            
            input_field = None
            for selector in input_selectors:
                try:
                    input_field = await self.page.query_selector(selector)
                    if input_field and await input_field.is_visible():
                        print(f"[FALLBACK] Found input field: {selector}")
                        break
                except:
                    continue
            
            if not input_field:
                print("[ERROR] No input field found for fallback!")
                return False
            
            for interest in interests_to_try:
                try:
                    # Clear and type the interest
                    await input_field.fill("")
                    await asyncio.sleep(0.2)
                    await input_field.fill(interest)
                    await asyncio.sleep(0.5)
                    
                    # Try pressing Enter or Tab to select
                    await input_field.press('Enter')
                    await asyncio.sleep(0.3)
                    
                    selected_count += 1
                    print(f"[FALLBACK] {interest} typed and selected ({selected_count})")
                    
                    if selected_count >= 15:  # Stop after 15 typed interests
                        break
                        
                except Exception as e:
                    print(f"[WARNING] Fallback failed for {interest}: {str(e)[:50]}...")
                    continue
            
            print(f"[FALLBACK] Selected {selected_count} interests (target: 33)")
            
            # Validation check for fallback too
            if selected_count < 5:  # Lower threshold for typed fallback
                print(f"[ERROR] Fallback only selected {selected_count} interests! This is too few. Exiting session.")
                return False
            elif selected_count >= 10:
                print(f"[SUCCESS] Fallback achieved {selected_count} interests - good enough to continue!")
            else:
                print(f"[WARNING] Fallback selected {selected_count} interests. Continuing anyway.")
            
            print(f"[ENHANCED] Interest Selection abgeschlossen: {selected_count} Interests")
            return True
            
        except Exception as e:
            print(f"[ERROR] Fallback interest selection failed: {e}")
            return True

    async def click_video_chat(self):
        try:
            print("Suche nach Video Chat Button...")
            await asyncio.sleep(2)
            
            video_chat_selectors = [
                'button:has-text("Video Chat")',
                'a:has-text("Video Chat")',
                'button:has-text("Start Video")',
                '[data-action="video-chat"]',
                '.video-chat-button',
                'button[class*="video"]'
            ]
            
            for selector in video_chat_selectors:
                try:
                    button = await self.page.wait_for_selector(selector, timeout=5000)
                    if button and await button.is_visible():
                        await button.click()
                        print(f"[OK] Video Chat Button geklickt: {selector}")
                        await asyncio.sleep(3)
                        return True
                except:
                    continue
            
            print("[ERROR] Video Chat Button nicht gefunden")
            return False
            
        except Exception as e:
            print(f"[ERROR] Fehler beim Video Chat Button: {e}")
            return False

    async def handle_i_agree_popup(self):
        try:
            print("Suche nach 'I Agree' Popup...")
            await asyncio.sleep(3)  # Longer wait for popup
            
            agree_selectors = [
                'button:has-text("I Agree")',
                'button:has-text("Agree")',
                'button:has-text("Accept")',
                'button:has-text("Continue")',
                '.agree-button',
                '[data-action="agree"]'
            ]
            
            for selector in agree_selectors:
                try:
                    agree_btn = await self.page.wait_for_selector(selector, timeout=5000)
                    if agree_btn and await agree_btn.is_visible():
                        await agree_btn.click()
                        print(f"[OK] 'I Agree' Popup geschlossen: {selector}")
                        await asyncio.sleep(2)
                        return True
                except:
                    continue
            
            print("[OK] Kein 'I Agree' Popup gefunden")
            return True
            
        except Exception as e:
            print(f"[WARNING] Fehler beim I Agree Popup: {e}")
            return True

    async def enhanced_form_filling(self):
        """ULTRA-FAST form filling with EXACT selectors from user"""
        try:
            print("Fülle Entry Form aus (ULTRA-FAST)...")
            
            # WAIT FOR FORM TO APPEAR
            print("⏳ Waiting for form to appear...")
            try:
                await self.page.wait_for_selector('form', timeout=10000)
                print("✅ Form detected")
            except:
                print("⚠️ No form detected, continuing anyway")
            
            # DEBUG: Log all available inputs and buttons
            print("🔍 DEBUG: Analyzing page elements...")
            try:
                inputs = await self.page.query_selector_all('input')
                buttons = await self.page.query_selector_all('button')
                
                print(f"[DEBUG] Found {len(inputs)} inputs and {len(buttons)} buttons")
                
                for i, inp in enumerate(inputs[:10]):  # Show first 10 inputs
                    try:
                        outer_html = await inp.get_attribute('outerHTML')
                        print(f"[DEBUG] Input {i}: {outer_html[:100]}...")
                    except:
                        pass
                        
                for i, btn in enumerate(buttons[:10]):  # Show first 10 buttons
                    try:
                        text = await btn.inner_text()
                        outer_html = await btn.get_attribute('outerHTML')
                        print(f"[DEBUG] Button {i}: '{text}' - {outer_html[:100]}...")
                    except:
                        pass
                        
            except Exception as e:
                print(f"[DEBUG] Element analysis failed: {e}")
            
            # ULTRA-FAST FORM FILLING - USER'S EXACT METHOD WITH ENHANCED DEBUGGING
            print("🚀 Using ultra-fast form filling method with enhanced debugging")
            
            # 1. Female auswählen with multiple strategies
            print("1️⃣ Selecting Female...")
            female_success = False
            female_selectors = [
                'button:has-text("Female")',
                'input[value="female"]',
                'label:has-text("Female")',
                'span:has-text("Female")',
                '[data-value="female"]'
            ]
            
            for i, selector in enumerate(female_selectors):
                try:
                    print(f"[DEBUG] Trying Female selector {i+1}: {selector}")
                    await self.page.click(selector, timeout=3000)
                    print("✅ Female selected successfully!")
                    female_success = True
                    break
                except Exception as e:
                    print(f"[DEBUG] Female selector {i+1} failed: {str(e)[:100]}")
                    continue
            
            if not female_success:
                print("⚠️ All Female selectors failed, trying radio fallback...")
                try:
                    await self.page.click('span[data-scope="radio-group"][data-part="item-control"][data-state="unchecked"]')
                    print("✅ Female selected via radio fallback")
                except Exception as e:
                    print(f"❌ Female selection failed completely: {e}")
            
            # 2. Looking for Everyone with multiple strategies
            print("2️⃣ Selecting Everyone...")
            everyone_success = False
            everyone_selectors = [
                'button:has-text("Everyone")',
                'input[value="everyone"]',
                'label:has-text("Everyone")',
                'span:has-text("Everyone")',
                '[data-value="everyone"]'
            ]
            
            for i, selector in enumerate(everyone_selectors):
                try:
                    print(f"[DEBUG] Trying Everyone selector {i+1}: {selector}")
                    await self.page.click(selector, timeout=3000)
                    print("✅ Everyone selected successfully!")
                    everyone_success = True
                    break
                except Exception as e:
                    print(f"[DEBUG] Everyone selector {i+1} failed: {str(e)[:100]}")
                    continue
            
            if not everyone_success:
                print("⚠️ All Everyone selectors failed, trying radio fallback...")
                try:
                    radios = await self.page.query_selector_all('span[data-scope="radio-group"][data-part="item-control"]')
                    if len(radios) > 1:  # Click second radio if available
                        await radios[1].click()
                        print("✅ Everyone selected via radio fallback")
                except Exception as e:
                    print(f"❌ Everyone selection failed completely: {e}")
            
            # 3. Birth date generation
            start = datetime(2002, 1, 1)
            end = datetime(2004, 1, 1)
            delta = end - start
            random_days = random.randint(0, delta.days)
            dob = start + timedelta(days=random_days)
            day = dob.strftime('%d')
            month = dob.strftime('%m')
            year = dob.strftime('%Y')
            print(f"🎂 Generated birth date: {day}.{month}.{year}")
            
            # 4. Fill birth date fields with multiple strategies
            print("3️⃣ Filling birth date fields...")
            
            # Day field
            day_selectors = [
                'input[placeholder*="Day"]',
                'input[name*="day"]',
                'input[aria-label*="Day"]',
                'input[type="number"]'
            ]
            
            for i, selector in enumerate(day_selectors):
                try:
                    print(f"[DEBUG] Trying day selector {i+1}: {selector}")
                    await self.page.fill(selector, day, timeout=3000)
                    print(f"✅ Day filled: {day}")
                    break
                except Exception as e:
                    print(f"[DEBUG] Day selector {i+1} failed: {str(e)[:100]}")
                    continue
            
            # Month field
            month_selectors = [
                'input[placeholder*="Month"]',
                'input[name*="month"]',
                'input[aria-label*="Month"]'
            ]
            
            for i, selector in enumerate(month_selectors):
                try:
                    print(f"[DEBUG] Trying month selector {i+1}: {selector}")
                    await self.page.fill(selector, month, timeout=3000)
                    print(f"✅ Month filled: {month}")
                    break
                except Exception as e:
                    print(f"[DEBUG] Month selector {i+1} failed: {str(e)[:100]}")
                    continue
            
            # Year field
            year_selectors = [
                'input[placeholder*="Year"]',
                'input[name*="year"]',
                'input[aria-label*="Year"]'
            ]
            
            for i, selector in enumerate(year_selectors):
                try:
                    print(f"[DEBUG] Trying year selector {i+1}: {selector}")
                    await self.page.fill(selector, year, timeout=3000)
                    print(f"✅ Year filled: {year}")
                    break
                except Exception as e:
                    print(f"[DEBUG] Year selector {i+1} failed: {str(e)[:100]}")
                    continue
            
            # 5. Terms checkbox with multiple strategies
            print("4️⃣ Activating terms checkbox...")
            terms_selectors = [
                'input[type="checkbox"]',
                'svg[data-state="unchecked"]',
                '[role="checkbox"]',
                'label:has-text("terms")',
                'label:has-text("agree")'
            ]
            
            for i, selector in enumerate(terms_selectors):
                try:
                    print(f"[DEBUG] Trying terms selector {i+1}: {selector}")
                    await self.page.click(selector, timeout=3000)
                    print("✅ Terms checkbox activated")
                    break
                except Exception as e:
                    print(f"[DEBUG] Terms selector {i+1} failed: {str(e)[:100]}")
                    continue
            
            # Brief pause before start button
            await asyncio.sleep(1)
            
            # 6. Start Button with multiple strategies
            print("5️⃣ Clicking Start Button...")
            start_selectors = [
                'button:has-text("Start")',
                'button[type="button"].chakra-button',
                'button.css-fw0t89',
                'button:has-text("Begin")',
                'button[data-action="start"]',
                'input[type="submit"]'
            ]
            
            start_clicked = False
            for i, selector in enumerate(start_selectors):
                try:
                    print(f"[DEBUG] Trying start selector {i+1}: {selector}")
                    await self.page.click(selector, timeout=3000)
                    print("✅ Start button clicked successfully!")
                    start_clicked = True
                    break
                except Exception as e:
                    print(f"[DEBUG] Start selector {i+1} failed: {str(e)[:100]}")
                    continue
            
            if not start_clicked:
                print("❌ All Start button selectors failed!")
            
            await asyncio.sleep(5)  # Longer wait after form submission
            
            # Check for any warnings or errors
            await self.handle_fake_video_warnings()
            
            # Take screenshot after form completion
            await self.page.screenshot(path=f"debug_form_complete_{int(datetime.now().timestamp())}.png")
            print("[OK] Entry Form ausgefüllt - Screenshot gespeichert")
            
            # Additional wait to ensure we reach chat window
            print("[INFO] Warte auf Chat Window...")
            await asyncio.sleep(5)
            
            return True
            
        except Exception as e:
            print(f"[ERROR] Fehler beim Enhanced Form Filling: {e}")
            return True

    async def handle_fake_video_warnings(self):
        try:
            print("[SHIELD] Pruefe auf Fake Video Warnings...")
            await asyncio.sleep(1)
            
            warning_selectors = [
                'text="fake video"',
                'text="Fake Video"',
                'text="fake camera"',
                '[data-warning="fake-video"]',
                '*:has-text("fake"):visible'
            ]
            
            warning_found = False
            for selector in warning_selectors:
                try:
                    warning = await self.page.query_selector(selector)
                    if warning and await warning.is_visible():
                        print("[WARNING] Fake video warning detected!")
                        warning_found = True
                        break
                except:
                    continue
            
            if not warning_found:
                print("[OK] Keine Fake Video Warnings gefunden")
            
            return True
            
        except Exception as e:
            print(f"[WARNING] Fehler beim Fake Video Warning Check: {e}")
            return True

    async def wait_for_chat_window(self):
        """Enhanced chat window detection"""
        try:
            print("[CHAT] Erweiterte Chat Window Erkennung...")
            
            # Multiple strategies to detect chat window
            chat_indicators = [
                'input[placeholder*="message"]',
                'textarea[placeholder*="message"]', 
                'input[placeholder*="type"]',
                'textarea[placeholder*="type"]',
                '.chat-input',
                '.message-input',
                '[data-testid="chat-input"]',
                '[role="textbox"]',
                'input[type="text"]:visible',
                '.chat-container',
                '.video-chat-container'
            ]
            
            chat_window_found = False
            for attempt in range(3):  # Try 3 times
                print(f"[CHAT] Versuch {attempt + 1}/3 - Suche Chat Window...")
                
                for selector in chat_indicators:
                    try:
                        element = await self.page.wait_for_selector(selector, timeout=10000)
                        if element and await element.is_visible():
                            print(f"[SUCCESS] Chat Window gefunden: {selector}")
                            chat_window_found = True
                            return element
                    except:
                        continue
                
                if not chat_window_found:
                    print(f"[INFO] Chat Window nicht gefunden, warte 10s...")
                    await asyncio.sleep(10)
                    
                    # Take screenshot for debugging
                    await self.page.screenshot(path=f"debug_chat_search_{attempt}_{int(datetime.now().timestamp())}.png")
            
            if not chat_window_found:
                print("[ERROR] Chat Window nach mehreren Versuchen nicht gefunden")
                return None
                
        except Exception as e:
            print(f"[ERROR] Fehler bei Chat Window Erkennung: {e}")
            return None

    async def chat_loop(self):
        try:
            print("[LOOP] Starte Enhanced Chat-Loop...")
            
            # First, wait for chat window to be available
            chat_input = await self.wait_for_chat_window()
            if not chat_input:
                print("[ERROR] Kann nicht zum Chat Window gelangen")
                return False
            
            chat_count = 0
            while True:
                chat_count += 1
                print(f"\n--- Enhanced Chat #{chat_count} ---")
                
                await self.handle_fake_video_warnings()
                
                # Verify chat input is still available
                try:
                    if not await chat_input.is_visible():
                        print("[INFO] Chat input nicht mehr sichtbar, suche erneut...")
                        chat_input = await self.wait_for_chat_window()
                        if not chat_input:
                            print("[ERROR] Chat input verloren")
                            return False
                except:
                    print("[INFO] Chat input prüfung fehlgeschlagen, suche erneut...")
                    chat_input = await self.wait_for_chat_window()
                    if not chat_input:
                        return False
                
                print("[OK] Partner gefunden! Chat bereit.")
                
                # Send message
                message = random.choice(self.messages)
                try:
                    await chat_input.fill(message)
                    await asyncio.sleep(random.uniform(0.5, 1))
                    await chat_input.press('Enter')
                    print(f"[OK] Nachricht gesendet: {message}")
                except Exception as e:
                    print(f"[WARNING] Fehler beim Nachricht senden: {e}")
                
                # Wait 10 seconds
                print("[WAIT] Warte 10 Sekunden...")
                await asyncio.sleep(10)
                
                # Press ESC twice for new partner
                print("Drücke ESC zweimal für neuen Partner...")
                try:
                    await self.page.keyboard.press('Escape')
                    await asyncio.sleep(0.5)
                    print("[OK] Erster ESC gedrückt")
                    
                    await self.page.keyboard.press('Escape')
                    await asyncio.sleep(2)
                    print("[OK] Zweiter ESC gedrückt")
                    
                    await self.handle_boost_popup()
                    
                except Exception as e:
                    print(f"[WARNING] Fehler beim ESC drücken: {e}")
                
                await asyncio.sleep(random.uniform(3, 6))
                
                if chat_count % 3 == 0:
                    await self.page.screenshot(path=f"debug_enhanced_chat_{chat_count}_{int(datetime.now().timestamp())}.png")
                    print(f"[DEBUG] Screenshot nach {chat_count} Chats")
                
        except Exception as e:
            print(f"[ERROR] Fehler im Enhanced Chat-Loop: {e}")
            return False

    async def handle_boost_popup(self):
        try:
            print("[CHECK] Pruefe auf 'Buy A Boost' Popup...")
            await asyncio.sleep(2)
            
            maybe_later_selectors = [
                'button:has-text("Maybe Later")',
                'button:has-text("Later")',
                'button:has-text("Skip")',
                'button:has-text("No Thanks")'
            ]
            
            popup_found = False
            for selector in maybe_later_selectors:
                try:
                    maybe_later_btn = await self.page.query_selector(selector)
                    if maybe_later_btn and await maybe_later_btn.is_visible():
                        await maybe_later_btn.click()
                        print("[OK] 'Maybe Later' Button geklickt")
                        popup_found = True
                        await asyncio.sleep(1)
                        break
                except:
                    continue
            
            if not popup_found:
                print("[OK] Kein 'Buy A Boost' Popup gefunden")
            
            return True
            
        except Exception as e:
            print(f"[WARNING] Fehler beim Boost-Popup-Handling: {e}")
            return True

    async def cleanup(self):
        try:
            if self.page:
                await self.page.close()
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

    async def run_session(self, max_wait_time=60):
        proxy = self.get_next_proxy()
        if proxy:
            print(f"\n[Proxy] Verwende Proxy: {proxy['host']}:{proxy['port']}")
        else:
            print(f"\n[Kein Proxy] Direktverbindung")
            
        try:
            self.init_session_data()
            
            await self.setup_browser(proxy)
            print("Browser gestartet mit Enhanced WebRTC-Spoofing...")
            
            # 1. Load page
            if not await self.goto_thundr():
                return False
            
            # 2. Enhanced interest selection
            if not await self.enhanced_interest_selection():
                return False
            
            # 3. Video Chat Button
            if not await self.click_video_chat():
                return False
            
            # 4. I Agree Popup
            if not await self.handle_i_agree_popup():
                return False
            
            # 5. Enhanced Form Filling
            if not await self.enhanced_form_filling():
                return False
            
            # 6. Enhanced Chat-Loop
            chat_success = await self.chat_loop()
            
            if chat_success:
                print("[SUCCESS] Enhanced Chat-Loop erfolgreich abgeschlossen!")
                return True
            else:
                print("[WARNING] Enhanced Chat-Loop beendet")
                return False
                
        except Exception as e:
            print(f"[ERROR] Session-Fehler: {e}")
            return False
        finally:
            await self.cleanup()
            print("Browser bereinigt.")

async def main():
    print('🚀 === ULTRA-FAST THUNDR BOT - SPEED OPTIMIZED ===')
    print('⚡ Maximum speed, minimal delays, comprehensive logging')
    print('🔄 Auto-restart on timeouts, 33 interests per session')
    
    proxies = []
    print(f'Proxy-Liste: {len(proxies)} Proxys (Debug-Modus ohne Proxy)')
    
    messages = [
        "Write me on Snapchat for Free nude ;* Snapchat : LaLiLuLaara"
    ]
    
    bot = ThundrBot(proxies=proxies, messages=messages)
    max_sessions = 100  # Continuous ultra-fast sessions
    session_count = 0
    
    # Create logs directory for debug reports
    os.makedirs("logs", exist_ok=True)
    
    while session_count < max_sessions:
        print(f"\n=== [ENHANCED] STARTE BOT-SESSION {session_count + 1}/{max_sessions} ===")
        
        try:
            success = await bot.run_session(max_wait_time=60)
            
            if success:
                print(f"[SUCCESS] Enhanced Session {session_count + 1} erfolgreich abgeschlossen")
            else:
                print(f"[WARNING] Enhanced Session {session_count + 1} beendet (Neustart nötig)")
            
        except Exception as e:
            print(f"[ERROR] Fehler in Enhanced Session {session_count + 1}: {e}")
        
        session_count += 1
        
        if session_count < max_sessions:
            wait_time = random.uniform(3, 8)
            print(f"[WAIT] Warte {wait_time:.1f}s vor nächster Session...")
            await asyncio.sleep(wait_time)
    
    print("[FINISH] Alle Enhanced Sessions abgeschlossen!")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f'[ERROR] Enhanced Hauptprogramm-Fehler: {e}') 