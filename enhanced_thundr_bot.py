import asyncio
import random
import json
import os
from datetime import datetime, timedelta
from playwright.async_api import async_playwright
import logging

print('Script gestartet')

# Set up logging
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
        
        # Session-persistente Daten (bleiben für gesamte Browser-Session gleich)
        self.session_birth_date = None
        self.session_interests = None
        self.session_initialized = False
        
        # Pre-loaded interests cache
        self.interests_cache_file = "thundr_interests_cache.json"
        self.all_available_interests = []
        self.interests_preloaded = False

    def save_interests_cache(self, interests):
        """Speichere Interests in Cache-Datei"""
        try:
            with open(self.interests_cache_file, 'w', encoding='utf-8') as f:
                json.dump(interests, f, ensure_ascii=False, indent=2)
            print(f"✓ {len(interests)} Interests im Cache gespeichert")
        except Exception as e:
            print(f"⚠ Fehler beim Speichern des Interest-Cache: {e}")

    def load_interests_cache(self):
        """Lade Interests aus Cache-Datei"""
        try:
            if os.path.exists(self.interests_cache_file):
                with open(self.interests_cache_file, 'r', encoding='utf-8') as f:
                    interests = json.load(f)
                print(f"✓ {len(interests)} Interests aus Cache geladen")
                return interests
        except Exception as e:
            print(f"⚠ Fehler beim Laden des Interest-Cache: {e}")
        return []

    def init_session_data(self):
        """Initialisiere Session-Daten (einmal pro Browser-Session)"""
        if not self.session_initialized:
            # Zufälliges Geburtsdatum (18-25 Jahre)
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
            
            # Lade verfügbare Interests
            self.all_available_interests = self.load_interests_cache()
            
            # Wähle zufällige Interests für diese Session (3-33)
            if self.all_available_interests:
                max_interests = min(33, len(self.all_available_interests))
                num_interests = random.randint(3, max_interests)
                self.session_interests = random.sample(self.all_available_interests, num_interests)
            else:
                # Fallback falls Cache leer
                fallback_interests = ["Gaming", "Music", "Movies", "Sports", "Technology"]
                num_interests = random.randint(3, 5)
                self.session_interests = random.sample(fallback_interests, num_interests)
            
            self.session_initialized = True
            print(f"🎯 Session-Daten initialisiert:")
            print(f"   Geburtsdatum: {self.session_birth_date['day']}.{self.session_birth_date['month']}.{self.session_birth_date['year']}")
            print(f"   Interessen ({len(self.session_interests)}): {', '.join(self.session_interests[:5])}{'...' if len(self.session_interests) > 5 else ''}")

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
                '--use-fake-ui-for-media-stream',  # Automatische Kamera-Genehmigung
                '--use-fake-device-for-media-stream',  # Fake-Device verwenden
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
        
        # Grant permissions for Thundr
        await self.context.grant_permissions(['camera', 'microphone'], origin='https://thundr.com')
        
        # Advanced WebRTC spoofing and fake video warning bypass
        await self.page.add_init_script("""
            // 1. Remove webdriver detection
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            // 2. Fake realistic camera device
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
            
            // 3. Override getUserMedia to return realistic stream
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            navigator.mediaDevices.getUserMedia = async (constraints) => {
                console.log('getUserMedia called with:', constraints);
                try {
                    const stream = await originalGetUserMedia(constraints);
                    
                    // Mark stream as "real"
                    Object.defineProperty(stream, '__thundr_real_stream', { 
                        value: true, 
                        writable: false 
                    });
                    
                    return stream;
                } catch (error) {
                    console.log('getUserMedia error:', error);
                    throw error;
                }
            };
            
            // 4. Fake WebRTC fingerprinting protection
            const originalRTCPeerConnection = window.RTCPeerConnection;
            window.RTCPeerConnection = function(...args) {
                const pc = new originalRTCPeerConnection(...args);
                
                // Override getStats to return realistic camera info
                const originalGetStats = pc.getStats.bind(pc);
                pc.getStats = async function() {
                    const stats = await originalGetStats();
                    return stats;
                };
                
                return pc;
            };
            
            // 5. Override screen capture detection
            Object.defineProperty(screen, 'availWidth', { value: 1920 });
            Object.defineProperty(screen, 'availHeight', { value: 1080 });
            Object.defineProperty(screen, 'width', { value: 1920 });
            Object.defineProperty(screen, 'height', { value: 1080 });
            
            console.log('🎯 WebRTC spoofing initialized - fake video warnings should be reduced');
        """)

    async def goto_thundr(self):
        """1. Schritt: Seite laden"""
        try:
            print("Lade Thundr.com...")
            await self.page.goto('https://thundr.com/', wait_until='domcontentloaded')
            await asyncio.sleep(random.uniform(2, 4))
            
            # Screenshot nach dem Laden
            await self.page.screenshot(path=f"debug_step1_loaded_{int(datetime.now().timestamp())}.png")
            print("✓ Seite geladen - Screenshot gespeichert")
            return True
        except Exception as e:
            print(f"✗ Fehler beim Laden der Seite: {e}")
            return False

    async def preload_all_interests(self):
        """Preload alle verfügbaren Interests für Lightning-Fast Selection"""
        try:
            print("🚀 Preloading alle verfügbaren Interests...")
            
            # Erweiterte Selektoren für Interest-Input
            interest_input_selectors = [
                'input[placeholder="Type your interests..."]',
                'input[placeholder*="interest"]',
                'input[placeholder*="Interest"]',
                '.interest-input',
                'input[data-testid="interests"]',
                'input[type="text"]',  # Fallback
                '.chakra-input'  # Chakra UI fallback
            ]
            
            input_clicked = False
            for selector in interest_input_selectors:
                try:
                    interest_input = await self.page.wait_for_selector(selector, timeout=3000)
                    if interest_input and await interest_input.is_visible():
                        await interest_input.click()
                        print(f"✓ Interest-Input geklickt: {selector}")
                        input_clicked = True
                        break
                except:
                    continue
            
            if not input_clicked:
                print("⚠ Interest-Input nicht gefunden")
                return False
            
            # Warte auf Dropdown und lade alle Optionen
            await asyncio.sleep(2)  # Längere Wartezeit
            
            # Erweiterte Selektoren für Dropdown-Optionen
            dropdown_selectors = [
                'li[role="option"]',
                '[role="option"]',
                '.chakra-menu__menuitem',
                '.dropdown-option',
                '.interest-option',
                'div[role="button"]',  # Fallback
                'button[data-interest]'  # Fallback
            ]
            
            options_found = False
            interest_elements = []
            
            for selector in dropdown_selectors:
                try:
                    await self.page.wait_for_selector(selector, timeout=3000)
                    interest_elements = await self.page.query_selector_all(selector)
                    if interest_elements:
                        print(f"✓ {len(interest_elements)} Interest-Optionen gefunden mit: {selector}")
                        options_found = True
                        break
                except:
                    continue
            
            if not options_found or not interest_elements:
                print("⚠ Keine Interest-Optionen gefunden, verwende Fallback-Liste")
                # Fallback: Standard-Interests definieren
                fallback_interests = [
                    "Music", "Movies", "Sports", "Technology", "Gaming", "Art", "Travel", "Food",
                    "Photography", "Dancing", "Fitness", "Fashion", "Nature", "Cooking", "Animals",
                    "Comedy", "Science", "History", "Languages", "Yoga", "Shopping", "Cars", "Books"
                ]
                self.all_available_interests = fallback_interests
                self.save_interests_cache(fallback_interests)
                print(f"✓ {len(fallback_interests)} Fallback-Interests geladen")
                return True
            
            # Extrahiere alle verfügbaren Interests
            all_interests = []
            for elem in interest_elements:
                try:
                    text = await elem.inner_text()
                    clean_text = text.strip()
                    if clean_text and len(clean_text) < 50 and clean_text not in all_interests:
                        all_interests.append(clean_text)
                except:
                    continue
            
            if all_interests:
                self.all_available_interests = all_interests
                self.save_interests_cache(all_interests)
                print(f"✓ {len(all_interests)} Interests erfolgreich preloaded!")
                print(f"   Erste 10: {', '.join(all_interests[:10])}")
                
                # Update Session-Interests mit neuen Daten
                if not self.session_interests:
                    max_interests = min(33, len(all_interests))
                    num_interests = random.randint(5, max_interests)
                    self.session_interests = random.sample(all_interests, num_interests)
                    print(f"   Session-Interests aktualisiert: {num_interests} ausgewählt")
                
                self.interests_preloaded = True
                return True
            else:
                print("⚠ Keine gültigen Interests extrahiert")
                return False
                
        except Exception as e:
            print(f"✗ Fehler beim Preloading: {e}")
            return False

    async def lightning_fast_interest_selection(self):
        """2. Schritt: Lightning-Fast Interest Selection (bis zu 33 auf einmal)"""
        try:
            print("⚡ Lightning-Fast Interest Selection...")
            
            # Falls Interests noch nicht preloaded, versuche es jetzt
            if not self.interests_preloaded and self.all_available_interests:
                print("Verwende gecachte Interests...")
            elif not self.interests_preloaded:
                print("Preloading Interests...")
                if not await self.preload_all_interests():
                    print("⚠ Preloading fehlgeschlagen, verwende Fallback")
                    return await self.select_interests_fallback()
            
            if not self.session_interests:
                print("⚠ Keine Session-Interests verfügbar, verwende Fallback")
                return await self.select_interests_fallback()
            
            # Stelle sicher, dass Dropdown offen ist
            try:
                input_selectors = [
                    'input[placeholder="Type your interests..."]',
                    'input[placeholder*="interest"]',
                    '.interest-input',
                    'input[type="text"]'
                ]
                
                for selector in input_selectors:
                    try:
                        input_elem = await self.page.query_selector(selector)
                        if input_elem and await input_elem.is_visible():
                            await input_elem.click()
                            await asyncio.sleep(1)
                            break
                    except:
                        continue
            except:
                pass
            
            # Super-schnelle Auswahl aller Session-Interests
            selected_count = 0
            max_selections = min(len(self.session_interests), 20)  # Reduziert auf 20 für Stabilität
            
            print(f"Wähle {max_selections} Interests aus...")
            
            for i, interest in enumerate(self.session_interests[:max_selections]):
                try:
                    # Verschiedene schnelle Selektoren
                    selectors = [
                        f'li[role="option"]:has-text("{interest}")',
                        f'[role="option"]:has-text("{interest}")',
                        f'.chakra-menu__menuitem:has-text("{interest}")',
                        f'[data-value="{interest.lower()}"]',
                        f'div:has-text("{interest}")[role="button"]',
                        f'button:has-text("{interest}")'
                    ]
                    
                    interest_found = False
                    for selector in selectors:
                        try:
                            option = await self.page.query_selector(selector)
                            if option and await option.is_visible():
                                await option.click()
                                selected_count += 1
                                interest_found = True
                                
                                # Kurze Pause alle 5 Klicks
                                if selected_count % 5 == 0:
                                    await asyncio.sleep(0.2)
                                break
                        except:
                            continue
                    
                    if interest_found:
                        print(f"✓ {interest} ({selected_count}/{max_selections})")
                    else:
                        # Fallback: Suche ohne has-text
                        try:
                            fallback_options = await self.page.query_selector_all('li[role="option"], [role="option"]')
                            for option in fallback_options[:3]:  # Nur erste 3 probieren
                                try:
                                    text = await option.inner_text()
                                    if interest.lower() in text.lower():
                                        await option.click()
                                        selected_count += 1
                                        print(f"✓ {interest} (Fallback-Match)")
                                        interest_found = True
                                        break
                                except:
                                    continue
                        except:
                            pass
                        
                        if not interest_found:
                            print(f"⚠ {interest} nicht gefunden")
                        
                except Exception as e:
                    print(f"⚠ Fehler bei {interest}: {e}")
                    continue
            
            # Screenshot nach Lightning-Selection
            await self.page.screenshot(path=f"debug_step2_lightning_{int(datetime.now().timestamp())}.png")
            print(f"⚡ Lightning-Fast Selection abgeschlossen: {selected_count}/{max_selections} Interests")
            
            # Auch bei 0 Interests weitermachen (manche Sites funktionieren ohne)
            return True
            
        except Exception as e:
            print(f"✗ Fehler bei Lightning-Fast Selection: {e}")
            return await self.select_interests_fallback()

    async def select_interests_fallback(self):
        """Fallback: Interesse-Buttons direkt anklicken"""
        try:
            print("Fallback: Suche nach Interest-Buttons...")
            selected_count = 0
            
            fallback_interests = ["Gaming", "Music", "Movies", "Technology", "Sports"]
            
            for interest in fallback_interests:
                try:
                    selectors = [
                        f'button:has-text("{interest}")',
                        f'[data-interest="{interest.lower()}"]',
                        f'label:has-text("{interest}")',
                        f'div:has-text("{interest}")[role="button"]'
                    ]
                    
                    for selector in selectors:
                        try:
                            element = await self.page.wait_for_selector(selector, timeout=2000)
                            if element:
                                await element.click()
                                selected_count += 1
                                print(f"✓ Interest-Button geklickt: {interest}")
                                await asyncio.sleep(random.uniform(0.5, 1))
                                break
                        except:
                            continue
                except:
                    continue
            
            print(f"✓ Fallback: {selected_count} Interests ausgewählt")
            return True
            
        except Exception as e:
            print(f"✗ Auch Fallback fehlgeschlagen: {e}")
            return False

    async def click_video_chat(self):
        """3. Schritt: Video Chat Button klicken"""
        try:
            print("Suche nach Video Chat Button...")
            await asyncio.sleep(1)
            
            video_chat_selectors = [
                'button:has-text("Video Chat")',
                'a:has-text("Video Chat")',
                '[data-action="video-chat"]',
                '.video-chat-button',
                'button[class*="video"]',
                'button:has-text("Start Video")',
                'div:has-text("Video Chat")[role="button"]'
            ]
            
            for selector in video_chat_selectors:
                try:
                    button = await self.page.wait_for_selector(selector, timeout=3000)
                    if button and await button.is_visible():
                        await button.click()
                        print(f"✓ Video Chat Button geklickt: {selector}")
                        await asyncio.sleep(random.uniform(2, 3))
                        
                        await self.page.screenshot(path=f"debug_step3_videochat_{int(datetime.now().timestamp())}.png")
                        return True
                except:
                    continue
            
            print("✗ Video Chat Button nicht gefunden")
            await self.page.screenshot(path=f"debug_step3_failed_{int(datetime.now().timestamp())}.png")
            return False
        except Exception as e:
            print(f"✗ Fehler beim Video Chat Klick: {e}")
            return False

    async def handle_i_agree_popup(self):
        """4. Schritt: I Agree Popup schließen"""
        try:
            print("Suche nach 'I Agree' Popup...")
            await asyncio.sleep(1)
            
            agree_selectors = [
                'button:has-text("I Agree")',
                'button:has-text("Agree")',
                'button:has-text("Accept")',
                '[data-action="agree"]',
                'button[class*="agree"]'
            ]
            
            for selector in agree_selectors:
                try:
                    button = await self.page.wait_for_selector(selector, timeout=3000)
                    if button and await button.is_visible():
                        await button.click()
                        print(f"✓ 'I Agree' Popup geschlossen: {selector}")
                        await asyncio.sleep(random.uniform(1, 2))
                        
                        await self.page.screenshot(path=f"debug_step4_agreed_{int(datetime.now().timestamp())}.png")
                        return True
                except:
                    continue
            
            print("ℹ Kein 'I Agree' Popup gefunden (möglicherweise nicht nötig)")
            return True
        except Exception as e:
            print(f"✗ Fehler beim Popup schließen: {e}")
            return False

    async def handle_fake_video_warnings(self):
        """Handle "fake video" warnings automatisch"""
        try:
            print("🛡️ Prüfe auf Fake Video Warnings...")
            
            # Verschiedene Warning-Nachrichten die erscheinen können
            warning_texts = [
                "this user may be using a fake video",
                "fake video",
                "virtual camera",
                "suspicious video",
                "artificial video"
            ]
            
            warning_found = False
            for warning_text in warning_texts:
                try:
                    warning_element = await self.page.query_selector(f'text="{warning_text}"')
                    if warning_element and await warning_element.is_visible():
                        print(f"⚠️ Fake Video Warning gefunden: {warning_text}")
                        warning_found = True
                        break
                except:
                    continue
            
            if warning_found:
                # Versuche Warning zu schließen
                dismiss_selectors = [
                    'button:has-text("Continue")',
                    'button:has-text("Dismiss")',
                    'button:has-text("OK")',
                    'button:has-text("Close")',
                    'button:has-text("X")',
                    '[data-action="dismiss"]',
                    '.close-button',
                    '.dismiss-button'
                ]
                
                for selector in dismiss_selectors:
                    try:
                        dismiss_btn = await self.page.query_selector(selector)
                        if dismiss_btn and await dismiss_btn.is_visible():
                            await dismiss_btn.click()
                            print(f"✓ Warning dismissed: {selector}")
                            await asyncio.sleep(1)
                            return True
                    except:
                        continue
                
                print("⚠️ Warning gefunden aber konnte nicht dismissed werden")
                # Screenshot für Debugging
                await self.page.screenshot(path=f"debug_fake_video_warning_{int(datetime.now().timestamp())}.png")
            else:
                print("✓ Keine Fake Video Warnings gefunden")
            
            return True
            
        except Exception as e:
            print(f"⚠️ Fehler beim Warning-Check: {e}")
            return True  # Nicht kritisch, weiter machen

    async def fill_entry_form(self):
        """5. Schritt: Entry Form ausfüllen (mit Session-Daten)"""
        try:
            print("Fülle Entry Form aus...")
            await asyncio.sleep(3)  # Längere Wartezeit für Form-Load
            
            # Screenshot vor dem Ausfüllen
            await self.page.screenshot(path=f"debug_step5_before_form_{int(datetime.now().timestamp())}.png")
            
            # 1. Gender auswählen (erweiterte Selektoren)
            gender = random.choice(['Female', 'Male'])
            print(f"Wähle Gender aus: {gender}")
            gender_selected = False
            
            # Erweiterte Gender-Selektoren
            gender_selectors = [
                'span[data-scope="radio-group"][data-part="item-control"]',
                'input[type="radio"][name*="gender"]',
                'input[type="radio"][name*="sex"]',
                'button[data-gender]',
                '.gender-option',
                '.radio-button',
                'label[for*="gender"]',
                f'button:has-text("{gender}")',
                f'div:has-text("{gender}")[role="button"]'
            ]
            
            for selector in gender_selectors:
                try:
                    if 'span[data-scope' in selector:
                        # Original Chakra UI Logic
                        gender_spans = await self.page.query_selector_all(selector)
                        for span in gender_spans:
                            try:
                                label = await span.evaluate('el => el.parentElement?.textContent?.trim() || ""')
                                if gender.lower() in label.lower():
                                    await span.click()
                                    print(f"✓ {gender} Gender geklickt (Chakra-Span)")
                                    gender_selected = True
                                    break
                            except:
                                continue
                    else:
                        # Alternative Selektoren
                        elements = await self.page.query_selector_all(selector)
                        for elem in elements:
                            try:
                                text = await elem.inner_text() or await elem.get_attribute('value') or ""
                                if gender.lower() in text.lower():
                                    await elem.click()
                                    print(f"✓ {gender} Gender geklickt ({selector})")
                                    gender_selected = True
                                    break
                            except:
                                continue
                    
                    if gender_selected:
                        break
                except:
                    continue
            
            if not gender_selected:
                print("⚠ Gender-Auswahl fehlgeschlagen")
            
            await asyncio.sleep(0.5)
            
            # 2. Looking For auswählen (erweiterte Selektoren)
            looking_for = random.choice(['Everyone', 'Male', 'Female'])
            print(f"Wähle Looking For aus: {looking_for}")
            looking_selected = False
            
            looking_for_selectors = [
                'span[data-scope="radio-group"][data-part="item-control"]',
                'input[type="radio"][name*="looking"]',
                'input[type="radio"][name*="seeking"]',
                'button[data-looking]',
                '.looking-option',
                f'button:has-text("{looking_for}")',
                f'button:has-text("Everyone")',
                f'div:has-text("{looking_for}")[role="button"]'
            ]
            
            for selector in looking_for_selectors:
                try:
                    if 'span[data-scope' in selector:
                        # Chakra UI spans
                        looking_spans = await self.page.query_selector_all(selector)
                        for span in looking_spans:
                            try:
                                label = await span.evaluate('el => el.parentElement?.textContent?.trim() || ""')
                                if any(word in label.lower() for word in [looking_for.lower(), 'everyone', 'alle', 'all']):
                                    await span.click()
                                    print(f"✓ {looking_for} Looking For geklickt (Chakra-Span)")
                                    looking_selected = True
                                    break
                            except:
                                continue
                    else:
                        # Alternative Selektoren
                        elements = await self.page.query_selector_all(selector)
                        for elem in elements:
                            try:
                                text = await elem.inner_text() or await elem.get_attribute('value') or ""
                                if any(word in text.lower() for word in [looking_for.lower(), 'everyone', 'alle', 'all']):
                                    await elem.click()
                                    print(f"✓ {looking_for} Looking For geklickt ({selector})")
                                    looking_selected = True
                                    break
                            except:
                                continue
                    
                    if looking_selected:
                        break
                except:
                    continue
            
            if not looking_selected:
                print("⚠ Looking For-Auswahl fehlgeschlagen")
            
            await asyncio.sleep(0.5)
            
            # 3. Geburtsdatum (erweiterte Selektoren)
            print(f"Fülle Geburtsdatum aus: {self.session_birth_date['day']}.{self.session_birth_date['month']}.{self.session_birth_date['year']}")
            
            birth_date_selectors = [
                # Standard Selektoren
                ('input[placeholder="DD"], input[name="day"], input[id*="day"]', 'day'),
                ('input[placeholder="MM"], input[name="month"], input[id*="month"]', 'month'), 
                ('input[placeholder="YYYY"], input[name="year"], input[id*="year"]', 'year'),
                # Chakra UI Selektoren
                ('.chakra-input[placeholder="DD"]', 'day'),
                ('.chakra-input[placeholder="MM"]', 'month'),
                ('.chakra-input[placeholder="YYYY"]', 'year'),
                # Fallback Selektoren
                ('input[type="number"]:nth-of-type(1)', 'day'),
                ('input[type="number"]:nth-of-type(2)', 'month'),
                ('input[type="number"]:nth-of-type(3)', 'year'),
                ('input[type="text"]:nth-of-type(1)', 'day'),
                ('input[type="text"]:nth-of-type(2)', 'month'),
                ('input[type="text"]:nth-of-type(3)', 'year')
            ]
            
            birth_filled = False
            for day_sel, month_sel, year_sel in [
                ('input[placeholder="DD"], input[name="day"], input[id*="day"]',
                 'input[placeholder="MM"], input[name="month"], input[id*="month"]',
                 'input[placeholder="YYYY"], input[name="year"], input[id*="year"]'),
                ('.chakra-input[placeholder="DD"]', '.chakra-input[placeholder="MM"]', '.chakra-input[placeholder="YYYY"]'),
                ('input[type="number"]:nth-of-type(1)', 'input[type="number"]:nth-of-type(2)', 'input[type="number"]:nth-of-type(3)')
            ]:
                try:
                    day_input = await self.page.query_selector(day_sel)
                    month_input = await self.page.query_selector(month_sel)
                    year_input = await self.page.query_selector(year_sel)
                    
                    if day_input and month_input and year_input:
                        await day_input.fill(self.session_birth_date['day'])
                        await month_input.fill(self.session_birth_date['month'])
                        await year_input.fill(self.session_birth_date['year'])
                        print(f"✓ Geburtsdatum ausgefüllt ({day_sel[:20]}...)")
                        birth_filled = True
                        break
                except:
                    continue
            
            if not birth_filled:
                print("⚠ Geburtsdatum-Felder nicht gefunden")
            
            await asyncio.sleep(0.5)
            
            # 4. Terms Checkbox (erweiterte Selektoren)
            print("Aktiviere Terms Checkbox...")
            terms_selectors = [
                'svg[data-state="unchecked"].css-wuqtn7',
                'input[type="checkbox"][name*="terms"]',
                'input[type="checkbox"][name*="agree"]',
                'input[type="checkbox"][id*="terms"]',
                '.chakra-checkbox__control',
                '.checkbox-control',
                'label[for*="terms"]',
                'button[role="checkbox"]',
                '.terms-checkbox'
            ]
            
            terms_clicked = False
            for selector in terms_selectors:
                try:
                    checkbox = await self.page.query_selector(selector)
                    if checkbox and await checkbox.is_visible():
                        await checkbox.click()
                        print(f"✓ Terms Checkbox aktiviert ({selector[:30]}...)")
                        terms_clicked = True
                        break
                except:
                    continue
            
            if not terms_clicked:
                print("⚠ Terms Checkbox nicht gefunden")
            
            await asyncio.sleep(0.5)
            
            # 5. Start Button (erweiterte Selektoren)
            print("Klicke Start Button...")
            start_selectors = [
                'button.chakra-button.css-fw0t89',
                'button:has-text("Start")',
                'button:has-text("Continue")',
                'button:has-text("Submit")',
                'button:has-text("Enter")',
                'button:has-text("Join")',
                'button[type="submit"]',
                '.start-button',
                '.submit-button',
                '.continue-button',
                'input[type="submit"]',
                'button.primary-button',
                '.chakra-button[type="submit"]'
            ]
            
            start_clicked = False
            for selector in start_selectors:
                try:
                    start_btn = await self.page.query_selector(selector)
                    if start_btn and await start_btn.is_visible():
                        await start_btn.click()
                        print(f"✓ Start Button geklickt ({selector[:30]}...)")
                        start_clicked = True
                        break
                except:
                    continue
            
            if not start_clicked:
                print("⚠ Start Button nicht gefunden")
            
            await asyncio.sleep(3)  # Längere Wartezeit nach Submit
            
            # Check for fake video warnings nach Start
            await self.handle_fake_video_warnings()
            
            # Screenshot nach dem Ausfüllen
            await self.page.screenshot(path=f"debug_step5_after_form_{int(datetime.now().timestamp())}.png")
            print("✓ Entry Form ausgefüllt - Screenshot gespeichert")
            
            # Auch ohne perfekte Form-Ausfüllung weitermachen
            return True
            
        except Exception as e:
            print(f"✗ Fehler beim Entry Form: {e}")
            await self.page.screenshot(path=f"debug_step5_error_{int(datetime.now().timestamp())}.png")
            return True  # Trotzdem weitermachen

    async def chat_loop(self):
        """6. Schritt: Endlos-Chat-Loop (Nachricht → 10s → ESC zweimal → neuer Partner)"""
        try:
            print("🔄 Starte Chat-Loop...")
            chat_count = 0
            
            while True:
                chat_count += 1
                print(f"\n--- Chat #{chat_count} ---")
                
                # Check for fake video warnings vor jedem Chat
                await self.handle_fake_video_warnings()
                
                # 1. Warte auf Chat-Partner (erweiterte Selektoren, längere Wartezeit)
                print("Warte auf Chat-Partner...")
                partner_found = False
                
                partner_indicators = [
                    'input[placeholder*="message"]',
                    'textarea[placeholder*="message"]',
                    'input[placeholder*="Message"]',
                    'input[placeholder*="Type"]',
                    '.chat-input',
                    '.message-input',
                    'input[type="text"]',
                    '.chakra-input',
                    '[data-testid="chat-input"]',
                    '[role="textbox"]'
                ]
                
                # Längere Wartezeit: 90 Sekunden statt 60
                for selector in partner_indicators:
                    try:
                        chat_input = await self.page.wait_for_selector(selector, timeout=90000)
                        if chat_input and await chat_input.is_visible():
                            print(f"✓ Partner gefunden! Chat-Input bereit: {selector}")
                            partner_found = True
                            break
                    except:
                        continue
                
                if not partner_found:
                    print("⚠ Kein Chat-Partner nach 90 Sekunden gefunden.")
                    # Versuche Browser zu refreshen oder Neustart
                    try:
                        await self.page.reload(wait_until='domcontentloaded')
                        print("🔄 Seite neu geladen, versuche erneut...")
                        await asyncio.sleep(5)
                        continue
                    except:
                        print("Browser wird geschlossen für Neustart.")
                        return False
                
                # 2. Nachricht senden
                message = random.choice(self.messages)
                try:
                    await chat_input.fill(message)
                    await asyncio.sleep(random.uniform(0.5, 1))
                    
                    # Verschiedene Wege Enter zu drücken
                    try:
                        await chat_input.press('Enter')
                    except:
                        try:
                            await self.page.keyboard.press('Enter')
                        except:
                            # Fallback: Submit Button suchen
                            submit_btn = await self.page.query_selector('button[type="submit"], .send-button, button:has-text("Send")')
                            if submit_btn:
                                await submit_btn.click()
                    
                    print(f"✓ Nachricht gesendet: {message}")
                except Exception as e:
                    print(f"⚠ Fehler beim Nachricht senden: {e}")
                
                # 3. 10 Sekunden warten
                print("⏳ Warte 10 Sekunden...")
                await asyncio.sleep(10)
                
                # 4. ESC zweimal drücken für neuen Chat-Partner (neue Logik)
                print("Drücke ESC zweimal für neuen Partner...")
                try:
                    # Erster ESC
                    await self.page.keyboard.press('Escape')
                    await asyncio.sleep(0.5)
                    print("✓ Erster ESC gedrückt")
                    
                    # Zweiter ESC  
                    await self.page.keyboard.press('Escape')
                    await asyncio.sleep(1)
                    print("✓ Zweiter ESC gedrückt")
                    
                    # Prüfe auf "Buy A Boost" Popup
                    await self.handle_boost_popup()
                    
                except Exception as e:
                    print(f"⚠ Fehler beim ESC drücken: {e}")
                    # Fallback: Versuche alte Next-Button Methode
                    await self.try_next_button_fallback()
                
                # 5. Kurz warten vor nächster Iteration
                await asyncio.sleep(random.uniform(3, 6))
                
                # Gelegentlicher Screenshot für Debugging
                if chat_count % 3 == 0:  # Alle 3 Chats statt 5
                    await self.page.screenshot(path=f"debug_chat_loop_{chat_count}_{int(datetime.now().timestamp())}.png")
                    print(f"📸 Debug-Screenshot nach {chat_count} Chats")
                
        except Exception as e:
            print(f"✗ Fehler im Chat-Loop: {e}")
            return False

    async def handle_boost_popup(self):
        """Handle 'Buy A Boost' Popup falls es erscheint"""
        try:
            print("🔍 Prüfe auf 'Buy A Boost' Popup...")
            
            # Warte kurz auf mögliches Popup
            await asyncio.sleep(2)
            
            # Verschiedene Selektoren für "Maybe Later" Button
            maybe_later_selectors = [
                'button.chakra-button.css-1xee04p:has-text("Maybe Later")',
                'button:has-text("Maybe Later")',
                'button[class*="chakra-button"]:has-text("Maybe Later")',
                '.chakra-button:has-text("Maybe Later")',
                'button:has-text("Later")',
                '[data-testid="maybe-later"]'
            ]
            
            popup_found = False
            for selector in maybe_later_selectors:
                try:
                    maybe_later_btn = await self.page.query_selector(selector)
                    if maybe_later_btn and await maybe_later_btn.is_visible():
                        await maybe_later_btn.click()
                        print(f"✓ 'Maybe Later' Button geklickt: {selector}")
                        popup_found = True
                        await asyncio.sleep(1)
                        break
                except:
                    continue
            
            if not popup_found:
                # Prüfe allgemein auf Boost-Popup-Texte
                boost_indicators = [
                    'text="Buy A Boost"',
                    'text="Boost Your Matches"',
                    'text="Buy 1 Boost"'
                ]
                
                for indicator in boost_indicators:
                    try:
                        popup_element = await self.page.query_selector(f'[{indicator}]')
                        if popup_element and await popup_element.is_visible():
                            print("⚠ Boost-Popup gefunden aber 'Maybe Later' nicht gefunden")
                            # Versuche ESC um Popup zu schließen
                            await self.page.keyboard.press('Escape')
                            print("✓ ESC zum Popup schließen gedrückt")
                            popup_found = True
                            break
                    except:
                        continue
            
            if not popup_found:
                print("✓ Kein 'Buy A Boost' Popup gefunden")
            
            return True
            
        except Exception as e:
            print(f"⚠ Fehler beim Boost-Popup-Handling: {e}")
            return True  # Nicht kritisch, weiter machen

    async def try_next_button_fallback(self):
        """Fallback: Alte Next-Button Methode falls ESC nicht funktioniert"""
        try:
            print("🔄 Fallback: Suche Next-Button...")
            next_button_selectors = [
                'button.chakra-button.css-1nb04tj',
                'button:has-text("Next")',
                'button:has-text("Skip")',
                'button:has-text("New")',
                'button:has-text("►")',
                'button:has-text("⏭")',
                '.next-button',
                '.skip-button',
                '.swipe-button',
                '[data-action="next"]',
                '[data-action="skip"]',
                '[data-testid="next"]',
                'button[title*="next"]',
                'button[title*="skip"]'
            ]
            
            for selector in next_button_selectors:
                try:
                    next_btn = await self.page.query_selector(selector)
                    if next_btn and await next_btn.is_visible():
                        await next_btn.click()
                        print(f"✓ Fallback Next-Button geklickt: {selector}")
                        return True
                except:
                    continue
            
            print("⚠ Auch Fallback Next-Button nicht gefunden")
            return False
            
        except Exception as e:
            print(f"⚠ Fehler beim Fallback: {e}")
            return False

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
        """Hauptfunktion: Setup + Chat-Loop bis Timeout/Fehler"""
        proxy = self.get_next_proxy()
        if proxy:
            print(f"\n[Proxy] Verwende Proxy: {proxy['host']}:{proxy['port']}")
        else:
            print(f"\n[Kein Proxy] Direktverbindung")
            
        try:
            # Session-Daten initialisieren
            self.init_session_data()
            
            # Browser setup mit verbessertem Fake-Video-Bypass
            await self.setup_browser(proxy)
            print("Browser gestartet mit WebRTC-Spoofing...")
            
            # 1. Seite laden
            if not await self.goto_thundr():
                return False
            
            # 2. Lightning-Fast Interest Selection (preload + select bis zu 33)
            if not await self.lightning_fast_interest_selection():
                return False
            
            # 3. Video Chat Button klicken
            if not await self.click_video_chat():
                return False
            
            # 4. I Agree Popup schließen
            if not await self.handle_i_agree_popup():
                return False
            
            # 5. Entry Form ausfüllen
            if not await self.fill_entry_form():
                return False
            
            # 6. Chat-Loop starten (läuft bis Timeout/Fehler)
            chat_success = await self.chat_loop()
            
            if chat_success:
                print("✓ Chat-Loop erfolgreich abgeschlossen!")
                return True
            else:
                print("⚠ Chat-Loop beendet (Timeout/Fehler)")
                return False
                
        except Exception as e:
            print(f"✗ Session-Fehler: {e}")
            await self.page.screenshot(path=f"debug_session_error_{int(datetime.now().timestamp())}.png")
            return False
        finally:
            await self.cleanup()
            print("Browser bereinigt.")

