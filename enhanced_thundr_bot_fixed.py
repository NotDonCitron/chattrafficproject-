# -*- coding: utf-8 -*-
import os
import sys
from typing import Optional, List, Dict, Any

# Fix Windows Unicode encoding issues
if sys.platform.startswith('win'):
    # Force UTF-8 encoding for Windows
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

import asyncio
import random
import json
from datetime import datetime, timedelta
try:
    from playwright.async_api import async_playwright, Page, BrowserContext, Browser
except ImportError:
    print("Please install playwright: pip install playwright")
    sys.exit(1)
import logging

print('Script gestartet')

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ThundrBot:
    def __init__(self, proxies: Optional[List[Dict[str, Any]]] = None, messages: Optional[List[str]] = None):
        self.proxies = proxies or []
        self.current_proxy_index = 0
        self.messages = messages or ["Write me on Snapchat for Free nude ;* Snapchat : LaLiLuLaara"]
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        
        # Session-persistente Daten (bleiben für gesamte Browser-Session gleich)
        self.session_birth_date: Optional[Dict[str, str]] = None
        self.session_interests: Optional[List[str]] = None
        self.session_initialized = False
        
        # Pre-loaded interests cache
        self.interests_cache_file = "thundr_interests_cache.json"
        self.all_available_interests: List[str] = []
        self.interests_preloaded = False

    def save_interests_cache(self, interests: List[str]) -> None:
        """Speichere Interests in Cache-Datei"""
        try:
            with open(self.interests_cache_file, 'w', encoding='utf-8') as f:
                json.dump(interests, f, ensure_ascii=False, indent=2)
            print(f"[OK] {len(interests)} Interests im Cache gespeichert")
        except Exception as e:
            print(f"[WARNING] Fehler beim Speichern des Interest-Cache: {e}")

    def load_interests_cache(self) -> List[str]:
        """Lade Interests aus Cache-Datei"""
        try:
            if os.path.exists(self.interests_cache_file):
                with open(self.interests_cache_file, 'r', encoding='utf-8') as f:
                    interests = json.load(f)
                print(f"[OK] {len(interests)} Interests aus Cache geladen")
                return interests
        except Exception as e:
            print(f"[WARNING] Fehler beim Laden des Interest-Cache: {e}")
        return []

    def init_session_data(self) -> None:
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
            print(f"[TARGET] Session-Daten initialisiert:")
            if self.session_birth_date:
                print(f"   Geburtsdatum: {self.session_birth_date['day']}.{self.session_birth_date['month']}.{self.session_birth_date['year']}")
            if self.session_interests:
                print(f"   Interessen ({len(self.session_interests)}): {', '.join(self.session_interests[:5])}{'...' if len(self.session_interests) > 5 else ''}")

    def get_next_proxy(self) -> Optional[Dict[str, Any]]:
        if not self.proxies:
            return None
        proxy = self.proxies[self.current_proxy_index]
        self.current_proxy_index = (self.current_proxy_index + 1) % len(self.proxies)
        return proxy

    async def setup_browser(self, proxy: Optional[Dict[str, Any]] = None) -> None:
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
            
            console.log('[TARGET] WebRTC spoofing initialized - fake video warnings should be reduced');
        """)

    async def goto_thundr(self) -> bool:
        """1. Schritt: Seite laden"""
        if not self.page:
            return False
        
        assert self.page is not None  # Type checker hint
        try:
            print("Lade Thundr.com...")
            await self.page.goto('https://thundr.com/', wait_until='domcontentloaded')
            await asyncio.sleep(random.uniform(2, 4))
            
            # Screenshot nach dem Laden
            await self.page.screenshot(path=f"debug_step1_loaded_{int(datetime.now().timestamp())}.png")
            print("[OK] Seite geladen - Screenshot gespeichert")
            return True
        except Exception as e:
            print(f"[ERROR] Fehler beim Laden der Seite: {e}")
            return False

    async def lightning_fast_interest_selection(self) -> bool:
        """Lightning-Fast Interest Selection - Windows-compatible"""
        if not self.page:
            return False
        try:
            print("[FAST] Lightning-Fast Interest Selection...")
            
            # Verwende Session-Interests falls verfügbar
            if not self.session_interests:
                print("[WARNING] Keine Session-Interests verfügbar, verwende Fallback")
                return await self.select_interests_fallback()
            
            print(f"Waehle {len(self.session_interests)} Interests aus...")
            selected_count = 0
            
            for i, interest in enumerate(self.session_interests[:15]):  # Max 15 für Stabilität
                try:
                    # Verschiedene Selektoren probieren
                    selectors = [
                        f'li[role="option"]:has-text("{interest}")',
                        f'[role="option"]:has-text("{interest}")',
                        f'.chakra-menu__menuitem:has-text("{interest}")',
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
                                print(f"[OK] {interest} ({selected_count}/{len(self.session_interests)})")
                                break
                        except:
                            continue
                    
                    if not interest_found:
                        print(f"[WARNING] {interest} nicht gefunden")
                        
                except Exception as e:
                    print(f"[WARNING] Fehler bei {interest}: {e}")
                    continue
            
            print(f"[FAST] Lightning-Fast Selection abgeschlossen: {selected_count}/{len(self.session_interests)} Interests")
            return True
            
        except Exception as e:
            print(f"[ERROR] Fehler bei Lightning-Fast Selection: {e}")
            return await self.select_interests_fallback()

    async def select_interests_fallback(self) -> bool:
        """Fallback Interest Selection"""
        if not self.page:
            return False
        try:
            print("Fallback: Suche nach Interest-Buttons...")
            selected_count = 0
            
            fallback_interests = ["Gaming", "Music", "Movies", "Technology", "Sports"]
            
            for interest in fallback_interests:
                try:
                    selectors = [
                        f'button:has-text("{interest}")',
                        f'label:has-text("{interest}")',
                        f'div:has-text("{interest}")[role="button"]'
                    ]
                    
                    for selector in selectors:
                        try:
                            element = await self.page.wait_for_selector(selector, timeout=2000)
                            if element:
                                await element.click()
                                selected_count += 1
                                print(f"[OK] Interest-Button geklickt: {interest}")
                                await asyncio.sleep(random.uniform(0.5, 1))
                                break
                        except:
                            continue
                except:
                    continue
            
            print(f"[OK] Fallback: {selected_count} Interests ausgewählt")
            return True
            
        except Exception as e:
            print(f"[ERROR] Auch Fallback fehlgeschlagen: {e}")
            return False

    async def click_video_chat(self) -> bool:
        """Video Chat Button klicken"""
        if not self.page:
            return False
        try:
            print("Suche nach Video Chat Button...")
            await asyncio.sleep(1)
            
            video_chat_selectors = [
                'button:has-text("Video Chat")',
                'a:has-text("Video Chat")',
                '[data-action="video-chat"]',
                '.video-chat-button'
            ]
            
            for selector in video_chat_selectors:
                try:
                    button = await self.page.wait_for_selector(selector, timeout=3000)
                    if button and await button.is_visible():
                        await button.click()
                        print(f"[OK] Video Chat Button geklickt: {selector}")
                        await asyncio.sleep(random.uniform(2, 3))
                        return True
                except:
                    continue
            
            print("[ERROR] Video Chat Button nicht gefunden")
            return False
            
        except Exception as e:
            print(f"[ERROR] Fehler beim Video Chat Button: {e}")
            return False

    async def handle_i_agree_popup(self) -> bool:
        """I Agree Popup handhaben"""
        if not self.page:
            return True
        try:
            print("Suche nach 'I Agree' Popup...")
            await asyncio.sleep(2)
            
            agree_selectors = [
                'button:has-text("I Agree")',
                'button:has-text("Agree")',
                'button:has-text("Accept")',
                '.agree-button'
            ]
            
            for selector in agree_selectors:
                try:
                    agree_btn = await self.page.wait_for_selector(selector, timeout=3000)
                    if agree_btn and await agree_btn.is_visible():
                        await agree_btn.click()
                        print(f"[OK] 'I Agree' Popup geschlossen: {selector}")
                        await asyncio.sleep(1)
                        return True
                except:
                    continue
            
            print("[OK] Kein 'I Agree' Popup gefunden")
            return True
            
        except Exception as e:
            print(f"[WARNING] Fehler beim I Agree Popup: {e}")
            return True

    async def handle_fake_video_warnings(self) -> bool:
        """Handle fake video warnings"""
        if not self.page:
            return True
        try:
            print("[SHIELD] Pruefe auf Fake Video Warnings...")
            await asyncio.sleep(1)
            
            # Check for fake video warning indicators
            warning_selectors = [
                'text="fake video"',
                'text="Fake Video"',
                'text="fake camera"',
                '[data-warning="fake-video"]'
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

    async def fill_entry_form(self) -> bool:
        """Entry Form ausfüllen"""
        if not self.page or not self.session_birth_date:
            return False
        try:
            print("Fülle Entry Form aus...")
            
            # Gender selection
            gender = random.choice(['Male', 'Female'])
            print(f"Waehle Gender aus: {gender}")
            
            gender_selectors = [
                f'span[data-scope="chakra"]:has-text("{gender}")',
                f'button:has-text("{gender}")',
                f'input[value="{gender.lower()}"]'
            ]
            
            gender_selected = False
            for selector in gender_selectors:
                try:
                    if 'span[data-scope' in selector:
                        gender_spans = await self.page.query_selector_all(selector)
                        for span in gender_spans:
                            try:
                                label = await span.evaluate('el => el.parentElement?.textContent?.trim() || ""')
                                if gender.lower() in label.lower():
                                    await span.click()
                                    print(f"[OK] {gender} Gender geklickt (Chakra-Span)")
                                    gender_selected = True
                                    break
                            except:
                                continue
                    else:
                        element = await self.page.query_selector(selector)
                        if element and await element.is_visible():
                            await element.click()
                            print(f"[OK] {gender} Gender geklickt")
                            gender_selected = True
                            break
                except:
                    continue
                
                if gender_selected:
                    break
            
            if not gender_selected:
                print("[WARNING] Gender-Auswahl fehlgeschlagen")
            
            await asyncio.sleep(0.5)
            
            # Looking For selection
            looking_for = random.choice(['Male', 'Female', 'Everyone'])
            print(f"Waehle Looking For aus: {looking_for}")
            
            looking_for_selectors = [
                f'span[data-scope="chakra"]:has-text("{looking_for}")',
                f'button:has-text("{looking_for}")',
                f'input[value="{looking_for.lower()}"]'
            ]
            
            looking_selected = False
            for selector in looking_for_selectors:
                try:
                    if 'span[data-scope' in selector:
                        looking_spans = await self.page.query_selector_all(selector)
                        for span in looking_spans:
                            try:
                                label = await span.evaluate('el => el.parentElement?.textContent?.trim() || ""')
                                if any(word in label.lower() for word in [looking_for.lower(), 'everyone', 'alle', 'all']):
                                    await span.click()
                                    print(f"[OK] {looking_for} Looking For geklickt (Chakra-Span)")
                                    looking_selected = True
                                    break
                            except:
                                continue
                    else:
                        element = await self.page.query_selector(selector)
                        if element and await element.is_visible():
                            await element.click()
                            print(f"[OK] {looking_for} Looking For geklickt")
                            looking_selected = True
                            break
                except:
                    continue
                
                if looking_selected:
                    break
            
            if not looking_selected:
                print("[WARNING] Looking For-Auswahl fehlgeschlagen")
            
            await asyncio.sleep(0.5)
            
            # Geburtsdatum
            print(f"Fülle Geburtsdatum aus: {self.session_birth_date['day']}.{self.session_birth_date['month']}.{self.session_birth_date['year']}")
            
            # Try to fill birth date fields
            birth_filled = False
            try:
                day_input = await self.page.query_selector('input[placeholder="DD"], input[name="day"]')
                month_input = await self.page.query_selector('input[placeholder="MM"], input[name="month"]')
                year_input = await self.page.query_selector('input[placeholder="YYYY"], input[name="year"]')
                
                if day_input and month_input and year_input:
                    await day_input.fill(self.session_birth_date['day'])
                    await month_input.fill(self.session_birth_date['month'])
                    await year_input.fill(self.session_birth_date['year'])
                    print("[OK] Geburtsdatum ausgefüllt")
                    birth_filled = True
            except:
                pass
            
            if not birth_filled:
                print("[WARNING] Geburtsdatum-Felder nicht gefunden")
            
            await asyncio.sleep(0.5)
            
            # Terms Checkbox
            print("Aktiviere Terms Checkbox...")
            terms_selectors = [
                'svg[data-state="unchecked"]',
                'input[type="checkbox"][name*="terms"]',
                '.chakra-checkbox__control'
            ]
            
            terms_clicked = False
            for selector in terms_selectors:
                try:
                    checkbox = await self.page.query_selector(selector)
                    if checkbox and await checkbox.is_visible():
                        await checkbox.click()
                        print(f"[OK] Terms Checkbox aktiviert")
                        terms_clicked = True
                        break
                except:
                    continue
            
            if not terms_clicked:
                print("[WARNING] Terms Checkbox nicht gefunden")
            
            await asyncio.sleep(0.5)
            
            # Start Button
            print("Klicke Start Button...")
            start_selectors = [
                'button.chakra-button',
                'button:has-text("Start")',
                'button[type="submit"]'
            ]
            
            start_clicked = False
            for selector in start_selectors:
                try:
                    start_btn = await self.page.query_selector(selector)
                    if start_btn and await start_btn.is_visible():
                        await start_btn.click()
                        print("[OK] Start Button geklickt")
                        start_clicked = True
                        break
                except:
                    continue
            
            if not start_clicked:
                print("[WARNING] Start Button nicht gefunden")
            
            await asyncio.sleep(3)
            
            # Check for fake video warnings
            await self.handle_fake_video_warnings()
            
            # Screenshot
            await self.page.screenshot(path=f"debug_form_{int(datetime.now().timestamp())}.png")
            print("[OK] Entry Form ausgefüllt - Screenshot gespeichert")
            
            return True
            
        except Exception as e:
            print(f"[ERROR] Fehler beim Entry Form: {e}")
            return True

    async def chat_loop(self) -> bool:
        """Chat Loop"""
        if not self.page:
            return False
        try:
            print("[LOOP] Starte Chat-Loop...")
            chat_count = 0
            
            while True:
                chat_count += 1
                print(f"\n--- Chat #{chat_count} ---")
                
                # Check for fake video warnings
                await self.handle_fake_video_warnings()
                
                # Warte auf Chat-Partner
                print("Warte auf Chat-Partner...")
                partner_found = False
                
                partner_indicators = [
                    'input[placeholder*="message"]',
                    'textarea[placeholder*="message"]',
                    '.chat-input'
                ]
                
                chat_input = None
                for selector in partner_indicators:
                    try:
                        chat_input = await self.page.wait_for_selector(selector, timeout=90000)
                        if chat_input and await chat_input.is_visible():
                            print(f"[OK] Partner gefunden! Chat-Input bereit: {selector}")
                            partner_found = True
                            break
                    except:
                        continue
                
                if not partner_found or not chat_input:
                    print("[WARNING] Kein Chat-Partner nach 90 Sekunden gefunden.")
                    print("Browser wird geschlossen für Neustart.")
                    return False
                
                # Nachricht senden
                message = random.choice(self.messages)
                try:
                    await chat_input.fill(message)
                    await asyncio.sleep(random.uniform(0.5, 1))
                    await chat_input.press('Enter')
                    print(f"[OK] Nachricht gesendet: {message}")
                except Exception as e:
                    print(f"[WARNING] Fehler beim Nachricht senden: {e}")
                
                # 10 Sekunden warten
                print("[WAIT] Warte 10 Sekunden...")
                await asyncio.sleep(10)
                
                # ESC zweimal für neuen Partner
                print("Drücke ESC zweimal für neuen Partner...")
                try:
                    await self.page.keyboard.press('Escape')
                    await asyncio.sleep(0.5)
                    print("[OK] Erster ESC gedrückt")
                    
                    await self.page.keyboard.press('Escape')
                    await asyncio.sleep(1)
                    print("[OK] Zweiter ESC gedrückt")
                    
                    # Check for boost popup
                    await self.handle_boost_popup()
                    
                except Exception as e:
                    print(f"[WARNING] Fehler beim ESC drücken: {e}")
                
                # Kurz warten
                await asyncio.sleep(random.uniform(3, 6))
                
                # Screenshot alle 3 Chats
                if chat_count % 3 == 0:
                    await self.page.screenshot(path=f"debug_chat_{chat_count}_{int(datetime.now().timestamp())}.png")
                    print(f"[DEBUG] Screenshot nach {chat_count} Chats")
                
        except Exception as e:
            print(f"[ERROR] Fehler im Chat-Loop: {e}")
            return False

    async def handle_boost_popup(self) -> bool:
        """Handle Boost Popup"""
        if not self.page:
            return True
        try:
            print("[CHECK] Pruefe auf 'Buy A Boost' Popup...")
            await asyncio.sleep(2)
            
            maybe_later_selectors = [
                'button:has-text("Maybe Later")',
                'button:has-text("Later")'
            ]
            
            popup_found = False
            for selector in maybe_later_selectors:
                try:
                    maybe_later_btn = await self.page.query_selector(selector)
                    if maybe_later_btn and await maybe_later_btn.is_visible():
                        await maybe_later_btn.click()
                        print(f"[OK] 'Maybe Later' Button geklickt")
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

    async def cleanup(self) -> None:
        try:
            if self.page:
                await self.page.close()
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

    async def run_session(self, max_wait_time: int = 60) -> bool:
        """Hauptfunktion: Setup + Chat-Loop bis Timeout/Fehler"""
        proxy = self.get_next_proxy()
        if proxy:
            print(f"\n[Proxy] Verwende Proxy: {proxy['host']}:{proxy['port']}")
        else:
            print(f"\n[Kein Proxy] Direktverbindung")
            
        try:
            # Session-Daten initialisieren
            self.init_session_data()
            
            # Browser setup
            await self.setup_browser(proxy)
            print("Browser gestartet mit WebRTC-Spoofing...")
            
            # 1. Seite laden
            if not await self.goto_thundr():
                return False
            
            # 2. Interest Selection
            if not await self.lightning_fast_interest_selection():
                return False
            
            # 3. Video Chat Button
            if not await self.click_video_chat():
                return False
            
            # 4. I Agree Popup
            if not await self.handle_i_agree_popup():
                return False
            
            # 5. Entry Form
            if not await self.fill_entry_form():
                return False
            
            # 6. Chat-Loop
            chat_success = await self.chat_loop()
            
            if chat_success:
                print("[OK] Chat-Loop erfolgreich abgeschlossen!")
                return True
            else:
                print("[WARNING] Chat-Loop beendet (Timeout/Fehler)")
                return False
                
        except Exception as e:
            print(f"[ERROR] Session-Fehler: {e}")
            return False
        finally:
            await self.cleanup()
            print("Browser bereinigt.")

async def main() -> None:
    print('[ROCKET] Starte Enhanced Thundr Bot mit Lightning-Fast Interests & Fake-Video-Bypass...')
    
    # Ohne Proxys für ersten Test
    proxies: List[Dict[str, Any]] = []
    
    print(f'Proxy-Liste: {len(proxies)} Proxys (erste Session ohne Proxy)')
    
    messages = [
        "Write me on Snapchat for Free nude ;* Snapchat : LaLiLuLaara"
    ]
    
    bot = ThundrBot(proxies=proxies, messages=messages)
    max_sessions = 100
    session_count = 0
    
    while session_count < max_sessions:
        print(f"\n=== [LOOP] STARTE BOT-SESSION {session_count + 1}/{max_sessions} ===")
        
        try:
            success = await bot.run_session(max_wait_time=60)
            
            if success:
                print(f"[SUCCESS] Session {session_count + 1} erfolgreich abgeschlossen")
            else:
                print(f"[WARNING] Session {session_count + 1} beendet (Neustart nötig)")
            
        except Exception as e:
            print(f"[ERROR] Fehler in Session {session_count + 1}: {e}")
        
        session_count += 1
        
        # Pause zwischen Sessions
        if session_count < max_sessions:
            wait_time = random.uniform(3, 8)
            print(f"[WAIT] Warte {wait_time:.1f}s vor nächster Session...")
            await asyncio.sleep(wait_time)
    
    print("[FINISH] Alle Sessions abgeschlossen!")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f'[ERROR] Hauptprogramm-Fehler: {e}') 