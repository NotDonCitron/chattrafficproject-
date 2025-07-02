# -*- coding: utf-8 -*-
import os
import sys

# Fix Windows Unicode encoding issues
if sys.platform.startswith('win'):
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    import codecs
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import asyncio
import random
import json
from datetime import datetime, timedelta
from playwright.async_api import async_playwright
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
            
            if self.all_available_interests:
                max_interests = min(10, len(self.all_available_interests))  # Reduced for stability
                num_interests = random.randint(3, max_interests)
                self.session_interests = random.sample(self.all_available_interests, num_interests)
            else:
                fallback_interests = ["Gaming", "Music", "Movies", "Sports", "Technology"]
                num_interests = random.randint(3, 5)
                self.session_interests = random.sample(fallback_interests, num_interests)
            
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
        """Enhanced interest selection with multiple strategies"""
        try:
            print("[ENHANCED] Verbesserte Interest Selection...")
            await asyncio.sleep(2)  # Wait for page to fully load
            
            # Strategy 1: Try to click on input to open dropdown
            input_selectors = [
                'input[placeholder*="interest"]',
                'input[placeholder*="Interest"]', 
                '.interest-input',
                'input[type="text"]'
            ]
            
            dropdown_opened = False
            for selector in input_selectors:
                try:
                    input_elem = await self.page.query_selector(selector)
                    if input_elem and await input_elem.is_visible():
                        await input_elem.click()
                        await asyncio.sleep(1)
                        print(f"[OK] Interest input geklickt: {selector}")
                        dropdown_opened = True
                        break
                except:
                    continue
            
            if not dropdown_opened:
                print("[INFO] Kein Interest-Input gefunden, suche direkte Buttons...")
            
            # Strategy 2: Look for direct interest buttons (if no dropdown)
            selected_count = 0
            interests_to_try = ["Gaming", "Music", "Movies", "Sports", "Technology", "Art", "Food"]
            
            for interest in interests_to_try:
                try:
                    # Multiple selector strategies
                    selectors = [
                        f'button:has-text("{interest}")',
                        f'[role="option"]:has-text("{interest}")',
                        f'li:has-text("{interest}")',
                        f'div:has-text("{interest}")[role="button"]',
                        f'label:has-text("{interest}")',
                        f'[data-value="{interest.lower()}"]'
                    ]
                    
                    interest_found = False
                    for selector in selectors:
                        try:
                            element = await self.page.query_selector(selector)
                            if element and await element.is_visible():
                                await element.click()
                                selected_count += 1
                                print(f"[OK] {interest} ausgewählt ({selected_count})")
                                interest_found = True
                                await asyncio.sleep(0.5)
                                break
                        except:
                            continue
                    
                    if not interest_found:
                        print(f"[WARNING] {interest} nicht gefunden")
                        
                    # Stop after finding 5 interests
                    if selected_count >= 5:
                        break
                        
                except Exception as e:
                    print(f"[WARNING] Fehler bei {interest}: {e}")
                    continue
            
            print(f"[ENHANCED] Interest Selection abgeschlossen: {selected_count} Interests")
            await asyncio.sleep(2)
            return True
            
        except Exception as e:
            print(f"[ERROR] Fehler bei Enhanced Interest Selection: {e}")
            return True  # Continue anyway

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
        """Enhanced form filling with better selectors and error handling"""
        try:
            print("Fülle Entry Form aus (Enhanced)...")
            await asyncio.sleep(2)
            
            # 1. Gender selection with RADIO GROUP SELECTORS (CRITICAL FIX!)
            gender = random.choice(['Male', 'Female'])
            print(f"Waehle Gender aus: {gender}")
            
            gender_selected = False
            gender_selectors = [
                # EXACT RADIO CONTROL SELECTORS - CRITICAL FIX!
                'span[data-scope="radio-group"][data-part="item-control"][id*="radio:control"]',
                'span[data-scope="radio-group"][data-part="item-control"][data-state="unchecked"]',
                'span[data-scope="radio-group"][data-part="item-control"]',
                # CHAKRA UI RADIO GROUP SELECTORS - CRITICAL FIX!
                f'[data-scope="radio-group"] span:has-text("{gender}")',
                f'[data-scope="radio-group"] label:has-text("{gender}")',
                f'[data-scope="radio-group"][data-part="item-control"] + *:has-text("{gender}")',
                # Original selectors as fallback
                f'span:has-text("{gender}"):visible',
                f'button:has-text("{gender}"):visible',
                f'label:has-text("{gender}"):visible',
                f'div:has-text("{gender}")[role="button"]:visible',
                f'input[value="{gender.lower()}"]',
                f'[data-gender="{gender.lower()}"]'
            ]
            
            for i, selector in enumerate(gender_selectors):
                try:
                    print(f"[DEBUG] Trying gender selector {i+1}/{len(gender_selectors)}: {selector}")
                    element = await self.page.wait_for_selector(selector, timeout=3000)
                    if element and await element.is_visible():
                        await element.click()
                        print(f"[SUCCESS] {gender} Gender geklickt mit selector: {selector}")
                        gender_selected = True
                        break
                    else:
                        print(f"[DEBUG] Gender element found but not visible: {selector}")
                except Exception as e:
                    print(f"[DEBUG] Gender selector failed: {selector} - {str(e)}")
                    continue
            
            if not gender_selected:
                print("[WARNING] Gender-Auswahl fehlgeschlagen - probiere Fallback")
                # Fallback: click first available gender option
                try:
                    gender_options = await self.page.query_selector_all('span:has-text("Male"), span:has-text("Female")')
                    if gender_options:
                        await gender_options[0].click()
                        print("[OK] Fallback Gender ausgewählt")
                        gender_selected = True
                except:
                    pass
            
            await asyncio.sleep(1)
            
            # 2. Looking For selection WITH RADIO GROUP SELECTORS
            looking_for = random.choice(['Male', 'Female', 'Everyone'])
            print(f"Waehle Looking For aus: {looking_for}")
            
            looking_selected = False
            looking_selectors = [
                # EXACT SELECTOR FROM ERROR MESSAGE - CRITICAL FIX!
                '#radio-group\\:\\:r1\\:\\:radio\\:control\\:a',
                'span[id="radio-group::r1::radio:control:a"]',
                'span[data-scope="radio-group"][data-part="item-control"][id*="radio:control:a"]',
                # CHAKRA UI RADIO GROUP SELECTORS - CRITICAL FIX!
                f'span[data-scope="radio-group"][data-part="item-control"][data-state="unchecked"]',
                f'span[data-scope="radio-group"][data-part="item-control"]',
                f'[data-scope="radio-group"] span:has-text("{looking_for}")',
                f'[data-scope="radio-group"] label:has-text("{looking_for}")',
                f'[data-scope="radio-group"][data-part="item-control"] + *:has-text("{looking_for}")',
                # Original selectors as fallback
                f'span:has-text("{looking_for}"):visible',
                f'button:has-text("{looking_for}"):visible',
                f'label:has-text("{looking_for}"):visible',
                f'div:has-text("{looking_for}")[role="button"]:visible',
                f'span:has-text("Everyone"):visible',  # Fallback to Everyone
                f'[data-looking="{looking_for.lower()}"]'
            ]
            
            for i, selector in enumerate(looking_selectors):
                try:
                    print(f"[DEBUG] Trying looking-for selector {i+1}/{len(looking_selectors)}: {selector}")
                    element = await self.page.wait_for_selector(selector, timeout=3000)
                    if element and await element.is_visible():
                        await element.click()
                        print(f"[SUCCESS] {looking_for} Looking For geklickt mit selector: {selector}")
                        looking_selected = True
                        break
                    else:
                        print(f"[DEBUG] Looking-for element found but not visible: {selector}")
                except Exception as e:
                    print(f"[DEBUG] Looking-for selector failed: {selector} - {str(e)}")
                    continue
            
            if not looking_selected:
                print("[WARNING] Looking For-Auswahl fehlgeschlagen - probiere Fallback")
                try:
                    looking_options = await self.page.query_selector_all('span:has-text("Male"), span:has-text("Female"), span:has-text("Everyone")')
                    if looking_options:
                        await looking_options[0].click()
                        print("[OK] Fallback Looking For ausgewählt")
                        looking_selected = True
                except:
                    pass
            
            await asyncio.sleep(1)
            
            # 3. Birth date with enhanced selectors
            print(f"Fülle Geburtsdatum aus: {self.session_birth_date['day']}.{self.session_birth_date['month']}.{self.session_birth_date['year']}")
            
            birth_filled = False
            try:
                # Try multiple birth date selector strategies
                day_selectors = ['input[placeholder="DD"]', 'input[name="day"]', 'input[placeholder*="day"]']
                month_selectors = ['input[placeholder="MM"]', 'input[name="month"]', 'input[placeholder*="month"]']
                year_selectors = ['input[placeholder="YYYY"]', 'input[name="year"]', 'input[placeholder*="year"]']
                
                day_input = None
                month_input = None
                year_input = None
                
                for selector in day_selectors:
                    try:
                        day_input = await self.page.query_selector(selector)
                        if day_input and await day_input.is_visible():
                            break
                    except:
                        continue
                
                for selector in month_selectors:
                    try:
                        month_input = await self.page.query_selector(selector)
                        if month_input and await month_input.is_visible():
                            break
                    except:
                        continue
                
                for selector in year_selectors:
                    try:
                        year_input = await self.page.query_selector(selector)
                        if year_input and await year_input.is_visible():
                            break
                    except:
                        continue
                
                if day_input and month_input and year_input:
                    await day_input.fill(self.session_birth_date['day'])
                    await month_input.fill(self.session_birth_date['month'])
                    await year_input.fill(self.session_birth_date['year'])
                    print("[OK] Geburtsdatum ausgefüllt")
                    birth_filled = True
                else:
                    print("[WARNING] Nicht alle Geburtsdatum-Felder gefunden")
            except Exception as e:
                print(f"[WARNING] Fehler beim Geburtsdatum: {e}")
            
            await asyncio.sleep(1)
            
            # 4. Terms checkbox with multiple strategies
            print("Aktiviere Terms Checkbox...")
            terms_clicked = False
            terms_selectors = [
                'input[type="checkbox"]',
                'svg[data-state="unchecked"]',
                '.checkbox',
                '[role="checkbox"]',
                'label:has-text("terms"):visible',
                'label:has-text("agree"):visible'
            ]
            
            for selector in terms_selectors:
                try:
                    checkbox = await self.page.query_selector(selector)
                    if checkbox and await checkbox.is_visible():
                        await checkbox.click()
                        print("[OK] Terms Checkbox aktiviert")
                        terms_clicked = True
                        break
                except:
                    continue
            
            if not terms_clicked:
                print("[WARNING] Terms Checkbox nicht gefunden")
            
            await asyncio.sleep(1)
            
            # 5. Start button with enhanced detection - FIXED FOR EXACT SELECTOR
            print("Klicke Start Button...")
            start_clicked = False
            start_selectors = [
                'button[type="button"].chakra-button.css-fw0t89',  # EXACT selector you found!
                'button.chakra-button.css-fw0t89:has-text("Start")',
                'button.chakra-button:has-text("Start")',
                'button:has-text("Start"):visible',
                'button:has-text("Continue"):visible', 
                'button:has-text("Submit"):visible',
                'button:has-text("Enter"):visible',
                'button[type="submit"]:visible',
                'button[type="button"]:has-text("Start")',
                '.start-button:visible',
                '.submit-button:visible',
                'button.primary:visible'
            ]
            
            for i, selector in enumerate(start_selectors):
                try:
                    print(f"[DEBUG] Trying start button selector {i+1}/{len(start_selectors)}: {selector}")
                    start_btn = await self.page.wait_for_selector(selector, timeout=3000)
                    if start_btn and await start_btn.is_visible():
                        await start_btn.click()
                        print(f"[SUCCESS] Start Button geklickt mit selector: {selector}")
                        start_clicked = True
                        break
                    else:
                        print(f"[DEBUG] Start button found but not visible: {selector}")
                except Exception as e:
                    print(f"[DEBUG] Start button selector failed: {selector} - {str(e)}")
                    continue
            
            if not start_clicked:
                print("[WARNING] Start Button nicht gefunden - probiere Fallback")
                try:
                    # Fallback: find any button that might be the start button
                    buttons = await self.page.query_selector_all('button:visible')
                    for button in buttons:
                        text = await button.inner_text()
                        if any(word in text.lower() for word in ['start', 'continue', 'submit', 'enter']):
                            await button.click()
                            print(f"[OK] Fallback Start Button geklickt: {text}")
                            start_clicked = True
                            break
                except:
                    pass
            
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
    print('[DEBUG] Starte Enhanced Thundr Bot - DEBUG SINGLE CLIENT VERSION...')
    print('[DEBUG] This will run only 1 session with detailed step analysis')
    
    proxies = []
    print(f'Proxy-Liste: {len(proxies)} Proxys (Debug-Modus ohne Proxy)')
    
    messages = [
        "Write me on Snapchat for Free nude ;* Snapchat : LaLiLuLaara"
    ]
    
    bot = ThundrBot(proxies=proxies, messages=messages)
    max_sessions = 1  # Only 1 session for debugging
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