async def main():
    print('🚀 Starte Enhanced Thundr Bot mit Lightning-Fast Interests & Fake-Video-Bypass...')
    
    # Ohne Proxys für ersten Test
    proxies = []
    
    print(f'Proxy-Liste: {len(proxies)} Proxys (erste Session ohne Proxy)')
    
    messages = [
        "Write me on Snapchat for Free nude ;* Snapchat : LaLiLuLaara"
    ]
    
    bot = ThundrBot(proxies=proxies, messages=messages)
    max_sessions = 100  # Viele Sessions für kontinuierliches Laufen
    session_count = 0
    
    while session_count < max_sessions:
        print(f"\n=== 🔄 STARTE BOT-SESSION {session_count + 1}/{max_sessions} ===")
        
        try:
            # Jede Session läuft bis zum Timeout, dann Neustart
            success = await bot.run_session(max_wait_time=60)
            
            if success:
                print(f"✅ Session {session_count + 1} erfolgreich abgeschlossen")
            else:
                print(f"⚠️ Session {session_count + 1} beendet (Neustart nötig)")
            
        except Exception as e:
            print(f"❌ Fehler in Session {session_count + 1}: {e}")
        
        session_count += 1
        
        # Kurze Pause zwischen Sessions
        if session_count < max_sessions:
            wait_time = random.uniform(3, 8)
            print(f"⏳ Warte {wait_time:.1f}s vor nächster Session...")
            await asyncio.sleep(wait_time)
    
    print("🏁 Alle Sessions abgeschlossen!")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f'❌ Hauptprogramm-Fehler: {e}') 